-- iRouter v3.3.0 — Cloudflare D1 schema
-- 部署：wrangler d1 execute irouter --remote --file=./schema.sql
-- 本地：wrangler d1 execute irouter --local  --file=./schema.sql
-- 注意：不要在 D1 上执行 PRAGMA journal_mode / foreign_keys ——
--       D1 托管引擎内建 WAL，且远程不接受这类 PRAGMA（会直接报错中断整个文件）

-- 1. 供应商（含内置 22 家 + 自建）
CREATE TABLE IF NOT EXISTS providers (
    id          TEXT PRIMARY KEY,        -- deepseek / openai / zzz ...
    name        TEXT NOT NULL,           -- 显示名
    builtin     INTEGER NOT NULL DEFAULT 0,  -- 1=内置不可删
    enabled     INTEGER NOT NULL DEFAULT 1,
    base_url    TEXT NOT NULL DEFAULT '',
    protocol    TEXT NOT NULL DEFAULT 'openai',  -- openai / anthropic / gemini / custom
    headers     TEXT NOT NULL DEFAULT '{}',     -- 自定义请求头 JSON
    keys        TEXT NOT NULL DEFAULT '[]',     -- 该供应商下的 keyId 列表
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_providers_enabled ON providers(enabled);

-- 2. 路由规则（pattern -> 供应商列表 + 兜底）
CREATE TABLE IF NOT EXISTS routes (
    id          TEXT PRIMARY KEY,        -- 自动生成 uuid
    name        TEXT NOT NULL DEFAULT '',
    pattern     TEXT NOT NULL DEFAULT '',    -- 模型名匹配，支持 * 通配
    providers   TEXT NOT NULL DEFAULT '[]',  -- 命中的供应商 id 列表（有序）
    fallback    TEXT NOT NULL DEFAULT '[]',  -- 兜底供应商 id 列表
    priority    INTEGER NOT NULL DEFAULT 0,   -- 数值大优先
    enabled     INTEGER NOT NULL DEFAULT 1,
    model_map   TEXT NOT NULL DEFAULT '{}',  -- 模型名改写 JSON：{ "请求模型名": "上游模型名" }
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_routes_priority ON routes(priority DESC);
-- 老库兼容：已存在的 routes 表会自动被 CI 的 ensureRouteModelMap 补齐 model_map 列（见 db.ts）

-- 3. API Key（加密存储，只存密文 + 摘要）
CREATE TABLE IF NOT EXISTS keys (
    id          TEXT PRIMARY KEY,        -- 自动生成
    name        TEXT NOT NULL DEFAULT '',
    provider_id TEXT NOT NULL DEFAULT '',    -- 所属供应商
    secret      TEXT NOT NULL DEFAULT '',    -- 加密后的真实 key（AES-GCM，env.ENCRYPT_KEY）
    hint        TEXT NOT NULL DEFAULT '',    -- 后4位，方便识别
    masked      TEXT NOT NULL DEFAULT '',    -- sk-****abcd
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    last_used   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_keys_provider ON keys(provider_id);

-- 4. 元数据（KV 里那些零散 config 全塞这张表，key-value）
CREATE TABLE IF NOT EXISTS meta (
    k TEXT PRIMARY KEY,      -- config / stats / settings / version / migration ...
    v TEXT NOT NULL DEFAULT '{}'
);
INSERT OR IGNORE INTO meta(k, v) VALUES
    ('version',  '"3.3.0"'),
    ('config',   '{}'),
    ('settings', '{"projectName":"iRouter","baseUrl":"","apiToken":"","tokenMasked":""}'),
    ('stats',    '{"totalRequests":0,"successCount":0,"successRate":0,"avgLatency":0}');

-- 5. 请求日志（RingBuffer 语义：内存聚合，60s 批量 flush 几条 INSERT；表只保留最近 N 条）
CREATE TABLE IF NOT EXISTS request_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    model       TEXT NOT NULL DEFAULT '',
    provider    TEXT NOT NULL DEFAULT '',
    ok          INTEGER NOT NULL DEFAULT 1,   -- 1成功 0失败
    latency_ms  INTEGER NOT NULL DEFAULT 0,
    status      INTEGER NOT NULL DEFAULT 200,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_logs_created ON request_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_model ON request_logs(model);

-- 日志裁剪：超过 2000 条时删最老的（写时触发，避免定时任务）
DELETE FROM request_logs WHERE id <= (
    SELECT MAX(id) - 2000 FROM request_logs
) AND (SELECT COUNT(*) FROM request_logs) > 2000;
