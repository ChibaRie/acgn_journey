# 项目进度记录

> 最后更新：2026-06-01
> 当前版本：`v0.5.0` ｜ 默认分支：`main` ｜ 远程：github.com/ChibaRie/My_ACGN_Journey

## 当前状态总览

| 项 | 状态 |
|---|---|
| 版本 | v0.5.0 |
| 发布目标 | 推送到 `main` 后由 GitHub Actions 发布 |
| 搜索模式 | 直连优先的 anime_trace 式单来源检索 |
| 默认搜索源 | 3 个：萌娘百科、AGE动漫、Bangumi |
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

默认来源：

- 萌娘百科
- AGE动漫
- Bangumi

咕咕番、girigiri愛、豆瓣、NyaFun 已从 active code 中舍弃：

- 咕咕番、girigiri愛：页面可访问但无 CORS，需代理。
- 豆瓣：部分 JSON 接口有 CORS 头但请求限制较多，直接读取不稳定。
- NyaFun：当前返回跳转/校验页，需后续单独适配。

### 2. 新搜索模块结构

新增 `src/search/`：

```text
src/search/
  sources.js
  searchService.js
  html.js
  adapters/
    moegirl.js
    bangumi.js
    age.js
```

`src/api/search.js` 改为兼容导出层，仅转发新搜索模块，不再保留旧的 AniList / VNDB / 月幕Galgame 聚合逻辑。萌娘百科以直连单来源身份回归。

### 3. 代理白名单收窄

默认搜索源走浏览器直连。Vite dev proxy 与 Cloudflare Worker 只保留仍可验证的固定前缀，供本地验证或后续 fallback：

```text
/api/sources/bangumi/*
/api/sources/age/*
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

### 5. 线上 404 修正与废弃源清理

v0.5 首次发布后，前端已切到 `/api/sources/*`，但线上 Worker 仍是旧部署；本机 wrangler token 又无 Cloudflare 部署权限，导致默认来源全部命中旧 Worker 404。修正策略是默认展示直连可读来源，降低对 Worker 同步部署的依赖。

随后按“废弃源优先舍弃，优先保留墙内可用”原则继续收窄：

- 默认顺序改为萌娘百科、AGE动漫、Bangumi。
- 删除咕咕番、girigiri愛、豆瓣、NyaFun adapter 与测试。
- 删除上述废弃源的 Vite dev proxy 和 Worker 白名单路由。

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
- 默认搜索不依赖 Worker。若未来验证代理 fallback，需要手动执行：

```bash
cd worker
wrangler deploy
```

- 第三方站点 HTML 结构可能变化；若某个来源突然无结果，优先检查对应 adapter 解析规则。
