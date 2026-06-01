# GitHub Pages 部署 + Cloudflare Worker 代理 — 设计文档

日期：2026-05-29
状态：已批准，待实现

## 1. 目标

将 acgn_journey 部署到 GitHub Pages，让他人可访问；并用 Cloudflare Worker 做 serverless 代理，使线上版本的多源搜索（5 个源）正常工作。同时更新 README。

## 2. 背景与约束

- 应用是纯前端 SPA，dev 下搜索靠 Vite dev-server proxy 转发到 5 个上游 API（绕过 CORS）。
- GitHub Pages 是纯静态托管，无服务器、无代理——线上搜索必须改打到一个外部代理。
- 5 个源：Bangumi、Bilibili、萌娘百科、AniList、VNDB（AniList/VNDB 来自 PR #1）。
- **依赖**：先合并 PR #1（`feat/anilist-vndb-sources`）进 main，使 5 源齐全，再做本部署工作。

## 3. 决策记录

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 部署范围 | 5 源（先合并 PR #1） | 用户要求线上含 AniList/VNDB |
| 代理平台 | Cloudflare Workers | 免费额度大、全球边缘、单文件覆盖 5 源 |
| 代理地址注入 | 环境变量 `VITE_API_BASE` | dev/prod 同代码，地址不硬编码进源码 |
| Worker 部署 | 用户手动 `wrangler deploy` | 代理改动不频繁，免去 CI 存 Cloudflare Token |
| Worker 路由 | 单 Worker + 路径前缀路由表（方案 A） | 与 vite proxy 结构同构、白名单封闭、前端只认一个 base |
| CORS Allow-Origin | 收紧到 Pages 域名（`ALLOWED_ORIGIN` 配置） | 防止 Worker 被搭便车滥用 |
| CI build 门禁 | build 前跑 `npm test` | 符合 testing 规约，测试挂则不部署 |
| 404 fallback | 不做 | 无前端路由、纯 tab 切换，YAGNI |
| 自定义域名 | 不做 | 范围之外 |

## 4. 前端 API base 改造

`src/api/search.js` 顶部新增：
```js
const API_BASE = import.meta.env.VITE_API_BASE || '';
```
5 处 `fetchJson('/api/xxx...')` 改为 `fetchJson(\`${API_BASE}/api/xxx...\`)`。

行为：
- dev：`VITE_API_BASE` 未设 → `API_BASE=''` → 请求 `/api/...` → 走 Vite proxy（现有行为不变）。
- prod：CI 注入 `VITE_API_BASE=https://acgn-proxy.xxx.workers.dev` → 请求打到 Worker。

`fetchJson` 不变（已接受完整 URL）。

## 5. Cloudflare Worker

新建 `worker/index.js` + `wrangler.toml`，与前端分离。

路由表（与 vite.config.js proxy 同构）：
```js
const ROUTES = {
  '/api/bangumi':  { target: 'https://api.bgm.tv',         headers: { 'User-Agent': 'acgn_journey/0.3 (https://github.com/ChibaRie/acgn_journey)' } },
  '/api/bilibili': { target: 'https://api.bilibili.com',   headers: { Referer: 'https://www.bilibili.com/', Origin: 'https://www.bilibili.com' } },
  '/api/moegirl':  { target: 'https://zh.moegirl.org.cn',  headers: {} },
  '/api/anilist':  { target: 'https://graphql.anilist.co', headers: {} },
  '/api/vndb':     { target: 'https://api.vndb.org/kana',  headers: {} },
};
```

转发逻辑（fetch handler）：
1. 匹配最长前缀 → `{target, headers}`；无匹配 → 404。
2. 改写路径：去前缀；空路径兜底 `/`（复刻 AniList 修复）；保留 query。
3. 构造上游请求：method/body 透传，合并源专属 header + 统一浏览器 UA。
4. fetch 上游。
5. 回填 CORS 头，返回。

关键点：POST body 透传（Bangumi/AniList/VNDB 是 POST）；白名单封闭（非 5 前缀一律 404）；AniList 空路径 `|| '/'` 兜底。

## 6. CORS

仅 prod 跨域（dev 同源不涉及）。

- OPTIONS 预检：Worker 拦截，返回 204 + CORS 头，不转发上游。
- 实际响应：转发后加 CORS 头。

```js
const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,   // 默认 https://chibarie.github.io
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
```
`ALLOWED_ORIGIN` 在 wrangler.toml 的 `[vars]` 配置，换域名只改配置。

## 7. Pages 部署

(a) `vite.config.js` base：
```js
base: process.env.GITHUB_ACTIONS ? '/acgn_journey/' : '/',
```
dev 用 `/`，仅 CI 用子路径（项目页地址带仓库名）。

(b) `.github/workflows/deploy.yml`，push 到 main 触发：
1. checkout → setup-node → `npm ci`
2. `npm test`（门禁，挂则停）
3. `npm run build`，`env: VITE_API_BASE: ${{ vars.VITE_API_BASE }}`
4. 上传 dist/ 为 Pages artifact
5. 部署到 Pages（actions/deploy-pages）

`VITE_API_BASE` 存仓库 Variable（非 Secret——非机密，构建产物本就含此 URL）。

(c) 不做 404.html（无前端路由，YAGNI）。

## 8. README 更新

- 当前版本 v0.3、功能列表补充 AniList/VNDB 源。
- 新增"在线访问"段：Pages 地址 + 搜索功能依赖 Worker 代理的说明。
- 新增"部署"段：指向 docs/DEPLOYMENT.md。

## 9. 部署文档（docs/DEPLOYMENT.md）

写清两条人工步骤：

1. Cloudflare Worker（用户手动）：`npm i -g wrangler` → `wrangler login` → `cd worker && wrangler deploy` → 记 Worker URL；改允许源改 wrangler.toml `ALLOWED_ORIGIN`。
2. GitHub 仓库配置（用户手动）：Settings→Pages→Source 选 "GitHub Actions"；Settings→Variables 新建 `VITE_API_BASE`=Worker URL；push main 触发部署。

## 10. 执行边界

| 我能做（代码/CI 层） | 必须用户做（账号/浏览器层） |
|---|---|
| 写 Worker + wrangler.toml | wrangler login + deploy |
| 写 deploy.yml | 开启 Pages（Actions 源） |
| 改 search.js 用 VITE_API_BASE | 设 VITE_API_BASE Variable |
| 配 vite base | 验证线上站可访问 |
| 写 DEPLOYMENT.md + README | — |

## 11. 测试策略

- Worker 纯函数（路由匹配、路径改写、CORS 头构造）抽出用 vitest 单测。
- 前端 API_BASE：`API_BASE=''` 时路径不变需验证；现有 14 测试保证 normalize 不回归。
- 端到端（线上真打通）：用户部署后人工验证，不在自动化范围内。

## 12. 范围之外（YAGNI）

- 自定义域名
- 404.html SPA fallback
- CI 自动部署 Worker（用户手动）
- 上游源本身的稳定性问题（如 Bangumi 间歇 500）
