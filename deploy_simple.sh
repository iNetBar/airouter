#!/usr/bin/env bash
# ============================================================
#  iRouter 极简部署（小白版）
#  一条命令：装依赖 → 建表 → 部署（D1 库在首次 deploy 后自动建好）
#
#  用法：
#    1. 安装 Node.js (>=18) 并  npx wrangler login
#    2. 编辑 wrangler.toml：把 <DATABASE_ID> 换成你的（见 README）
#    3. bash deploy.sh
# ============================================================
set -e

echo "===== iRouter 部署 ====="

command -v node >/dev/null 2>&1 || { echo "❌ 请先装 Node.js: https://nodejs.org"; exit 1; }

echo "[1/4] 安装依赖..."
npm install

echo "[2/4] 打包..."
npm run build

echo "[3/4] 部署（首次会自动创建 D1 数据库 irouter-db）..."
npx wrangler deploy

echo "[4/4] 建表（自动建表，可反复执行，不会删数据）..."
npx wrangler d1 execute irouter-db --remote --file=./schema.sql || \
echo "   （若提示数据库不存在，请先到 Cloudflare 控制台手动建一个名叫 irouter-db 的 D1 库）"

echo ""
echo "✅ 完成！设置管理员密码："
echo "   npx wrangler secret put DEFAULT_ADMIN_PASS"
echo "   npx wrangler secret put SESSION_SECRET"
echo "   然后访问  https://irouter.<子域>.workers.dev/admin"
