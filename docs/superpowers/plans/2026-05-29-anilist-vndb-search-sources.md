# AniList 与 VNDB 搜索源接入 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有多源搜索中新增 AniList（动画/漫画拆为两源）和 VNDB 两个数据源。

**Architecture:** 沿用现有 `PROVIDERS` 映射 + `Promise.allSettled` 并行调度（方案 A）。每个源是一个独立的 `search*` 函数 + `normalize*Item` 纯函数。纯转换函数用 vitest 单元测试，集成行为用浏览器实测验证。

**Tech Stack:** React 19, Vite 7, vitest（新增）, AniList GraphQL API, VNDB Kana HTTPS API。

**关键解析（计划自审发现）：** spec 第 4 节 AniList meta 原写 `averageScore 分`，但 AniList averageScore 是 0–100 百分制，与「rating 统一 10 分制」的决策冲突。本计划统一为 `averageScore / 10`，并已同步修正 spec。

---

## 文件结构

| 文件 | 职责 | 改动 |
|------|------|------|
| `package.json` | 加 vitest devDep + test 脚本 | Modify |
| `vite.config.js` | defineConfig 改用 vitest/config；加 2 个 dev proxy | Modify |
| `src/api/search.js` | 加 stripBBCode + 3 个 normalize + 3 个 search + 注册 + 导出 | Modify |
| `src/api/search.test.js` | 纯函数单元测试 | Create |
| `src/components/SearchPanel.jsx` | DEFAULT_SOURCES 扩为 6 个 | Modify |

---

## Task 1: 搭建 vitest 测试环境

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js:1-2`

- [ ] **Step 1: 安装 vitest**

Run: `npm install -D vitest`
Expected: package.json devDependencies 出现 vitest，无报错。

- [ ] **Step 2: 加 test 脚本**

修改 `package.json` 的 scripts，加一行：

```json
"scripts": {
  "dev": "vite --host 127.0.0.1 --port 5188",
  "build": "vite build",
  "preview": "vite preview --host 127.0.0.1 --port 4174",
  "test": "vitest run"
}
```

- [ ] **Step 3: 让 vite.config.js 支持 test 字段**

将 `vite.config.js` 第 1 行的 import 从 `vite` 改为 `vitest/config`（re-export 了 vite 的 defineConfig，兼容现有 server/proxy 配置）：

```js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
```

- [ ] **Step 4: 冒烟验证 vitest 可运行**

Run: `npm test`
Expected: vitest 启动，报 "No test files found"（此时还没测试文件），退出码非崩溃。

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.js
git commit -m "test: add vitest test harness"
```

## Task 2: stripBBCode 工具函数（TDD）

VNDB 简介含 BBCode（`[url=...]文字[/url]`、`[spoiler]...[/spoiler]`、`[b]...[/b]`）。现有 `stripHtml` 只去 HTML 标签，处理不了 BBCode。新增 `stripBBCode` 去掉 `[...]` 标记但保留标记内的可见文字。

**Files:**
- Create: `src/api/search.test.js`
- Modify: `src/api/search.js`（顶部加 export function，并在文件末尾 export 区暴露）

- [ ] **Step 1: 写失败测试**

创建 `src/api/search.test.js`：

```js
import { describe, it, expect } from 'vitest';
import { stripBBCode } from './search.js';

describe('stripBBCode', () => {
  it('removes url bbcode but keeps the link text', () => {
    expect(stripBBCode('see [url=/v17]Ever17[/url] now')).toBe('see Ever17 now');
  });

  it('removes spoiler and formatting tags', () => {
    expect(stripBBCode('[spoiler]secret[/spoiler] [b]bold[/b]')).toBe('secret bold');
  });

  it('handles empty and plain input', () => {
    expect(stripBBCode('')).toBe('');
    expect(stripBBCode('plain text')).toBe('plain text');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL，报 `stripBBCode is not a function` 或 import 未定义。

- [ ] **Step 3: 实现 stripBBCode**

在 `src/api/search.js` 顶部（`stripHtml` 函数定义之后）加入：

```js
export function stripBBCode(value = '') {
  return String(value)
    .replace(/\[url=[^\]]*\]/gi, '')
    .replace(/\[\/?[a-z][^\]]*\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}
```

注意：`stripHtml` 当前未 export，保持不变；`stripBBCode` 用 `export function` 直接命名导出，供测试 import。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`
Expected: PASS，3 个 stripBBCode 用例全绿。

- [ ] **Step 5: Commit**

```bash
git add src/api/search.js src/api/search.test.js
git commit -m "feat: add stripBBCode helper for VNDB descriptions"
```

---

## Task 3: AniList 归一化函数（TDD）

`normalizeAniListItem(media, source)` 把 AniList Media 对象转为 SearchWork。`source` 参数区分 `anilist_anime` / `anilist_manga`，并决定 type 文案。

**Files:**
- Modify: `src/api/search.js`
- Modify: `src/api/search.test.js`

- [ ] **Step 1: 写失败测试**

在 `src/api/search.test.js` 末尾追加：

```js
import { normalizeAniListItem } from './search.js';

const aniListAnime = {
  id: 21,
  title: { romaji: 'Sousou no Frieren', english: 'Frieren', native: '葬送のフリーレン' },
  coverImage: { large: 'https://img/large.jpg', medium: 'https://img/med.jpg' },
  description: 'A story <br>about an elf.',
  genres: ['Adventure', 'Drama'],
  tags: [{ name: 'Magic' }, { name: 'Adventure' }],
  averageScore: 89,
  format: 'TV',
  startDate: { year: 2023 },
  siteUrl: 'https://anilist.co/anime/21',
  isAdult: false,
};

describe('normalizeAniListItem', () => {
  it('prefers native (Japanese) title', () => {
    const work = normalizeAniListItem(aniListAnime, 'anilist_anime');
    expect(work.title).toBe('葬送のフリーレン');
    expect(work.originalTitle).toBe('Sousou no Frieren');
  });

  it('maps anime source to 动画 type and builds id/url', () => {
    const work = normalizeAniListItem(aniListAnime, 'anilist_anime');
    expect(work.id).toBe('anilist-21');
    expect(work.source).toBe('anilist_anime');
    expect(work.type).toBe('动画');
    expect(work.sourceUrl).toBe('https://anilist.co/anime/21');
    expect(work.releaseYear).toBe('2023');
  });

  it('converts averageScore to 10-point scale in meta', () => {
    const work = normalizeAniListItem(aniListAnime, 'anilist_anime');
    expect(work.meta).toContain('8.9 分');
  });

  it('dedupes genres and tags', () => {
    const work = normalizeAniListItem(aniListAnime, 'anilist_anime');
    expect(work.tags).toEqual(['Adventure', 'Drama', 'Magic']);
  });

  it('maps manga format NOVEL to 轻小说/书籍', () => {
    const novel = { ...aniListAnime, id: 99, format: 'NOVEL' };
    const work = normalizeAniListItem(novel, 'anilist_manga');
    expect(work.type).toBe('轻小说/书籍');
  });

  it('maps manga format MANGA to 漫画', () => {
    const manga = { ...aniListAnime, id: 98, format: 'MANGA' };
    const work = normalizeAniListItem(manga, 'anilist_manga');
    expect(work.type).toBe('漫画');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL，`normalizeAniListItem is not a function`。

- [ ] **Step 3: 实现 normalizeAniListItem**

在 `src/api/search.js` 加入 type 映射常量（放在文件顶部常量区，`BANGUMI_TYPE_LABELS` 之后）：

```js
const ANILIST_MANGA_FORMAT_LABELS = {
  MANGA: '漫画',
  ONE_SHOT: '漫画',
  NOVEL: '轻小说/书籍',
};
```

并加入归一化函数（放在 `normalizeMoegirlItem` 之后），用 `export function` 导出：

```js
export function normalizeAniListItem(media, source) {
  const title = media.title?.native || media.title?.romaji || media.title?.english || '未命名条目';
  const romaji = media.title?.romaji || '';
  const year = media.startDate?.year ? String(media.startDate.year) : '';
  const type =
    source === 'anilist_manga'
      ? ANILIST_MANGA_FORMAT_LABELS[media.format] || '漫画'
      : '动画';
  const score = media.averageScore ? `${(media.averageScore / 10).toFixed(1)} 分` : '';

  return {
    id: `anilist-${media.id}`,
    source,
    sourceLabel: SOURCE_LABELS[source],
    sourceId: String(media.id),
    sourceUrl: media.siteUrl || `https://anilist.co/${source === 'anilist_manga' ? 'manga' : 'anime'}/${media.id}`,
    title,
    originalTitle: romaji && romaji !== title ? romaji : '',
    cover: normalizeUrl(media.coverImage?.large || media.coverImage?.medium || ''),
    type,
    summary: stripHtml(media.description || ''),
    releaseDate: year,
    releaseYear: year,
    tags: uniqueTags([...(media.genres || []), ...(media.tags || []).map((tag) => tag.name)]),
    meta: [year, score].filter(Boolean),
  };
}
```

注意：此函数引用了 `SOURCE_LABELS[source]`，Task 5 会补 `SOURCE_LABELS` 的 anilist 条目；为让测试通过，**本任务先在 Task 5 之前临时通过也可**——但为避免乱序，Step 4 的测试不断言 `sourceLabel`，故现在即可通过。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`
Expected: PASS，AniList 6 个用例全绿（stripBBCode 3 个仍绿）。

- [ ] **Step 5: Commit**

```bash
git add src/api/search.js src/api/search.test.js
git commit -m "feat: add AniList item normalizer"
```

---

## Task 4: VNDB 归一化函数（TDD）

`normalizeVndbItem(vn)` 把 VNDB vn 对象转为 SearchWork。

**Files:**
- Modify: `src/api/search.js`
- Modify: `src/api/search.test.js`

- [ ] **Step 1: 写失败测试**

在 `src/api/search.test.js` 末尾追加：

```js
import { normalizeVndbItem } from './search.js';

const vndbVn = {
  id: 'v17',
  title: 'Ever17 -The Out of Infinity-',
  alttitle: 'Ever17 -the out of infinity-',
  image: { url: 'https://t.vndb.org/cv/17.jpg', sexual: 0 },
  released: '2002-08-29',
  description: 'A [b]sci-fi[/b] mystery. [url=/v18]sequel[/url]',
  rating: 87,
  length: 4,
  tags: [
    { name: 'Science Fiction', rating: 2.8 },
    { name: 'Amnesia', rating: 2.1 },
  ],
};

describe('normalizeVndbItem', () => {
  it('builds id, source, url and fixed Galgame type', () => {
    const work = normalizeVndbItem(vndbVn);
    expect(work.id).toBe('vndb-v17');
    expect(work.source).toBe('vndb');
    expect(work.sourceId).toBe('v17');
    expect(work.sourceUrl).toBe('https://vndb.org/v17');
    expect(work.type).toBe('Galgame/游戏');
  });

  it('uses default title and strips bbcode from description', () => {
    const work = normalizeVndbItem(vndbVn);
    expect(work.title).toBe('Ever17 -The Out of Infinity-');
    expect(work.summary).toBe('A sci-fi mystery. sequel');
  });

  it('converts 0-100 rating to 10-point scale', () => {
    const work = normalizeVndbItem(vndbVn);
    expect(work.meta).toContain('8.7 分');
  });

  it('orders tags by rating descending', () => {
    const work = normalizeVndbItem(vndbVn);
    expect(work.tags).toEqual(['Science Fiction', 'Amnesia']);
  });

  it('extracts release year', () => {
    const work = normalizeVndbItem(vndbVn);
    expect(work.releaseYear).toBe('2002');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL，`normalizeVndbItem is not a function`。

- [ ] **Step 3: 实现 normalizeVndbItem**

在 `src/api/search.js` 加入（放在 `normalizeAniListItem` 之后），用 `export function` 导出：

```js
export function normalizeVndbItem(vn) {
  const sortedTags = [...(vn.tags || [])].sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const rating = vn.rating ? `${(vn.rating / 10).toFixed(1)} 分` : '';

  return {
    id: `vndb-${vn.id}`,
    source: 'vndb',
    sourceLabel: SOURCE_LABELS.vndb,
    sourceId: vn.id,
    sourceUrl: `https://vndb.org/${vn.id}`,
    title: vn.title || '未命名作品',
    originalTitle: vn.alttitle && vn.alttitle !== vn.title ? vn.alttitle : '',
    cover: normalizeUrl(vn.image?.url || ''),
    type: 'Galgame/游戏',
    summary: stripHtml(stripBBCode(vn.description || '')),
    releaseDate: vn.released || '',
    releaseYear: getYear(vn.released),
    tags: uniqueTags(sortedTags.map((tag) => tag.name)),
    meta: [vn.released, rating].filter(Boolean),
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`
Expected: PASS，VNDB 5 个用例全绿。

- [ ] **Step 5: Commit**

```bash
git add src/api/search.js src/api/search.test.js
git commit -m "feat: add VNDB item normalizer"
```

---

## Task 5: 注册搜索源（search 函数 + PROVIDERS + SOURCE_LABELS）

**Files:**
- Modify: `src/api/search.js`

- [ ] **Step 1: 扩展 SOURCE_LABELS**

将文件顶部 `SOURCE_LABELS` 改为：

```js
const SOURCE_LABELS = {
  bangumi: 'Bangumi',
  bilibili: 'Bilibili',
  moegirl: '萌娘百科',
  anilist_anime: 'AniList动画',
  anilist_manga: 'AniList漫画',
  vndb: 'VNDB',
};
```

- [ ] **Step 2: 加 AniList 查询函数**

在 `searchMoegirl` 之后加入共享查询常量与两个 search 函数：

```js
const ANILIST_QUERY = `query ($search: String, $type: MediaType) {
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
}`;

async function searchAniListByType(keyword, source, mediaType, signal) {
  const json = await fetchJson('/api/anilist', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: ANILIST_QUERY, variables: { search: keyword, type: mediaType } }),
  });

  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message || 'AniList 查询失败');
  }

  return (json.data?.Page?.media || []).map((media) => normalizeAniListItem(media, source));
}

function searchAniListAnime(keyword, signal) {
  return searchAniListByType(keyword, 'anilist_anime', 'ANIME', signal);
}

function searchAniListManga(keyword, signal) {
  return searchAniListByType(keyword, 'anilist_manga', 'MANGA', signal);
}
```

- [ ] **Step 3: 加 VNDB 查询函数**

紧接其后加入：

```js
async function searchVndb(keyword, signal) {
  const json = await fetchJson('/api/vndb/vn', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filters: ['search', '=', keyword],
      fields: 'title, alttitle, image{url, sexual}, released, description, rating, length, tags{name, rating}',
      results: 12,
      sort: 'searchrank',
    }),
  });

  return (json.results || []).map(normalizeVndbItem);
}
```

- [ ] **Step 4: 注册到 PROVIDERS**

将 `PROVIDERS` 改为：

```js
const PROVIDERS = {
  bangumi: searchBangumi,
  bilibili: searchBilibili,
  moegirl: searchMoegirl,
  anilist_anime: searchAniListAnime,
  anilist_manga: searchAniListManga,
  vndb: searchVndb,
};
```

- [ ] **Step 5: 运行测试确认无回归**

Run: `npm test`
Expected: PASS，全部 14 个用例仍绿（注册改动不影响纯函数测试）。

- [ ] **Step 6: Commit**

```bash
git add src/api/search.js
git commit -m "feat: register AniList and VNDB search providers"
```

---

## Task 6: dev 代理配置

**Files:**
- Modify: `vite.config.js`

- [ ] **Step 1: 加两个 proxy 条目**

在 `vite.config.js` 的 `server.proxy` 对象中，`/api/moegirl` 条目之后加入：

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

- [ ] **Step 2: 校验配置可加载**

Run: `npm run dev`（启动后确认无配置报错，看到 `Local: http://127.0.0.1:5188`），然后 Ctrl+C 停止。
Expected: Vite 正常启动，无 proxy 配置语法错误。

- [ ] **Step 3: Commit**

```bash
git add vite.config.js
git commit -m "feat: add dev proxy for AniList and VNDB"
```

---

## Task 7: SearchPanel 接入 6 个源

**Files:**
- Modify: `src/components/SearchPanel.jsx:7`

- [ ] **Step 1: 扩展 DEFAULT_SOURCES**

将 `src/components/SearchPanel.jsx` 第 7 行改为：

```js
const DEFAULT_SOURCES = ['bangumi', 'bilibili', 'moegirl', 'anilist_anime', 'anilist_manga', 'vndb'];
```

chip 渲染、toggle、错误展示均由该数组驱动，无需改其它逻辑。

- [ ] **Step 2: Commit**

```bash
git add src/components/SearchPanel.jsx
git commit -m "feat: enable AniList and VNDB sources in search panel"
```

---

## Task 8: 浏览器集成验证

**Files:** 无代码改动（除非发现 CSS 布局问题）

- [ ] **Step 1: 启动 dev server**

Run: `npm run dev`

- [ ] **Step 2: 验证 6 chip 与跨源搜索**

浏览器打开 `http://127.0.0.1:5188`，进入搜索页：
- 确认 source-bar 出现 6 个 chip（含 AniList动画、AniList漫画、VNDB），换行/布局正常无溢出
- 搜「葬送的芙莉莲」→ AniList动画、AniList漫画、Bangumi 出结果
- 搜「白色相簿2」→ VNDB、Bangumi 出结果，VNDB 卡片标题/封面/简介（无 BBCode 残留）/评分（10 分制）正常
- 确认 AniList 卡片标题为日文原名

- [ ] **Step 3: 验证开关与错误展示**

- 只勾 VNDB 单独搜，确认能出结果
- 取消勾选某源后该源不再返回
- 若某源失败，warning-strip 显示对应中文 label

- [ ] **Step 4: 验证加入库 type 文案**

- VNDB 结果加入库 → 标记「已玩」
- AniList动画 加入库 → 标记「已看」
- AniList漫画 加入库 → 标记「已读」

- [ ] **Step 5: 如有 CSS 布局问题则修复**

若 6 chip 布局异常，调整 `src/styles.css` 中 `.source-bar` 的 `flex-wrap` / `gap`，重新验证后：

```bash
git add src/styles.css
git commit -m "style: adjust source-bar layout for six sources"
```

- [ ] **Step 6: 全量测试 + 构建确认**

Run: `npm test && npm run build`
Expected: 测试全绿，构建成功无报错。

---

## 自审记录

- **Spec 覆盖：** VNDB（Task 4/5/6）、AniList 拆两源（Task 3/5/6）、不过滤成人（查询无 isAdult 过滤）、走 /api/ 代理（Task 6）、AniList 日文优先（Task 3 测试断言）、VNDB 默认 title（Task 4 测试断言）、rating 10 分制（Task 3/4 测试断言）、6 chip UI（Task 7/8）、BBCode 清洗（Task 2）、错误处理（Task 5 AniList errors 检查 + 现有 fetchJson）。全覆盖。
- **量纲冲突修正：** AniList averageScore 0–100 → `/10`，与 VNDB 及决策一致，spec 第 4 节同步修正。
- **类型一致性：** `normalizeAniListItem(media, source)` 签名在 Task 3 定义、Task 5 调用一致；`stripBBCode`、`normalizeVndbItem` 命名前后一致。
- **占位符扫描：** 无 TBD/TODO，每个代码步骤含完整代码。

