# 项目进度记录

> 最后更新：2026-05-30
> 当前版本：`v0.3.0` ｜ 默认分支：`main` ｜ 远程：github.com/ChibaRie/My_ACGN_Journey

## 当前状态总览

| 项 | 状态 |
|---|---|
| 版本 | v0.3.0 |
| main（本地 = 远程） | `33e1db3` 完全同步 |
| 分支 | 仅 `main`（无遗留特性分支） |
| worktree | 仅主仓库（临时 worktree 已清理） |
| 工作树 | 干净 |
| 搜索源 | 5 个：Bangumi、Bilibili、萌娘百科、AniList（动画/漫画）、VNDB |
| 在线部署 | GitHub Pages + Cloudflare Worker，已上线 |
| 线上地址 | https://chibarie.github.io/My_ACGN_Journey/ |
| 代理地址 | https://acgn-proxy.rie-acgn-journey.workers.dev |
| 单元测试 | 26 个（17 前端 + 9 Worker 路由），全绿 |

## 本轮交付的两大功能

### 1. 接入 AniList 与 VNDB 搜索源（PR #1，已合并 `26b780c`）

在原有 3 源（Bangumi / Bilibili / 萌娘百科）基础上新增：

- **VNDB**（视觉小说 / Galgame）— Kana HTTPS API
- **AniList**（动画 / 漫画）— GraphQL API，拆为「AniList动画」「AniList漫画」两个独立可开关的源

搜索栏从 3 个来源 chip 扩展到 6 个。引入 vitest 测试框架（项目此前无测试）。

关键设计：

- AniList 两个源共用一个 GraphQL 端点，仅 `type`（ANIME/MANGA）不同，复用 `PROVIDERS` + `Promise.allSettled` 并行调度
- 标题：AniList 日文（native）优先；VNDB 用默认 `vn.title`
- 评分统一 10 分制（AniList averageScore/10、VNDB rating/10）
- type 文案：动画→已看、漫画/轻小说→已读、Galgame→已玩
- 新增 `stripBBCode` 清洗 VNDB 简介的 BBCode 标记
- 不过滤成人内容（按需求）

过程中修复：浏览器验证发现 `/api/anilist` 代理把路径改写成空字符串会丢失 POST body（AniList 报 "No query provided"），用 `|| '/'` 兜底修复。

### 2. GitHub Pages 部署 + Cloudflare Worker 代理（PR #2，已合并 `33e1db3`）

让项目可在线访问。GitHub Pages 是纯静态托管，无法跑 Vite dev 代理，故用 Cloudflare Worker 做 serverless 代理使线上搜索可用。

- **前端**：所有 `/api/*` 请求经 `buildApiUrl` + `VITE_API_BASE` 环境变量路由。dev 空值走 Vite 代理（行为不变），prod 注入 Worker URL。
- **Worker**（`worker/`）：单 Worker + 路径前缀路由表，转发 5 个上游并回填 CORS。路由表与 `vite.config.js` dev 代理结构同构。
- **CI/Pages**：`vite.config.js` 仅在 CI 用 `/My_ACGN_Journey/` 子路径；`.github/workflows/deploy.yml` 跑测试门禁 → 构建 → 部署 Pages。
- **文档**：`docs/DEPLOYMENT.md` + README（在线访问、5 源、跨域方案）。

安全（公开代理）：

- 白名单封闭：非 5 个已知前缀一律 404
- 无 SSRF：上游 URL 字符串拼接固定 host（非 `new URL`）；`rewritePath` 折叠前导 `//` 防协议相对路径逃逸（含专门测试）
- CORS 锁定到 Pages 域名（`ALLOWED_ORIGIN`，非通配/非反射）
- 转发前删除入站 `host` 头

过程中修复（最终审查抓到的 Critical）：CI 用 `npm ci` 但 v0.3 曾删除 `package-lock.json`，会导致 CI 第一步失败。已重新生成并提交。

<!-- APPEND-MARKER -->

## 部署配置（已生效）

| 项 | 值 |
|---|---|
| Cloudflare Worker | `acgn-proxy`，部署于 `https://acgn-proxy.rie-acgn-journey.workers.dev` |
| Worker 部署方式 | 手动 `cd worker && wrangler deploy`（不进 CI） |
| `ALLOWED_ORIGIN`（wrangler.toml） | `https://chibarie.github.io` |
| GitHub Pages 源 | GitHub Actions |
| 仓库 Variable `VITE_API_BASE` | `https://acgn-proxy.rie-acgn-journey.workers.dev` |
| 首次部署 Actions | 成功（push #2 合并触发） |

更新代理或前端后的部署流程：

- 改了 `worker/` 下代码 → 手动 `cd worker && wrangler deploy`
- 改了前端 → push 到 `main`，GitHub Actions 自动构建并部署 Pages

## 关键文件结构

```
src/api/search.js          5 源搜索 + buildApiUrl/API_BASE
src/components/SearchPanel  6 个来源 chip
worker/router.js           路由匹配/路径改写/CORS（纯函数，已单测）
worker/index.js            Worker fetch handler（编排转发）
worker/wrangler.toml       Worker 配置（ALLOWED_ORIGIN）
vite.config.js             dev 代理（5 源）+ CI base 子路径
.github/workflows/deploy.yml  测试门禁 → 构建 → 部署 Pages
docs/DEPLOYMENT.md         部署操作手册
docs/superpowers/specs/    两份设计 spec（搜索源、部署）
docs/superpowers/plans/    两份实现计划
```

## 工作流程说明

本轮两个功能均按 brainstorm（设计）→ spec → plan（计划）→ 子代理驱动实现（每任务两阶段审查：spec 合规 + 代码质量）→ 最终全量审查的流程推进。设计 spec 与实现计划存档于 `docs/superpowers/`，可追溯每个决策。

## 待办 / 下一步候选

- **端到端线上验证**：访问 https://chibarie.github.io/My_ACGN_Journey/ ，确认 6 个 chip 搜索均通过 Worker 跑通（部署后人工验证项，尚未确认）。
- 已知上游不稳定：Bangumi、萌娘百科偶发 500/412（上游源问题，非本项目代码缺陷）。
- 未来可选：自定义域名、API 授权同步（OAuth，需后端保存 token）、多端同步（见 ARCHITECTURE.md 第 9 节）。

