-- 0001_init.sql — irouter D1 初始化迁移（wrangler migrations 自动执行）
-- 与 schema.sql 内容一致，作为 migrations_dir 的版本化入口

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS providers (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    builtin     INTEGER NOT NULL DEFAULT 0,
    enabled     INTEGER NOT NULL DEFAULT 1,
    base_url    TEXT NOT NULL DEFAULT '',
    protocol    TEXT NOT NULL DEFAULT 'openai',
    headers     TEXT NOT NULL DEFAULT '{}',
    keys        TEXT NOT NULL DEFAULT '[]',
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_providers_enabled ON providers(enabled);

CREATE TABLE IF NOT EXISTS routes (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL DEFAULT '',
    pattern     TEXT NOT NULL DEFAULT '',
    providers   TEXT NOT NULL DEFAULT '[]',
    fallback    TEXT NOT NULL DEFAULT '[]',
    priority    INTEGER NOT NULL DEFAULT 0,
    enabled     INTEGER NOT NULL DEFAULT 1,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_routes_priority ON routes(priority DESC);

CREATE TABLE IF NOT EXISTS keys (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL DEFAULT '',
    provider_id TEXT NOT NULL DEFAULT '',
    secret      TEXT NOT NULL DEFAULT '',
    hint        TEXT NOT NULL DEFAULT '',
    masked      TEXT NOT NULL DEFAULT '',
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    last_used   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_keys_provider ON keys(provider_id);

CREATE TABLE IF NOT EXISTS meta (
    k TEXT PRIMARY KEY,
    v TEXT NOT NULL DEFAULT '{}'
);
INSERT OR IGNORE INTO meta(k, v) VALUES
    ('version',  '"3.2.0"'),
    ('config',   '{}'),
    ('settings', '{"projectName":"iRouter","baseUrl":"","apiToken":"","tokenMasked":""}'),
    ('stats',    '{"totalRequests":0,"successCount":0,"successRate":0,"avgLatency":0}');

CREATE TABLE IF NOT EXISTS request_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    model       TEXT NOT NULL DEFAULT '',
    provider    TEXT NOT NULL DEFAULT '',
    ok          INTEGER NOT NULL DEFAULT 1,
    latency_ms  INTEGER NOT NULL DEFAULT 0,
    status      INTEGER NOT NULL DEFAULT 200,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_logs_created ON request_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_model ON request_logs(model);

DELETE FROM request_logs WHERE id <= (
    SELECT MAX(id) - 2000 FROM request_logs
) AND (SELECT COUNT(*) FROM request_logs) > 2000;
