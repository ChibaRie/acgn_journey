# 项目进度记录

> 最后更新：2026-06-01
> 当前版本：`v0.5.4` ｜ 默认分支：`main` ｜ 远程：github.com/ChibaRie/acgn_journey

## 当前状态总览

| 项 | 状态 |
|---|---|
| 版本 | v0.5.4 |
| 发布目标 | 推送到 `main` 后由 GitHub Actions 发布 |
| 搜索模式 | 直连优先的 anime_trace 式单来源检索 |
| 默认搜索源 | 3 个：AGE动漫（直连）、萌娘百科（直连）、Bangumi（需代理） |
| 截图识别 | trace.moe |
| 在线部署 | GitHub Pages + Cloudflare Worker |
| 线上地址 | https://chibarie.github.io/acgn_journey/ |
| 代理地址 | https://acgn-proxy.rie-acgn-journey.workers.dev |
| 数据持久化 | 浏览器 LocalStorage |

## v0.5.4 交付内容

### 1. 搜索核心替换为单来源模式

本版本按用户要求参考 [anime_trace](https://github.com/linyi102/anime_trace) 的搜索思路，替换原来的多源并行聚合：

- UI 只维护一个当前来源，切换来源不会自动搜索。
- 每次搜索只请求当前来源。
- 当前来源失败时只显示该来源的错误。
- 搜索结果仍归一化为现有 `SearchWork`，继续复用「加入我的库」、时间线、统计和编辑流程。

默认来源：

- AGE动漫
- 萌娘百科
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
    traceMoe.js
```

`src/api/search.js` 改为兼容导出层，仅转发新搜索模块，不再保留旧的 AniList / VNDB / 月幕Galgame 聚合逻辑。萌娘百科以直连单来源身份回归。

### 3. 代理白名单收窄

默认搜索源走浏览器直连。Vite dev proxy 与 Cloudflare Worker 只保留仍可验证的固定前缀，供本地验证或后续 fallback：

```text
/api/bangumi/*
/api/sources/bangumi/*
/api/age/*
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

- 默认顺序改为 AGE动漫、萌娘百科、Bangumi。
- 删除咕咕番、girigiri愛、豆瓣、NyaFun adapter 与测试。
- 删除上述废弃源的 Vite dev proxy 和 Worker 白名单路由。

### 6. trace.moe 截图识别与 AGE 元数据增强

- 新增“截图识别”面板，接入 trace.moe `/search?anilistInfo`。
- 支持上传本地截图或粘贴图片 URL；默认开启 `cutBorders`。
- trace.moe 结果归一化为 `SearchWork`，可直接加入我的库。
- AGE动漫搜索结果现在解析首播时间、制作公司、剧情类型/标签，并把它们整理为独立 `animeTags`，用于作品年份、meta、卡片标签和后续词云统计。

### 7. 统一启停工具

- 移除旧 Windows 批处理入口。
- 新增 `scripts/dev-server.mjs`，通过 `npm run app` 自动启停本地开发服务。
- 新增 `npm run app:start`、`npm run app:stop`、`npm run app:restart`、`npm run app:status`，统一覆盖启动、停止、重启和状态检查。

### 8. 界面收尾

- 移除页面左上角 ico 标识和浏览器 favicon 引用，界面更简洁。
- 在网页底部新增 `ChibaRie/acgn_journey` GitHub 仓库链接，便于从线上页面回到项目仓库。

### 9. Bangumi 代理兼容与标签词云

- 修复线上 Worker 仍使用旧路由时 Bangumi 代理搜索 404 的问题：前端优先请求 `/api/bangumi/*`，Worker/Vite 同时兼容 `/api/sources/bangumi/*`。
- 统计面板新增标签词云，聚合用户标签与来源解析出的 `animeTags`，点击标签可查看关联作品。
- 新增 `scripts/tag_wordcloud.py`，可从导出的 JSON 备份生成独立词云 HTML；安装 `pyecharts` 后输出交互式词云。

### 10. 我的库批量管理

- “我的库”新增批量管理工具栏，可进入选择模式并显示已选数量。
- 支持一键选择或取消当前筛选结果，便于按类型、年份、状态或关键词批处理。
- 支持批量修改选中记录状态，并在删除多条记录前进行确认。

### 11. 项目重命名与版本同步

- 项目名、页面标题、仓库链接、GitHub Pages base path、备份导出前缀和 LocalStorage 新键统一更新为 `acgn_journey`。
- GitHub 仓库已从旧名重命名为 `ChibaRie/acgn_journey`，部署地址更新为 `https://chibarie.github.io/acgn_journey/`。
- 版本号同步更新为 `v0.5.4`，本地代理和 Worker 的 User-Agent 一并更新。

## 历史版本摘要

### v0.4

- 移除 Bilibili 搜索源。
- 新增自定义背景功能。

### v0.3

- 接入 AniList、VNDB、月幕Galgame。
- 部署到 GitHub Pages + Cloudflare Worker。
- 引入 Vitest 测试。

### v0.2

- 首个完整功能版本：作品库管理、分类筛选、时间线、统计面板、实体库存、批量导入和本地 JSON 备份。

## 发布后注意

- 推送 `main` 会触发 GitHub Actions 部署前端。
- 默认搜索不依赖 Worker。若未来验证代理 fallback，需要手动执行：

```bash
cd worker
wrangler deploy
```

- 第三方站点 HTML 结构可能变化；若某个来源突然无结果，优先检查对应 adapter 解析规则。
