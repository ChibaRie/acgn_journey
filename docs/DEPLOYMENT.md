# 部署指南

本项目部署为 GitHub Pages 静态站 + Cloudflare Worker 搜索代理。前端通过 GitHub Actions 自动部署；Worker 需手动部署一次。

## 一、部署 Cloudflare Worker（搜索代理）

需代理的搜索源（Bilibili / AniList / VNDB / 月幕Galgame）依赖该 Worker 转发上游 API，规避浏览器 CORS。Bangumi 与萌娘百科支持 CORS，由浏览器直连，不经 Worker。

1. 安装 wrangler 并登录（需免费 Cloudflare 账号）：

   ```bash
   npm install -g wrangler
   wrangler login
   ```

2. 部署：

   ```bash
   cd worker
   wrangler deploy
   ```

3. 记下输出的 Worker URL，形如 `https://acgn-proxy.<你的子域>.workers.dev`。

4. 允许来源默认是 `https://chibarie.github.io`。换 Pages 域名时改 `worker/wrangler.toml` 的 `ALLOWED_ORIGIN` 后重新 `wrangler deploy`。

## 二、配置并触发 GitHub Pages

1. 仓库 Settings → Pages → Build and deployment → Source 选 **GitHub Actions**。

2. 仓库 Settings → Secrets and variables → Actions → **Variables** 标签 → New repository variable：
   - Name: `VITE_API_BASE`
   - Value: 第一步记下的 Worker URL（不带末尾斜杠）

3. push 到 `main`（或在 Actions 页手动 Run workflow）触发部署。

4. 部署完成后访问 `https://chibarie.github.io/My_ACGN_Journey/`。

## 工作原理

- 搜索源分两类：**直连源**（Bangumi、萌娘百科）浏览器直接访问官方 API，不经 Worker、不依赖 `VITE_API_BASE`；**需代理源**（Bilibili、AniList、VNDB、月幕Galgame）走 `/api/<源>` 路径。
- **本地开发**：`VITE_API_BASE` 为空，需代理源由 Vite dev server 代理转发（见 `vite.config.js`）。
- **生产**：构建时注入 `VITE_API_BASE`，需代理源请求改打到 Cloudflare Worker，由 Worker 转发到各上游并回填 CORS 头。
- Worker 路由表（`worker/router.js`）与 Vite 代理表结构一致，是白名单封闭代理——只转发已知的需代理源，其它路径返回 404。

## 月幕Galgame（ymgal）说明

- ymgal 接口需 OAuth2 认证。Worker 用公开凭证（`client_id=ymgal`）自动换取 access_token 并内存缓存约 55 分钟，前端无需配置。
- 本地开发限制：`npm run dev` 下不经过 Worker，ymgal 缺少 token 注入，可能搜不出结果。其余源在 dev 下正常。ymgal 的完整功能需在 Worker 部署后验证。

## 本地开发

本地 `npm run dev` 不需要 Worker：直连源（Bangumi、萌娘百科）直接访问官方 API，其余需代理源走 Vite dev-server 代理。仅当你想在本地验证 Worker 本身时才需要 `wrangler dev`。
