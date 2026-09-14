// 本地 D1 建表（绕过 wrangler d1 migrations apply --local 的 SQLITE_AUTH 问题）
// 与 pages dev 共用 .wrangler/state 持久化目录
const { Miniflare, convertV4MiniflareOptions } = require('miniflare');
const fs = require('fs');
const path = require('path');

(async () => {
  const rawSql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '0001_init.sql'), 'utf8');
  // 过滤注释行、空行与 workerd sqlite 不支持的 PRAGMA，避免 D1 exec 报错
  // 过滤注释行、空行与 PRAGMA，并将多行 SQL 压缩为单行（workerd D1 exec 对换行解析有 bug）
  const sql = rawSql.replace(/\r/g, '').split('\n').filter((l) => {
    const t = l.trim();
    return t.length > 0 && !t.startsWith('--') && !t.startsWith('PRAGMA');
  }).join(' ').replace(/\s+/g, ' ');
  const root = __dirname;
  const v4 = {
    resourcePersistencePath: path.join(__dirname, '..', '.wrangler', 'state', 'v3'),
    workers: [
      {
        scriptPath: path.join(root, 'empty-worker.js'),
        modules: true,
        name: 'empty',
        compatibilityDate: '2025-06-01',
        d1Databases: { DB: 'f49b9fcd-9def-46de-94ba-6a04372791bc' },
      },
    ],
  };
  const mf = new Miniflare(convertV4MiniflareOptions(v4));
  const db = await mf.getD1Database('DB');
  // D1 exec 不支持多语句，拆成单条逐次执行
  const stmts = sql.split(';').map((s) => s.trim()).filter((s) => s.length > 0);
  let count = 0;
  for (const stmt of stmts) {
    await db.exec(stmt);
    count++;
  }
  console.log('migrations applied via miniflare, statements:', count);
  await mf.dispose();
  process.exit(0);
})().catch((e) => { console.error('apply FAIL:', e); process.exit(1); });