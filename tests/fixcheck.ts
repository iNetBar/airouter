// fixcheck.ts — 验证修复点行为（构建后由 node 运行）
import { logRing } from '../db';

interface SqlCall { sql: string; binds: any[] }
const calls: SqlCall[] = [];

function makeDb(onInsert: (sql: string, binds: any[]) => void) {
    return {
        prepare(sql: string) {
            return {
                bind(...binds: any[]) {
                    return {
                        run: async () => { onInsert(sql, binds); return {}; },
                        all: async () => ({ results: [] }),
                    };
                },
                run: async () => ({}),
            };
        },
        batch: async () => [],
    };
}

// ---------- 测试 1：flush 分块（参数不超 100） + stats 累加 ----------
(async () => {
    const db1 = makeDb((sql, binds) => calls.push({ sql, binds }));
    for (let i = 0; i < 210; i++) {
        logRing.push({ model: 'm' + i, provider: 'p', ok: i % 2 === 0, latency_ms: i, status: 200 });
    }
    await logRing.flush(db1 as any);

    const inserts = calls.filter(c => c.sql.startsWith('INSERT INTO request_logs'));
    const maxBinds = Math.max(...inserts.map(c => c.binds.length));
    const totalRows = inserts.reduce((n, c) => n + c.binds.length / 5, 0);
    const stats = calls.find(c => c.sql.includes('json_set') && c.sql.includes('totalRequests'));
    const ok1 = inserts.length === 11 && maxBinds <= 100 && totalRows === 210 && !!stats;
    console.log('[1] INSERT 语句数 =', inserts.length, '(期望 11) | 单条最大绑定 =', maxBinds, '(期望 <=100) | 总行数 =', totalRows, '(期望 210) | stats 存在 =', !!stats, '| stats bind =', stats ? stats.binds : '-');
    console.log('    => 测试1', ok1 ? 'PASS' : 'FAIL');

    // ---------- 测试 2：失败块放回、成功块不重放 ----------
    const calls2: SqlCall[] = [];
    let failFirst = true;
    const db2 = makeDb((sql, binds) => {
        if (failFirst && sql.startsWith('INSERT INTO request_logs')) { failFirst = false; throw new Error('simulated failure'); }
        calls2.push({ sql, binds });
    });
    (logRing as any).buf = [];
    await logRing.flush(db2 as any);            // buffer 空 → 直接返回
    for (let i = 0; i < 25; i++) logRing.push({ model: 'x' + i, provider: 'q', ok: true, latency_ms: 1, status: 200 });
    await logRing.flush(db2 as any);            // block1(20) 失败放回，block2(5) 成功
    const bufAfter = (logRing as any).buf.length;
    const inserted1 = calls2.filter(c => c.sql.startsWith('INSERT INTO request_logs')).reduce((n, c) => n + c.binds.length / 5, 0);
    await logRing.flush(db2 as any);            // 重试 20 条
    const inserted2 = calls2.filter(c => c.sql.startsWith('INSERT INTO request_logs')).reduce((n, c) => n + c.binds.length / 5, 0);
    const ok2 = bufAfter === 20 && inserted1 === 5 && inserted2 === 25;
    console.log('[2] 失败后 buffer =', bufAfter, '(期望 20) | 首次成功插入 =', inserted1, '(期望 5) | 重试后总插入 =', inserted2, '(期望 25)');
    console.log('    => 测试2', ok2 ? 'PASS' : 'FAIL');
})();