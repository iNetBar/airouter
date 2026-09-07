@echo off
chcp 65001 >nul
REM ============================================================
REM  iRouter 一键部署脚本（Windows 版）
REM  用法：
REM    1. 安装 Node.js (https://nodejs.org) 一路下一步
REM    2. 打开命令提示符(cmd)，运行：  npm install -g wrangler
REM    3. 运行：  wrangler login   （浏览器里登录 Cloudflare）
REM    4. 修改下面 ACCOUNT_ID 后，双击本文件或运行：  deploy.bat
REM ============================================================

set WORKER_NAME=irouter
set DB_NAME=irouter-db
set ACCOUNT_ID=

if "%ACCOUNT_ID%"=="" (
  echo [错误] 请用记事本打开本文件，把 ACCOUNT_ID 改成你的 Cloudflare Account ID
  pause
  exit /b 1
)
set CLOUDFLARE_ACCOUNT_ID=%ACCOUNT_ID%

echo ===== iRouter 一键部署 =====
echo Worker: %WORKER_NAME%   数据库: %DB_NAME%
echo.

echo [1/6] 安装依赖...
call npm install
if errorlevel 1 pause & exit /b 1

echo [2/6] 打包...
call npm run build
if errorlevel 1 pause & exit /b 1

echo [3/6] 确保 D1 数据库存在...
wrangler d1 list --json > d1list.json 2>nul
findstr /c:"\"%DB_NAME%\"" d1list.json >nul 2>nul
if errorlevel 1 (
  echo   创建数据库 %DB_NAME% ...
  wrangler d1 create %DB_NAME%
) else (
  echo   数据库 %DB_NAME% 已存在，跳过
)

echo [4/6] 自动建表...
wrangler d1 execute %DB_NAME% --remote --file=./schema.sql
if errorlevel 1 pause & exit /b 1

echo [5/6] 检查并设置环境变量（已存在则跳过，不覆盖用户改过的密码）...
wrangler secret list --name %WORKER_NAME% > secretlist.txt 2>nul
findstr /c:"SESSION_SECRET" secretlist.txt >nul 2>nul
if errorlevel 1 (
  echo change-me-%RANDOM%%RANDOM% | wrangler secret put SESSION_SECRET
) else (
  echo   SESSION_SECRET 已存在，跳过
)
findstr /c:"PROJECT_NAME" secretlist.txt >nul 2>nul
if errorlevel 1 (
  echo iRouter | wrangler secret put PROJECT_NAME
) else (
  echo   PROJECT_NAME 已存在，跳过
)
del secretlist.txt >nul 2>nul
if not "%DEFAULT_ADMIN_PASS%"=="" (
  echo %DEFAULT_ADMIN_PASS% | wrangler secret put DEFAULT_ADMIN_PASS
) else (
  echo   ⚠️ 未设置 DEFAULT_ADMIN_PASS（可通过 set DEFAULT_ADMIN_PASS=xxx 传入），
  echo      请手动执行：wrangler secret put DEFAULT_ADMIN_PASS （否则后台无法登录）
)
echo   ⚠️ 可选设置调用 Token：wrangler secret put API_TOKEN

echo [6/6] 部署...
wrangler deploy --name %WORKER_NAME%
if errorlevel 1 pause & exit /b 1

echo.
echo ✅ 部署完成！
echo    管理后台：https://%WORKER_NAME%.你的子域.workers.dev/admin
echo    首次登录后请立即修改管理员密码。
pause
