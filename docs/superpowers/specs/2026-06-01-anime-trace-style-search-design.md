# 漫迹式单来源搜索核心替换 — 设计文档

日期：2026-06-01
状态：已批准，待实现
参考项目：https://github.com/linyi102/anime_trace
工作分支：`feat/anime-trace-style-search`

## 1. 目标

将 My ACGN Journey 当前的多源聚合搜索替换为参考《漫迹》的**单来源检索**模式：用户先选择一个来源，再在该来源内搜索作品。第一版只迁移一组墙内更可用、范围较小、可验证的来源，删除当前 AniList / VNDB / 月幕Galgame / 萌娘百科等旧聚合搜索入口。

首批来源：

1. Bangumi
2. AGE动漫
3. 咕咕番
4. girigiri愛
5. 豆瓣
6. NyaFun

成功标准是：六个来源可在 UI 中单独选择；每次搜索只查询当前来源；搜索结果仍可加入我的库；Worker/Vite 代理保持白名单，不成为开放代理。

## 2. 背景与约束

- 当前项目是 React + Vite SPA，生产环境部署在 GitHub Pages，搜索代理由 Cloudflare Worker 提供。
- 《漫迹》是 Flutter App，能直接用原生网络请求访问站点；本项目运行在浏览器中，必须处理 CORS。
- 因此不能简单复制请求路径到浏览器直连。所有非 CORS 友好的资源站应通过 Vite dev proxy / Cloudflare Worker 代理访问。
- 本次在分支 `feat/anime-trace-style-search` 上实现；如验证不可用，可丢弃分支回退。
- 参考《漫迹》架构与公开实现，但 Web 端代码需按本项目结构重写与适配。

## 3. 决策记录

| 决策点 | 选择 | 理由 |
|---|---|---|
| 搜索交互 | 单来源搜索 | 用户明确选择《漫迹》式“先选单个来源” |
| 第一版范围 | 6 个来源 | 小范围可验证，避免一次性迁移所有资源站 |
| 推荐方案 | 方案 1：替换为单来源适配器架构 | 符合“删除现有搜索核心、照搬漫迹方式”的目标 |
| 回退方式 | Git 分支回退 | 不在产品中长期保留两套搜索系统，降低复杂度 |
| 解析位置 | 前端 adapter 解析 HTML/JSON，Worker 只做代理 | 适配器逻辑集中，接近《漫迹》结构，也便于单元测试 |
| 代理安全 | 固定来源白名单 | 防止 Worker 变成任意 URL 开放代理 |
| 旧来源 | 移除旧聚合入口 | 本轮目标是替换搜索核心，不做双轨模式 |

## 4. 架构设计

新的搜索核心分三层：

```text
SearchPanel
  ↓
single-source search service
  ↓
source adapters
  ├── bangumi
  ├── age
  ├── gugu
  ├── girigiri
  ├── douban
  └── nyafun
```

`SearchPanel` 只负责 UI 状态：当前来源、关键词、加载状态、错误、结果。业务搜索入口交给 `searchSource(sourceId, keyword, options)`。具体来源的 URL 拼接、请求、HTML/JSON 解析放在各自 adapter 中。

所有 adapter 返回统一的 `SearchWork[]`，继续复用现有 `WorkCard` 与 `useLibrary.addWork()` 入库流程，避免同时重写库管理、时间线、统计等模块。

## 5. 文件结构

新增：

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

职责：

| 文件 | 职责 |
|---|---|
| `src/search/sources.js` | 来源元数据：id、名称、描述、默认来源、代理路径、图标/标签 |
| `src/search/searchService.js` | 对外搜索入口：校验 sourceId，调用 adapter，返回 `{ items, error }` 或抛出结构化错误 |
| `src/search/html.js` | HTML 工具：文本清洗、实体解码、相对 URL 转绝对 URL、年份解析、标签去重 |
| `src/search/adapters/*.js` | 每个来源一个适配器，负责拼 URL、请求、解析、归一化 |

修改：

| 文件 | 改动 |
|---|---|
| `src/api/search.js` | 删除旧多源 provider 逻辑，或改为兼容 re-export 到新 `src/search/searchService.js` |
| `src/components/SearchPanel.jsx` | 从多 chip 并行搜索改为单来源选择 + 单来源搜索 |
| `vite.config.js` | 替换旧 `/api/anilist`、`/api/vndb`、`/api/ymgal` 等代理为新 `/api/sources/*` 路由 |
| `worker/router.js` | 替换路由白名单为六个新来源 |
| `worker/index.js` | 保持安全转发结构，适配新路由表 |
| `README.md` / 部署文档 / 进度文档 | 同步当前搜索来源与使用方式 |

## 6. Adapter 接口

每个来源 adapter 统一导出：

```js
export const source = {
  id: 'age',
  label: 'AGE动漫',
  description: '动画资源站',
  search,
};

export async function search(keyword, { signal } = {}) {
  // returns SearchWork[]
}
```

返回的 `SearchWork` 结构沿用当前项目：

```js
{
  id,
  source,
  sourceLabel,
  sourceId,
  sourceUrl,
  title,
  originalTitle,
  cover,
  type,
  summary,
  releaseDate,
  releaseYear,
  tags,
  meta,
}
```

## 7. 来源范围与解析策略

### Bangumi

- 作为正规元数据来源保留。
- 可继续使用 Bangumi API 或参考《漫迹》的网页搜索 `/subject_search/<keyword>?cat=<type>`。
- 第一版优先选择更稳定、当前项目已有经验的 API 路径；UI 仍表现为单来源搜索。

### AGE动漫

- 参考《漫迹》：`/search?query=<keyword>`。
- 返回类型固定为“动画”。
- 从结果页提取标题、封面、详情链接、简短信息。

### 咕咕番

- 参考《漫迹》：`/index.php/vod/search.html?wd=<keyword>`。
- 返回类型固定为“动画”。
- 解析列表卡片中的标题、封面、详情链接、状态/年份信息。

### girigiri愛

- 参考《漫迹》：`/search/-------------/?wd=<keyword>`。
- 返回类型固定为“动画”。
- 解析标题、封面、详情链接、附加信息。

### 豆瓣

- 作为元数据保底源，不作为播放资源站。
- 返回类型可按搜索结果中的分类信息映射为“动画”或“三次元/影视”，无法判断时使用“影视/动画”。
- 优先提取中文标题、原名、年份、评分、简介、封面。

### NyaFun

- 参考《漫迹》：`/search.html?wd=<keyword>`。
- 返回类型固定为“动画”。
- 作为 AGE / 咕咕番之外的动画资源站保底。

## 8. 代理设计

前端请求统一走：

```text
/api/sources/bangumi/*
/api/sources/age/*
/api/sources/gugu/*
/api/sources/girigiri/*
/api/sources/douban/*
/api/sources/nyafun/*
```

Worker 路由表只允许这些前缀，每个前缀固定到一个上游 host。禁止通过 query/body 传入任意目标 URL。

安全规则：

1. 未匹配白名单前缀返回 404。
2. 路径改写只移除已匹配前缀，保留相对路径与 query。
3. 折叠多余前导 `/`，避免协议相对路径逃逸。
4. 删除入站 `host` 等不应透传的头。
5. CORS 仍限制到配置的 Pages origin。
6. OPTIONS 预检由 Worker 直接响应。

## 9. UI 设计

搜索面板从“多源作品搜索”改为“单来源作品搜索”。结构：

1. 来源选择区
   - 显示 6 个来源按钮或下拉。
   - 当前来源高亮。
   - 展示当前来源简短说明。
2. 关键词输入区
   - 输入关键词。
   - 搜索按钮。
3. 状态区
   - 搜索中、错误、空结果。
4. 结果区
   - 继续使用 `WorkCard`。
   - “加入我的库”逻辑不变。

交互规则：

- 空关键词不发请求，提示输入关键词。
- 切换来源不自动搜索，避免无意请求；保留关键词，用户点击搜索后查询新来源。
- 当前来源失败只显示当前来源错误，不再展示多来源错误列表。

## 10. 错误处理

| 场景 | 行为 |
|---|---|
| 关键词为空 | 不发请求，提示输入关键词 |
| 来源不存在 | `searchSource` 抛出“未知搜索源”错误 |
| HTTP 非 2xx | 显示状态码与来源名称 |
| 代理不可用 | 显示“代理不可用 / 来源不可达” |
| HTML 结构变更 | 捕获解析异常，显示“结果解析失败” |
| 无结果 | 显示“该来源无结果”，不算错误 |
| 请求取消 | 不显示错误 |

## 11. 测试策略

单元测试：

- `searchService`：sourceId 校验、调用正确 adapter、空关键词行为。
- `html.js`：HTML 实体解码、URL 归一化、年份提取、标签去重。
- 各 adapter：用 fixture HTML 测试解析输出，避免真打外网。
- Worker router：白名单匹配、路径改写、未知路径 404、CORS 头。

集成/手工验证：

1. `npm test` 通过。
2. `npm run build` 通过。
3. 本地 `npm run dev` 后逐个来源搜索：
   - `葬送的芙莉莲`
   - `孤独摇滚`
   - `白色相簿2`
4. 每个来源要么返回结果，要么显示清晰错误。
5. 至少一个来源的结果可以成功加入我的库。
6. 确认 Worker 不是开放代理：访问未知 `/api/sources/unknown/...` 返回 404。

## 12. 文档与许可

文档需记录：

- 搜索模式已改为单来源。
- 参考项目为《漫迹》：`https://github.com/linyi102/anime_trace`。
- 第一版来源列表与已知限制。
- 如某来源因站点结构或网络环境不可用，文档中明确标注。

如果实现中直接复用了《漫迹》中明显同源的 URL 模板或解析选择器，应在 adapter 文件顶部注释说明参考来源。

## 13. 范围之外

- 不实现多源并行聚合。
- 不保留旧 AniList / VNDB / 月幕 / 萌娘百科搜索入口。
- 不实现播放链接解析。
- 不导入《漫迹》的用户收藏导入功能。
- 不做账号同步、OAuth、多端同步。
- 不一次性迁移《漫迹》全部搜索源。
