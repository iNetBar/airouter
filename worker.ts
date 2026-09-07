// worker.ts — iRouter v3.2.0 (Cloudflare Workers + D1)
// 相比 v3.0 (KV 版) 的变化：存储层从 Deno KV / Workers KV 全部迁移到 D1 (db.ts)
// Hono 路由定义、API 路径、前端 dashboard.html 完全不变（路由层/前端零改动）

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import * as db from './db';

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

// 管理员鉴权（Cookie session + HMAC-SHA256 签名）
async function isAdmin(req: Request, env: Env): Promise<boolean> {
    const cookie = req.headers.get('cookie') || '';
    const m = cookie.match(/irouter_sid=([^;]+)/);
    if (!m) return false;
    try {
        const [user, sig] = atob(m[1]).split(':');
        const expected = await hmacSha256(env.SESSION_SECRET, 'admin');
        return user === 'admin' && sig === expected;
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
const settingsCache: { data: db.Settings | null; at: number } = { data: null, at: 0 };
async function getSettingsCached(env: Env): Promise<db.Settings> {
    if (settingsCache.data && Date.now() - settingsCache.at < 60_000) return settingsCache.data;
    const s = await db.getSettings(env.DB);
    settingsCache.data = s;
    settingsCache.at = Date.now();
    return s;
}

// 错误响应
function err(status: number, msg: string) {
    return new Response(JSON.stringify({ error: msg }), {
        status, headers: { 'content-type': 'application/json' },
    });
}

// =====================================================================
// 主 fetch handler
// =====================================================================
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const app = new Hono<{ Bindings: Env }>();

        app.use('*', cors({ origin: '*', credentials: false }));
        app.use('*', logger());

        // ---------- 首次启动：迁移内置供应商（整个 isolate 只执行一次，幂等）----------
        if (!builtinsInit) {
            builtinsInit = db.migrateBuiltins(env.DB).catch((e) => console.error('migrateBuiltins failed:', e));
        }
        ctx.waitUntil(builtinsInit);

        // ---------- 健康检查 ----------
        app.get('/health', (c) => c.json({ ok: true, version: '3.2.0', storage: 'd1' }));

        // =================================================================
        // 代理转发（流式透传，CPU < 5ms，不 buffer 完整响应）
        // =================================================================
        app.post('/v1/chat/completions', async (c) => {
            const auth = c.req.header('authorization') || '';
            const token = auth.replace(/^Bearer\s+/i, '');
            // 鉴权键：环境变量 PROXY_KEY 优先；未配置时回退到后台「调用信息」里设置的 Token；
            // 两者都未配置则拒绝服务（绝不无鉴权放行）
            const expectedKey = env.PROXY_KEY || (await getSettingsCached(env)).apiToken;
            if (!expectedKey) return err(500, '网关 Token 未配置：请设置 PROXY_KEY 环境变量，或在管理后台「调用信息」中设置 Token');
            if (!token || token !== expectedKey) return err(401, 'Unauthorized');

            const body = await c.req.json().catch(() => null);
            if (!body || !body.model) return err(400, 'model required');

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

            const providers = await db.getProviders(env.DB);
            const tryList = matched
                ? [...matched.providers, ...matched.fallback]
                : providers.filter(p => p.enabled).map(p => p.id);

            let lastErr: any = null;
            for (const pid of tryList) {
                const p = providers.find(x => x.id === pid);
                if (!p) continue;
                if (p.protocol !== 'openai') {
                    lastErr = new Error(`供应商 ${p.id} 的协议 ${p.protocol} 暂未实现（当前仅支持 openai），已跳过`);
                    continue;
                }
                const keys = await db.getKeys(env.DB, p.id);
                if (keys.length === 0) continue;
                const key = keys[Math.floor(Math.random() * keys.length)];

                // 解密 secret（AES-GCM）；解密失败给出明确错误并尝试下一个供应商
                let apiKey: string;
                try {
                    apiKey = await decrypt(key.secret, env.ENCRYPT_KEY);
                } catch (e) {
                    lastErr = new Error(`key ${key.id} 解密失败（请确认 ENCRYPT_KEY 与保存该 Key 时一致）`);
                    continue;
                }

                const upstream = p.base_url + (p.base_url.endsWith('/') ? '' : '/') + 'chat/completions';
                try {
                    const upstreamReq = new Request(upstream, {
                        method: 'POST',
                        headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + apiKey, ...p.headers },
                        body: JSON.stringify(body),
                        // CF 特有：带 body 的 fetch 必须 duplex: 'half'，否则抛异常
                        duplex: 'half' as any,
                    });
                    const res = await fetch(upstreamReq);

                    // 流式：直接透传 ReadableStream，零 buffer
                    if (body.stream && res.body) {
                        const latency = Date.now() - start;
                        ctx.waitUntil(db.touchKey(env.DB, key.id));
                        db.logRing.push({ model, provider: p.id, ok: res.ok, latency_ms: latency, status: res.status });
                        db.logRing.flush(env.DB);     // best-effort 落盘
                        return new Response(res.body, { status: res.status, headers: res.headers });
                    }

                    const text = await res.text();
                    const latency = Date.now() - start;
                    ctx.waitUntil(db.touchKey(env.DB, key.id));
                    db.logRing.push({ model, provider: p.id, ok: res.ok, latency_ms: latency, status: res.status });
                    db.logRing.flush(env.DB);
                    return new Response(text, { status: res.status, headers: res.headers });
                } catch (e) {
                    lastErr = e;
                    continue;            // 尝试下一个供应商（兜底）
                }
            }

            db.logRing.push({ model, provider: 'none', ok: false, latency_ms: Date.now() - start, status: 502 });
            db.logRing.flush(env.DB);
            return err(502, 'All providers failed: ' + (lastErr?.message || 'no available provider'));
        });

        // =================================================================
        // 管理后台静态页（SPA 兜底路由，必须声明在所有 /admin/api/* 之后，见文件末尾）
        // =================================================================

        // =================================================================
        // API：认证
        // =================================================================
        app.post('/admin/api/login', async (c) => {
            if (!env.DEFAULT_ADMIN_PASS) {
                return err(500, '未配置 DEFAULT_ADMIN_PASS：请先在 Cloudflare 控制台 → Settings → Variables 中设置后台密码');
            }
            // 登录失败限速（软限制）
            const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
            const now = Date.now();
            const rec = loginFailures.get(ip);
            if (rec && now - rec.at < LOGIN_LIMIT.windowMs && rec.count >= LOGIN_LIMIT.max) {
                return err(429, '尝试次数过多，请 1 分钟后再试');
            }
            const { password } = await c.req.json().catch(() => ({ password: '' }));
            if (typeof password !== 'string' || !timingSafeEqual(password, env.DEFAULT_ADMIN_PASS)) {
                const f = loginFailures.get(ip);
                if (!f || now - f.at >= LOGIN_LIMIT.windowMs) loginFailures.set(ip, { count: 1, at: now });
                else f.count++;
                return err(401, '密码错误');
            }
            loginFailures.delete(ip);
            const sig = await hmacSha256(env.SESSION_SECRET, 'admin');
            const sid = btoa('admin:' + sig);
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
                db.recentLogs(env.DB, 10),
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
                version: '3.2.0',
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
            return c.json(await db.getProviders(env.DB));
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
                created_at: Date.now(),
                updated_at: Date.now(),
            };
            await db.saveProvider(env.DB, p);
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
                updated_at: Date.now(),
            };
            await db.saveProvider(env.DB, next);
            return c.json({ ok: true });
        });
        app.delete('/admin/api/providers/:id', async (c) => {
            if (!(await isAdmin(c.req.raw, env))) return err(401, 'Unauthorized');
            await db.deleteProvider(env.DB, c.req.param('id'));
            return c.json({ ok: true });
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
                created_at: Date.now(),
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
            return c.json(keys.map(k => ({ ...k, secret: '' })));   // 列表不返回密文
        });
        app.post('/admin/api/keys', async (c) => {
            if (!(await isAdmin(c.req.raw, env))) return err(401, 'Unauthorized');
            if (!env.ENCRYPT_KEY) {
                return err(500, 'ENCRYPT_KEY 未配置：无法加密存储 API Key。请先在 Cloudflare 控制台设置 ENCRYPT_KEY（任意长随机串）后再添加');
            }
            const body = await c.req.json().catch(() => ({})) as any;
            if (!body.secret) return err(400, 'secret required');
            const encrypted = await encrypt(String(body.secret), env.ENCRYPT_KEY);
            const k: db.KeyRow = {
                id: 'k_' + Date.now(),
                name: body.name || '',
                provider_id: body.provider_id || '',
                secret: encrypted,
                hint: String(body.secret).slice(-4),
                masked: '****' + String(body.secret).slice(-4),
                created_at: Date.now(),
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
//   ENCRYPT_KEY 必填：未配置时拒绝新增 Key（不允许用公开默认密钥兜底）
//   decrypt 兼容早期用默认密钥加密的存量数据
// =====================================================================
const LEGACY_ENCRYPT_KEY = 'default-encrypt-key-change-me';

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
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;background:#0f1419;color:#e6edf3;line-height:1.6}
  .layout{display:flex;min-height:100vh}
  .sidebar{width:220px;background:#161b22;border-right:1px solid #30363d;padding:20px 0;position:sticky;top:0;height:100vh;overflow:auto}
  .brand{padding:0 20px 20px;border-bottom:1px solid #30363d;margin-bottom:12px}
  .brand h1{font-size:20px;color:#58a6ff;letter-spacing:1px}
  .brand small{color:#8b949e;font-size:12px}
  .nav a{display:block;padding:10px 20px;color:#c9d1d9;text-decoration:none;font-size:14px;border-left:3px solid transparent;transition:.15s}
  .nav a:hover{background:#21262d;color:#fff}
  .nav a.active{background:#1f6feb22;color:#58a6ff;border-left-color:#58a6ff}
  .main{flex:1;padding:28px 36px;overflow:auto}
  .topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
  .topbar h2{font-size:20px;font-weight:600}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px}
  .card{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:18px}
  .card .label{color:#8b949e;font-size:13px;margin-bottom:6px}
  .card .value{font-size:28px;font-weight:700;color:#58a6ff}
  .card .sub{font-size:12px;color:#8b949e;margin-top:4px}
  .panel{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:20px;margin-bottom:24px}
  .panel h3{font-size:15px;margin-bottom:14px;color:#e6edf3}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:24px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{text-align:left;padding:9px 10px;border-bottom:1px solid #30363d}
  th{color:#8b949e;font-weight:600}
  .badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:12px}
  .badge.ok{background:#23863633;color:#3fb950}
  .badge.err{background:#f8514933;color:#f85149}
  .badge.warn{background:#d2992233;color:#d29922}
  .btn{background:#238636;color:#fff;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:13px}
  .btn:hover{background:#2ea043}
  .btn.ghost{background:transparent;border:1px solid #30363d;color:#c9d1d9}
  .btn.danger{background:#f85149}
  .form-row{display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap}
  .form-row label{font-size:12px;color:#8b949e;display:block;margin-bottom:4px}
  .form-row input,.form-row select{flex:1;min-width:160px;background:#0d1117;border:1px solid #30363d;color:#e6edf3;padding:8px 10px;border-radius:6px}
  .conn-card{border:1px solid #30363d;border-radius:12px;padding:18px;background:#161b22}
  .conn-card .row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #30363d}
  .conn-card .row:last-child{border-bottom:none}
  .conn-card code{background:#0d1117;padding:4px 8px;border-radius:6px;font-family:ui-monospace,Menlo,monospace;font-size:12px}
  .copy{cursor:pointer;color:#58a6ff;font-size:12px;margin-left:8px}
  .toast{position:fixed;top:20px;right:20px;background:#161b22;border:1px solid #30363d;padding:12px 18px;border-radius:8px;z-index:99;display:none}
  .toast.show{display:block}
  pre{background:#0d1117;padding:14px;border-radius:8px;overflow:auto;font-size:12px;color:#a5d6ff}
  .modal{position:fixed;inset:0;background:#0008;display:none;align-items:center;justify-content:center;z-index:100}
  .modal.show{display:flex}
  .modal .box{background:#161b22;border:1px solid #30363d;border-radius:12px;padding:24px;width:440px;max-width:90vw}
  .modal h3{margin-bottom:16px}
  .bar{height:6px;background:#30363d;border-radius:3px;overflow:hidden;margin-top:4px}
  .bar>span{display:block;height:100%;background:#58a6ff;border-radius:3px}
  .hidden{display:none!important}
</style></head>
<body>
<div class="layout">
  <aside class="sidebar">
    <div class="brand"><h1>iRouter</h1><small>智能路由网关 v3.2.0</small></div>
    <nav class="nav">
      <a href="#dashboard" class="active" data-view="dashboard">🏠 首页</a>
      <a href="#providers" data-view="providers">⚙️ 供应商</a>
      <a href="#routes" data-view="routes">🔀 路由规则</a>
      <a href="#keys" data-view="keys">🔑 API Keys</a>
      <a href="#settings" data-view="settings">⚡ 调用信息</a>
      <a href="#guide" data-view="guide">❔ 使用指南</a>
      <a href="#" id="logout">🚪 退出</a>
    </nav>
  </aside>
  <main class="main" id="view"></main>
</div>
<div class="toast" id="toast"></div>
<div class="modal" id="modal"><div class="box" id="modal-box"></div></div>

<script>
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
    if(!r.ok) return r.json().then(function(e){ throw e; });
    return r.json();
  });
};

// ============ 视图渲染 ============
var TITLES = {dashboard:'管理首页',providers:'供应商',routes:'路由规则',keys:'API Keys',settings:'调用信息',guide:'使用指南'};
var currentView = 'dashboard';
var state = {providers:[],routes:[],keys:[],settings:null};

function toast(msg){var t=document.getElementById('toast');t.textContent=msg;t.className='toast show';setTimeout(function(){t.className='toast';},2500);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

function render(){
  var v = currentView;
  document.title = (TITLES[v]||'') + ' · iRouter';
  var main = document.getElementById('view');
  if(v==='dashboard') return render_dashboard(main);
  if(v==='providers') return render_providers(main);
  if(v==='routes') return render_routes(main);
  if(v==='keys') return render_keys(main);
  if(v==='settings') return render_settings(main);
  if(v==='guide') return render_guide(main);
}

// ---- 首页 Dashboard ----
function render_dashboard(main){
  main.innerHTML = '<div class="topbar"><h2>🏠 管理首页</h2><button class="btn" onclick="fetchDashboard()">🔄 刷新</button></div>'
    + '<div class="cards" id="cards"></div>'
    + '<div class="grid2">'
    +   '<div class="panel"><h3>📊 模型调用排行</h3><div id="ranking"></div></div>'
    +   '<div class="panel"><h3>🏥 供应商健康度</h3><div id="health"></div></div>'
    + '</div>'
    + '<div class="panel"><h3>🕐 最近请求</h3><table id="recent"><thead><tr><th>时间</th><th>模型</th><th>供应商</th><th>状态</th><th>延迟</th></tr></thead><tbody></tbody></table></div>'
    + '<div id="guide-mount"></div>';
  fetchDashboard();
}

function fetchDashboard(){
  api('GET','/admin/api/dashboard').then(function(d){
    var data = d.data || d;   // 兼容 {ok,data} 与裸对象两种返回
    state.settings = data.settings;
    render_cards(data);
    render_ranking(data.modelRanking||[]);
    render_health(data.providerHealth||[]);
    render_recent(data.recent||[]);
    if(!localStorage.getItem('irouter_guide_dismissed')) render_guide_mini();
  }).catch(function(e){ toast('加载失败：'+(e&&e.error||e)); });
}

function render_cards(data){
  var c = document.getElementById('cards');
  if(!c) return;
  var s = data.stats||{};
  c.innerHTML = ''
    + card('⚙️ 供应商', (data.counts||{}).providers||0, '已启用 '+(data.providers||[]).filter(function(p){return p.enabled;}).length)
    + card('🔀 路由规则', (data.counts||{}).routes||0, '按优先级匹配')
    + card('🔑 API Keys', (data.counts||{}).keys||0, '加密存储')
    + card('🚀 总请求', s.totalRequests||0, '成功率 '+(s.successRate||0)+'%');
}

function card(label,value,sub){return '<div class="card"><div class="label">'+label+'</div><div class="value">'+value+'</div><div class="sub">'+esc(sub)+'</div></div>';}

function render_ranking(list){
  var el = document.getElementById('ranking');
  if(!el) return;
  if(!list.length){el.innerHTML='<p style="color:#8b949e;font-size:13px">暂无请求数据，发一次请求后此处会显示排行</p>';return;}
  var max = Math.max.apply(null,list.map(function(x){return x.count;}));
  el.innerHTML = '<table><thead><tr><th>模型</th><th>调用次数</th></tr></thead><tbody>'
    + list.map(function(x){return '<tr><td>'+esc(x.model)+'</td><td><div class="bar"><span style="width:'+(x.count/max*100)+'%"></span></div>'+x.count+'</td></tr>';}).join('')
    + '</tbody></table>';
}

function render_health(list){
  var el = document.getElementById('health');
  if(!el) return;
  el.innerHTML = list.map(function(p){
    var color = p.successRate>=90?'ok':p.successRate>=60?'warn':'err';
    return '<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:13px"><span>'+esc(p.name)+'</span><span>'+(p.successRate||0)+'% · '+(p.avgLatency||0)+'ms</span></div><div class="bar"><span style="width:'+(p.successRate||0)+'%;background:'+(color==='ok'?'#3fb950':color==='warn'?'#d29922':'#f85149')+'"></span></div></div>';
  }).join('') || '<p style="color:#8b949e;font-size:13px">暂无数据</p>';
}

function render_recent(list){
  var tb = document.querySelector('#recent tbody');
  if(!tb) return;
  tb.innerHTML = list.map(function(r){
    var d = new Date((r.created_at||0)*1000);
    var time = isNaN(d)?'':'0'.concat(d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)+':'+('0'+d.getSeconds()).slice(-2);
    var badge = r.ok?'<span class="badge ok">'+r.status+'</span>':'<span class="badge err">'+r.status+'</span>';
    return '<tr><td>'+time+'</td><td>'+esc(r.model||'-')+'</td><td>'+esc(r.provider||'-')+'</td><td>'+badge+'</td><td>'+(r.latency_ms||0)+'ms</td></tr>';
  }).join('') || '<tr><td colspan="5" style="color:#8b949e;text-align:center;padding:20px">暂无请求记录</td></tr>';
}

// ---- 调用信息（总览页核心：Base URL + Token + 修改）----
function render_settings(main){
  main.innerHTML = '<div class="topbar"><h2>⚡ 调用信息</h2></div>'
    + '<div class="conn-card" id="conn"></div>'
    + '<div class="panel" style="margin-top:24px"><h3>📝 修改配置</h3><div id="settings-form"></div></div>';
  api('GET','/admin/api/settings').then(function(d){
    var s = d.data || d;
    state.settings = s;
    render_conn(s);
    render_settings_form(s);
  }).catch(function(e){ toast('加载失败：'+(e&&e.error||e)); });
}

function render_conn(s){
  var baseUrl = s.baseUrl || (location.origin || '');
  var token = s.apiToken || '（未设置，请在下方设置 API_TOKEN）';
  var curl = 'curl -X POST "'+baseUrl+'/v1/chat/completions" \\\\\\n'
           + '  -H "Authorization: Bearer '+esc(s.apiToken||'YOUR_TOKEN')+'" \\\\\\n'
           + '  -H "Content-Type: application/json" \\\\\\n'
           + '  -d \\'{ "model": "gpt-4o-mini", "messages": [{"role":"user","content":"hello"}] }\\'';
  document.getElementById('conn').innerHTML = ''
    + row_html('🏷️ 项目名', esc(s.projectName||'iRouter')+' <span class="badge ok">v3.2.0 · D1</span>')
    + row_html('🌐 网关 Base URL', '<code id="conn-url">'+esc(baseUrl)+'</code> <span class="copy" onclick="copyText(\\'conn-url\\')">📋 复制</span>')
    + row_html('🔑 调用 Token', '<code id="conn-token">'+esc(token)+'</code> <span class="copy" onclick="copyText(\\'conn-token\\')">📋 复制</span>')
    + '<div style="margin-top:14px"><label style="font-size:12px;color:#8b949e">📦 快速调用示例（curl）</label><pre id="conn-curl">'+esc(curl)+'</pre><span class="copy" onclick="copyText(\\'conn-curl\\')">📋 复制</span></div>';
}

function row_html(k,v){return '<div class="row"><div><div style="font-size:12px;color:#8b949e">'+k+'</div><div style="font-size:14px;margin-top:4px">'+v+'</div></div></div>';}

function render_settings_form(s){
  document.getElementById('settings-form').innerHTML = ''
    + '<div class="form-row"><div style="flex:1"><label>项目名</label><input id="f-project" value="'+esc(s.projectName||'iRouter')+'"></div>'
    + '<div style="flex:1"><label>网关 Base URL（留空=自动取当前域名）</label><input id="f-base" value="'+esc(s.baseUrl||'')+'" placeholder="https://irouter.example.com"></div></div>'
    + '<div class="form-row"><div style="flex:1"><label>调用 Token（留空=不修改；≥8 位可更新；与登录密码相互独立）</label><input id="f-token" type="password" placeholder="sk-xxxxxxxx（留空则不修改）"></div></div>'
    + '<button class="btn" onclick="saveSettings()">💾 保存</button>'
    + '<span style="margin-left:12px;font-size:12px;color:#8b949e">提示：此 Token 是「外部调用网关」用的鉴权 key，与管理员登录密码是两套，互不影响</span>';
}

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

window.copyText = function(id){var el=document.getElementById(id);var txt=el.textContent||el.innerText;navigator.clipboard.writeText(txt).then(function(){toast('📋 已复制');},function(){toast('复制失败，请手动选择');});};

// ---- 供应商 ----
function render_providers(main){
  main.innerHTML = '<div class="topbar"><h2>⚙️ 供应商</h2><button class="btn" onclick="openProvider()">＋ 添加供应商</button></div>'
    + '<div class="panel"><table><thead><tr><th>名称</th><th>标识</th><th>Base URL</th><th>协议</th><th>状态</th><th>操作</th></tr></thead><tbody id="prov-tbody"></tbody></table></div>';
  api('GET','/admin/api/providers').then(function(d){state.providers=d.data||d;render_prov_table();}).catch(function(e){toast(e&&e.error||e);});
}
function render_prov_table(){
  var tb=document.getElementById('prov-tbody');
  tb.innerHTML=state.providers.map(function(p){
    return '<tr><td>'+esc(p.name)+'</td><td><code>'+esc(p.id)+'</code></td><td><code style="font-size:11px">'+esc(p.base_url)+'</code></td><td>'+esc(p.protocol)+'</td>'
      + '<td>'+(p.enabled?'<span class="badge ok">启用</span>':'<span class="badge err">停用</span>')+'</td>'
      + '<td><button class="btn ghost" onclick="editProvider(\\''+esc(p.id)+'\\')">编辑</button> '
      + (p.builtin?'<span style="font-size:11px;color:#8b949e">内置</span>':'<button class="btn danger" onclick="deleteProvider(\\''+esc(p.id)+'\\')">删除</button>')+'</td></tr>';
  }).join('');
}
window.openProvider=function(){setModal('<h3>添加供应商</h3>'
  +'<div class="form-row"><div style="flex:1"><label>名称</label><input id="m-name"></div><div style="flex:1"><label>标识（唯一 ID）</label><input id="m-id" placeholder="my-provider"></div></div>'
  +'<div class="form-row"><div style="flex:1"><label>Base URL</label><input id="m-url" placeholder="https://api.example.com/v1"></div><div style="flex:1"><label>协议</label><select id="m-proto"><option value="openai">openai</option><option value="anthropic">anthropic</option><option value="gemini">gemini</option><option value="custom">custom</option></select></div></div>'
  +'<button class="btn" onclick="submitProvider()">保存</button>');};
window.submitProvider=function(){api('POST','/admin/api/providers',{name:document.getElementById('m-name').value,id:document.getElementById('m-id').value,base_url:document.getElementById('m-url').value,protocol:document.getElementById('m-proto').value}).then(function(){closeModal();render_providers(document.getElementById('view'));toast('✅ 已添加');});};
window.editProvider=function(id){var p=state.providers.find(function(x){return x.id===id;});if(!p)return;setModal('<h3>编辑供应商</h3>'
  +'<div class="form-row"><div style="flex:1"><label>名称</label><input id="m-name" value="'+esc(p.name)+'"></div><div style="flex:1"><label>Base URL</label><input id="m-url" value="'+esc(p.base_url)+'"></div></div>'
  +'<div class="form-row"><label>启用</label><select id="m-enabled"><option value="1"'+(p.enabled?' selected':'')+'>启用</option><option value="0"'+(!p.enabled?' selected':'')+'>停用</option></select></div>'
  +'<button class="btn" onclick="submitEditProvider(\\''+esc(id)+'\\')">保存</button>');};
window.submitEditProvider=function(id){api('PUT','/admin/api/providers/'+id,{name:document.getElementById('m-name').value,base_url:document.getElementById('m-url').value,enabled:document.getElementById('m-enabled').value==='1'}).then(function(){closeModal();render_providers(document.getElementById('view'));toast('✅ 已更新');});};
window.deleteProvider=function(id){if(!confirm('确认删除？'))return;api('DELETE','/admin/api/providers/'+id).then(function(){render_providers(document.getElementById('view'));toast('🗑️ 已删除');});};

// ---- 路由规则 ----
function render_routes(main){
  main.innerHTML='<div class="topbar"><h2>🔀 路由规则</h2><button class="btn" onclick="openRoute()">＋ 添加规则</button></div>'
    +'<div class="panel"><table><thead><tr><th>名称</th><th>匹配模式</th><th>命中供应商</th><th>兜底</th><th>优先级</th><th>操作</th></tr></thead><tbody id="rt-tbody"></tbody></table></div>';
  api('GET','/admin/api/routes').then(function(d){state.routes=d.data||d;render_route_table();}).catch(function(e){toast(e&&e.error||e);});
}
function render_route_table(){
  var tb=document.getElementById('rt-tbody');
  tb.innerHTML=state.routes.map(function(r){
    return '<tr><td>'+esc(r.name||'(未命名)')+'</td><td><code>'+esc(r.pattern)+'</code></td>'
      +'<td>'+(r.providers||[]).map(esc).join(' → ')+'</td>'
      +'<td>'+(r.fallback||[]).map(esc).join(' → ')||'<span style="color:#8b949e">-</span>'+
      '</td><td>'+(r.priority||0)+'</td>'
      +'<td><button class="btn ghost" onclick="editRoute(\\''+esc(r.id)+'\\')">编辑</button> <button class="btn danger" onclick="deleteRoute(\\''+esc(r.id)+'\\')">删除</button></td></tr>';
  }).join('');
}
window.openRoute=function(){setModal('<h3>添加路由规则</h3>'
  +'<div class="form-row"><div style="flex:1"><label>名称</label><input id="r-name"></div><div style="flex:1"><label>匹配模式（支持 * 通配，如 gpt-*）</label><input id="r-pattern" value="*"></div></div>'
  +'<div class="form-row"><div style="flex:1"><label>命中供应商 ID（逗号分隔，有序）</label><input id="r-prov" placeholder="openai,anthropic"></div><div style="flex:1"><label>兜底供应商 ID</label><input id="r-fb" placeholder="openrouter"></div></div>'
  +'<div class="form-row"><div style="flex:1"><label>优先级（大者优先）</label><input id="r-pri" type="number" value="0"></div></div>'
  +'<button class="btn" onclick="submitRoute()">保存</button>');};
window.submitRoute=function(){api('POST','/admin/api/routes',{name:document.getElementById('r-name').value,pattern:document.getElementById('r-pattern').value,providers:document.getElementById('r-prov').value.split(',').map(function(s){return s.trim();}).filter(Boolean),fallback:document.getElementById('r-fb').value.split(',').map(function(s){return s.trim();}).filter(Boolean),priority:parseInt(document.getElementById('r-pri').value)||0}).then(function(){closeModal();render_routes(document.getElementById('view'));toast('✅ 已添加');});};
window.editRoute=function(id){var r=state.routes.find(function(x){return x.id===id;});if(!r)return;setModal('<h3>编辑路由规则</h3>'
  +'<div class="form-row"><div style="flex:1"><label>名称</label><input id="r-name" value="'+esc(r.name||'')+'"></div><div style="flex:1"><label>匹配模式</label><input id="r-pattern" value="'+esc(r.pattern)+'"></div></div>'
  +'<div class="form-row"><div style="flex:1"><label>命中供应商</label><input id="r-prov" value="'+esc((r.providers||[]).join(','))+'"></div><div style="flex:1"><label>兜底</label><input id="r-fb" value="'+esc((r.fallback||[]).join(','))+'"></div></div>'
  +'<div class="form-row"><label>优先级</label><input id="r-pri" type="number" value="'+esc(r.priority||0)+'"></div>'
  +'<button class="btn" onclick="submitEditRoute(\\''+esc(id)+'\\')">保存</button>');};
window.submitEditRoute=function(id){api('PUT','/admin/api/routes/'+id,{name:document.getElementById('r-name').value,pattern:document.getElementById('r-pattern').value,providers:document.getElementById('r-prov').value.split(',').map(function(s){return s.trim();}).filter(Boolean),fallback:document.getElementById('r-fb').value.split(',').map(function(s){return s.trim();}).filter(Boolean),priority:parseInt(document.getElementById('r-pri').value)||0}).then(function(){closeModal();render_routes(document.getElementById('view'));toast('✅ 已更新');});};
window.deleteRoute=function(id){if(!confirm('确认删除？'))return;api('DELETE','/admin/api/routes/'+id).then(function(){render_routes(document.getElementById('view'));toast('🗑️ 已删除');});};

// ---- Keys ----
function render_keys(main){
  main.innerHTML='<div class="topbar"><h2>🔑 API Keys</h2><button class="btn" onclick="openKey()">＋ 添加 Key</button></div>'
    +'<div class="panel"><table><thead><tr><th>名称</th><th>供应商</th><th>掩码</th><th>操作</th></tr></thead><tbody id="key-tbody"></tbody></table></div>';
  api('GET','/admin/api/keys').then(function(d){state.keys=d.data||d;render_key_table();}).catch(function(e){toast(e&&e.error||e);});
}
function render_key_table(){
  var tb=document.getElementById('key-tbody');
  tb.innerHTML=state.keys.map(function(k){
    return '<tr><td>'+esc(k.name||'(未命名)')+'</td><td><code>'+esc(k.provider_id)+'</code></td><td><code>'+esc(k.masked||'****')+'</code></td>'
      +'<td><button class="btn danger" onclick="deleteKey(\\''+esc(k.id)+'\\')">删除</button></td></tr>';
  }).join('')||'<tr><td colspan="4" style="text-align:center;color:#8b949e;padding:20px">暂无 Key，添加后供应商方可转发</td></tr>';
}
window.openKey=function(){var opts=state.providers.map(function(p){return '<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>';}).join('');setModal('<h3>添加 API Key</h3>'
  +'<div class="form-row"><div style="flex:1"><label>名称</label><input id="k-name"></div><div style="flex:1"><label>所属供应商</label><select id="k-prov">'+opts+'</select></div></div>'
  +'<div class="form-row"><div style="flex:1"><label>真实 Key（AES-GCM 加密存储，仅你可见）</label><input id="k-secret" type="password" placeholder="sk-..."></div></div>'
  +'<button class="btn" onclick="submitKey()">保存</button>');};
window.submitKey=function(){api('POST','/admin/api/keys',{name:document.getElementById('k-name').value,provider_id:document.getElementById('k-prov').value,secret:document.getElementById('k-secret').value}).then(function(){closeModal();render_keys(document.getElementById('view'));toast('✅ 已添加');});};
window.deleteKey=function(id){if(!confirm('确认删除？删除后该 Key 无法再用于转发'))return;api('DELETE','/admin/api/keys/'+id).then(function(){render_keys(document.getElementById('view'));toast('🗑️ 已删除');});};

// ---- 使用指南 ----
function render_guide(main){
  main.innerHTML='<div class="topbar"><h2>❔ 使用指南</h2><button class="ghost btn" onclick="localStorage.removeItem(\\'irouter_guide_dismissed\\');toast(\\'已重置，下次进入将再次弹出\\')">🔁 重置引导</button></div>'
    +'<div class="panel" id="guide-box"></div>';
  render_guide_content(document.getElementById('guide-box'));
}
function render_guide_mini(){
  var mount=document.getElementById('guide-mount');
  if(!mount) return;
  mount.innerHTML='<div class="panel" style="border-color:#58a6ff"><h3>👋 欢迎使用 iRouter v3.2.0（Cloudflare D1 版）</h3><div id="guide-mini-body"></div><button class="btn ghost" onclick="document.getElementById(\\'guide-mount\\').innerHTML=\\'\\'">关闭</button></div>';
  render_guide_content(document.getElementById('guide-mini-body'), true);
  if(!localStorage.getItem('irouter_guide_dismissed')){
    setTimeout(function(){var b=document.getElementById('guide-mini-body');if(b) render_guide_content(b,true);},50);
  }
}
function render_guide_content(el, mini){
  if(!el) return;
  var steps = [
    {t:'① 部署完成',d:'访问「健康检查」<code>/health</code> 应返回 <code>{"ok":true,"storage":"d1"}</code>；后台各页面能正常显示数据即说明 D1 绑定正常。'},
    {t:'② 添加供应商',d:'「供应商」页 → ＋ 添加，填写名称、标识、Base URL、协议（openai/anthropic/gemini）。'},
    {t:'③ 配置 Key',d:'「API Keys」页 → 添加真实 Key（AES-GCM 加密存储，仅你可见）。'},
    {t:'④ 设置路由规则',d:'「路由规则」页 → ＋ 添加，pattern 支持 <code>*</code> 通配，命中后按供应商列表顺序尝试 + 兜底。'},
    {t:'⑤ 验证转发',d:'复制下方「调用信息」卡的 curl 示例，或直接 POST <code>/v1/chat/completions</code>，Header 带 <code>Authorization: Bearer &lt;API_TOKEN&gt;</code>。'},
    {t:'⑥ 监控',d:'回到「首页」看模型排行 / 供应商健康度 / 最近请求。'},
  ];
  el.innerHTML='<ol style="padding-left:20px">'+
    steps.map(function(s,idx){return '<li style="margin-bottom:12px"><b>'+s.t+'</b><br><span style="color:#c9d1d9;font-size:13px">'+s.d+'</span></li>';}).join('')+
    '</ol>'+
    (mini?'':'<p style="margin-top:16px;color:#8b949e;font-size:12px">💡 总览页的「调用信息」可随时查看 Base URL 与 Token，并支持修改（与登录密码相互独立）。</p>');
  if(!mini) localStorage.setItem('irouter_guide_dismissed','1');
}

// ---- 登录 ----
function render_login(){
  document.getElementById('view').innerHTML='<div style="max-width:360px;margin:80px auto;background:#161b22;border:1px solid #30363d;border-radius:12px;padding:32px">'
    +'<h2 style="text-align:center;margin-bottom:24px">🔐 iRouter 管理后台</h2>'
    +'<label style="font-size:12px;color:#8b949e">管理员密码</label>'
    +'<input id="login-pass" type="password" style="width:100%;background:#0d1117;border:1px solid #30363d;color:#e6edf3;padding:10px;border-radius:6px;margin:8px 0 16px" placeholder="请输入密码">'
    +'<button class="btn" style="width:100%;padding:10px" onclick="doLogin()">登录</button>'
    +'<p style="font-size:11px;color:#8b949e;margin-top:16px;text-align:center">默认密码见环境变量 DEFAULT_ADMIN_PASS</p></div>';
}
window.doLogin=function(){api('POST','/admin/api/login',{password:document.getElementById('login-pass').value}).then(function(){toast('✅ 登录成功');render();}).catch(function(e){toast('❌ '+(e&&e.error||'登录失败'));});};

// ---- 模态框 ----
function setModal(html){document.getElementById('modal-box').innerHTML=html+'<div style="margin-top:16px;text-align:right"><button class="btn ghost" onclick="closeModal()">取消</button></div>';document.getElementById('modal').className='modal show';}
window.closeModal=function(){document.getElementById('modal').className='modal';};

// ============ 导航 + 自动刷新 ============
document.querySelectorAll('.nav a[data-view]').forEach(function(a){
  a.onclick=function(e){e.preventDefault();document.querySelectorAll('.nav a').forEach(function(x){x.classList.remove('active');});a.classList.add('active');currentView=a.dataset.view;location.hash='#'+a.dataset.view;render();};
});
document.getElementById('logout').onclick=function(e){e.preventDefault();document.cookie='irouter_sid=; Max-Age=0; Path=/';toast('已退出');render_login();};
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
  // 简单是否已登录探测：直接尝试加载 dashboard，401 则弹登录
  api('GET','/admin/api/dashboard').then(function(){render();}).catch(function(){render_login();});
})();
</script>
</body></html>`;
