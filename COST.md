# 免费额度优化指南（Cloudflare Workers + D1）

## 免费档官方配额（Workers Free，每日 UTC 重置）

| 资源 | 免费额度 | 本项目实际消耗 |
|---|---|---|
| Worker 请求 | **10 万次/天** | 后台低频，通常 < 1000/天 |
| CPU 时间 | **10 万 ms/天**（单请求上限 50ms） | 流式透传 < 5ms/请求 |
| D1 读 | **500 万行/天** | 内存缓存 → 日常 ≈ 0 |
| D1 写 | **10 万行/天** | 批量 flush → 每分钟几次 |
| D1 存储 | **5 GB / 库** | 配置 < 1 MB |
| KV | 已弃用（改 D1） | 0 |

## 本项目省额度的 4 个关键设计

### 1. 转发请求「流式透传」，CPU < 5ms
`proxy.ts` / `worker.ts` 的 `/v1/chat/completions`：拿到上游 Response 的 `ReadableStream` **直接 return**，不在 Worker 里 buffer 完整响应。
→ 长对话、流式 SSE **不累积 CPU 时间**，轻松 < 50ms/请求上限。

### 2. D1 读走「进程级内存缓存」（60s 过期）
`db.ts` 的 `getProviders()` / `getRoutes()`：首次读 D1 后缓存 60 秒，期间 Dashboard 轮询、每次转发查路由 **全部命中内存，0 次 D1 读**。
→ 500 万行/天的额度基本用不到。

### 3. D1 写走「RingBuffer + 60s 批量 flush」
`request_logs`：每条请求不立即写，攒进内存 buffer，每 60s 或满 200 条批量 INSERT（多值 VALUES，一次写 = 若干行）。
→ 10 万行/天的额度，按每分钟几次写入，**一辈子摸不到天花板**。
→ 表自动裁剪到最近 2000 条，存储不膨胀。

### 4. Dashboard 轮询「30s + 页面隐藏暂停」
`dashboard.html`：`setInterval` 30s，但 **`document.hidden` 时跳过**；切走标签页即停止请求。
→ 进一步压低请求数。

## 监控方式
Cloudflare Dashboard → Workers & Pages → irouter → **Metrics / D1**：实时看 requests、CPU、D1 rows read/written，确保不触顶。

## 触顶后的兜底策略（可选）
若某天真的接近 10 万请求/天：
- 给 `/v1/chat/completions` 加 **KV / Cache API 短缓存**（相同 prompt 命中缓存直接返回，省上游调用）
- Dashboard 轮询间隔从 30s → 60s
- 非活跃时段自动降级为「仅内存模式」（已有 `storage.writable` 判断逻辑）

> 对「管理后台 + LLM 路由」这种低频场景，以上 4 条已足够在 **Workers Free 档长期免费用**。
