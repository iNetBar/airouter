// routecheck.ts — 真实 bundle 路由回归测试（mock D1）
import worker from '../worker.ts';

function makeDb() {
    return {
        prepare(sql: string) {
            return {
                bind(..._args: any[]) {
                    return {
                        all: async () => ({ results: [] }),
                        run: async () => ({}),
                    };
                },
                all: async () => ({ results: [] }),
                run: async () => ({}),
            };
        },
        batch: async (a: any[]) => a.map(() => ({})),
    };
}

(async () => {
    const env: any = { DB: makeDb() }; // 不设 SESSION_SECRET / DEFAULT_ADMIN_PASS / PROXY_KEY
    const ctx: any = { waitUntil: async () => {} };

    const r1 = await worker.fetch(new Request('http://x/admin/api/dashboard'), env, ctx);
    const b1 = await r1.text();
    console.log('[R1] GET /admin/api/dashboard     ->', r1.status, '|', r1.headers.get('content-type'), '|', b1.slice(0, 90));

    const r2 = await worker.fetch(new Request('http://x/admin/api/storage/status'), env, ctx);
    console.log('[R2] GET /admin/api/storage/status(未登录) ->', r2.status, '|', (await r2.text()).slice(0, 60));

    const r3 = await worker.fetch(new Request('http://x/admin'), env, ctx);
    console.log('[R3] GET /admin                  ->', r3.status, '|', r3.headers.get('content-type'));

    const r3b = await worker.fetch(new Request('http://x/admin/some/deep/path'), env, ctx);
    console.log('[R3b] GET /admin/some/deep/path   ->', r3b.status, '|', r3b.headers.get('content-type'));

    const r4 = await worker.fetch(new Request('http://x/admin/api/login', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'x' }),
    }), env, ctx);
    console.log('[R4] POST /admin/api/login(无DEFAULT_ADMIN_PASS) ->', r4.status, '|', (await r4.text()).slice(0, 100));

    const r5 = await worker.fetch(new Request('http://x/v1/chat/completions', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'gpt-4o-mini', messages: [] }),
    }), env, ctx);
    console.log('[R5] POST /v1/chat/completions(未配置PROXY_KEY/apiToken) ->', r5.status, '|', (await r5.text()).slice(0, 120));

    const r6 = await worker.fetch(new Request('http://x/health'), env, ctx);
    const b6 = await r6.text();
    console.log('[R6] GET /health                 ->', r6.status, '|', b6.slice(0, 80));

    const pass = r1.status === 401 && b1.trim().startsWith('{') && r2.status === 401 && r3.status === 200 && r3.headers.get('content-type')?.includes('html') && r3b.status === 200 && r4.status === 500 && r5.status === 500 && r6.status === 200;
    console.log('    => 路由回归测试', pass ? 'PASS' : 'FAIL');
    process.exit(0);
})();