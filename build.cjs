// build.cjs — 健壮构建脚本（CI 和本地通用，纯 CommonJS，无顶层 await）
const { build } = require('esbuild');
const fs = require('fs');
const path = require('path');

function findNodeModules() {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'node_modules'),
    path.join(cwd, 'lib', 'node_modules'),
    '/usr/local/lib/node_modules',
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'hono', 'package.json'))) return c;
  }
  return null;
}

function main() {
  const nm = findNodeModules();
  if (!nm) {
    console.error('❌ 找不到 hono，请确保已安装：npm install hono');
    process.exit(1);
  }
  console.log('📦 使用 node_modules:', nm);

  return build({
    entryPoints: [path.join(process.cwd(), 'worker.ts')],
    bundle: true,
    format: 'esm',
    outfile: path.join(process.cwd(), 'dist', '_worker.js'),
    platform: 'browser',
    target: 'es2022',
    external: ['@cloudflare/workers-types'],
    nodePaths: [nm],
    logLevel: 'warning',
  }).then(function (result) {
    const out = path.join(process.cwd(), 'dist', '_worker.js');
    const code = fs.readFileSync(out, 'utf8');
    console.log('✅ 构建成功:', out, '(' + code.length + ' bytes)');

    const bad = ['Deno.openKv', 'Deno.serve'].filter(function (x) { return code.includes(x); });
    if (bad.length) { console.error('❌ 产物含 Deno 残留:', bad); process.exit(1); }
    console.log('   ✓ 无 Deno.openKv / Deno.serve 残留（已全量迁到 D1 + Workers fetch）');
    if (code.includes('DB.prepare') || code.includes('env.DB')) console.log('   ✓ 使用 D1 绑定 (env.DB)');
    if (code.includes('Hono')) console.log('   ✓ Hono 已 bundle 进产物');
  }).catch(function (e) {
    console.error(e);
    process.exit(1);
  });
}

main();
