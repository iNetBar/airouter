#!/usr/bin/env bash
# push.sh —— 一键推送到 https://github.com/iNetBar/airouter.git
# 用法:
#   1. 先在 GitHub 撤销旧 token，新建一个 (scope: repo + workflow)
#   2. chmod +x push.sh && ./push.sh
#   3. 按提示粘贴新 token (仅本次有效，用完可撤销)

set -e

REPO="https://github.com/iNetBar/airouter.git"
BRANCH="main"

echo "==> 检查 git..."
command -v git >/dev/null || { echo "请先安装 git"; exit 1; }

# 若仓库不存在，初始化
if [ ! -d .git ]; then
  git init
  git branch -M "$BRANCH"
fi

# 让 git 正常处理带 token 的 URL (避免明文留在 .git/config)
if [ -z "$GH_TOKEN" ]; then
  echo -n "粘贴新的 GitHub PAT (回车后输入，不回显): "
  read -rs GH_TOKEN
  echo
fi

# 用 credential 临时注入，不写死进 remote
git config --local credential.helper "!f() { echo username=iNetBar; echo password=\$GH_TOKEN; }; f"

git remote remove origin 2>/dev/null || true
git remote add origin "$REPO"

echo "==> 添加文件..."
git add .

if git diff --cached --quiet; then
  echo "没有新改动，直接推送当前提交"
else
  git commit -m "${1:-iRouter v3.2.0 - CF Workers + D1, auto deploy}"
fi

echo "==> 推送到 $BRANCH..."
git push -u origin "$BRANCH" --force-with-lease

# 清理 credential helper，避免 token 残留在 config
git config --local --unset credential.helper 2>/dev/null || true

echo "==> 完成. 之后去仓库 Settings -> Secrets -> Actions 配置:"
echo "    CF_API_TOKEN"
echo "    CF_ACCOUNT_ID"
echo "    以及 Cloudflare 控制台的 SESSION_SECRET / DEFAULT_ADMIN_PASS / PROXY_KEY / API_TOKEN"
