#!/bin/bash
# airouter 本地冒烟：三协议转发 + responses 兼容（mock 上游）
set -u
BASE=http://127.0.0.1:8788
CJ=/tmp/ar-cj.txt
DEV_PID=${DEV_PID:-}
PASS=0; FAIL=0

cleanup() {
  kill $MOCK_PID 2>/dev/null
  taskkill //F //T //PID $DEV_PID >/dev/null 2>&1
  kill -9 $DEV_PID 2>/dev/null
  pkill -f "wrangler pages dev" 2>/dev/null
  sleep 1
  cd /d/projects/airouter || true
  if [ -f .dev.vars.bak ]; then mv .dev.vars.bak .dev.vars; fi
}
trap cleanup EXIT

check() { # $1 name  $2 expected-substr  $3 actual
  if echo "$3" | grep -qF "$2"; then PASS=$((PASS+1)); echo "PASS  $1";
  else FAIL=$((FAIL+1)); echo "FAIL  $1 (want '$2', got: $(echo "$3" | head -c 220))"; fi
}

echo "== start mock upstream =="
node /tmp/mock-upstream.js >/tmp/mock.log 2>&1 &
MOCK_PID=$!
sleep 1

echo "== reset local D1 state + remove .dev.vars =="
cd /d/projects/airouter || exit 1
rm -rf .wrangler
if [ -f .dev.vars ]; then mv .dev.vars .dev.vars.bak; fi
node /d/projects/airouter/.smoke/apply-d1.cjs >/tmp/migrate.log 2>&1 || { echo "D1 init failed:"; tail -20 /tmp/migrate.log; exit 1; }

echo "== start wrangler pages dev =="
# 不传 --d1：pages dev 从 wrangler.toml 的 [[d1_databases]] 读取 database_id，
# 本地 instance id 与 apply-d1.cjs 建表时完全一致，否则两库不互通
nohup npx wrangler pages dev dist --port 8788 --binding PROXY_KEY=tok-test-123 >/tmp/pagesdev.log 2>&1 &
DEV_PID=$!

echo "== wait /health =="
ok=0
for i in $(seq 1 90); do
  if curl -s -m 2 $BASE/health | grep -q '"ok":true'; then ok=1; break; fi
  sleep 1
done
if [ $ok != 1 ]; then echo "health not ready, tail pagesdev.log:"; tail -30 /tmp/pagesdev.log; exit 1; fi
echo "health ok"

CT='content-type: application/json'

# ---- 鉴权 ----
r=$(curl -s -m 5 -X POST $BASE/v1/chat/completions -H "$CT" -d '{"model":"mock-openai-test","messages":[{"role":"user","content":"hi"}]}')
check "chat 无鉴权 401" '"Unauthorized"' "$r"
r=$(curl -s -m 5 -X POST $BASE/v1/messages -H "$CT" -d '{"model":"mock-anthropic-test","messages":[{"role":"user","content":"hi"}]}')
check "messages 无鉴权 401" '"Unauthorized"' "$r"
r=$(curl -s -m 5 -X POST $BASE/v1/responses -H "$CT" -d '{"model":"mock-openai-test","input":"hi"}')
check "responses 无鉴权 401" '"Unauthorized"' "$r"

# ---- 初始化 + 数据 ----
r=$(curl -s -m 5 -X POST $BASE/admin/api/bootstrap -H "$CT" -d '{"password":"admin-pass-123","session_secret":"local-session-secret-123456"}')
check "bootstrap" '"ok":true' "$r"
curl -s -m 5 -c $CJ -X POST $BASE/admin/api/login -H "$CT" -d '{"password":"admin-pass-123"}' >/dev/null

B="-b $CJ"
curl -s -m 5 $B -X POST $BASE/admin/api/providers -H "$CT" -d '{"id":"mock-openai","name":"mock openai","base_url":"http://127.0.0.1:18999","protocol":"openai","key":"sk-mock-1234"}' >/dev/null
curl -s -m 5 $B -X POST $BASE/admin/api/providers -H "$CT" -d '{"id":"mock-gemini","name":"mock gemini","base_url":"http://127.0.0.1:18999/gemini","protocol":"gemini","key":"gm-mock-1234"}' >/dev/null
curl -s -m 5 $B -X POST $BASE/admin/api/providers -H "$CT" -d '{"id":"mock-anthropic","name":"mock anthropic","base_url":"http://127.0.0.1:18999/anthropic","protocol":"anthropic","key":"sk-ant-mock-1234"}' >/dev/null
curl -s -m 5 $B -X POST $BASE/admin/api/routes -H "$CT" -d '{"name":"ro","pattern":"mock-openai-*","providers":["mock-openai"],"fallback":[],"priority":10}' >/dev/null
curl -s -m 5 $B -X POST $BASE/admin/api/routes -H "$CT" -d '{"name":"rg","pattern":"mock-gemini-*","providers":["mock-gemini"],"fallback":[],"priority":10}' >/dev/null
curl -s -m 5 $B -X POST $BASE/admin/api/routes -H "$CT" -d '{"name":"ra","pattern":"mock-anthropic-*","providers":["mock-anthropic"],"fallback":[],"priority":10}' >/dev/null

AH='Authorization: Bearer tok-test-123'

# ---- openai ----
r=$(curl -s -m 8 -X POST $BASE/v1/chat/completions -H "$AH" -H "$CT" -d '{"model":"mock-openai-test","messages":[{"role":"user","content":"hi"}]}')
check "openai 非流式" 'Hello from mock-openai' "$r"
r=$(curl -s -m 8 -N -X POST $BASE/v1/chat/completions -H "$AH" -H "$CT" -d '{"model":"mock-openai-test","messages":[{"role":"user","content":"hi"}],"stream":true}')
check "openai 流式" 'mock-openai!' "$r"

# ---- gemini ----
r=$(curl -s -m 8 -X POST $BASE/v1/chat/completions -H "$AH" -H "$CT" -d '{"model":"mock-gemini-test","messages":[{"role":"system","content":"sys"},{"role":"user","content":"hi"}]}')
check "gemini 非流式转换" 'Hello from mock-gemini' "$r"
r=$(curl -s -m 8 -N -X POST $BASE/v1/chat/completions -H "$AH" -H "$CT" -d '{"model":"mock-gemini-test","messages":[{"role":"user","content":"hi"}],"stream":true}')
check "gemini 流式转换" 'mock-gemini!' "$r"

# ---- anthropic ----
r=$(curl -s -m 8 -X POST $BASE/v1/messages -H "$AH" -H "$CT" -H 'anthropic-version: 2023-06-01' -d '{"model":"mock-anthropic-test","max_tokens":64,"messages":[{"role":"user","content":"hi"}]}')
check "anthropic 非流式" 'Hello from mock-anthropic' "$r"
r=$(curl -s -m 8 -N -X POST $BASE/v1/messages -H "$AH" -H "$CT" -d '{"model":"mock-anthropic-test","max_tokens":64,"stream":true,"messages":[{"role":"user","content":"hi"}]}')
check "anthropic 流式" 'mock-anthropic!' "$r"
r=$(curl -s -m 8 -X POST $BASE/v1/chat/completions -H "$AH" -H "$CT" -d '{"model":"mock-anthropic-test","messages":[{"role":"user","content":"hi"}]}')
check "anthropic 模型走 chat 端点明确 502" 'openai/gemini' "$r"

# ---- responses ----
r=$(curl -s -m 8 -X POST $BASE/v1/responses -H "$AH" -H "$CT" -d '{"model":"mock-openai-test","input":"hi"}')
check "responses 非流式 object" '"object":"response"' "$r"
check "responses 非流式文本" 'Hello from mock-openai' "$r"
r=$(curl -s -m 8 -N -X POST $BASE/v1/responses -H "$AH" -H "$CT" -d '{"model":"mock-openai-test","input":[{"type":"message","role":"user","content":[{"type":"input_text","text":"hi"}]}],"instructions":"be brief","stream":true}')
check "responses 流式 created" 'response.created' "$r"
check "responses 流式 delta" 'output_text.delta' "$r"
check "responses 流式 completed" 'response.completed' "$r"

echo "== RESULT: PASS=$PASS FAIL=$FAIL =="
[ $FAIL = 0 ]