// db.ts — iRouter v3.3.0 D1 存储层（替代 KV 版 storage.ts）
// 设计原则：
//   1. 全部 SQL 走 env.DB.prepare(...).bind(...)，参数化防注入
//   2. 进程级内存缓存（Worker 实例内）：providers/routes/keys 读走内存，60s 过期
//      → 日常运行 D1 读 ≈ 0，写 = 批量 flush（每分钟几次），远低于免费额度
//   3. request_logs 采用 RingBuffer：内存聚合 + 60s 批量 INSERT，表保留最近 2000 条
//   4. meta 表存零散 config（key-value），兼容旧版 KV 的 config/stats/settings 结构

import type { D1Database } from '@cloudflare/workers-types';

// ---------- 类型（与原 KV 版保持一致，路由层 / 前端无需改动）----------
export interface Provider {
    id: string; name: string; builtin: boolean; enabled: boolean;
    base_url: string; protocol: string; headers: Record<string,string>;
    keys: string[]; created_at: number; updated_at: number;
}
export interface Route {
    id: string; name: string; pattern: string; providers: string[];
    fallback: string[]; priority: number; enabled: boolean; created_at: number;
    model_map: Record<string, string>;   // 模型名改写：{ 请求模型名: 上游模型名 }
}
export interface KeyRow {
    id: string; name: string; provider_id: string; secret: string;
    hint: string; masked: string; created_at: number; last_used: number;
}
export interface Settings {
    projectName: string; baseUrl: string; apiToken: string; tokenMasked: string;
}
export interface Stats {
    totalRequests: number; successCount: number; successRate: number; avgLatency: number;
}

// ---------- 内存缓存（进程级，冷启动后首次读 D1，之后 60s 走内存）----------
const CACHE_TTL = 60_000;
const cache: { providers?: { data: Provider[]; at: number }; routes?: { data: Route[]; at: number } } = {};

function expired(at?: number) { return !at || Date.now() - at > CACHE_TTL; }

// ---------- 底层 helpers ----------
function jget<T = unknown>(row: string | { v: string } | null, fallback: T): T {
    if (row == null) return fallback;
    try {
        return JSON.parse(typeof row === 'string' ? row : row.v) as T;
    } catch { return fallback; }
}

// =====================================================================
// Providers
// =====================================================================
export async function getProviders(db: D1Database): Promise<Provider[]> {
    if (cache.providers && !expired(cache.providers.at)) return cache.providers.data;
    const { results } = await db.prepare('SELECT * FROM providers ORDER BY builtin DESC, name ASC').all();
    const rows = (results || []).map((r: any) => ({
        id: r.id, name: r.name, builtin: !!r.builtin, enabled: !!r.enabled,
        base_url: r.base_url, protocol: r.protocol,
        headers: jget<Record<string,string>>(r.headers, {}),
        keys: jget<string[]>(r.keys, []),
        created_at: r.created_at, updated_at: r.updated_at,
    })) as Provider[];
    cache.providers = { data: rows, at: Date.now() };
    return rows;
}

export async function getProvider(db: D1Database, id: string): Promise<Provider | null> {
    const all = await getProviders(db);            // 走缓存
    return all.find(p => p.id === id) || null;
}

export async function saveProvider(db: D1Database, p: Provider): Promise<void> {
    await db.prepare(`
        INSERT INTO providers(id, name, builtin, enabled, base_url, protocol, headers, keys, updated_at)
        VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)
        ON CONFLICT(id) DO UPDATE SET
            name=excluded.name, builtin=excluded.builtin, enabled=excluded.enabled,
            base_url=excluded.base_url, protocol=excluded.protocol,
            headers=excluded.headers, keys=excluded.keys, updated_at=excluded.updated_at
    `).bind(p.id, p.name, p.builtin ? 1 : 0, p.enabled ? 1 : 0, p.base_url, p.protocol,
            JSON.stringify(p.headers), JSON.stringify(p.keys), Math.floor(Date.now() / 1000)).run();
    cache.providers = undefined;                    // 写后清缓存（强一致）
}

export async function deleteProvider(db: D1Database, id: string): Promise<void> {
    // 级联清理该供应商下的 keys，避免孤儿 key 残留（内置供应商受 builtin=0 保护）
    await db.batch([
        db.prepare('DELETE FROM keys WHERE provider_id = ?1').bind(id),
        db.prepare('DELETE FROM providers WHERE id = ?1 AND builtin = 0').bind(id),
    ]);
    cache.providers = undefined;
}

// =====================================================================
// Routes
// =====================================================================
export async function getRoutes(db: D1Database): Promise<Route[]> {
    if (cache.routes && !expired(cache.routes.at)) return cache.routes.data;
    const { results } = await db.prepare('SELECT * FROM routes ORDER BY priority DESC, created_at ASC').all();
    const rows = (results || []).map((r: any) => ({
        id: r.id, name: r.name, pattern: r.pattern,
        providers: jget<string[]>(r.providers, []),
        fallback: jget<string[]>(r.fallback, []),
        priority: r.priority, enabled: !!r.enabled, created_at: r.created_at,
        model_map: jget<Record<string, string>>(r.model_map, {}),
    })) as Route[];
    cache.routes = { data: rows, at: Date.now() };
    return rows;
}

export async function saveRoute(db: D1Database, rt: Route): Promise<void> {
    await db.prepare(`
        INSERT INTO routes(id, name, pattern, providers, fallback, priority, enabled, model_map, created_at)
        VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)
        ON CONFLICT(id) DO UPDATE SET
            name=excluded.name, pattern=excluded.pattern, providers=excluded.providers,
            fallback=excluded.fallback, priority=excluded.priority, enabled=excluded.enabled,
            model_map=excluded.model_map
    `).bind(rt.id, rt.name, rt.pattern, JSON.stringify(rt.providers),
            JSON.stringify(rt.fallback), rt.priority, rt.enabled ? 1 : 0,
            JSON.stringify(rt.model_map || {}), rt.created_at || Math.floor(Date.now() / 1000)).run();
    cache.routes = undefined;
}

// 老库兼容：routes 表缺 model_map 列时补列（幂等，重复执行安全）
export async function ensureRouteModelMap(db: D1Database): Promise<void> {
    try {
        const { results } = await db.prepare("PRAGMA table_info(routes)").all() as any;
        const hasCol = (results || []).some((c: any) => c.name === 'model_map');
        if (!hasCol) {
            await db.prepare("ALTER TABLE routes ADD COLUMN model_map TEXT NOT NULL DEFAULT '{}'").run();
            cache.routes = undefined;
        }
    } catch (e) { console.error('[ensureRouteModelMap] failed:', e); }
}

export async function deleteRoute(db: D1Database, id: string): Promise<void> {
    await db.prepare('DELETE FROM routes WHERE id = ?1').bind(id).run();
    cache.routes = undefined;
}

// =====================================================================
// Keys（secret 加密由调用方负责，这里只负责存取）
// =====================================================================
export async function getKeys(db: D1Database, providerId?: string): Promise<KeyRow[]> {
    const sql = providerId
        ? 'SELECT * FROM keys WHERE provider_id = ?1 ORDER BY created_at DESC'
        : 'SELECT * FROM keys ORDER BY created_at DESC';
    const { results } = providerId
        ? await db.prepare(sql).bind(providerId).all()
        : await db.prepare(sql).all();
    return (results || []).map((r: any) => ({
        id: r.id, name: r.name, provider_id: r.provider_id, secret: r.secret,
        hint: r.hint, masked: r.masked, created_at: r.created_at, last_used: r.last_used,
    })) as KeyRow[];
}

export async function saveKey(db: D1Database, k: KeyRow): Promise<void> {
    await db.prepare(`
        INSERT INTO keys(id, name, provider_id, secret, hint, masked, created_at, last_used)
        VALUES(?1,?2,?3,?4,?5,?6,?7,?8)
        ON CONFLICT(id) DO UPDATE SET
            name=excluded.name, provider_id=excluded.provider_id, secret=excluded.secret,
            hint=excluded.hint, masked=excluded.masked, last_used=excluded.last_used
    `).bind(k.id, k.name, k.provider_id, k.secret, k.hint, k.masked,
            k.created_at || Math.floor(Date.now() / 1000), k.last_used).run();
}

export async function deleteKey(db: D1Database, id: string): Promise<void> {
    await db.prepare('DELETE FROM keys WHERE id = ?1').bind(id).run();
}

// 记录 Key 最近使用时间（转发成功时调用，best-effort）
export async function touchKey(db: D1Database, keyId: string): Promise<void> {
    await db.prepare('UPDATE keys SET last_used = ?1 WHERE id = ?2').bind(Math.floor(Date.now() / 1000), keyId).run();
}

// =====================================================================
// Meta（兼容旧 KV 的 config / stats / settings / version）
// =====================================================================
export async function metaGet<T = unknown>(db: D1Database, key: string, fallback: T): Promise<T> {
    const { results } = await db.prepare('SELECT v FROM meta WHERE k = ?1').bind(key).all();
    return jget<T>(results?.[0] as any, fallback);
}

export async function metaSet(db: D1Database, key: string, value: unknown): Promise<void> {
    await db.prepare(`
        INSERT INTO meta(k, v) VALUES(?1,?2)
        ON CONFLICT(k) DO UPDATE SET v = excluded.v
    `).bind(key, JSON.stringify(value)).run();
}

// 便捷：settings / stats
export async function getSettings(db: D1Database): Promise<Settings> {
    return metaGet<Settings>(db, 'settings', {
        projectName: 'iRouter', baseUrl: '', apiToken: '', tokenMasked: '',
    });
}
export async function saveSettings(db: D1Database, s: Settings): Promise<void> {
    await metaSet(db, 'settings', s);
}
export async function getStats(db: D1Database): Promise<Stats> {
    return metaGet<Stats>(db, 'stats', { totalRequests: 0, successCount: 0, successRate: 0, avgLatency: 0 });
}
export async function saveStats(db: D1Database, s: Stats): Promise<void> {
    await metaSet(db, 'stats', s);
}

// =====================================================================
// Request logs — RingBuffer：内存聚合 + 批量 flush
//   免费额度优化：不每条请求都写，Worker 内存攒一批，定时/定量落盘
//   D1 限制：单条语句最多 100 个绑定参数 → 每次 INSERT 最多 20 行
// =====================================================================
interface LogBuf { model: string; provider: string; ok: boolean; latency_ms: number; status: number }

const MAX_ROWS_PER_INSERT = 20;   // D1 100 bindings / 5 列
const TRIM_KEEP = 2000;

class LogRing {
    private buf: LogBuf[] = [];
    private timer: any = null;

    push(l: LogBuf) {
        this.buf.push(l);
        // 内存攒满 200 条立即 flush（定量兜底，定时 flush 在 Workers 空闲时不可靠）
        if (this.buf.length >= 200) void this.flush();
    }

    // 定时 flush（由 worker 每 60s 调用一次）
    async flush(db?: D1Database): Promise<void> {
        if (!db || this.buf.length === 0) return;
        const batch = this.buf.splice(0, this.buf.length);
        const failed: LogBuf[] = [];

        // 分批插入：每批最多 20 行，避免超过 D1 单语句 100 参数上限
        for (let i = 0; i < batch.length; i += MAX_ROWS_PER_INSERT) {
            const chunk = batch.slice(i, i + MAX_ROWS_PER_INSERT);
            try {
                const values = chunk.map((_, j) => `(?${j*5+1},?${j*5+2},?${j*5+3},?${j*5+4},?${j*5+5},unixepoch())`).join(',');
                const params: any[] = [];
                for (const l of chunk) params.push(l.model, l.provider, l.ok ? 1 : 0, l.latency_ms, l.status);
                await db.prepare(`INSERT INTO request_logs(model, provider, ok, latency_ms, status, created_at) VALUES ${values}`).bind(...params).run();
            } catch (e) {
                console.error('[logRing] INSERT failed:', e);
                failed.push(...chunk);
            }
        }
        // 失败的行放回 buffer 下次重试；已落盘的行绝不重放（避免重复计数）
        if (failed.length) this.buf = [...failed, ...this.buf];

        const inserted = batch.length - failed.length;
        if (inserted <= 0) return;

        // 裁剪：保留最近 TRIM_KEEP 条（写时触发）。best-effort：数据已落盘，失败只记日志、不放回
        try {
            await db.prepare(`DELETE FROM request_logs WHERE id <= (SELECT MAX(id) - ${TRIM_KEEP} FROM request_logs) AND (SELECT COUNT(*) FROM request_logs) > ${TRIM_KEEP}`).run();
        } catch (e) { console.error('[logRing] trim failed:', e); }

        // 统计累加（SQL 原子累加，避免读改写竞态）：总请求 / 成功数 / 平均延迟 / 成功率
        try {
            const okN = batch.reduce((n, l) => (l.ok && !failed.includes(l) ? n + 1 : n), 0);
            const latSum = batch.reduce((s, l) => (failed.includes(l) ? s : s + l.latency_ms), 0);
            await db.prepare(`UPDATE meta SET v = json_set(v,
                '$.totalRequests', COALESCE(json_extract(v, '$.totalRequests', 0), 0) + ?1,
                '$.successCount',  COALESCE(json_extract(v, '$.successCount', 0), 0) + ?2,
                '$.avgLatency', (COALESCE(json_extract(v, '$.avgLatency', 0), 0) * COALESCE(json_extract(v, '$.totalRequests', 0), 0) + ?3) / (COALESCE(json_extract(v, '$.totalRequests', 0), 0) + ?1),
                '$.successRate', ROUND(100.0 * (COALESCE(json_extract(v, '$.successCount', 0), 0) + ?2) / (COALESCE(json_extract(v, '$.totalRequests', 0), 0) + ?1), 2)
            ) WHERE k = 'stats'`).bind(inserted, okN, latSum).run();
        } catch (e) { console.error('[logRing] stats update failed:', e); }
    }

    startTimer(db: D1Database) {
        if (this.timer) return;
        this.timer = setInterval(() => this.flush(db), 60_000);  // 60s 批量落盘
        // Cloudflare Workers 中 setInterval 在空闲时会被取消，属于 best-effort；配合定量 flush 兜底
    }
}

export const logRing = new LogRing();

export async function recentLogs(db: D1Database, limit = 50): Promise<any[]> {
    const { results } = await db.prepare(
        'SELECT * FROM request_logs ORDER BY created_at DESC LIMIT ?1'
    ).bind(limit).all();
    return (results || []).map((r: any) => ({
        model: r.model, provider: r.provider, ok: !!r.ok,
        latency_ms: r.latency_ms, status: r.status, created_at: r.created_at,
    }));
}

// =====================================================================
// 初始化：首次部署建表 + 写入内置供应商（由 migrate.ts / worker 启动时调用一次）
// =====================================================================
export const BUILTIN_PROVIDERS: Omit<Provider, 'keys' | 'created_at' | 'updated_at' | 'headers'>[] = [
    { id: 'deepseek',  name: 'DeepSeek',       builtin: true, enabled: true, base_url: 'https://api.deepseek.com',   protocol: 'openai' },
    { id: 'qwen',      name: '通义千问',        builtin: true, enabled: true, base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', protocol: 'openai' },
    { id: 'hunyuan',   name: '腾讯混元',        builtin: true, enabled: true, base_url: 'https://api.hunyuan.cloud.tencent.com/v1', protocol: 'openai' },
    { id: 'doubao',    name: '豆包/火山方舟',   builtin: true, enabled: true, base_url: 'https://ark.cn-beijing.volces.com/api/v3', protocol: 'openai' },
    { id: 'kimi',      name: 'Kimi (Moonshot)', builtin: true, enabled: true, base_url: 'https://api.moonshot.cn/v1', protocol: 'openai' },
    { id: 'glm',       name: '智谱 GLM',        builtin: true, enabled: true, base_url: 'https://open.bigmodel.cn/api/paas/v4', protocol: 'openai' },
    { id: 'siliconflow', name: '硅基流动',       builtin: true, enabled: true, base_url: 'https://api.siliconflow.cn/v1', protocol: 'openai' },
    { id: 'groq',      name: 'Groq (极速)',      builtin: true, enabled: true, base_url: 'https://api.groq.com/openai/v1', protocol: 'openai' },
    { id: 'together',  name: 'Together',        builtin: true, enabled: true, base_url: 'https://api.together.xyz/v1', protocol: 'openai' },
    { id: 'openrouter', name: 'OpenRouter',      builtin: true, enabled: true, base_url: 'https://openrouter.ai/api/v1', protocol: 'openai' },
    { id: 'fireworks', name: 'Fireworks',       builtin: true, enabled: true, base_url: 'https://api.fireworks.ai/inference/v1', protocol: 'openai' },
    { id: 'novita',    name: 'Novita',          builtin: true, enabled: true, base_url: 'https://api.novita.ai/v3/openai', protocol: 'openai' },
    { id: 'ppio',      name: 'PPIO 派欧',        builtin: true, enabled: true, base_url: 'https://api.ppio.cn/v1', protocol: 'openai' },
    { id: 'mistral',   name: 'Mistral',         builtin: true, enabled: true, base_url: 'https://api.mistral.ai/v1', protocol: 'openai' },
    { id: 'cohere',    name: 'Cohere',          builtin: true, enabled: true, base_url: 'https://api.cohere.ai/v2', protocol: 'openai' },
    { id: 'openai',    name: 'OpenAI',          builtin: true, enabled: true, base_url: 'https://api.openai.com/v1', protocol: 'openai' },
    { id: 'anthropic', name: 'Anthropic',       builtin: true, enabled: true, base_url: 'https://api.anthropic.com', protocol: 'anthropic' },
    { id: 'google',    name: 'Google',          builtin: true, enabled: true, base_url: 'https://generativelanguage.googleapis.com/v1beta', protocol: 'gemini' },
    { id: 'ollama',    name: 'Ollama (自建)',     builtin: false, enabled: false, base_url: 'http://localhost:11434/v1', protocol: 'openai' },
    { id: 'vllm',      name: 'vLLM (自建)',      builtin: false, enabled: false, base_url: 'http://localhost:8000/v1', protocol: 'openai' },
    { id: 'oneapi',    name: 'OneAPI (自建)',    builtin: false, enabled: false, base_url: 'http://localhost:3000', protocol: 'openai' },
];

export async function migrateBuiltins(db: D1Database): Promise<void> {
    let changed = false;
    for (const p of BUILTIN_PROVIDERS) {
        const exist = await db.prepare('SELECT id FROM providers WHERE id = ?1').bind(p.id).all();
        if ((exist.results || []).length > 0) continue;
        await db.prepare(`
            INSERT INTO providers(id, name, builtin, enabled, base_url, protocol, headers, keys)
            VALUES(?1,?2,?3,?4,?5,?6,?7,?8)
        `).bind(p.id, p.name, p.builtin ? 1 : 0, p.enabled ? 1 : 0, p.base_url, p.protocol, '{}', '[]').run();
        changed = true;
    }
    // 只有真正发生过插入才清缓存（避免每次请求都让 providers 缓存失效）
    if (changed) cache.providers = undefined;
}
