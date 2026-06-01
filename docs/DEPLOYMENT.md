# 部署指南

本项目部署为 GitHub Pages 静态站。默认搜索源优先浏览器直连；Cloudflare Worker 只作为已验证来源的可选 fallback，默认搜索不依赖它。

## 一、可选部署 Cloudflare Worker（搜索代理）

默认可直连来源不依赖 Worker，并按当前 UI 顺序排序：

- AGE动漫搜索页
- 萌娘百科 MediaWiki API
- trace.moe 截图识别 API

Bangumi 在 UI 中标注为需代理；如果未配置 `VITE_API_BASE`，前端仍会尝试官方 API 直连 fallback。

Worker 只转发以下仍保留的固定前缀，不接收任意目标 URL：

| 前端路径 | 上游 |
|---|---|
| `/api/bangumi/*` | `https://api.bgm.tv/*` |
| `/api/sources/bangumi/*` | `https://api.bgm.tv/*` |
| `/api/age/*` | `https://www.agedm.io/*` |
| `/api/sources/age/*` | `https://www.agedm.io/*` |

咕咕番、girigiri愛、豆瓣、NyaFun 已从 active code 和代理白名单中移除；重新接入前需先验证墙内可用性、CORS/代理策略和解析稳定性。

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

2. 不需要配置 `VITE_API_BASE` 也可以正常发布。默认搜索源会直接请求上游。

3. 如果未来启用 Worker fallback，再到仓库 Settings → Secrets and variables → Actions → **Variables** 标签 → New repository variable：
   - Name: `VITE_API_BASE`
   - Value: Worker URL（不带末尾斜杠）

4. push 到 `main`（或在 Actions 页手动 Run workflow）触发部署。

5. 部署完成后访问 `https://chibarie.github.io/acgn_journey/`。

## 工作原理

- 搜索 UI 是单来源模式：用户先选择 AGE动漫、萌娘百科或 Bangumi，再搜索关键词。
- “截图识别”面板直接调用 trace.moe，可上传本地截图或粘贴图片 URL。
- `src/search/adapters/*` 负责按来源构造请求、解析 HTML/JSON，并归一化为 `SearchWork`。
- Bangumi 代理优先使用当前线上 Worker 已部署的 `/api/bangumi/*`，Worker 代码也兼容新前缀 `/api/sources/bangumi/*`。
- **本地开发**：默认来源直接请求上游；保留的代理 fallback 可由 Vite dev server 转发（见 `vite.config.js`）。
- **生产**：默认来源直接请求上游；若未来启用代理 fallback，构建时注入 `VITE_API_BASE`，请求改打 Cloudflare Worker，由 Worker 转发到固定上游并回填 CORS 头。
- Worker 路由表（`worker/router.js`）与 Vite 代理表结构一致，是白名单封闭代理；其它路径返回 404。

## 本地开发

本地默认使用 `npm run app` 统一启停开发服务；需要前台查看 Vite 日志时也可以直接运行 `npm run dev`。本地开发不需要 Worker。只有验证生产代理本身时才需要 `cd worker && wrangler dev` 或重新部署 Worker。
