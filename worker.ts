// worker.ts — iRouter v3.6.0 (Cloudflare Workers + D1)
// 相比 v3.0 (KV 版) 的变化：存储层从 Deno KV / Workers KV 全部迁移到 D1 (db.ts)
// Hono 路由定义、API 路径、前端 dashboard.html 完全不变（路由层/前端零改动）

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import * as db from './db';
import type { D1Database, ExecutionContext } from '@cloudflare/workers-types';

// ---------- 类型 ----------
interface Env {
    DB: D1Database;
    SESSION_SECRET: string;
    DEFAULT_ADMIN_PASS: string;
    PROXY_KEY: string;
    API_TOKEN: string;
    ENCRYPT_KEY: string;          // 用于加密 keys.secret (AES-GCM)
    PROJECT_NAME?: string;
    BASE_URL?: string;
}

// ---------- 工具函数 ----------
function maskToken(t: string): string {
    if (!t) return '';
    if (t.length <= 8) return '****';
    return t.slice(0, 4) + '****' + t.slice(-4);
}

// 管理员鉴权（Cookie session + HMAC-SHA256 签名 + 24h 有效期）
// 会话密钥优先用 env.SESSION_SECRET；未配置时回退到 bootstrap 写入 meta 的 session_secret
async function getSessionSecret(env: Env): Promise<string> {
    if (env.SESSION_SECRET) return env.SESSION_SECRET;
    try {
        const s = await db.metaGet<string>(env.DB, 'session_secret', '');
        return s || '';
    } catch { return ''; }
}

// 凭据来源探测：环境变量优先，其次 meta（bootstrap 写入）。返回不抛错。
async function bootstrapMeta(env: Env): Promise<{ pass: string; secret: string }> {
    let pass = env.DEFAULT_ADMIN_PASS || '';
    let secret = env.SESSION_SECRET || '';
    try {
        if (!pass) pass = await db.metaGet<string>(env.DB, 'admin_pass_hash', '');
        if (!secret) secret = await db.metaGet<string>(env.DB, 'session_secret', '');
    } catch { /* meta 表缺失时按未配置处理 */ }
    return { pass, secret };
}
async function isAdmin(req: Request, env: Env): Promise<boolean> {
    const cookie = req.headers.get('cookie') || '';
    const m = cookie.match(/irouter_sid=([^;]+)/);
    if (!m) return false;
    try {
        // 新格式：admin:ts:sig；旧格式（无 ts）直接失效需重新登录
        const parts = atob(m[1]).split(':');
        if (parts.length !== 3 || parts[0] !== 'admin') return false;
        const ts = Number(parts[1]);
        if (!ts || Date.now() - ts > 24 * 3600 * 1000) return false;   // 服务端 24h 过期
        const secret = await getSessionSecret(env);
        if (!secret) return false;
        const expected = await hmacSha256(secret, 'admin:' + ts);
        return parts[2] === expected;
    } catch { return false; }
}

async function hmacSha256(secret: string, msg: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
    return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// 常量时间字符串比较（防时序侧信道，用于密码校验）
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

// =====================================================================
// /v1/models 模型目录：内置供应商 → 常见模型名（静态，开箱即用）
// 自定义供应商走 runtime 探测（probeProviderModels，60s 缓存）
// =====================================================================
const MODEL_CATALOG: Record<string, string[]> = {
    deepseek: ['deepseek-chat', 'deepseek-reasoner'],
    qwen: ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen-long', 'qwen2.5-72b-instruct'],
    hunyuan: ['hunyuan-turbo', 'hunyuan-standard', 'hunyuan-pro'],
    doubao: ['doubao-pro-32k', 'doubao-lite-32k', 'doubao-seed-1-6-250615'],
    kimi: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k', 'kimi-k2-0711-preview'],
    glm: ['glm-4-plus', 'glm-4-air', 'glm-4-flash', 'glm-4v-plus'],
    siliconflow: ['deepseek-ai/DeepSeek-V3', 'deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-72B-Instruct'],
    groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    together: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'deepseek-ai/DeepSeek-V3'],
    openrouter: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'deepseek/deepseek-chat'],
    fireworks: ['accounts/fireworks/models/llama-v3p1-70b-instruct', 'accounts/fireworks/models/deepseek-v3'],
    novita: ['meta-llama/llama-3.1-8b-instruct', 'deepseek/deepseek-chat'],
    ppio: ['gpt-4o', 'deepseek-chat', 'glm-4-plus'],
    mistral: ['mistral-large-latest', 'mistral-small-latest', 'open-mistral-nemo'],
    cohere: ['command-r-plus', 'command-r-plus-08-2024'],
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o3-mini'],
};

// 自定义供应商 /models 探测缓存（60s）
const modelProbeCache: { data: Record<string, string[]>; at: number } = { data: {}, at: 0 };
async function probeProviderModels(env: Env, p: db.Provider, force = false): Promise<string[]> {
    // 静态目录命中时永不探测
    if (!force && MODEL_CATALOG[p.id]?.length) return [];
    if (!force && Date.now() - modelProbeCache.at < 60_000) return modelProbeCache.data[p.id] || [];
    try {
        const keys = await db.getKeys(env.DB, p.id);
        for (const k of keys) {
            let apiKey: string;
            try { apiKey = await decrypt(k.secret, await getEncryptKey(env)); } catch { continue; }
            const url = p.base_url + (p.base_url.endsWith('/') ? '' : '/') + 'models';
            const res = await fetch(url, { headers: { authorization: 'Bearer ' + apiKey, ...p.headers } });
            if (!res.ok) continue;
            const j = await res.json().catch(() => null) as any;
            const list = (j?.data || []).map((m: any) => String(m.id)).filter(Boolean).slice(0, 50);
            modelProbeCache.data[p.id] = list;
            modelProbeCache.at = Date.now();
            return list;
        }
    } catch (e) { /* best-effort */ }
    return [];
}

// 路由 pattern → 正则：* 转 .*，其余正则元字符全部转义（防误匹配/非法正则 500）
function patternToRegex(pattern: string): RegExp | null {
    try {
        let p = pattern.replace(/\*/g, '\u0000');           // 通配占位
        p = p.replace(/[.+?^${}()|[\]\\]/g, '\\$&');        // 转义其余元字符
        p = p.replace(/\u0000/g, '.*');                     // 还原通配
        return new RegExp('^' + p + '$');
    } catch { return null; }
}

// 首次启动只执行一次的内置供应商迁移（跨请求复用，避免每请求 21 次 D1 SELECT + 缓存失效）
let builtinsInit: Promise<unknown> | null = null;

// 登录失败限速（进程内 best-effort：Workers 多 isolate 下为软限制）
const loginFailures = new Map<string, { count: number; at: number }>();
const LOGIN_LIMIT = { max: 5, windowMs: 60_000 };

// settings 短缓存（60s）：代理鉴权需要读取 settings.apiToken，避免每次请求都查 D1
// 首次部署表未创建时容错返回默认值（bootstrap 初始化可先于建表可用）
const settingsCache: { data: db.Settings | null; at: number } = { data: null, at: 0 };
async function getSettingsCached(env: Env): Promise<db.Settings> {
    if (settingsCache.data && Date.now() - settingsCache.at < 60_000) return settingsCache.data;
    try {
        const s = await db.getSettings(env.DB);
        settingsCache.data = s;
        settingsCache.at = Date.now();
        return s;
    } catch {
        return { projectName: 'iRouter', baseUrl: '', apiToken: '', tokenMasked: '' };
    }
}

// 错误响应（OpenAI 兼容结构：{ error: { message, type, code } }）
function err(status: number, msg: string, type = 'invalid_request_error') {
    return new Response(JSON.stringify({ error: { message: msg, type, code: status } }), {
        status, headers: { 'content-type': 'application/json' },
    });
}

// =====================================================================
// 主 fetch handler
// =====================================================================
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const app = new Hono<{ Bindings: Env }>();

        // CORS 仅对 /v1/* 开放（管理后台/健康检查均为同源浏览器访问，无需跨域）
        app.use('/v1/*', cors({ origin: '*', credentials: false }));
        app.use('*', logger());

        // ---------- 首次启动：迁移内置供应商 + 老库补列（整个 isolate 只执行一次，幂等）----------
        if (!builtinsInit) {
            builtinsInit = (async () => {
                await db.migrateBuiltins(env.DB);
                await db.ensureRouteModelMap(env.DB);   // 老库（含线上已部署库）自动补 model_map 列，幂等
            })().catch((e) => console.error('init migrations failed:', e));
        }
        ctx.waitUntil(builtinsInit);

        // ---------- 健康检查 ----------
        app.get('/health', (c) => c.json({ ok: true, version: '3.6.0', storage: 'd1' }));

        // =================================================================
        // 代理转发（流式透传，CPU < 5ms，不 buffer 完整响应）
        // =================================================================
        // 鉴权：PROXY_KEY 优先；未配置时回退后台「调用信息」Token；两者都无则拒绝（绝不无鉴权放行）
        const gwToken = env.PROXY_KEY || (await getSettingsCached(env)).apiToken;
        app.use('/v1/*', async (c, next) => {
            if (!gwToken) return err(500, '网关 Token 未配置：请设置 PROXY_KEY 环境变量，或在管理后台「系统设置」中设置 Token', 'gateway_not_configured');
            const auth = c.req.header('authorization') || '';
            const token = auth.replace(/^Bearer\s+/i, '');
            if (!token || token !== gwToken) return err(401, 'Unauthorized', 'authentication_error');
            await next();
        });

        // GET /v1/models — OpenAI 兼容模型清单（agent/SDK 接入前会先拉取此端点）
        app.get('/v1/models', async (c) => {
            const providers = await db.getProviders(env.DB);
            const data: { id: string; object: string; owned_by: string }[] = [];
            for (const p of providers) {
                if (!p.enabled) continue;
                const builtin = MODEL_CATALOG[p.id];
                if (builtin && builtin.length) {
                    for (const mid of builtin) data.push({ id: mid, object: 'model', owned_by: p.id });
                    continue;
                }
                // 自定义供应商：best-effort 探测其 /models（60s 缓存），失败静默跳过
                const probe = await probeProviderModels(env, p);
                if (probe && probe.length) for (const mid of probe) data.push({ id: mid, object: 'model', owned_by: p.id });
            }
            return c.json({ object: 'list', data });
        });

        app.post('/v1/chat/completions', async (c) => {
            const body = await c.req.json().catch(() => null);
            if (!body || !body.model) return err(400, 'model required', 'invalid_request_error');

            const start = Date.now();
            // 路由匹配：找命中的供应商（pattern 支持 * 通配，其余字符按字面匹配）
            const routes = await db.getRoutes(env.DB);
            const model = String(body.model);
            const matched = routes
                .filter(r => {
                    if (!r.enabled) return false;
                    const re = patternToRegex(r.pattern);
                    return !!re && re.test(model);
                })
                .sort((a, b) => b.priority - a.priority || b.created_at - a.created_at)[0];

            // 无匹配路由 → 明确 404（不再静默轮询全部启用的供应商）
            if (!matched) {
                db.logRing.push({ model, provider: 'none', ok: false, latency_ms: Date.now() - start, status: 404 });
                db.logRing.flush(env.DB);
                return err(404, `未配置模型「${model}」的转发路由：请先到管理后台「路由规则」添加匹配规则（如 pattern=* 的默认路由）`, 'model_not_found');
            }

            const providers = await db.getProviders(env.DB);
            // 展开候选：严格按用户配置顺序 [providers..., fallback...]，同供应商多个 key 依次轮换
            const tryQueue: { p: db.Provider; k: db.KeyRow }[] = [];
            for (const pid of [...matched.providers, ...matched.fallback]) {
                const p = providers.find(x => x.id === pid);
                if (!p || p.protocol !== 'openai') continue;   // 非 openai 协议暂不支持，跳过
                const keys = await db.getKeys(env.DB, p.id);
                for (const k of keys) tryQueue.push({ p, k });
            }

            if (tryQueue.length === 0) {
                db.logRing.push({ model, provider: 'none', ok: false, latency_ms: Date.now() - start, status: 502 });
                db.logRing.flush(env.DB);
                return err(502, `路由「${matched.name || matched.id}」下没有可用的 openai 协议供应商或 Key，请先配置供应商 Key`, 'provider_unavailable');
            }

            // 模型名改写：路由 model_map 里命中则替换上游 model（agent 请求名 → 供应商实际模型名）
            const upstreamModel = (matched.model_map || {})[model] || model;
            const upstreamBody = upstreamModel === model ? body : { ...body, model: upstreamModel };

            let lastErr: any = null;
            for (const { p, k } of tryQueue) {
                // 解密 secret（AES-GCM）；解密失败给出明确错误并尝试下一个 Key/供应商
                let apiKey: string;
                try {
                    apiKey = await decrypt(k.secret, await getEncryptKey(env));
                } catch (e) {
                    lastErr = new Error(`key ${k.id} 解密失败（请确认 ENCRYPT_KEY 与保存该 Key 时一致）`);
                    continue;
                }

                const upstream = p.base_url + (p.base_url.endsWith('/') ? '' : '/') + 'chat/completions';
                try {
                    const upstreamReq = new Request(upstream, {
                        method: 'POST',
                        headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + apiKey, ...p.headers },
                        body: JSON.stringify(upstreamBody),
                        // CF 特有：带 body 的 fetch 必须 duplex: 'half'，否则抛异常
                        duplex: 'half' as any,
                    });
                    const res = await fetch(upstreamReq);
                    const latency = Date.now() - start;

                    // 上游 4xx/5xx：读取错误文本记录后继续兜底（不把失败直接透传给 agent）
                    if (!res.ok) {
                        const errText = await res.text().catch(() => '');
                        lastErr = new Error(`[${p.id}] HTTP ${res.status} ${errText.slice(0, 300) || res.statusText}`);
                        db.logRing.push({ model, provider: p.id, ok: false, latency_ms: latency, status: res.status });
                        db.logRing.flush(env.DB);
                        continue;
                    }

                    ctx.waitUntil(db.touchKey(env.DB, k.id));
                    db.logRing.push({ model, provider: p.id, ok: true, latency_ms: latency, status: res.status });
                    db.logRing.flush(env.DB);

                    // 流式：直接透传 ReadableStream，零 buffer
                    if (body.stream && res.body) {
                        return new Response(res.body, { status: res.status, headers: res.headers });
                    }
                    const text = await res.text();
                    return new Response(text, { status: res.status, headers: res.headers });
                } catch (e) {
                    lastErr = e;
                    continue;            // 尝试下一个 Key / 供应商（兜底）
                }
            }

            db.logRing.push({ model, provider: 'none', ok: false, latency_ms: Date.now() - start, status: 502 });
            db.logRing.flush(env.DB);
            return err(502, `所有供应商均失败：${lastErr?.message || '无可用供应商'}`, 'upstream_error');
        });

        // =================================================================
        // 管理后台静态页（SPA 兜底路由，必须声明在所有 /admin/api/* 之后，见文件末尾）
        // =================================================================

        // =================================================================
        // API：认证（支持两种凭据来源：环境变量优先，其次 bootstrap 写入的 meta）
        // =================================================================
        app.get('/admin/api/bootstrap', async (c) => {
            const { pass, secret } = await bootstrapMeta(env);
            return c.json({ required: !pass || !secret });
        });
        app.post('/admin/api/bootstrap', async (c) => {
            const { password = '', session_secret = '', current_password = '' } = await c.req.json().catch(() => ({})) as any;
            if (String(password).length < 6) return err(400, '管理员密码至少 6 位');
            if (String(session_secret).length < 12) return err(400, '会话密钥至少 12 位随机串');
            const cur = await bootstrapMeta(env);
            if (cur.pass || cur.secret) {
                // 已初始化 → 重新初始化模式：必须提供当前密码校验，防止未授权重置
                if (env.DEFAULT_ADMIN_PASS || env.SESSION_SECRET) {
                    // env 优先：写入 meta 不会生效，直接引导改环境变量
                    return err(409, '当前凭据来自环境变量（DEFAULT_ADMIN_PASS / SESSION_SECRET），后台重置不会生效。请直接在 Cloudflare 控制台修改环境变量并重新部署；如需改用数据库凭据，请先删除这两个环境变量');
                }
                if (!cur.pass) return err(409, '已初始化过，如需重置请先删除 meta 中 admin_pass_hash/session_secret');
                if (typeof current_password !== 'string' || !current_password) return err(400, '已初始化过：请提供当前管理员密码（current_password）以重新初始化');
                const curOk = await hmacSha256(cur.secret, current_password) === cur.pass;   // meta 来源：HMAC 比对
                if (!curOk) return err(401, '当前密码验证失败');
            }
            // 存 HMAC(password, session_secret)，即使库被读到也无法直接还原密码
            const hash = await hmacSha256(String(session_secret), String(password));
            await db.metaSet(env.DB, 'admin_pass_hash', hash);
            await db.metaSet(env.DB, 'session_secret', String(session_secret));
            return c.json({ ok: true, reinit: !!(cur.pass || cur.secret) });
        });
        // 修改登录密码（需已登录；旧密码校验通过后更新 meta 中的 admin_pass_hash）
        app.post('/admin/api/password', async (c) => {
            if (!(await isAdmin(c.req.raw, env))) return err(401, 'Unauthorized');
            const { old_password = '', new_password = '' } = await c.req.json().catch(() => ({})) as any;
            if (String(new_password).length < 6) return err(400, '新密码至少 6 位');
            if (typeof old_password !== 'string' || !old_password) return err(400, '请提供当前密码');
            const { pass, secret } = await bootstrapMeta(env);
            if (!pass || !secret) return err(500, '未配置管理员密码（使用环境变量时请直接修改 DEFAULT_ADMIN_PASS）');
            // 密码来自环境变量时不允许通过后台修改（env 优先，改了 meta 也不生效），给出明确引导
            if (env.DEFAULT_ADMIN_PASS) return err(409, '当前密码来自环境变量 DEFAULT_ADMIN_PASS，请直接在 Cloudflare 控制台修改环境变量并重新部署');
            const verified = await hmacSha256(secret, old_password) === pass;
            if (!verified) return err(401, '当前密码错误');
            const hash = await hmacSha256(secret, String(new_password));
            await db.metaSet(env.DB, 'admin_pass_hash', hash);
            return c.json({ ok: true });
        });
        app.post('/admin/api/login', async (c) => {
            const { pass, secret } = await bootstrapMeta(env);
            if (!pass) {
                return err(500, '未配置管理员密码：请设置 DEFAULT_ADMIN_PASS 环境变量，或先用下方「快速初始化」完成首次配置');
            }
            if (!secret) {
                return err(500, '未配置会话密钥：请设置 SESSION_SECRET 环境变量，或先用下方「快速初始化」完成首次配置');
            }
            // 登录失败限速（软限制）
            const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
            const now = Date.now();
            const rec = loginFailures.get(ip);
            if (rec && now - rec.at < LOGIN_LIMIT.windowMs && rec.count >= LOGIN_LIMIT.max) {
                return err(429, '尝试次数过多，请 1 分钟后再试');
            }
            const { password } = await c.req.json().catch(() => ({ password: '' }));
            let ok = false;
            if (env.DEFAULT_ADMIN_PASS) {
                ok = typeof password === 'string' && timingSafeEqual(password, env.DEFAULT_ADMIN_PASS);
            } else {
                ok = typeof password === 'string' && timingSafeEqual(await hmacSha256(secret, password), pass);
            }
            if (!ok) {
                const f = loginFailures.get(ip);
                if (!f || now - f.at >= LOGIN_LIMIT.windowMs) loginFailures.set(ip, { count: 1, at: now });
                else f.count++;
                return err(401, '密码错误');
            }
            loginFailures.delete(ip);
            const sig = await hmacSha256(secret, 'admin:' + now);
            const sid = btoa('admin:' + now + ':' + sig);
            return new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: {
                    'content-type': 'application/json',
                    'set-cookie': `irouter_sid=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`,
                },
            });
        });

        // =================================================================
        // API：Dashboard（聚合，与原版字段一致）
        // =================================================================
        app.get('/admin/api/dashboard', async (c) => {
            if (!(await isAdmin(c.req.raw, env))) return err(401, 'Unauthorized');
            const [providers, routes, keys, stats, recent, settings] = await Promise.all([
                db.getProviders(env.DB),
                db.getRoutes(env.DB),
                db.getKeys(env.DB),
                db.getStats(env.DB),
                db.recentLogs(env.DB, 200),
                db.getSettings(env.DB),
            ]);

            // 模型调用排行
            const modelCount = new Map<string, number>();
            for (const l of recent) modelCount.set(l.model, (modelCount.get(l.model) || 0) + 1);
            const modelRanking = [...modelCount.entries()]
                .map(([model, count]) => ({ model, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

            // 供应商健康度（基于最近日志）
            const provStat = new Map<string, { ok: number; total: number; latency: number }>();
            for (const l of recent) {
                const s = provStat.get(l.provider) || { ok: 0, total: 0, latency: 0 };
                s.total++; if (l.ok) s.ok++; s.latency += l.latency_ms;
                provStat.set(l.provider, s);
            }
            const providerHealth = providers.map(p => {
                const s = provStat.get(p.id);
                return {
                    id: p.id, name: p.name, enabled: p.enabled,
                    successRate: s ? Math.round(s.ok / s.total * 100) : 0,
                    avgLatency: s ? Math.round(s.latency / s.total) : 0,
                };
            });

            return c.json({
                version: '3.6.0',
                generatedAt: Date.now(),
                storage: { mode: 'd1', writable: true, warning: null },
                counts: { providers: providers.length, routes: routes.length, keys: keys.length },
                stats,
                recent,
                modelRanking,
                providerHealth,
                providers,           // 前端 render_dashboard 用到
                settings,            // 总览页调用信息卡
            });
        });

        // =================================================================
        // API：Settings（调用信息 + 改 Token，与原版一致）
        // =================================================================
        app.get('/admin/api/settings', async (c) => {
            if (!(await isAdmin(c.req.raw, env))) return err(401, 'Unauthorized');
            const s = await db.getSettings(env.DB);
            return c.json({
                projectName: s.projectName || env.PROJECT_NAME || 'iRouter',
                baseUrl: s.baseUrl || env.BASE_URL || '',
                apiToken: s.tokenMasked || maskToken(env.API_TOKEN || ''),
            });
        });

        // API：在线聊天页获取明文调用 Token（仅管理员，用于直接调 /v1/chat/completions 验证转发链路）
        app.get('/admin/api/token', async (c) => {
            if (!(await isAdmin(c.req.raw, env))) return err(401, 'Unauthorized');
            const s = await db.getSettings(env.DB);
            return c.json({ token: s.apiToken || env.API_TOKEN || '' });
        });

        app.put('/admin/api/settings', async (c) => {
            if (!(await isAdmin(c.req.raw, env))) return err(401, 'Unauthorized');
            const body = await c.req.json().catch(() => ({})) as any;
            const cur = await db.getSettings(env.DB);
            const next = { ...cur };

            if (typeof body.projectName === 'string') next.projectName = body.projectName;
            if (typeof body.baseUrl === 'string') next.baseUrl = body.baseUrl;

            // Token：留空 = 不修改；<8 位拒绝；否则更新
            if (typeof body.apiToken === 'string') {
                const t = body.apiToken.trim();
                if (t === '') {
                    // 不修改
                } else if (t.length < 8) {
                    return err(400, 'Token 至少 8 位');
                } else {
                    next.apiToken = t;
                    next.tokenMasked = maskToken(t);
                }
            }
            await db.saveSettings(env.DB, next);
            settingsCache.data = null;   // 使代理鉴权立即使用新 Token
            return c.json({ ok: true, settings: { ...next, apiToken: next.tokenMasked } });
        });

        // =================================================================
        // API：Providers（CRUD）
        // =================================================================
        app.get('/admin/api/providers', async (c) => {
            if (!(await isAdmin(c.req.raw, env))) return err(401, 'Unauthorized');
            const providers = await db.getProviders(env.DB);
            const keys = await db.getKeys(env.DB);   // 全部 Key（secret 密文剥离，仅回传摘要）
            return c.json(providers.map(p => ({
                ...p,
                keysBrief: keys.filter(k => k.provider_id === p.id)
                    .map(k => ({ id: k.id, name: k.name, masked: k.masked, hint: k.hint, last_used: k.last_used })),
            })));
        });
        app.post('/admin/api/providers', async (c) => {
            if (!(await isAdmin(c.req.raw, env))) return err(401, 'Unauthorized');
            const body = await c.req.json().catch(() => ({})) as any;
            const p: db.Provider = {
                id: body.id || 'p_' + Date.now(),
                name: body.name || '未命名',
                builtin: false,
                enabled: body.enabled !== false,
                base_url: body.base_url || '',
                protocol: body.protocol || 'openai',
                headers: body.headers || {},
                keys: body.keys || [],
                created_at: Math.floor(Date.now() / 1000),
                updated_at: Math.floor(Date.now() / 1000),
            };
            await db.saveProvider(env.DB, p);
            // API Key 合并进供应商：创建时可直接携带 key（AES-GCM 加密存储）
            const rawKey = String(body.key || '').trim();
            if (rawKey) {
                const ek = await getEncryptKey(env);
                if (!ek) return err(500, '加密密钥暂不可用，请重试');
                const k: db.KeyRow = {
                    id: 'k_' + Date.now(), name: body.keyName || '',
                    provider_id: p.id, secret: await encrypt(rawKey, ek),
                    hint: rawKey.slice(-4), masked: '****' + rawKey.slice(-4),
                    created_at: Math.floor(Date.now() / 1000), last_used: 0,
                };
                await db.saveKey(env.DB, k);
            }
            return c.json({ ok: true, id: p.id }, 201);
        });
        app.put('/admin/api/providers/:id', async (c) => {
            if (!(await isAdmin(c.req.raw, env))) return err(401, 'Unauthorized');
            const id = c.req.param('id');
            const cur = await db.getProvider(env.DB, id);
            if (!cur) return err(404, '供应商不存在');
            const body = await c.req.json().catch(() => ({})) as any;
            const next: db.Provider = {
                ...cur,
                name: body.name ?? cur.name,
                enabled: body.enabled ?? cur.enabled,
                base_url: body.base_url ?? cur.base_url,
                protocol: body.protocol ?? cur.protocol,
                headers: body.headers ?? cur.headers,
                updated_at: Math.floor(Date.now() / 1000),
            };
            await db.saveProvider(env.DB, next);
            // 追加新 Key（可选）
            const rawKey = String(body.key || '').trim();
            if (rawKey) {
                const ek = await getEncryptKey(env);
                if (!ek) return err(500, '加密密钥暂不可用，请重试');
                const k: db.KeyRow = {
                    id: 'k_' + Date.now(), name: body.keyName || '',
                    provider_id: id, secret: await encrypt(rawKey, ek),
                    hint: rawKey.slice(-4), masked: '****' + rawKey.slice(-4),
                    created_at: Math.floor(Date.now() / 1000), last_used: 0,
                };
                await db.saveKey(env.DB, k);
            }
            // 移除指定 Key（remove_keys：单个 id 字符串或数组）
            const rm = body.remove_keys;
            const rmList = Array.isArray(rm) ? rm : (typeof rm === 'string' && rm ? [rm] : []);
            for (const kid of rmList) { if (kid) await db.deleteKey(env.DB, String(kid)); }
            return c.json({ ok: true });
        });
        app.delete('/admin/api/providers/:id', async (c) => {
            if (!(await isAdmin(c.req.raw, env))) return err(401, 'Unauthorized');
            await db.deleteProvider(env.DB, c.req.param('id'));
            return c.json({ ok: true });
        });
        // 供应商测试连接：实际用第一个 Key 请求上游 /models，给出可读结论（不写日志、不 touch key）
        app.post('/admin/api/providers/:id/test', async (c) => {
            if (!(await isAdmin(c.req.raw, env))) return err(401, 'Unauthorized');
            const id = c.req.param('id');
            const p = await db.getProvider(env.DB, id);
            if (!p) return err(404, '供应商不存在');
            const keys = await db.getKeys(env.DB, id);
            if (keys.length === 0) return c.json({ ok: false, message: '该供应商还没有 Key，请先添加 Key 再测试' });
            let apiKey: string;
            try {
                apiKey = await decrypt(keys[0].secret, await getEncryptKey(env));
            } catch {
                return c.json({ ok: false, message: 'Key 解密失败：可能与保存时的 ENCRYPT_KEY 不一致，请重新保存 Key' });
            }
            const base = p.base_url.replace(/\/+$/, '');
            const url = base + (base.endsWith('/v1') || base.endsWith('/api') ? '' : '/v1') + '/models';
            const sentAt = Date.now();
            try {
                const res = await fetch(url, { headers: { authorization: 'Bearer ' + apiKey, ...p.headers } });
                const ms = Date.now() - sentAt;
                if (!res.ok) {
                    const text = (await res.text().catch(() => '')).slice(0, 200);
                    return c.json({ ok: false, message: `HTTP ${res.status}${text ? '：' + text : ''}（${ms}ms）` });
                }
                const j = await res.json().catch(() => null) as any;
                const n = Array.isArray(j?.data) ? j.data.length : 0;
                return c.json({ ok: true, message: `连接成功（${ms}ms），返回 ${n} 个可用模型` });
            } catch (e) {
                return c.json({ ok: false, message: `请求失败：${(e as Error).message}` });
            }
        });

        // API：在线聊天页获取指定供应商可用模型（内置目录优先，自定义 go probeProviderModels 60s 缓存）
        app.get('/admin/api/providers/:id/models', async (c) => {
            if (!(await isAdmin(c.req.raw, env))) return err(401, 'Unauthorized');
            const id = c.req.param('id');
            const p = await db.getProvider(env.DB, id);
            if (!p) return err(404, '供应商不存在');
            const builtin = MODEL_CATALOG[p.id];
            if (builtin?.length) return c.json({ models: builtin });
            const models = await probeProviderModels(env, p);
            return c.json({ models });
        });

        // =================================================================
        // API：Routes（CRUD，app.put 修复，无 app.set）
        // =================================================================
        app.get('/admin/api/routes', async (c) => {
            if (!(await isAdmin(c.req.raw, env))) return err(401, 'Unauthorized');
            return c.json(await db.getRoutes(env.DB));
        });
        app.post('/admin/api/routes', async (c) => {
            if (!(await isAdmin(c.req.raw, env))) return err(401, 'Unauthorized');
            const body = await c.req.json().catch(() => ({})) as any;
            const rt: db.Route = {
                id: 'r_' + Date.now(),
                name: body.name || '',
                pattern: body.pattern || '*',
                providers: body.providers || [],
                fallback: body.fallback || [],
                priority: body.priority || 0,
                enabled: body.enabled !== false,
                model_map: body.model_map && typeof body.model_map === 'object' ? body.model_map : {},
                created_at: Math.floor(Date.now() / 1000),
            };
            await db.saveRoute(env.DB, rt);
            return c.json({ ok: true, id: rt.id }, 201);
        });
        app.put('/admin/api/routes/:id', async (c) => {
            if (!(await isAdmin(c.req.raw, env))) return err(401, 'Unauthorized');
            const id = c.req.param('id');
            const routes = await db.getRoutes(env.DB);
            const cur = routes.find(r => r.id === id);
            if (!cur) return err(404, '路由不存在');
            const body = await c.req.json().catch(() => ({})) as any;
            const next: db.Route = {
                ...cur,
                name: body.name ?? cur.name,
                pattern: body.pattern ?? cur.pattern,
                providers: body.providers ?? cur.providers,
                fallback: body.fallback ?? cur.fallback,
                priority: body.priority ?? cur.priority,
                enabled: body.enabled ?? cur.enabled,
                model_map: body.model_map && typeof body.model_map === 'object' ? body.model_map : cur.model_map,
            };
            await db.saveRoute(env.DB, next);
            return c.json({ ok: true });
        });
        app.delete('/admin/api/routes/:id', async (c) => {
            if (!(await isAdmin(c.req.raw, env))) return err(401, 'Unauthorized');
            await db.deleteRoute(env.DB, c.req.param('id'));
            return c.json({ ok: true });
        });

        // =================================================================
        // API：Keys（CRUD，secret 加密存储）
        // =================================================================
        app.get('/admin/api/keys', async (c) => {
            if (!(await isAdmin(c.req.raw, env))) return err(401, 'Unauthorized');
            const keys = await db.getKeys(env.DB);
            return c.json({ ok: true, data: keys.map(k => ({ ...k, secret: '' })), encryptReady: true });   // 列表不返回密文；加密密钥自动就绪（env 或 meta 懒生成）
        });
        app.post('/admin/api/keys', async (c) => {
            if (!(await isAdmin(c.req.raw, env))) return err(401, 'Unauthorized');
            const ek = await getEncryptKey(env);
            if (!ek) return err(500, '加密密钥暂不可用：请设置 ENCRYPT_KEY 环境变量后重试');   // 双保险：meta 读写异常时兜底提示
            const body = await c.req.json().catch(() => ({})) as any;
            if (!body.secret) return err(400, 'secret required');
            const encrypted = await encrypt(String(body.secret), ek);
            const k: db.KeyRow = {
                id: 'k_' + Date.now(),
                name: body.name || '',
                provider_id: body.provider_id || '',
                secret: encrypted,
                hint: String(body.secret).slice(-4),
                masked: '****' + String(body.secret).slice(-4),
                created_at: Math.floor(Date.now() / 1000),
                last_used: 0,
            };
            await db.saveKey(env.DB, k);
            return c.json({ ok: true, id: k.id }, 201);
        });
        app.delete('/admin/api/keys/:id', async (c) => {
            if (!(await isAdmin(c.req.raw, env))) return err(401, 'Unauthorized');
            await db.deleteKey(env.DB, c.req.param('id'));
            return c.json({ ok: true });
        });

        // =================================================================
        // API：Storage status
        // =================================================================
        app.get('/admin/api/storage/status', async (c) => {
            if (!(await isAdmin(c.req.raw, env))) return err(401, 'Unauthorized');
            // D1 永远可写（只要绑定正确），这里做一次轻量探测
            try {
                await env.DB.prepare('SELECT 1 FROM meta LIMIT 1').all();
                return c.json({ mode: 'd1', writable: true, warning: null });
            } catch (e) {
                return c.json({ mode: 'd1', writable: false, warning: String(e) }, 500);
            }
        });

        // ---------- 启动定时 flush（best-effort，Workers 空闲会被取消，定量 flush 兜底）----------
        db.logRing.startTimer(env.DB);

        // ---------- SPA 兜底路由：必须在所有 /admin/api/* 之后声明，否则会拦截 API ----------
        // 首页 = 管理后台预览：/ 与 /admin 返回同一 SPA，前端 init() 自动探测登录态
        // （未登录 → 渲染登录页；已登录 → 渲染管理界面，行为与 /admin 完全一致）
        app.get('/', (c) => c.html(ADMIN_HTML));
        app.get('/admin', (c) => c.html(ADMIN_HTML));
        app.get('/admin/*', (c) => c.html(ADMIN_HTML));

        return app.fetch(request);
    },
};

// =====================================================================
// 加密工具（AES-GCM，secret 落库前加密）
//   密钥优先级：env.ENCRYPT_KEY > meta 中 encrypt_key（首次使用时自动生成并持久化）
//   → 未配置环境变量也能开箱即用；decrypt 兼容早期用默认密钥加密的存量数据
// =====================================================================
const LEGACY_ENCRYPT_KEY = 'default-encrypt-key-change-me';

// 当前加密密钥：env 优先，否则取 meta，不存在则随机生成并存 meta（懒初始化）
async function getEncryptKey(env: Env): Promise<string> {
    if (env.ENCRYPT_KEY) return env.ENCRYPT_KEY;
    try {
        const cur = await db.metaGet<string>(env.DB, 'encrypt_key', '');
        if (cur) return cur;
        const fresh = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
        await db.metaSet(env.DB, 'encrypt_key', fresh);
        return fresh;
    } catch {
        return '';
    }
}

async function getKeyMaterial(key: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'raw', new TextEncoder().encode(key.padEnd(32, '0').slice(0, 32)),
        { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
    );
}
async function encrypt(text: string, key: string): Promise<string> {
    const cryptoKey = await getKeyMaterial(key);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new Uint8Array(await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv }, cryptoKey, new TextEncoder().encode(text)
    ));
    // 输出：base64(iv) + ':' + base64(ciphertext)
    const b64 = (buf: Uint8Array) => btoa(String.fromCharCode(...buf));
    return b64(iv) + ':' + b64(enc);
}
async function decrypt(payload: string, key: string): Promise<string> {
    const [ivB64, encB64] = payload.split(':');
    if (!ivB64 || !encB64) throw new Error('invalid encrypted payload');
    const fromB64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const tryDecrypt = async (k: string) => {
        const cryptoKey = await getKeyMaterial(k);
        return crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(ivB64) }, cryptoKey, fromB64(encB64));
    };
    try {
        return new TextDecoder().decode(await tryDecrypt(key));
    } catch {
        // 兼容旧版（未配置 ENCRYPT_KEY 时代用默认密钥加密的存量数据）
        const legacy = await tryDecrypt(LEGACY_ENCRYPT_KEY);
        return new TextDecoder().decode(legacy);
    }
}

// =====================================================================
// 管理前端（与原版完全一致，含调用信息卡 + api() 防双拼 + iRouter 品牌）
// 为节省篇幅，此处内联占位；实际内容沿用 v2.5.5 的 dashboard.html
// （路由层与前端零改动，可直接复用原 ADMIN_HTML）
// =====================================================================
const ADMIN_HTML = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>iRouter · 管理后台</title>
<style>
  :root{
    --bg:#0f1419;--fg:#e6edf3;--panel:#161b22;--border:#30363d;--muted:#8b949e;
    --accent:#58a6ff;--input-bg:#0d1117;--nav:#c9d1d9;--nav-hover:#21262d;--active-bg:#1f6feb22;
    --green:#238636;--green-h:#2ea043;--danger:#f85149;
    --ok-bg:#23863633;--ok-fg:#3fb950;--err-bg:#f8514933;--err-fg:#f85149;--warn-bg:#d2992233;--warn-fg:#d29922;
    --overlay:#0008;--pre-bg:#0d1117;--pre-fg:#a5d6ff;--shadow:0 2px 10px rgba(0,0,0,.25);
  }
  html[data-theme="light"]{
    --bg:#ffffff;--fg:#1f2328;--panel:#f6f8fa;--border:#d0d7de;--muted:#656d76;
    --accent:#0969da;--input-bg:#ffffff;--nav:#57606a;--nav-hover:#eaeef2;--active-bg:#ddf4ff;
    --green:#1f883d;--green-h:#1a7f37;--danger:#cf222e;
    --ok-bg:#dafbe1;--ok-fg:#1a7f37;--err-bg:#ffebe9;--err-fg:#cf222e;--warn-bg:#fff8c5;--warn-fg:#9a6700;
    --overlay:#0006;--pre-bg:#f6f8fa;--pre-fg:#0550ae;--shadow:0 2px 10px rgba(0,0,0,.06);
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;background:var(--bg);color:var(--fg);line-height:1.6;transition:background .2s,color .2s}
  button{font-family:inherit}
  ::-webkit-scrollbar{width:8px;height:8px}
  ::-webkit-scrollbar-thumb{background:var(--border);border-radius:999px}
  ::-webkit-scrollbar-track{background:transparent}
  .layout{display:flex;min-height:100vh}
  .sidebar{width:230px;background:linear-gradient(180deg,var(--panel),var(--bg));border-right:1px solid var(--border);padding:20px 12px;position:sticky;top:0;height:100vh;overflow-y:auto}
  .brand{display:flex;align-items:center;gap:12px;padding:0 10px 16px;border-bottom:1px solid var(--border);margin-bottom:10px}
  .brand-text{min-width:0}
  .nav-toggle{display:none;align-items:center;justify-content:center;width:40px;height:40px;background:var(--nav-hover);border:1px solid var(--border);border-radius:12px;color:var(--fg);cursor:pointer;flex-shrink:0;padding:0;transition:background .15s,color .15s}
  .nav-toggle:hover{color:var(--accent);border-color:var(--accent)}
  .nav-toggle.open{background:var(--active-bg);color:var(--accent);border-color:var(--accent)}
  /* 移动端固定顶栏（App Bar）：仅 ≤768px 显示，桌面隐藏 */
  .appbar{display:none}
  .brand h1{font-size:20px;color:var(--accent);letter-spacing:1px;display:flex;align-items:center;gap:8px}
  .brand h1::before{content:"";width:10px;height:10px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--green));box-shadow:0 0 10px var(--accent);flex-shrink:0}
  .brand small{color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .nav a{display:block;padding:9px 16px;color:var(--nav);text-decoration:none;font-size:14px;border-radius:999px;margin:2px 0;transition:background .15s,color .15s}
  .nav a:hover{background:var(--nav-hover);color:var(--fg)}
  .nav a.active{background:var(--active-bg);color:var(--accent);font-weight:600}
  .main{flex:1;padding:20px 36px 32px;overflow:auto}
  .topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;gap:12px;flex-wrap:wrap}
  .topbar h2{font-size:20px;font-weight:700}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px}
  .card{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:18px;box-shadow:var(--shadow);transition:transform .15s,box-shadow .15s}
  .card:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(0,0,0,.12)}
  .card .label{color:var(--muted);font-size:13px;margin-bottom:6px}
  .card .value{font-size:28px;font-weight:700;color:var(--accent)}
  .card .sub{font-size:12px;color:var(--muted);margin-top:4px}
  .panel{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:24px;box-shadow:var(--shadow)}
  .panel h3{font-size:15px;margin-bottom:14px;color:var(--fg)}
  /* 主题切换：内置于 brand 行，iRouter 右侧（纯图标，不单独占行） */
  .theme-toggle{margin-left:auto;width:34px;height:34px;padding:0;display:flex;align-items:center;justify-content:center;background:var(--panel);border:1px solid var(--border);color:var(--fg);border-radius:999px;cursor:pointer;font-size:15px;box-shadow:var(--shadow);transition:border-color .15s,transform .15s;flex-shrink:0}
  .theme-toggle:hover{border-color:var(--accent);transform:translateY(-1px)}
  .theme-toggle:active{transform:translateY(0)}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:24px}
  .table-scroll{overflow-x:auto}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--border);white-space:nowrap}
  th{color:var(--muted);font-weight:600}
  td code{font-size:inherit;font-family:ui-monospace,Menlo,monospace}
  .badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px}
  .badge.ok{background:var(--ok-bg);color:var(--ok-fg)}
  .badge.err{background:var(--err-bg);color:var(--err-fg)}
  .badge.warn{background:var(--warn-bg);color:var(--warn-fg)}
  .badge.info{background:var(--active-bg);color:var(--accent)}
  .badge.plain{background:var(--input-bg);color:var(--muted)}
  /* 按钮：胶囊 */
  .btn{background:var(--green);color:#fff;border:none;padding:8px 18px;border-radius:999px;cursor:pointer;font-size:13px;transition:filter .15s,transform .15s,box-shadow .15s}
  .btn:hover{filter:brightness(1.08);transform:translateY(-1px);box-shadow:0 3px 10px rgba(0,0,0,.15)}
  .btn:active{transform:translateY(0)}
  .btn.ghost{background:transparent;border:1px solid var(--border);color:var(--nav)}
  .btn.ghost:hover{background:var(--nav-hover);color:var(--fg);filter:none}
  .btn.danger{background:var(--danger)}
  /* 操作胶囊下拉菜单：列表操作列多按钮合并为一个胶囊按钮，点击展开菜单 */
  .op-wrap{position:relative;display:inline-block;vertical-align:middle}
  .op-drop{display:none;position:absolute;right:0;top:calc(100% + 6px);background:var(--panel);border:1px solid var(--border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.25);min-width:148px;z-index:60;overflow:hidden;padding:4px}
  .op-wrap.open .op-drop{display:block}
  .op-drop button{display:block;width:100%;text-align:left;background:none;border:none;color:var(--fg);font-size:13px;padding:8px 12px;border-radius:8px;cursor:pointer;font-family:inherit}
  .op-drop button:hover{background:var(--nav-hover)}
  .op-drop button.danger{color:var(--danger)}
  .op-drop button.danger:hover{background:var(--err-bg)}
  /* 弹窗底部按钮组：保存+取消 拼接为单个胶囊分节按钮 */
  .modal-actions{display:flex;justify-content:flex-end;margin-top:16px}
  .modal-actions .btn{border-radius:0!important;margin:0!important}
  .modal-actions .btn:first-child{border-radius:999px 0 0 999px!important}
  .modal-actions .btn:last-child{border-radius:0 999px 999px 0!important}
  .modal-actions .btn.ghost{margin-left:-1px!important;border-left:none}
  /* 在线聊天：对话气泡与输入区 */
  .chat-msgs{display:flex;flex-direction:column;gap:10px;max-height:52vh;overflow-y:auto;padding:2px 0}
  .chat-msg{max-width:78%;padding:10px 14px;border-radius:14px;font-size:13px;white-space:pre-wrap;word-break:break-word;line-height:1.7;border:1px solid var(--border)}
  .chat-msg .who{font-size:11px;color:var(--muted);margin-bottom:4px}
  .chat-msg.user{background:var(--active-bg);align-self:flex-end;border-bottom-right-radius:4px}
  .chat-msg.ai{background:var(--input-bg);align-self:flex-start;border-bottom-left-radius:4px}
  .chat-msg.ai.loading::after{content:"⏳";animation:blink 1.2s infinite;display:inline-block}
  @keyframes blink{50%{opacity:.25}}
  .chat-msg.err-bubble{border-color:var(--danger)!important;color:var(--err-fg)}
  .chat-input{display:flex;gap:10px;margin-top:16px;align-items:flex-end}
  .chat-input textarea{flex:1;background:var(--input-bg);border:1px solid var(--border);color:var(--fg);padding:10px 14px;border-radius:12px;resize:vertical;font-family:inherit;font-size:13px;min-height:56px}
  .chat-input textarea:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--active-bg)}
  .chat-meta{font-size:11px;color:var(--muted);margin-top:10px;text-align:right}
  .form-row{display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap}
  .form-row label{font-size:12px;color:var(--muted);display:block;margin-bottom:4px}
  .form-row input,.form-row select{flex:1;min-width:160px;background:var(--input-bg);border:1px solid var(--border);color:var(--fg);padding:8px 12px;border-radius:10px;transition:border-color .15s,box-shadow .15s}
  .form-row input:focus,.form-row select:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--active-bg)}
  .conn-card{border:1px solid var(--border);border-radius:14px;padding:18px;background:var(--panel)}
  .conn-card .row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:6px}
  .conn-card .row:last-child{border-bottom:none}
  .conn-card code{background:var(--input-bg);padding:4px 10px;border-radius:999px;font-family:ui-monospace,Menlo,monospace;font-size:12px}
  .copy{cursor:pointer;color:var(--accent);font-size:12px;margin-left:8px}
  .toast{position:fixed;top:64px;right:16px;background:var(--panel);border:1px solid var(--border);padding:10px 18px;border-radius:999px;z-index:99;display:none;box-shadow:0 4px 16px rgba(0,0,0,.18)}
  .toast.show{display:block;animation:toastIn .2s ease}
  @keyframes toastIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
  pre{background:var(--pre-bg);padding:14px;border-radius:12px;overflow:auto;font-size:12px;color:var(--pre-fg)}
  .modal{position:fixed;inset:0;background:var(--overlay);display:none;align-items:center;justify-content:center;z-index:100}
  .modal.show{display:flex}
  .modal .box{background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:24px;width:440px;max-width:90vw;box-shadow:0 12px 40px rgba(0,0,0,.3);max-height:88vh;overflow-y:auto}
  .modal h3{margin-bottom:16px}
  .bar{height:6px;background:var(--border);border-radius:999px;overflow:hidden;margin-top:4px}
  .bar>span{display:block;height:100%;background:linear-gradient(90deg,var(--accent),var(--green));border-radius:999px;transition:width .4s}
  .hidden{display:none!important}
  .nav-overlay{display:none}
  .login-box{max-width:380px;margin:80px auto;background:var(--panel);border:1px solid var(--border);border-radius:16px;padding:32px;box-shadow:0 8px 30px rgba(0,0,0,.12)}
  /* ---- 响应式：移动端 ---- */
  @media (max-width:768px){
    .layout{display:block}
    .sidebar{position:fixed;top:52px;left:0;width:264px;max-width:84vw;height:calc(100vh - 52px);border-right:1px solid var(--border);border-bottom:none;padding:14px 12px;background:var(--panel);transform:translateX(-106%);transition:transform .25s ease;box-shadow:0 6px 28px rgba(0,0,0,.4);z-index:70}
    .sidebar.open{transform:translateX(0)}
    .brand{padding:4px 10px 12px;border-bottom:1px solid var(--border);margin-bottom:10px}
    .brand h1{font-size:16px}
    /* 固定顶栏：汉堡 + 当前页标题 + 主题按钮 同行，z80 常驻最上层 */
    .appbar{display:flex;align-items:center;gap:10px;position:fixed;top:0;left:0;right:0;height:52px;padding:0 12px;background:var(--panel);border-bottom:1px solid var(--border);z-index:80}
    .appbar-title{flex:1;min-width:0;font-size:16px;font-weight:700;color:var(--accent);letter-spacing:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .sidebar .theme-toggle{display:none}
    .nav-toggle{display:inline-flex;margin-right:0;position:static;border-radius:12px}
    .nav{display:block;padding:4px 2px}
    .nav a{display:block;padding:9px 14px;margin:2px 0;font-size:14px;white-space:nowrap}
    .nav-overlay{position:fixed;inset:0;background:var(--overlay);z-index:65;display:none}
    .nav-overlay.show{display:block}
    .main{padding:64px 14px 24px}
    .topbar{flex-wrap:wrap}
    .topbar h2{font-size:17px}
    .panel{padding:15px}
    .cards{gap:12px}
    .grid2{grid-template-columns:1fr;gap:16px}
    .modal .box{width:94vw;max-width:94vw;padding:18px}
    .toast{top:auto;bottom:20px;right:14px;left:14px;text-align:center}
    pre{font-size:11px}
    .login-box{margin:52px auto;padding:24px}
  }
</style></head>
<body>
<div class="appbar" id="appbar">
  <button class="nav-toggle" id="navToggle" aria-label="打开菜单"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg></button>
  <span class="appbar-title" id="appbarTitle">iRouter</span>
  <button class="theme-toggle" id="themeToggleM" onclick="toggleTheme()">🌙</button>
</div>
<div class="layout">
  <aside class="sidebar">
    <div class="brand"><div class="brand-text"><h1>iRouter<button class="theme-toggle" id="themeToggle" onclick="toggleTheme()">🌙</button></h1><small>智能路由网关 v3.6.0</small></div></div>
    <nav class="nav">
      <a href="#dashboard" class="active" data-view="dashboard">🏠 首页</a>
      <a href="#providers" data-view="providers">⚙️ 供应商</a>
      <a href="#routes" data-view="routes">🔀 路由规则</a>
      <a href="#chat" data-view="chat">💬 在线聊天</a>
      <a href="#settings" data-view="settings">🛠️ 系统设置</a>
      <a href="#guide" data-view="guide">❔ 使用指南</a>
      <a href="#" id="logout"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M12 2v10"></path><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path></svg>&nbsp;退出</a>
    </nav>
  </aside>
  <main class="main" id="view"></main>
</div>
<div class="nav-overlay" id="navOverlay"></div>
<div class="toast" id="toast"></div>
<div class="modal" id="modal"><div class="box" id="modal-box"></div></div>

<script>
// ============ 亮色/暗色主题切换（localStorage 记忆）============
function applyTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  var icon = (t==='light' ? '☀️' : '🌙');
  var b=document.getElementById('themeToggle');
  if(b) b.textContent = icon;
  var bm=document.getElementById('themeToggleM');
  if(bm) bm.textContent = icon;
}
window.toggleTheme=function(){
  var cur=document.documentElement.getAttribute('data-theme')==='light'?'dark':'light';
  localStorage.setItem('irouter_theme', cur);
  applyTheme(cur);
};
(function(){
  var saved=localStorage.getItem('irouter_theme')||'dark';
  applyTheme(saved);
})();
// ============ api()：URL 归一化（根治 /admin/apiGET 与双拼 404）============
window.api = function(method, path, body){
  var m, p, b;
  if(typeof method === 'string' && typeof path === 'string'){ m=method.toUpperCase(); p=path; b=body; }
  else { p=method; var opts=path||{}; m=(opts.method||'GET').toUpperCase(); b=opts.body; }
  p = String(p||'').replace(/^\\s+|\\s+$/g,'');
  var full = p.match(/^(GET|POST|PUT|DELETE|PATCH)\\s+(.+)$/i);
  if(full){ m=full[1].toUpperCase(); p=full[2]; }
  p = p.replace(/^(GET|POST|PUT|DELETE|PATCH)\\s+/i,'');
  if(p.indexOf('/')!==0) p='/'+p;
  // 合并重复斜杠（循环兜底，彻底治 //admin//api//dashboard）
  while(/\\/\\//.test(p)) p = p.replace(/\\/\\//g,'/');
  // 已带完整前缀则不再拼接，防 /admin/api/admin/api/... 双拼
  var url = p;
  if(p.indexOf('/admin/api/')!==0){
    var ep = p.replace(/^\\//,'');
    if(/^(providers|routes|keys|dashboard|config|stats|logs|storage|status|settings)(\\/|$)/.test(ep)){
      url = '/admin/api/'+ep;
    }
  }
  return fetch(url,{
    method:m,
    headers:b?{'content-type':'application/json'}:{},
    body:b?JSON.stringify(b):undefined,
    credentials:'include'
  }).then(function(r){
    if(!r.ok) return r.json().then(function(e){
      // 错误归一化为字符串：兼容 {error:{message}} / {error:'msg'} / {message} / 裸文本
      var msg = (e&&e.error&&typeof e.error==='object'&&e.error.message)?e.error.message
              : (e&&typeof e.error==='string')?e.error
              : (e&&e.message)||(typeof e==='string'?e:'请求失败');
      throw msg;
    });
    return r.json();
  });
};

// ============ 视图渲染 ============
var TITLES = {dashboard:'管理首页',providers:'供应商',routes:'路由规则',chat:'在线聊天',settings:'系统设置',guide:'使用指南'};
var currentView = 'dashboard';
var state = {providers:[],routes:[],keys:[],settings:null};

function toast(msg){var t=document.getElementById('toast');t.textContent=msg;t.className='toast show';setTimeout(function(){t.className='toast';},2500);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

function render(){
  var v = currentView;
  document.title = (TITLES[v]||'') + ' · iRouter';
  var ab = document.getElementById('appbar');
  if(ab) ab.style.display='';
  var main = document.getElementById('view');
  if(v==='dashboard') return render_dashboard(main);
  if(v==='providers') return render_providers(main);
  if(v==='routes') return render_routes(main);
  if(v==='chat') return render_chat(main);
  if(v==='settings') return render_settings(main);
  if(v==='guide') return render_guide(main);
}

// ---- 首页 Dashboard ----
function render_dashboard(main){
  main.innerHTML = '<div class="topbar"><h2>🏠 管理首页</h2><button class="btn" onclick="fetchDashboard()">🔄 刷新</button></div>'
    + '<div class="panel" id="setup-hint" style="display:none;border-left:4px solid var(--acc)"></div>'
    + '<div class="cards" id="cards"></div>'
    + '<div class="grid2">'
    +   '<div class="panel"><h3>📊 模型调用排行</h3><div id="ranking"></div></div>'
    +   '<div class="panel"><h3>🏥 供应商健康度</h3><div id="health"></div></div>'
    + '</div>'
    + '<div class="panel"><h3>🕐 最近请求</h3><div class="table-scroll"><table id="recent"><thead><tr><th>时间</th><th>模型</th><th>供应商</th><th>状态</th><th>延迟</th></tr></thead><tbody></tbody></table></div></div>'
    + '<div id="guide-mount"></div>';
  fetchDashboard();
}

function fetchDashboard(){
  api('GET','/admin/api/dashboard').then(function(d){
    var data = d.data || d;   // 兼容 {ok,data} 与裸对象两种返回
    state.settings = data.settings;
    render_setup_hint(data);
    render_cards(data);
    render_ranking(data.modelRanking||[]);
    render_health(data.providerHealth||[]);
    render_recent(data.recent||[]);
    if(!localStorage.getItem('irouter_guide_dismissed')) render_guide_mini();
  }).catch(function(e){ toast('加载失败：'+(e&&e.error||e)); });
}

// 首次引导：缺 Key / 缺路由 / 未启用供应商时给出下一步操作提示
function render_setup_hint(data){
  var el = document.getElementById('setup-hint');
  if(!el) return;
  var counts = data.counts||{}, providers = data.providers||[];
  var tips = [];
  if(!(counts.keys||0)) tips.push('① 前往【供应商】页，为至少一家供应商填入真实 Key（AES-GCM 加密存储）');
  else if(!(counts.routes||0)) tips.push('① 前往【路由规则】添加一条规则（如 pattern=<code>*</code> + 命中供应商），未匹配模型将返回明确 404');
  if(!providers.some(function(p){return p.enabled;})) tips.push('② 在【供应商】页启用至少一家供应商（点击状态徽章可切换）');
  if(!(counts.keys||0)&&!(counts.routes||0)) tips.push('② 再到【路由规则】建默认路由，即可用 <code>/v1</code> 直接发起调用');
  if(!tips.length){ el.style.display='none'; return; }
  el.style.display='';
  el.innerHTML = '<b>🚀 快速开始（'+(counts.keys||0)+' 个 Key / '+(counts.routes||0)+' 条路由 / '+providers.filter(function(p){return p.enabled;}).length+' 个启用供应商）</b><div style="margin-top:8px;font-size:13px;color:var(--muted)">'+tips.join('<br>')+'</div>';
}

function render_cards(data){
  var c = document.getElementById('cards');
  if(!c) return;
  var s = data.stats||{};
  c.innerHTML = ''
    + card('⚙️ 供应商', (data.counts||{}).providers||0, '已启用 '+(data.providers||[]).filter(function(p){return p.enabled;}).length)
    + card('🔀 路由规则', (data.counts||{}).routes||0, '按优先级匹配')
    + card('🔑 Keys', (data.counts||{}).keys||0, '加密存储')
    + card('🚀 总请求', s.totalRequests||0, '成功率 '+(s.successRate||0)+'%');
}

function card(label,value,sub){return '<div class="card"><div class="label">'+label+'</div><div class="value">'+value+'</div><div class="sub">'+esc(sub)+'</div></div>';}

function render_ranking(list){
  var el = document.getElementById('ranking');
  if(!el) return;
  if(!list.length){el.innerHTML='<p style="color:var(--muted);font-size:13px">暂无请求数据，发一次请求后此处会显示排行</p>';return;}
  var max = Math.max.apply(null,list.map(function(x){return x.count;}));
  el.innerHTML = '<div class="table-scroll"><table><thead><tr><th>模型</th><th>调用次数</th></tr></thead><tbody>'
    + list.map(function(x){return '<tr><td>'+esc(x.model)+'</td><td><div class="bar"><span style="width:'+(x.count/max*100)+'%"></span></div>'+x.count+'</td></tr>';}).join('')
    + '</tbody></table></div>';
}

function render_health(list){
  var el = document.getElementById('health');
  if(!el) return;
  el.innerHTML = list.map(function(p){
    var color = p.successRate>=90?'ok':p.successRate>=60?'warn':'err';
    return '<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:13px"><span>'+esc(p.name)+'</span><span>'+(p.successRate||0)+'% · '+(p.avgLatency||0)+'ms</span></div><div class="bar"><span style="width:'+(p.successRate||0)+'%;background:'+(color==='ok'?'var(--ok-fg)':color==='warn'?'var(--warn-fg)':'var(--err-fg)')+'"></span></div></div>';
  }).join('') || '<p style="color:var(--muted);font-size:13px">暂无数据</p>';
}

function render_recent(list){
  var tb = document.querySelector('#recent tbody');
  if(!tb) return;
  tb.innerHTML = list.map(function(r){
    var d = new Date((r.created_at||0)*1000);
    var time = isNaN(d)?'':'0'.concat(d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)+':'+('0'+d.getSeconds()).slice(-2);
    var badge = r.ok?'<span class="badge ok">'+r.status+'</span>':'<span class="badge err">'+r.status+'</span>';
    return '<tr><td>'+time+'</td><td>'+esc(r.model||'-')+'</td><td>'+esc(r.provider||'-')+'</td><td>'+badge+'</td><td>'+(r.latency_ms||0)+'ms</td></tr>';
  }).join('') || '<tr><td colspan="5" style="color:var(--muted);text-align:center;padding:20px">暂无请求记录</td></tr>';
}

// ---- 系统设置（原「调用信息」：连接信息 + Token + 系统初始化 + 改密码）----
// ---- 在线聊天：选择供应商/模型，经网关 /v1/chat/completions 真实转发测试（Token 鉴权 + 路由匹配 + 上游转发）----
var chatState={providers:[],token:'',msgs:[]};
function render_chat(main){
  main.innerHTML = ''
    + '<div class="topbar"><h2>💬 在线聊天</h2><button class="btn ghost" onclick="chatClear()">🗑️ 清空对话</button></div>'
    + '<div class="panel">'
    + '<div class="form-row"><div style="flex:1">'
    + '<label>供应商（仅列出已启用供应商）</label><select id="ch-prov" onchange="chatOnProv()"><option value="">— 选择供应商 —</option></select>'
    + '</div><div style="flex:1">'
    + '<label>模型（该供应商支持的模型；可手动输入）</label><div style="display:flex;gap:8px"><select id="ch-model" style="flex:1" onchange="chatOnModel()"><option value="">— 选择模型 —</option></select><input id="ch-model-custom" style="flex:1;display:none" placeholder="手动输入模型名，如 gpt-4o-mini"></div>'
    + '</div></div>'
    + '<div class="form-row"><div style="flex:1"><label>系统提示词（可选）</label><input id="ch-sys" placeholder="例如：你是一个乐于助人的助手"></div></div>'
    + '<div id="ch-hint" style="font-size:12px;color:var(--muted)">选择供应商与模型后发送消息：请求走 <code>/v1/chat/completions</code>（调用 Token 鉴权 + 路由规则匹配 + 上游供应商转发），可验证整条链路。多轮上下文自动保留，可随时「清空对话」。</div>'
    + '</div>'
    + '<div class="panel"><div class="chat-msgs" id="chat-msgs"><div class="chat-msg ai">💬 选择一个模型，输入消息开始在线聊天测试；多轮上下文自动保留，可随时「清空对话」。</div></div>'
    + '<div class="chat-input"><textarea id="chat-text" rows="2" placeholder="输入消息，Enter 发送 / Shift+Enter 换行"></textarea><button class="btn" id="chat-send" onclick="chatSend()">🚀 发送</button></div>'
    + '<div class="chat-meta" id="chat-meta"></div>'
    + '</div>';
  chatState.msgs=[];
  document.getElementById('chat-text').addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();chatSend();}});
  chatLoad();
}
function chatLoad(){
  Promise.all([
    api('GET','/admin/api/providers').then(function(d){chatState.providers=(d&&d.data)||d||[];}).catch(function(){chatState.providers=[];}),
    api('GET','/admin/api/token').then(function(d){chatState.token=(d&&d.token)||'';}).catch(function(){chatState.token='';})
  ]).then(function(){
    var list=chatState.providers.filter(function(p){return p.enabled;});
    document.getElementById('ch-prov').innerHTML='<option value="">— 选择供应商 —</option>'+list.map(function(p){return '<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>';}).join('');
    var hint=document.getElementById('ch-hint');
    if(!list.length) hint.innerHTML='⚠️ 暂无已启用的供应商，请先到「供应商」页添加并启用。';
    else if(!chatState.token) hint.innerHTML='⚠️ 未获取到调用 Token：请先到「🛠️ 系统设置」配置调用 Token。';
  });
}
function chatOnProv(){
  var pid=document.getElementById('ch-prov').value;
  var modelEl=document.getElementById('ch-model');
  modelEl.innerHTML='<option value="">— 选择模型 —</option>';
  var custom=document.getElementById('ch-model-custom');custom.style.display='none';custom.value='';
  if(!pid) return;
  api('GET','/admin/api/providers/'+encodeURIComponent(pid)+'/models').then(function(d){
    var list=(d&&d.models)||[];
    if(list.length){
      modelEl.innerHTML='<option value="">— 选择模型 —</option>'+list.map(function(m){return '<option value="'+esc(m)+'">'+esc(m)+'</option>';}).join('')+'<option value="__custom__">✍️ 手动输入</option>';
    }else{
      modelEl.innerHTML='<option value="">— 选择模型 —</option><option value="__custom__">✍️ 手动输入</option>';
      document.getElementById('ch-hint').textContent='该供应商暂无已知模型（未配置 Key 或探测失败），可手动输入模型名测试。';
    }
  }).catch(function(){});
}
function chatOnModel(){
  var v=document.getElementById('ch-model').value;
  var c=document.getElementById('ch-model-custom');
  if(v==='__custom__'){c.style.display='';c.focus();}else{c.style.display='none';}
}
function chatCurrentModel(){
  var v=document.getElementById('ch-model').value;
  return v==='__custom__'?document.getElementById('ch-model-custom').value.trim():v;
}
function chatAddMsg(role,html,extra){
  var box=document.getElementById('chat-msgs');
  var d=document.createElement('div');
  d.className='chat-msg '+role+(extra?(' '+extra):'');
  d.innerHTML='<div class="who">'+(role==='user'?'🧑 我':'🤖 网关')+'</div>'+html;
  box.appendChild(d);
  d.scrollIntoView({behavior:'smooth',block:'nearest'});
  return d;
}
function chatSend(){
  var model=chatCurrentModel();
  if(!model){toast('请先选择供应商与模型，或手动输入模型名');return;}
  var text=document.getElementById('chat-text').value.trim();
  if(!text){toast('请输入消息内容');return;}
  if(!chatState.token){toast('❌ 未获取到调用 Token：请到「系统设置」配置');return;}
  var sys=document.getElementById('ch-sys').value.trim();
  if(chatState.msgs.length===0&&sys) chatState.msgs.push({role:'system',content:sys});
  chatState.msgs.push({role:'user',content:text});
  document.getElementById('chat-text').value='';
  chatAddMsg('user',esc(text));
  var tip=chatAddMsg('ai','请求中', 'loading');
  var t0=Date.now();
  var btn=document.getElementById('chat-send');btn.disabled=true;btn.textContent='⏳ 发送中…';
  fetch('/v1/chat/completions',{
    method:'POST',
    headers:{'content-type':'application/json','authorization':'Bearer '+chatState.token},
    body:JSON.stringify({model:model,messages:chatState.msgs,stream:false}),
    credentials:'include'
  }).then(function(r){
    return r.json().catch(function(){return {error:{message:'HTTP '+r.status+'：网关返回了不可解析的响应'}};}).then(function(j){return {ok:r.ok,status:r.status,j:j};});
  }).then(function(res){
    var ms=Date.now()-t0;
    var meta=document.getElementById('chat-meta');
    if(!res.ok){
      var em=res.j&&res.j.error;
      var msg=(em&&typeof em==='object'&&em.message)||(typeof em==='string'?em:(res.j&&res.j.message))||('HTTP '+res.status);
      var hint='';
      if(res.status===401) hint='（调用 Token 无效或未配置：请到「系统设置」确认）';
      else if(res.status===404) hint='（未匹配到转发路由：请到「路由规则」添加 pattern 匹配该模型的规则，如 *）';
      else if(res.status===502) hint='（上游转发失败：请检查供应商 Key 与可用性）';
      chatState.msgs.pop();
      tip.className='chat-msg ai err-bubble';
      tip.innerHTML='<div class="who">🤖 网关</div>'+esc(msg)+hint;
      meta.textContent='HTTP '+res.status+' · '+ms+'ms';
      return;
    }
    var choice=res.j&&res.j.choices&&res.j.choices[0];
    var m=(choice&&choice.message)||{};
    var content=(typeof m.content==='string'?m.content:'').trim()||'（空回复：模型未返回 content）';
    var reasoning=(typeof m.reasoning_content==='string'&&m.reasoning_content.trim())?'<div class="who">🧠 思考（reasoning_content）</div>'+esc(m.reasoning_content).replace(/\\n/g,'<br>')+'<br>':'';
    var usage=(res.j&&res.j.usage)?(' · '+(res.j.usage.prompt_tokens||0)+'→'+(res.j.usage.completion_tokens||0)+' tokens'):'';
    tip.className='chat-msg ai';
    tip.innerHTML='<div class="who">🤖 '+esc(model)+usage+'</div>'+reasoning+esc(content).replace(/\\n/g,'<br>');
    chatState.msgs.push({role:'assistant',content:content});
    meta.textContent='✅ 回复完成 · '+ms+'ms · HTTP 200';
  }).catch(function(e){
    chatState.msgs.pop();
    tip.className='chat-msg ai err-bubble';
    tip.innerHTML='<div class="who">🤖 网关</div>请求失败：'+esc((e&&e.message)||String(e));
  }).then(function(){
    btn.disabled=false;btn.textContent='🚀 发送';
  });
}
function chatClear(){
  chatState.msgs=[];
  document.getElementById('chat-msgs').innerHTML='<div class="chat-msg ai">💬 对话已清空，可重新开始。</div>';
  var el=document.getElementById('chat-meta');if(el)el.textContent='';
  el=document.getElementById('ch-sys');if(el)el.value='';
  el=document.getElementById('chat-text');if(el)el.value='';
}

function render_settings(main){
  main.innerHTML = '<div class="topbar"><h2>🛠️ 系统设置</h2><button class="btn ghost" onclick="openReinit()">🔁 系统初始化</button></div>'
    + '<div class="conn-card" id="conn"></div>'
    + '<div class="panel" style="margin-top:24px"><h3>📝 修改配置</h3><div id="settings-form"></div></div>'
    + '<div class="panel" style="margin-top:24px"><h3>🔑 修改登录密码</h3><div id="pwd-form"></div></div>';
  api('GET','/admin/api/settings').then(function(d){
    var s = d.data || d;
    state.settings = s;
    render_conn(s);
    render_settings_form(s);
  }).catch(function(e){ toast('加载失败：'+(e&&e.error||e)); });
  render_pwd_form();
}

function gwBase(raw){
  var b=String(raw||location.origin||'').replace(/\\/+$/,'');
  return /\\/v1$/i.test(b)?b:b+'/v1';
}
function render_conn(s){
  var baseUrl = gwBase(s.baseUrl);
  var token = s.apiToken || '（未设置，请在下方设置 API_TOKEN）';
  var curl = 'curl -X POST "'+baseUrl+'/chat/completions" \\\\\\n'
           + '  -H "Authorization: Bearer '+esc(s.apiToken||'YOUR_TOKEN')+'" \\\\\\n'
           + '  -H "Content-Type: application/json" \\\\\\n'
           + '  -d \\'{ "model": "gpt-4o-mini", "messages": [{"role":"user","content":"hello"}] }\\'';
  document.getElementById('conn').innerHTML = ''
    + row_html('🏷️ 项目名', esc(s.projectName||'iRouter')+' <span class="badge ok">v3.6.0 · D1</span>')
    + row_html('🌐 网关 Base URL', '<code id="conn-url">'+esc(baseUrl)+'</code> <span class="copy" onclick="copyText(\\'conn-url\\')">📋 复制</span>')
    + row_html('🔑 调用 Token', '<code id="conn-token">'+esc(token)+'</code> <span class="copy" onclick="copyText(\\'conn-token\\')">📋 复制</span>')
    + '<div style="margin-top:14px"><label style="font-size:12px;color:var(--muted)">📦 快速调用示例（curl）</label><pre id="conn-curl">'+esc(curl)+'</pre><span class="copy" onclick="copyText(\\'conn-curl\\')">📋 复制</span></div>';
}

function row_html(k,v){return '<div class="row"><div><div style="font-size:12px;color:var(--muted)">'+k+'</div><div style="font-size:14px;margin-top:4px">'+v+'</div></div></div>';}

function render_settings_form(s){
  document.getElementById('settings-form').innerHTML = ''
    + '<div class="form-row"><div style="flex:1"><label>项目名</label><input id="f-project" value="'+esc(s.projectName||'iRouter')+'"></div>'
    + '<div style="flex:1"><label>网关 Base URL（留空=自动取当前域名并补 /v1）</label><input id="f-base" value="'+esc(s.baseUrl||'')+'" placeholder="https://irouter.pages.dev"></div></div>'
    + '<div class="form-row"><div style="flex:1"><label>调用 Token（外部调用网关用的鉴权 key，留空=不修改；≥8 位可更新）</label><div style="display:flex;gap:8px"><input id="f-token" type="password" style="flex:1" placeholder="sk-xxxxxxxx（留空则不修改）"><button class="btn ghost" onclick="genApiToken()">🎲 自动生成</button></div></div></div>'
    + '<button class="btn" onclick="saveSettings()">💾 保存</button>'
    + '<span style="margin-left:12px;font-size:12px;color:var(--muted)">Token 与管理员登录密码相互独立；自动生成后点「保存」生效并刷新展示。</span>';
}
window.genApiToken=function(){
  var c='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';var s='sk-';
  for(var i=0;i<32;i++)s+=c[Math.floor(Math.random()*c.length)];
  var el=document.getElementById('f-token');if(!el)return;
  el.value=s;toast('🎲 已自动生成新 Token，点击「保存」生效');
};

window.saveSettings = function(){
  var body = {
    projectName: document.getElementById('f-project').value.trim(),
    baseUrl: document.getElementById('f-base').value.trim(),
    apiToken: document.getElementById('f-token').value,
  };
  api('PUT','/admin/api/settings', body).then(function(d){
    toast('✅ 已保存');
    document.getElementById('f-token').value='';
    fetchDashboard && fetchDashboard();   // 静默刷新回填
  }).catch(function(e){ toast('保存失败：'+(e&&e.error||e)); });
};

// 修改登录密码（校验当前密码；仅 meta 来源凭据可改，env 来源提示改环境变量）
function render_pwd_form(){
  document.getElementById('pwd-form').innerHTML = ''
    + '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">修改后台登录密码（需输入当前密码验证；若密码来自环境变量 DEFAULT_ADMIN_PASS 请直接改环境变量）</div>'
    + '<div class="form-row"><div style="flex:1"><label>当前密码</label><input id="pw-old" type="password" placeholder="当前登录密码" autocomplete="current-password"></div>'
    + '<div style="flex:1"><label>新密码（至少 6 位）</label><input id="pw-new" type="password" placeholder="新密码" autocomplete="new-password"></div></div>'
    + '<div class="form-row"><div style="flex:1"><label>确认新密码</label><input id="pw-new2" type="password" placeholder="再次输入新密码" autocomplete="new-password"></div><div style="flex:1"></div></div>'
    + '<button class="btn" onclick="changePassword()">🔑 修改密码</button>';
}
window.changePassword=function(){
  var oldP=document.getElementById('pw-old').value, newP=document.getElementById('pw-new').value, newP2=document.getElementById('pw-new2').value;
  if(!oldP){toast('❌ 请输入当前密码');return;}
  if(newP.length<6){toast('❌ 新密码至少 6 位');return;}
  if(newP!==newP2){toast('❌ 两次输入的新密码不一致');return;}
  api('POST','/admin/api/password',{old_password:oldP,new_password:newP}).then(function(){
    toast('✅ 密码已修改');
    document.getElementById('pw-old').value=document.getElementById('pw-new').value=document.getElementById('pw-new2').value='';
  }).catch(function(e){ toast('❌ '+((e&&e.error)||e||'修改失败')); });
};

window.copyText = function(id){var el=document.getElementById(id);var txt=el.textContent||el.innerText;navigator.clipboard.writeText(txt).then(function(){toast('📋 已复制');},function(){toast('复制失败，请手动选择');});};

// ---- 供应商（Key 已并入供应商：增改表单直接填写/管理 Key）----
function render_providers(main){
  main.innerHTML = '<div class="topbar"><h2>⚙️ 供应商</h2><button class="btn" onclick="openProvider()">＋ 添加供应商</button></div>'
    + '<div class="panel"><div class="table-scroll"><table><thead><tr><th>名称</th><th>标识</th><th>Base URL</th><th>协议</th><th>内置</th><th>Key</th><th>状态</th><th>操作</th></tr></thead><tbody id="prov-tbody"></tbody></table></div></div>';
  api('GET','/admin/api/providers').then(function(d){state.providers=d.data||d;render_prov_table();}).catch(function(e){toast(e&&e.error||e);});
}
function render_prov_table(){
  var tb=document.getElementById('prov-tbody');
  tb.innerHTML=state.providers.map(function(p){
    var kb=(p.keysBrief||[]);
    var keysText=kb.length?kb.map(function(k){return '<code title="'+esc(k.name||'')+'">'+esc(k.masked||'****')+'</code>';}).join('<br>') : '<span style="color:var(--muted)">未设置</span>';
    var delBtn=p.builtin?'':'<button class="danger" onclick="deleteProvider(\\''+esc(p.id)+'\\')">🗑️ 删除</button>';
    return '<tr><td>'+esc(p.name)+'</td><td><code>'+esc(p.id)+'</code></td><td><code>'+esc(p.base_url)+'</code></td><td>'+esc(p.protocol)+'</td>'
      + '<td><span class="badge '+(p.builtin?'info':'plain')+'">'+(p.builtin?'内置':'自定义')+'</span></td>'
      + '<td>'+keysText+'</td>'
      + '<td><span class="badge '+(p.enabled?'ok':'err')+'" style="cursor:pointer" onclick="toggleProvider(\\''+esc(p.id)+'\\')" title="点击切换状态">'+(p.enabled?'启用':'停用')+'</span></td>'
      + '<td><div class="op-wrap"><button class="btn ghost" onclick="toggleOp(this)">⚙️ 操作 ▾</button><div class="op-drop">'
      + '<button onclick="testProvider(\\''+esc(p.id)+'\\')">🧪 测试连接</button>'
      + '<button onclick="editProvider(\\''+esc(p.id)+'\\')">✏️ 编辑</button>'
      + delBtn
      + '</div></div></td></tr>';
  }).join('')||'<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:20px">暂无供应商</td></tr>';
}
// 胶囊操作下拉：点击切换，点击菜单项或页面其它处自动关闭
window.toggleOp=function(btn){
  var w=btn.closest('.op-wrap');
  var was=w.classList.contains('open');
  document.querySelectorAll('.op-wrap.open').forEach(function(x){x.classList.remove('open');});
  if(!was) w.classList.add('open');
};
document.addEventListener('click',function(e){
  if(!e.target.closest('.op-wrap')){document.querySelectorAll('.op-wrap.open').forEach(function(x){x.classList.remove('open');});}
  else if(e.target.closest('.op-drop')){document.querySelectorAll('.op-wrap.open').forEach(function(x){x.classList.remove('open');});}
});
window.testProvider=function(id){
  api('POST','/admin/api/providers/'+id+'/test').then(function(r){
    toast((r.ok?'✅ ':'❌ ')+r.message);
  }).catch(function(e){
    toast('❌ '+(e&&e.error||e));
  });
};
window.openProvider=function(){window._delKeys=[];setModal('<h3>添加供应商</h3>'
  +'<div class="form-row"><div style="flex:1"><label>名称</label><input id="m-name"></div><div style="flex:1"><label>标识（唯一 ID）</label><input id="m-id" placeholder="my-provider"></div></div>'
  +'<div class="form-row"><div style="flex:1"><label>Base URL</label><input id="m-url" placeholder="https://api.example.com/v1"></div><div style="flex:1"><label>协议</label><select id="m-proto"><option value="openai">openai</option><option value="anthropic">anthropic</option><option value="gemini">gemini</option><option value="custom">custom</option></select></div></div>'
  +'<div class="form-row"><div style="flex:1"><label>API Key（AES-GCM 加密存储，可稍后在编辑中追加）</label><input id="m-key" type="password" placeholder="sk-...（可选）"></div></div>'
  +'<div class="modal-actions"><button class="btn" onclick="submitProvider()">保存</button></div>');};
window.submitProvider=function(){api('POST','/admin/api/providers',{name:document.getElementById('m-name').value,id:document.getElementById('m-id').value,base_url:document.getElementById('m-url').value,protocol:document.getElementById('m-proto').value,key:document.getElementById('m-key').value.trim()}).then(function(){closeModal();render_providers(document.getElementById('view'));toast('✅ 已添加');});};
window.editProvider=function(id){var p=state.providers.find(function(x){return x.id===id;});if(!p)return;window._delKeys=[];
  var kb=(p.keysBrief||[]).map(function(k){
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><code style="flex:1">'+esc(k.masked||'****')+'</code><span style="color:var(--muted);font-size:12px">'+esc(k.name||'')+'</span><button class="btn ghost" style="padding:2px 10px;font-size:12px" onclick="markDelKey(this,\\''+esc(k.id)+'\\')">移除</button></div>';
  }).join('')||'<div style="color:var(--muted);font-size:12px;margin-bottom:6px">暂无 Key</div>';
  setModal('<h3>编辑供应商</h3>'
  +'<div class="form-row"><div style="flex:1"><label>名称</label><input id="m-name" value="'+esc(p.name)+'"></div><div style="flex:1"><label>Base URL</label><input id="m-url" value="'+esc(p.base_url)+'"></div></div>'
  +'<div class="form-row"><div style="flex:1"><label>启用</label><select id="m-enabled"><option value="1"'+(p.enabled?' selected':'')+'>启用</option><option value="0"'+(!p.enabled?' selected':'')+'>停用</option></select></div><div style="flex:1"></div></div>'
  +'<div style="margin-bottom:6px"><label style="font-size:12px;color:var(--muted)">已绑定 Keys（点击「移除」，保存后删除）</label><div id="m-keys" style="margin-top:4px">'+kb+'</div></div>'
  +'<div class="form-row"><div style="flex:1"><label>追加新 Key（留空则不添加）</label><input id="m-key" type="password" placeholder="sk-..."></div></div>'
  +'<div class="modal-actions"><button class="btn" onclick="submitEditProvider(\\''+esc(id)+'\\')">保存</button></div>');};
window.submitEditProvider=function(id){api('PUT','/admin/api/providers/'+id,{name:document.getElementById('m-name').value,base_url:document.getElementById('m-url').value,enabled:document.getElementById('m-enabled').value==='1',key:document.getElementById('m-key').value.trim(),remove_keys:window._delKeys||[]}).then(function(){window._delKeys=[];closeModal();render_providers(document.getElementById('view'));toast('✅ 已更新');});};
window.markDelKey=function(btn,kid){if(btn.disabled)return;btn.disabled=true;btn.textContent='✓ 待删除';btn.style.opacity=.55;(window._delKeys=window._delKeys||[]).push(kid);};
window.deleteProvider=function(id){if(!confirm('确认删除？'))return;api('DELETE','/admin/api/providers/'+id).then(function(){render_providers(document.getElementById('view'));toast('🗑️ 已删除');});};
window.toggleProvider=function(id){var p=state.providers.find(function(x){return x.id===id;});if(!p)return;api('PUT','/admin/api/providers/'+id,{enabled:!p.enabled}).then(function(){render_providers(document.getElementById('view'));toast(p.enabled?'✅ 已停用':'✅ 已启用');}).catch(function(e){toast('切换失败：'+(e&&e.error||e));});};

// ---- 路由规则 ----
function render_routes(main){
  main.innerHTML='<div class="topbar"><h2>🔀 路由规则</h2><button class="btn" onclick="openRoute()">＋ 添加规则</button></div>'
    + '<div class="panel"><div class="table-scroll"><table><thead><tr><th>名称</th><th>匹配模式</th><th>命中供应商</th><th>兜底</th><th>优先级</th><th>模型映射</th><th>操作</th></tr></thead><tbody id="rt-tbody"></tbody></table></div></div>';
  api('GET','/admin/api/routes').then(function(d){state.routes=d.data||d;render_route_table();}).catch(function(e){toast(e&&e.error||e);});
}
function render_route_table(){
  var tb=document.getElementById('rt-tbody');
  tb.innerHTML=state.routes.map(function(r){
    var mm=modelMapToText(r.model_map);
    return '<tr><td>'+esc(r.name||'(未命名)')+'</td><td><code>'+esc(r.pattern)+'</code></td>'
      +'<td>'+(r.providers||[]).map(esc).join(' → ')+'</td>'
      +'<td>'+((r.fallback||[]).map(esc).join(' → ')||'<span style="color:var(--muted)">-</span>')+'</td>'
      +'<td>'+(r.priority||0)+'</td>'
      +'<td style="font-size:12px;color:var(--muted)">'+(mm?esc(mm):'-')+'</td>'
      +'<td><div class="op-wrap"><button class="btn ghost" onclick="toggleOp(this)">⚙️ 操作 ▾</button><div class="op-drop">'
      +'<button onclick="editRoute(\\''+esc(r.id)+'\\')">✏️ 编辑</button>'
      +'<button class="danger" onclick="deleteRoute(\\''+esc(r.id)+'\\')">🗑️ 删除</button>'
      +'</div></div></td></tr>';
  }).join('');
}
window.openRoute=function(){setModal('<h3>添加路由规则</h3>'
  +'<div class="form-row"><div style="flex:1"><label>名称</label><input id="r-name"></div><div style="flex:1"><label>匹配模式（支持 * 通配，如 gpt-*）</label><input id="r-pattern" value="*"></div></div>'
  +'<div class="form-row"><div style="flex:1"><label>命中供应商 ID（逗号分隔，有序）</label><input id="r-prov" placeholder="openai,anthropic"></div><div style="flex:1"><label>兜底供应商 ID</label><input id="r-fb" placeholder="openrouter"></div></div>'
  +'<div class="form-row"><div style="flex:1"><label>优先级（大者优先）</label><input id="r-pri" type="number" value="0"></div><div style="flex:1"><label>模型映射（可选：agent模型=上游模型，逗号分隔）</label><input id="r-map" placeholder="gpt-4o=deepseek-chat, claude-3.5-sonnet=hunyuan-turbo"></div></div>'
  +'<p style="font-size:11px;color:var(--muted);margin-top:4px">模型映射让 agent 用 A 的模型名调用 B 的模型：请求模型名命中映射时，转发前改写为上游模型名；留空=原样透传。</p>'
  +'<div class="modal-actions"><button class="btn" onclick="submitRoute()">保存</button></div>');};
window.submitRoute=function(){api('POST','/admin/api/routes',{name:document.getElementById('r-name').value,pattern:document.getElementById('r-pattern').value,providers:document.getElementById('r-prov').value.split(',').map(function(s){return s.trim();}).filter(Boolean),fallback:document.getElementById('r-fb').value.split(',').map(function(s){return s.trim();}).filter(Boolean),priority:parseInt(document.getElementById('r-pri').value)||0,model_map:parseModelMap(document.getElementById('r-map').value)}).then(function(){closeModal();render_routes(document.getElementById('view'));toast('✅ 已添加');});};
window.editRoute=function(id){var r=state.routes.find(function(x){return x.id===id;});if(!r)return;setModal('<h3>编辑路由规则</h3>'
  +'<div class="form-row"><div style="flex:1"><label>名称</label><input id="r-name" value="'+esc(r.name||'')+'"></div><div style="flex:1"><label>匹配模式</label><input id="r-pattern" value="'+esc(r.pattern)+'"></div></div>'
  +'<div class="form-row"><div style="flex:1"><label>命中供应商</label><input id="r-prov" value="'+esc((r.providers||[]).join(','))+'"></div><div style="flex:1"><label>兜底</label><input id="r-fb" value="'+esc((r.fallback||[]).join(','))+'"></div></div>'
  +'<div class="form-row"><div style="flex:1"><label>优先级</label><input id="r-pri" type="number" value="'+esc(r.priority||0)+'"></div><div style="flex:1"><label>模型映射（agent模型=上游模型）</label><input id="r-map" value="'+esc(modelMapToText(r.model_map))+'"></div></div>'
  +'<div class="modal-actions"><button class="btn" onclick="submitEditRoute(\\''+esc(id)+'\\')">保存</button></div>');};
window.submitEditRoute=function(id){api('PUT','/admin/api/routes/'+id,{name:document.getElementById('r-name').value,pattern:document.getElementById('r-pattern').value,providers:document.getElementById('r-prov').value.split(',').map(function(s){return s.trim();}).filter(Boolean),fallback:document.getElementById('r-fb').value.split(',').map(function(s){return s.trim();}).filter(Boolean),priority:parseInt(document.getElementById('r-pri').value)||0,model_map:parseModelMap(document.getElementById('r-map').value)}).then(function(){closeModal();render_routes(document.getElementById('view'));toast('✅ 已更新');});};
window.deleteRoute=function(id){if(!confirm('确认删除？'))return;api('DELETE','/admin/api/routes/'+id).then(function(){render_routes(document.getElementById('view'));toast('🗑️ 已删除');});};
// 模型映射：文本 "a=b, c=d" ⇄ 对象 {a:'b',c:'d'}
function parseModelMap(txt){var o={};String(txt||'').split(/[,，\\n]/).forEach(function(p){var i=p.indexOf('=');if(i>0){var k=p.slice(0,i).trim(),v=p.slice(i+1).trim();if(k&&v)o[k]=v;}});return o;}
function modelMapToText(mm){var out=[];for(var k in (mm||{})){if(Object.prototype.hasOwnProperty.call(mm,k))out.push(k+'='+mm[k]);}return out.join(', ');}

// ---- Keys 已并入「供应商」页（添加/编辑供应商表单直接管理 Key）----
// 原独立 Keys 页面（render_keys/openKey/submitKey/deleteKey）自 v3.5.0 移除；
// 后端 /admin/api/keys* 接口保留，供兼容与 /v1 探测逻辑使用。

// ---- 使用指南 ----
function render_guide(main){
  main.innerHTML='<div class="topbar"><h2>❔ 使用指南</h2><button class="ghost btn" onclick="localStorage.removeItem(\\'irouter_guide_dismissed\\');toast(\\'已重置，下次进入将再次弹出\\')">🔁 重置引导</button></div>'
    +'<div class="panel" id="guide-box"></div>';
  render_guide_content(document.getElementById('guide-box'));
}
function render_guide_mini(){
  var mount=document.getElementById('guide-mount');
  if(!mount) return;
  mount.innerHTML='<div class="panel" style="border-color:var(--accent)"><h3>👋 欢迎使用 iRouter v3.6.0（Cloudflare D1 版）</h3><div id="guide-mini-body"></div><button class="btn ghost" onclick="document.getElementById(\\'guide-mount\\').innerHTML=\\'\\'">关闭</button></div>';
  render_guide_content(document.getElementById('guide-mini-body'), true);
  if(!localStorage.getItem('irouter_guide_dismissed')){
    setTimeout(function(){var b=document.getElementById('guide-mini-body');if(b) render_guide_content(b,true);},50);
  }
}
function render_guide_content(el, mini){
  if(!el) return;
  var steps = [
    {t:'部署完成',d:'访问「健康检查」<code>/health</code> 应返回 <code>{"ok":true,"storage":"d1"}</code>；后台各页面能正常显示数据即说明 D1 绑定正常。'},
    {t:'添加供应商',d:'「供应商」页 → ＋ 添加，填写名称、标识、Base URL、协议（openai/anthropic/gemini），可同时填写 API Key。'},
    {t:'配置 Key',d:'供应商「编辑」弹窗中可追加 Key / 移除 Key（AES-GCM 加密存储，仅你可见）。'},
    {t:'设置路由规则',d:'「路由规则」页 → ＋ 添加，pattern 支持 <code>*</code> 通配，命中后按供应商列表顺序尝试 + 兜底。'},
    {t:'验证转发',d:'复制「系统设置」页的 curl 示例，或直接 POST <code>/v1/chat/completions</code>，Header 带 <code>Authorization: Bearer &lt;API_TOKEN&gt;</code>。'},
    {t:'监控',d:'回到「首页」看模型排行 / 供应商健康度 / 最近请求。'},
  ];
  el.innerHTML='<ol style="padding-left:20px">'+
    steps.map(function(s,idx){return '<li style="margin-bottom:12px"><b>'+s.t+'</b><br><span style="color:var(--nav);font-size:13px">'+s.d+'</span></li>';}).join('')+
    '</ol>'+
    (mini?'':'<p style="margin-top:16px;color:var(--muted);font-size:12px">💡 「系统设置」页可随时查看网关 Base URL 与调用 Token，支持修改与自动生成（与登录密码相互独立）；该页还提供「系统初始化」一键重置后台凭据。</p>');
  if(!mini) localStorage.setItem('irouter_guide_dismissed','1');
}

// ---- 登录 / 首次初始化 ----
function render_login(){
  var ab = document.getElementById('appbar');
  if(ab) ab.style.display='none';
  document.getElementById('view').innerHTML='<div class="login-box">'
    +'<h2 style="text-align:center;margin-bottom:24px">🔐 iRouter 管理后台</h2>'
    +'<label style="font-size:12px;color:var(--muted)">管理员密码</label>'
    +'<input id="login-pass" type="password" style="width:100%;background:var(--input-bg);border:1px solid var(--border);color:var(--fg);padding:10px;border-radius:10px;margin:8px 0 16px" placeholder="请输入密码" onkeydown="if(event.key===\\'Enter\\')doLogin()">'
    +'<button class="btn" style="width:100%;padding:11px" onclick="doLogin()">登录</button>'
    +'<p style="font-size:11px;color:var(--muted);margin-top:16px;text-align:center">凭据来自环境变量（DEFAULT_ADMIN_PASS / SESSION_SECRET）或首次初始化</p>'
    +'<p style="font-size:12px;text-align:center;margin-top:10px"><a href="javascript:void(0)" onclick="openReinit()" style="color:var(--accent)">🔁 重新初始化（需当前密码）</a></p></div>';
}
window.doLogin=function(){api('POST','/admin/api/login',{password:document.getElementById('login-pass').value}).then(function(){toast('✅ 登录成功');render();startAutoRefresh();}).catch(function(e){toast('❌ '+((e&&e.error)||e||'登录失败'));});};

// 重新初始化入口：输入当前密码校验通过后，切换到初始化表单（带 current_password 提交）
window.openReinit=function(){
  setModal('<h3>🔁 系统初始化</h3>'
    +'<p style="font-size:12px;color:var(--muted);margin:6px 0 14px">将重置管理员密码与会话密钥（凭据存储于 D1 数据库 meta，不占环境变量）。为安全起见，请先输入<b>当前管理员密码</b>验证身份。</p>'
    +'<label style="font-size:12px;color:var(--muted)">当前管理员密码</label>'
    +'<input id="reinit-cur" type="password" style="width:100%;background:var(--input-bg);border:1px solid var(--border);color:var(--fg);padding:10px;border-radius:10px;margin:8px 0 4px" placeholder="当前密码" onkeydown="if(event.key===\\'Enter\\')doReinitStep1()">'
    +'<div class="modal-actions"><button class="btn" onclick="doReinitStep1()">下一步</button></div>');
};
window.doReinitStep1=function(){
  var cur=document.getElementById('reinit-cur').value;
  if(!cur){toast('❌ 请输入当前密码');return;}
  api('POST','/admin/api/login',{password:cur}).then(function(){
    window._reinitCurPass=cur;
    closeModal();
    render_setup(true);
  }).catch(function(e){toast('❌ 当前密码验证失败：'+((e&&e.error)||e||'密码错误'));});
};

// 未初始化（缺管理密码/会话密钥）时渲染快速初始化表单 —— 开箱即用，无需先配置环境变量
// reinit=true：重新初始化模式（已初始化，提交时带 current_password，后端校验后覆盖）
function render_setup(reinit){
  var ab = document.getElementById('appbar');
  if(ab) ab.style.display='none';
  var t = reinit ? { t:'🔄 重新初始化', d:'已配置过凭据，将用新密码/新密钥覆盖。提交前需校验当前密码。' } : { t:'🚀 iRouter 快速初始化', d:'首次部署请在此设置后台凭据，立即开始使用（已配置环境变量则可直接登录）' };
  document.getElementById('view').innerHTML='<div class="login-box">'
    +'<h2 style="text-align:center;margin-bottom:6px">'+t.t+'</h2>'
    +'<p style="text-align:center;font-size:12px;color:var(--muted);margin-bottom:20px">'+t.d+'</p>'
    +'<label style="font-size:12px;color:var(--muted)">管理员密码（至少 6 位）</label>'
    +'<input id="s-pass" type="password" style="width:100%;background:var(--input-bg);border:1px solid var(--border);color:var(--fg);padding:10px;border-radius:10px;margin:8px 0 14px" placeholder="设置登录密码">'
    +'<label style="font-size:12px;color:var(--muted)">会话密钥 Session Secret（至少 12 位随机串）</label>'
    +'<div style="display:flex;gap:8px;margin:8px 0 20px"><input id="s-secret" type="text" style="flex:1;background:var(--input-bg);border:1px solid var(--border);color:var(--fg);padding:10px;border-radius:10px" placeholder="如 8J3k9xQ2LmNp"><button class="btn ghost" onclick="genSecret()">🎲 随机生成</button></div>'
    +'<button class="btn" style="width:100%;padding:11px" onclick="doSetup('+(reinit?'true':'false')+')">'+(reinit?'确认重新初始化':'完成初始化，去登录')+'</button>'
    +'<p style="font-size:11px;color:var(--muted);margin-top:14px;text-align:center">凭据仅加密存储于 D1 数据库 meta 中，不占环境变量</p></div>';
}
window.genSecret=function(){var c='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';var s='';for(var i=0;i<24;i++)s+=c[Math.floor(Math.random()*c.length)];document.getElementById('s-secret').value=s;};
window.doSetup=function(reinit){
  var p=document.getElementById('s-pass').value, s=document.getElementById('s-secret').value.trim();
  if(p.length<6){toast('❌ 密码至少 6 位');return;}
  if(s.length<12){toast('❌ 会话密钥至少 12 位');return;}
  var body={password:p,session_secret:s};
  if(reinit) body.current_password=window._reinitCurPass||'';
  api('POST','/admin/api/bootstrap',body).then(function(){toast(reinit?'✅ 已重新初始化，请用新密码登录':'✅ 初始化完成，请登录');window._reinitCurPass='';render_login();}).catch(function(e){toast('❌ '+((e&&e.error)||e||'初始化失败'));});
};

// ---- 模态框 ----
// setModal：弹窗内容底部按钮自动与「取消」拼接为单个胶囊分节按钮（.modal-actions）；内容里无 .modal-actions 时回退旧样式
function setModal(html){var box=document.getElementById('modal-box');box.innerHTML=html;var cancel='<button class="btn ghost" onclick="closeModal()">取消</button>';var actions=box.querySelector('.modal-actions');if(actions){actions.insertAdjacentHTML('beforeend',cancel);}else{box.insertAdjacentHTML('beforeend','<div style="margin-top:16px;text-align:right">'+cancel+'</div>');}document.getElementById('modal').className='modal show';}
window.closeModal=function(){document.getElementById('modal').className='modal';};

// ============ 导航 + 自动刷新 ============
document.getElementById('navToggle').onclick=function(){var n=document.getElementById('navToggle');document.querySelector('.sidebar').classList.toggle('open');document.getElementById('navOverlay').classList.toggle('show');n.classList.toggle('open');};
document.getElementById('navOverlay').onclick=function(){document.querySelector('.sidebar').classList.remove('open');this.classList.remove('show');document.getElementById('navToggle').classList.remove('open');};
document.querySelectorAll('.nav a[data-view]').forEach(function(a){
  a.onclick=function(e){e.preventDefault();document.querySelectorAll('.nav a').forEach(function(x){x.classList.remove('active');});a.classList.add('active');currentView=a.dataset.view;location.hash='#'+a.dataset.view;document.querySelector('.sidebar').classList.remove('open');document.getElementById('navOverlay').classList.remove('show');document.getElementById('navToggle').classList.remove('open');render();};
});
document.getElementById('logout').onclick=function(e){e.preventDefault();document.querySelector('.sidebar').classList.remove('open');document.getElementById('navOverlay').classList.remove('show');document.getElementById('navToggle').classList.remove('open');document.cookie='irouter_sid=; Max-Age=0; Path=/';toast('已退出');render_login();};
window.onhashchange=function(){var v=location.hash.replace('#','');if(TITLES[v]){currentView=v;render();}};

// 30 秒自动刷新（页面可见时才请求，节省额度）
var refreshTimer=null;
function startAutoRefresh(){
  if(refreshTimer) clearInterval(refreshTimer);
  refreshTimer=setInterval(function(){if(document.hidden) return;if(currentView==='dashboard') fetchDashboard();},30000);
}
startAutoRefresh();

// 首次渲染
(function init(){
  if(location.hash) currentView=location.hash.replace('#','');
  if(TITLES[currentView]){var a=document.querySelector('.nav a[data-view="'+currentView+'"]');if(a)a.classList.add('active');}
  // 未初始化 → 快速初始化表单；未登录 → 登录表单；已登录 → 主界面
  api('GET','/admin/api/bootstrap').then(function(d){
    if(d && d.required) return render_setup();
    api('GET','/admin/api/dashboard').then(function(){render();startAutoRefresh();}).catch(function(){render_login();});
  }).catch(function(){render_login();});
})();
</script>
</body></html>`;
