# 项目进度记录

> 最后更新：2026-06-01
> 当前版本：`v0.5.0` ｜ 默认分支：`main` ｜ 远程：github.com/ChibaRie/My_ACGN_Journey

## 当前状态总览

| 项 | 状态 |
|---|---|
| 版本 | v0.5.0 |
| 发布目标 | 推送到 `main` 后由 GitHub Actions 发布 |
| 搜索模式 | anime_trace 式单来源检索 |
| 搜索源 | 6 个：Bangumi、AGE动漫、咕咕番、girigiri愛、豆瓣、NyaFun |
| 在线部署 | GitHub Pages + Cloudflare Worker |
| 线上地址 | https://chibarie.github.io/My_ACGN_Journey/ |
| 代理地址 | https://acgn-proxy.rie-acgn-journey.workers.dev |
| 数据持久化 | 浏览器 LocalStorage |

## v0.5 交付内容

### 1. 搜索核心替换为单来源模式

本版本按用户要求参考 [anime_trace](https://github.com/linyi102/anime_trace) 的搜索思路，替换原来的多源并行聚合：

- UI 只维护一个当前来源，切换来源不会自动搜索。
- 每次搜索只请求当前来源。
- 当前来源失败时只显示该来源的错误。
- 搜索结果仍归一化为现有 `SearchWork`，继续复用「加入我的库」、时间线、统计和编辑流程。

首批来源：

- Bangumi
- AGE动漫
- 咕咕番
- girigiri愛
- 豆瓣
- NyaFun

### 2. 新搜索模块结构

新增 `src/search/`：

```text
src/search/
  sources.js
  searchService.js
  html.js
  adapters/
    bangumi.js
    age.js
    gugu.js
    girigiri.js
    douban.js
    nyafun.js
```

`src/api/search.js` 改为兼容导出层，仅转发新搜索模块，不再保留旧的 AniList / VNDB / 月幕Galgame / 萌娘百科聚合逻辑。

### 3. 代理白名单重建

Vite dev proxy 与 Cloudflare Worker 均改为六个固定前缀：

```text
/api/sources/bangumi/*
/api/sources/age/*
/api/sources/gugu/*
/api/sources/girigiri/*
/api/sources/douban/*
/api/sources/nyafun/*
```

安全约束：

- 未知前缀返回 404。
- 上游 host 固定写在路由表里。
- 不通过 query/body 接收任意目标 URL。
- `rewritePath` 折叠前导 `//`，避免协议相对路径逃逸。
- Worker 回填限定来源的 CORS 头。

### 4. 文档同步

已同步：

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/DEPLOYMENT.md`
- `docs/PROGRESS.md`

## 历史版本摘要

### v0.4

- 移除 Bilibili 搜索源。
- 新增自定义背景功能。

### v0.3

- 接入 AniList、VNDB、月幕Galgame。
- 部署到 GitHub Pages + Cloudflare Worker。
- 引入 Vitest 测试。

### v0.2

- 首个完整功能版本：作品库管理、分类筛选、时间线、统计面板、实体库存、关系图谱、批量导入和本地 JSON 备份。

## 发布后注意

- 推送 `main` 会触发 GitHub Actions 部署前端。
- 本次改动包含 Worker 路由变更，若线上搜索仍走旧 Worker，需要手动执行：

```bash
cd worker
wrangler deploy
```

- 第三方站点 HTML 结构可能变化；若某个来源突然无结果，优先检查对应 adapter 解析规则。
