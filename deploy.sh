#!/usr/bin/env bash
# ============================================================
#  iRouter 一键部署脚本（小白版）
#  适用：macOS / Linux / Windows(Git Bash 或 WSL)
#
#  用法：
#    1. 先装好 Node.js (>=18) 和 npm
#    2. 在 Cloudflare 注册账号，拿到 Account ID
#       （控制台右下角 "Account ID"）
#    3. 登录 wrangler：  npx wrangler login
#    4. 修改下面 3 个变量，然后运行：  bash deploy.sh
# ============================================================

set -e

# -------- 按需修改这 3 个 --------
WORKER_NAME="irouter"        # 你的 Worker 名字（也是访问子域名）
DB_NAME="irouter-db"         # D1 数据库名字
ACCOUNT_ID=""                # <<< 填你的 Cloudflare Account ID
# ---------------------------------

echo ""
echo "===== iRouter 一键部署 ====="
echo "Worker 名：$WORKER_NAME"
echo "数据库名：$DB_NAME"
echo ""

# 0. 检查环境
command -v node >/dev/null 2>&1 || { echo "❌ 请先安装 Node.js (https://nodejs.org)"; exit 1; }
command -v npx  >/dev/null 2>&1 || { echo "❌ 未找到 npx"; exit 1; }
[ -z "$ACCOUNT_ID" ] && { echo "❌ 请先在脚本里填写 ACCOUNT_ID"; exit 1; }
export CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID"

# 1. 安装依赖
echo ">>> [1/6] 安装依赖..."
npm install

# 2. 打包
echo ">>> [2/6] 打包 worker..."
npm run build

# 3. 建 D1 数据库（已存在则跳过）
echo ">>> [3/6] 确保 D1 数据库存在..."
if npx wrangler d1 list --json 2>/dev/null | grep -q "\"$DB_NAME\""; then
  echo "    数据库 $DB_NAME 已存在，跳过"
else
  echo "    创建数据库 $DB_NAME ..."
  npx wrangler d1 create "$DB_NAME"
fi

# 4. 把 database_id 填进 wrangler.toml（保留一份备份）
#    按名字精确匹配，避免账号内有多个 D1 库时取错 uuid
DB_ID=$(npx wrangler d1 list --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const a=JSON.parse(s);const r=a.find(x=>x.name===process.argv[1]);console.log(r?r.uuid:"")}catch(e){console.log("")}})' "$DB_NAME")
if [ -n "$DB_ID" ]; then
  cp wrangler.toml wrangler.toml.bak
  sed -i.bak2 "s|<DATABASE_ID>|$DB_ID|g" wrangler.toml
  echo "    已写入 database_id = $DB_ID 到 wrangler.toml"
else
  echo "    ⚠️ 未能解析出 $DB_NAME 的 database_id，请检查 wrangler.toml 的 database_id 是否已填写"
fi

# 5. 建表（幂等，可反复跑）
echo ">>> [4/6] 自动建表..."
npx wrangler d1 execute "$DB_NAME" --remote --file=./schema.sql

# 6. 设置必要的环境变量（幂等：已存在则跳过，不覆盖用户改过的强密码/密钥）
echo ">>> [5/6] 检查并设置运行所需的环境变量..."
EXISTING_SECRETS=$(npx wrangler secret list --name "$WORKER_NAME" 2>/dev/null)
set_secret() { # $1=变量名  $2=值
  if echo "$EXISTING_SECRETS" | grep -q "$1"; then
    echo "    $1 已存在，跳过（如需修改：npx wrangler secret put $1）"
  else
    npx wrangler secret put "$1" <<< "$2"
  fi
}
set_secret SESSION_SECRET "${SESSION_SECRET:-irouter-session-$(date +%s)}"
if [ -n "${DEFAULT_ADMIN_PASS:-}" ]; then
  set_secret DEFAULT_ADMIN_PASS "$DEFAULT_ADMIN_PASS"
else
  echo "    ⚠️ 未设置 DEFAULT_ADMIN_PASS 环境变量，部署后请立即在 Cloudflare 控制台设置后台密码（否则后台无法登录）"
fi
if [ -n "${API_TOKEN:-}" ]; then
  set_secret API_TOKEN "$API_TOKEN"
fi
set_secret PROJECT_NAME "iRouter"

# 7. 部署
echo ">>> [6/6] 部署到 Cloudflare Workers..."
npx wrangler deploy --name "$WORKER_NAME"

echo ""
echo "✅ 部署完成！"
echo "   管理后台：https://$WORKER_NAME.<你的子域>.workers.dev/admin"
echo "   健康检查：https://$WORKER_NAME.<你的子域>.workers.dev/health"
echo "   首次登录后请立即修改管理员密码。"
