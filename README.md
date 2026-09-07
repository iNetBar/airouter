# iRouter（Cloudflare Workers + D1 版）

一个 LLM API 统一网关：多供应商 Key 管理、智能路由、用量统计、可视化后台。
**本版本专为小白设计：数据库自动建、表自动建，push 代码即部署。**

---

## 一、准备（只需一次）

1. 注册 [Cloudflare](https://dash.cloudflare.com)（免费账号即可）
2. 安装 [Node.js](https://nodejs.org)（LTS 版，一路下一步）
3. 拿到两个值：
   - **Account ID**：登录 Cloudflare 后，控制台右下角
   - **API Token**：`My Profile → API Tokens → Create Token`，用 "Edit Cloudflare Workers" 模板，并加上 **D1:Edit** 权限
4. 登录 wrangler（命令行工具）：
   ```
   npm install -g wrangler
   wrangler login
   ```
   浏览器弹出后点授权。

---

## 二、部署（二选一）

### 方式 A：GitHub 自动部署（★推荐）

> 以后改代码只要 `git push`，GitHub 自动帮你**建库 → 建表 → 部署**。

1. 在 GitHub 新建仓库，把本文件夹所有文件上传
2. 仓库 → **Settings → Secrets and variables → Actions** 添加两个密钥：
   - `CF_API_TOKEN` = 你的 API Token
   - `CF_ACCOUNT_ID` = 你的 Account ID
3. 仓库 → **Actions** 标签 → 选 `Deploy to Cloudflare Workers` → **Run workflow**
4. 等日志变绿勾 ✅（自动建库 + 建表 + 部署一气呵成）

详见 **[部署指南.md](./部署指南.md)**。

### 方式 B：本地一条命令

```bash
# 1. 编辑 wrangler.toml，把 <DATABASE_ID> 换成你的（首次可先随便填，deploy 后再补）
# 2. 运行：
npm install
bash deploy.sh        # Windows 用户双击 deploy.bat
```

脚本会自动：装依赖 → 打包 → 部署（自动建 D1 库）→ 跑 schema.sql 建表 → 设置默认环境变量。

---

## 三、首次必做：设置管理员密码

部署后到 Cloudflare 控制台 → **Workers & Pages → irouter → Settings → Variables**：

| 变量名 | 说明 | 是否必填 |
|--------|------|----------|
| `SESSION_SECRET` | 登录加密密钥（任意长字符串） | 必填 |
| `DEFAULT_ADMIN_PASS` | 后台登录密码（**务必改成强密码**；不设置则后台无法登录） | 必填 |
| `PROXY_KEY` | 网关调用鉴权 Token（外部请求 `/v1/chat/completions` 时校验；未设置时用后台「调用信息」中的 Token） | 推荐 |
| `ENCRYPT_KEY` | API Key 加密密钥（**不设置则无法新增 Key**，必须用固定随机字符串，别用默认值） | 推荐 |
| `API_TOKEN` | 备用调用 Token（后台「调用信息」中设置；`PROXY_KEY` 未设置时生效） | 可选 |
| `PROJECT_NAME` | 页面标题，默认 iRouter | 可选 |

改完点 **Deploy** 重启生效。

---

## 四、访问

- 管理后台：`https://irouter.<你的子域>.workers.dev/admin`
- 健康检查：`https://irouter.<你的子域>.workers.dev/health`
- 子域名 = `wrangler.toml` 里的 `name` 字段（默认 `irouter`）

---

## 五、数据库会自动建吗？

**会。** 两种方式都会自动完成：

| 方式 | 建库 | 建表 |
|------|------|------|
| GitHub Actions（方式 A） | workflow 自动 `wrangler d1 create` | 自动跑 `schema.sql` |
| 本地脚本（方式 B） | 首次 `wrangler deploy` 自动建 | `deploy.sh` 自动跑 `schema.sql` |

`schema.sql` 全部用 `CREATE TABLE IF NOT EXISTS`，**反复执行也安全，不会清掉已有数据**。

---

## 六、省额度设计（免费档够用）

- **流式转发**：LLM 响应直接透传，CPU < 5ms/请求
- **内存缓存**：配置类数据进程内缓存 60s，D1 读 ≈ 0
- **批量落盘**：请求日志攒 200 条或 60 秒批量写入，写额度从"每次 1 次"降到"每分钟几次"
- **Dashboard 轮询 60s + 页面隐藏暂停**

D1 免费额度：每天 **500 万行读 / 10 万行写 / 5GB 存储**，正常用基本摸不到天花板。

详见 [COST.md](./COST.md)。

---

## 七、常见问题

**Q：首次访问报 `no such table`？**
A：建表没跑成功。本地执行 `npx wrangler d1 execute irouter --remote --file=./schema.sql` 即可补救，无需重部署。

**Q：忘了管理员密码？**
A：在 Cloudflare 控制台 Variables 里改 `DEFAULT_ADMIN_PASS` → 重新 Deploy。

**Q：看到 `/admin/apiGET 404`？**
A：前端已做路径归一化，强刷（Ctrl+Shift+R）清缓存即可。

---

## 目录结构

```
irouter_cf_d1/
├── worker.ts                 # 主程序入口
├── db.ts                    # D1 数据库操作（缓存+批量写）
├── schema.sql               # 数据库结构（自动建表）
├── wrangler.toml            # Cloudflare 配置
├── package.json
├── .github/workflows/
│   └── deploy.yml           # ★ GitHub 自动部署
├── deploy.sh / deploy.bat   # ★ 本地一键脚本
├── deploy_simple.sh         # 极简脚本
├── COST.md
└── 部署指南.md              # ★ 小白详细图文指南
```
