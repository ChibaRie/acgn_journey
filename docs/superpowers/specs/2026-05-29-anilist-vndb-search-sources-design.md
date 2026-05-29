# 接入 AniList 与 VNDB 搜索源 — 设计文档

日期：2026-05-29
状态：已批准，待实现

## 1. 目标

在现有多源搜索（Bangumi / Bilibili / 萌娘百科）基础上，新增两个数据源：

- **VNDB**（视觉小说 / Galgame）— Kana HTTPS API
- **AniList**（动画 / 漫画）— GraphQL API，按 type 拆为「AniList动画」「AniList漫画」两个独立源

## 2. 决策记录

| 决策点 | 选择 | 理由 |
|--------|------|------|
| AniList 呈现 | 动画、漫画拆为两个独立源（chip） | 用户要求更细粒度的开关 |
| 实现方式 | 方案 A：两个 provider，各发一次请求 | 贴合现有 `PROVIDERS` + `Promise.allSettled` 调度，零特例 |
| 成人内容 | 不过滤，全部返回 | Galgame 领域 R18 作品常见 |
| 请求路径 | 走 `/api/` 代理 | 与现有三源一致，为后续 Serverless 代理部署统一处理 |
| AniList title | 日文（native）优先 | 用户偏好 |
| VNDB title | 用默认 `vn.title`（通常罗马音） | 用户偏好，无需取 titles{} 子结构 |
| rating 量纲 | VNDB 百分制除 10，对齐 10 分制 | 与 Bangumi / AniList 显示一致 |

## 3. 源标识与 UI 接线

| key | chip 文案 (`SOURCE_LABELS`) | 端点 |
|-----|------|------|
| `anilist_anime` | AniList动画 | `/api/anilist`（GraphQL, `type: ANIME`） |
| `anilist_manga` | AniList漫画 | `/api/anilist`（同端点, `type: MANGA`） |
| `vndb` | VNDB | `/api/vndb/vn` |

改动文件：

- `src/api/search.js`：`SOURCE_LABELS` 加 3 条；新增 3 个 `normalize*Item` + 3 个 `search*`；`PROVIDERS` 注册。
- `src/components/SearchPanel.jsx`：`DEFAULT_SOURCES` 扩为 6 个 `['bangumi','bilibili','moegirl','anilist_anime','anilist_manga','vndb']`。chip 渲染/开关/错误展示已数据驱动，无需改逻辑。
- `vite.config.js`：新增 `/api/anilist`、`/api/vndb` 两个 dev proxy。

UI 注意：chip 栏将有 6 个按钮，需在实现后用浏览器实测 source-bar 换行/布局，必要时微调 CSS。

## 4. AniList 字段映射

端点：`POST /api/anilist` → `https://graphql.anilist.co`，无需认证，body `{ query, variables }`。

GraphQL 查询（两个 provider 共用，仅 `$type` 不同）：

```graphql
query ($search: String, $type: MediaType) {
  Page(page: 1, perPage: 12) {
    media(search: $search, type: $type, sort: SEARCH_MATCH) {
      id
      title { romaji english native }
      coverImage { large medium }
      description(asHtml: false)
      genres
      tags { name }
      averageScore
      format
      startDate { year }
      siteUrl
      isAdult
    }
  }
}
```

`anilist_anime` → `type: ANIME`；`anilist_manga` → `type: MANGA`。不传 isAdult 过滤，但取 `isAdult` 字段备用。

归一化到 `SearchWork`：

| SearchWork 字段 | AniList 来源 |
|-----|-----|
| `id` | `anilist-{media.id}` |
| `source` | `anilist_anime` / `anilist_manga` |
| `sourceId` | `String(media.id)` |
| `sourceUrl` | `media.siteUrl` |
| `title` | `title.native \|\| title.romaji \|\| title.english`（日文优先） |
| `originalTitle` | `title.romaji`（若与 title 不同） |
| `cover` | `coverImage.large \|\| coverImage.medium` |
| `type` | 动画固定「动画」；漫画按 `format` 映射（MANGA→漫画, NOVEL→轻小说/书籍, ONE_SHOT→漫画） |
| `summary` | `stripHtml(description)`（复用现有 stripHtml） |
| `releaseDate` / `releaseYear` | `startDate.year` |
| `tags` | `genres` + `tags[].name`，过 `uniqueTags()` |
| `meta` | `[year, averageScore ? '{score} 分' : '']` 过滤空值 |

错误处理：GraphQL 出错也常返回 HTTP 200，错误在 `json.errors`。`searchAniList` 检查 `if (json.errors?.length) throw new Error(...)`，同 `searchBilibili` 检查 `json.code !== 0` 的模式。

## 5. VNDB 字段映射

端点：`POST /api/vndb/vn` → `https://api.vndb.org/kana/vn`，JSON POST，无需认证。

请求 body：

```json
{
  "filters": ["search", "=", "<关键词>"],
  "fields": "title, alttitle, image{url, sexual}, released, description, rating, length, tags{name, rating}",
  "results": 12,
  "sort": "searchrank"
}
```

返回结构 `{ results: [...], more: bool }`。不做 NSFW 过滤。

归一化到 `SearchWork`：

| SearchWork 字段 | VNDB 来源 |
|-----|-----|
| `id` | `vndb-{vn.id}`（形如 `v17`） |
| `source` | `vndb` |
| `sourceId` | `vn.id` |
| `sourceUrl` | `https://vndb.org/{vn.id}` |
| `title` | `vn.title`（默认主标题） |
| `originalTitle` | `vn.alttitle`（若存在且不同） |
| `cover` | `vn.image?.url`（过 normalizeUrl 兜底） |
| `type` | 固定「Galgame/游戏」 |
| `summary` | `stripBBCode` → `stripHtml`（VNDB 简介含 BBCode 残留） |
| `releaseDate` / `releaseYear` | `vn.released`（`YYYY-MM-DD`） |
| `tags` | `vn.tags` 按 `rating` 降序取 name，过 `uniqueTags()` |
| `meta` | `[released, rating ? '{(rating/10).toFixed(1)} 分' : '']` |

VNDB 专属处理：

1. **BBCode 清洗**：新增轻量 `stripBBCode()` 去掉 `[...]` 标记（`[url=...]`、`[spoiler]` 等），再走 `stripHtml`。
2. **rating 量纲**：VNDB rating 为 0–100，除 10 对齐 10 分制。

错误处理：VNDB 出错返回非 2xx，现有 `fetchJson` 对 `!response.ok` 抛错已覆盖。

## 6. dev 代理

```js
'/api/anilist': {
  target: 'https://graphql.anilist.co',
  changeOrigin: true,
  secure: true,
  headers: browserLikeHeaders,
  rewrite: (path) => path.replace(/^\/api\/anilist/, ''),
},
'/api/vndb': {
  target: 'https://api.vndb.org/kana',
  changeOrigin: true,
  secure: true,
  headers: browserLikeHeaders,
  rewrite: (path) => path.replace(/^\/api\/vndb/, ''),
},
```

VNDB target 带 `/kana`：`/api/vndb/vn` → `https://api.vndb.org/kana/vn`。
AniList 单端点：`/api/anilist` → `https://graphql.anilist.co`。

## 7. 错误处理汇总

- AniList：HTTP 200 也可能带 `json.errors` → 检查并抛错
- VNDB：非 2xx → `fetchJson` 已抛错
- 单源失败不影响其它源（`Promise.allSettled`）
- warning-strip 自动用 `SOURCE_LABELS[source]` 展示，6 源通用

## 8. 验证计划

1. `npm run dev` 起服务
2. 跨源关键词实测（「白色相簿2」「葬送的芙莉莲」），确认 6 chip 出结果
3. 检查 6 chip 在 source-bar 的换行/布局，必要时调 CSS
4. 测单源开关、错误展示
5. 测加入库后 type 文案（VNDB→已玩，AniList动画→已看，AniList漫画→已读）

## 9. 范围之外（YAGNI）

- 不实现 Serverless 代理部署（单独事项）
- 不改现有三源
- 不加 isAdult / NSFW 过滤
