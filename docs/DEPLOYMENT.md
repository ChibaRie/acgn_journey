# 部署指南

本项目部署为 GitHub Pages 静态站 + Cloudflare Worker 搜索代理。前端通过 GitHub Actions 自动部署；Worker 需手动部署一次。

## 一、部署 Cloudflare Worker（搜索代理）

线上搜索（Bangumi / Bilibili / 萌娘百科 / AniList / VNDB）依赖该 Worker 转发上游 API，规避浏览器 CORS。

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

- 前端代码中所有搜索请求走 `/api/<源>` 路径。
- **本地开发**：`VITE_API_BASE` 为空，请求由 Vite dev server 代理转发（见 `vite.config.js`），无需 Worker。
- **生产**：构建时注入 `VITE_API_BASE`，请求改打到 Cloudflare Worker，由 Worker 转发到各上游并回填 CORS 头。
- Worker 路由表（`worker/router.js`）与 Vite 代理表结构一致，是白名单封闭代理——只转发这 5 个已知源，其它路径返回 404。

## 本地开发

本地 `npm run dev` 不需要 Worker：dev 下搜索请求走 Vite dev-server 代理。仅当你想在本地验证 Worker 本身时才需要 `wrangler dev`。
