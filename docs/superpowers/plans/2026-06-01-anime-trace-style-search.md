# 漫迹式单来源搜索核心替换 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前多源聚合搜索替换为《漫迹》式的单来源检索模式，首批接入 Bangumi、AGE动漫、咕咕番、girigiri愛、豆瓣、NyaFun 六个来源，并保留结果入库能力。

**Architecture:** 新搜索系统采用“来源注册表 + 单源 service + 独立 adapter”三层结构。`SearchPanel` 只维护一个当前来源，`searchService` 根据来源 ID 调用对应 adapter，adapter 负责拼 URL、发请求、解析响应并归一化为现有 `SearchWork` 结构。前端 adapter 解析 HTML/JSON，Vite dev proxy 与 Cloudflare Worker 只负责固定白名单转发，避免开放代理。

**Tech Stack:** React 19, Vite 7, Vitest, Fetch API, Cloudflare Worker, 现有 `SearchWork` / `WorkCard` / `useLibrary`。

---

## 文件结构

### 新增文件

- `src/search/sources.js` — 单来源元数据注册表
- `src/search/searchService.js` — 单来源搜索入口与结果归一化调度
- `src/search/html.js` — HTML / BBCode / URL / 年份清洗工具
- `src/search/adapters/bangumi.js` — Bangumi 单源适配器
- `src/search/adapters/age.js` — AGE动漫 单源适配器
- `src/search/adapters/gugu.js` — 咕咕番 单源适配器
- `src/search/adapters/girigiri.js` — girigiri愛 单源适配器
- `src/search/adapters/douban.js` — 豆瓣 单源适配器
- `src/search/adapters/nyafun.js` — NyaFun 单源适配器
- `src/search/sources.test.js` — 来源注册表测试
- `src/search/html.test.js` — HTML 工具测试
- `src/search/searchService.test.js` — 单源服务测试
- `src/search/adapters/*.test.js` — 每个 adapter 的 fixture 测试

### 修改文件

- `src/api/search.js` — 改为兼容导出或移除旧多源聚合逻辑，最终只保留新搜索入口需要的导出
- `src/components/SearchPanel.jsx` — 改成单来源选择 + 单来源搜索
- `src/components/WorkCard.jsx` — 保持复用，但核对 sourceLabel / meta / type 文案没有回归
- `src/styles.css` — 调整 source selector 与单来源布局
- `vite.config.js` — 将 dev proxy 改为新来源白名单路由
- `worker/router.js` — 将 worker 路由改为新来源白名单
- `worker/index.js` — 按新路由表转发并保持 CORS / 安全头
- `worker/router.test.js` — 更新路由白名单与 rewrite 测试
- `src/api/search.test.js` — 删除旧聚合测试，替换为新 service / adapter 测试入口
- `README.md` — 更新搜索模式说明与来源列表
- `docs/PROGRESS.md`、`docs/ARCHITECTURE.md` — 同步新搜索模式

---

## Task 1: 建立单来源注册表与搜索服务

**Files:**
- Create: `src/search/sources.js`
- Create: `src/search/searchService.js`
- Create: `src/search/sources.test.js`
- Modify: `src/api/search.js`

- [ ] **Step 1: 写来源注册表测试**

创建 `src/search/sources.test.js`，先锁定六个来源、默认来源和安全白名单：

```js
import { describe, it, expect } from 'vitest';
import { SOURCES, DEFAULT_SOURCE_ID, getSourceById } from './sources.js';

describe('sources registry', () => {
  it('exports exactly six first-party sources in the first release', () => {
    expect(SOURCES.map((source) => source.id)).toEqual([
      'bangumi',
      'age',
      'gugu',
      'girigiri',
      'douban',
      'nyafun',
    ]);
  });

  it('defaults to bangumi', () => {
    expect(DEFAULT_SOURCE_ID).toBe('bangumi');
  });

  it('returns null for unknown source ids', () => {
    expect(getSourceById('evil')).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- src/search/sources.test.js`

Expected: FAIL with module-not-found 或导出缺失错误。

- [ ] **Step 3: 写最小注册表实现**

创建 `src/search/sources.js`：

```js
export const DEFAULT_SOURCE_ID = 'bangumi';

export const SOURCES = [
  {
    id: 'bangumi',
    label: 'Bangumi',
    description: '条目信息与分类更完整，作为基础元数据来源',
    proxyPrefix: '/api/sources/bangumi',
    direct: true,
  },
  {
    id: 'age',
    label: 'AGE动漫',
    description: '墙内动画资源站',
    proxyPrefix: '/api/sources/age',
    direct: false,
  },
  {
    id: 'gugu',
    label: '咕咕番',
    description: '动画资源站',
    proxyPrefix: '/api/sources/gugu',
    direct: false,
  },
  {
    id: 'girigiri',
    label: 'girigiri愛',
    description: '动画资源站',
    proxyPrefix: '/api/sources/girigiri',
    direct: false,
  },
  {
    id: 'douban',
    label: '豆瓣',
    description: '中文标题与评分信息保底来源',
    proxyPrefix: '/api/sources/douban',
    direct: false,
  },
  {
    id: 'nyafun',
    label: 'NyaFun',
    description: '动画资源站保底来源',
    proxyPrefix: '/api/sources/nyafun',
    direct: false,
  },
];

export function getSourceById(sourceId) {
  return SOURCES.find((source) => source.id === sourceId) || null;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- src/search/sources.test.js`

Expected: PASS。

- [ ] **Step 5: 写搜索服务壳并接入旧导出**

创建 `src/search/searchService.js`，先只做 source 校验与分发壳：

```js
import { getSourceById } from './sources.js';

export async function searchSource(sourceId, keyword, options = {}) {
  const source = getSourceById(sourceId);
  if (!source) {
    throw new Error(`未知搜索源: ${sourceId}`);
  }
  if (!String(keyword || '').trim()) {
    return { items: [], error: null };
  }
  return { items: [], error: null };
}
```

然后在 `src/api/search.js` 中改成新搜索层的兼容出口，避免组件先炸掉：

```js
export { DEFAULT_SOURCE_ID, SOURCES, getSourceById } from '../search/sources.js';
export { searchSource } from '../search/searchService.js';
```

- [ ] **Step 6: 运行 service 冒烟测试**

先手工跑：`npm test -- src/search/sources.test.js`

Expected: PASS，且旧 `src/api/search.js` 导出路径可被后续 task 接管。

- [ ] **Step 7: 提交**

```bash
git add src/search/sources.js src/search/searchService.js src/search/sources.test.js src/api/search.js
git commit -m "feat: add single-source search registry"
```

---

## Task 2: 提取 HTML 清洗与归一化工具

**Files:**
- Create: `src/search/html.js`
- Create: `src/search/html.test.js`
- Modify: `src/api/search.js`

- [ ] **Step 1: 写 HTML 工具测试**

创建 `src/search/html.test.js`：

```js
import { describe, it, expect } from 'vitest';
import { stripHtml, stripBBCode, normalizeUrl, getYear, uniqueTags } from './html.js';

describe('html helpers', () => {
  it('strips html tags and entities', () => {
    expect(stripHtml('<p>A &amp; B</p>')).toBe('A & B');
  });

  it('strips bbcode but keeps visible text', () => {
    expect(stripBBCode('see [url=/v17]Ever17[/url] now')).toBe('see Ever17 now');
  });

  it('normalizes protocol-relative and path-relative urls', () => {
    expect(normalizeUrl('//cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
    expect(normalizeUrl('/img/a.jpg', 'https://zh.moegirl.org.cn')).toBe('https://zh.moegirl.org.cn/img/a.jpg');
  });

  it('extracts year from date text', () => {
    expect(getYear('2002-08-29')).toBe('2002');
  });

  it('deduplicates tags in order', () => {
    expect(uniqueTags(['Drama', 'drama', 'Adventure'])).toEqual(['Drama', 'Adventure']);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- src/search/html.test.js`

Expected: FAIL with export missing。

- [ ] **Step 3: 实现最小工具函数**

创建 `src/search/html.js`：

```js
export function stripHtml(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripBBCode(value = '') {
  return String(value)
    .replace(/\[url=[^\]]*\]/gi, '')
    .replace(/\[\/?[a-z][^\]]*\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeUrl(url, base = '') {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/') && base) return `${base.replace(/\/$/, '')}${url}`;
  return url;
}

export function getYear(value) {
  const match = String(value || '').match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : '';
}

export function uniqueTags(tags, limit = 10) {
  const seen = new Set();
  const output = [];

  for (const tag of tags.flat().filter(Boolean)) {
    const value = stripHtml(String(tag)).trim();
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    output.push(value);
    if (output.length >= limit) break;
  }

  return output;
}
```

把 `src/api/search.js` 里现有的 `stripHtml / normalizeUrl / uniqueTags / getYear` 迁移到新文件后删除重复实现，保留旧导出兼容或删掉旧多源逻辑。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- src/search/html.test.js`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/search/html.js src/search/html.test.js src/api/search.js
git commit -m "feat: add search html helpers"
```

---

## Task 3: 迁移 Bangumi 适配器

**Files:**
- Create: `src/search/adapters/bangumi.js`
- Create: `src/search/adapters/bangumi.test.js`
- Modify: `src/search/searchService.js`

- [ ] **Step 1: 写 Bangumi 适配器测试**

创建 `src/search/adapters/bangumi.test.js`，用 fixture HTML 或最小 JSON mock 锁定归一化输出：

```js
import { describe, it, expect } from 'vitest';
import { normalizeBangumiItem, searchBangumi } from './bangumi.js';

describe('bangumi adapter', () => {
  it('normalizes bangumi subject fields into SearchWork', () => {
    const work = normalizeBangumiItem({
      id: 1,
      name_cn: '葬送的芙莉莲',
      name: 'Sousou no Frieren',
      images: { large: 'https://img.example/a.jpg' },
      short_summary: 'A story',
      date: '2023-09-29',
      type: 2,
      tags: [{ name: 'Adventure' }, { name: 'Drama' }],
      score: 9.1,
      rank: 12,
    });

    expect(work.source).toBe('bangumi');
    expect(work.sourceLabel).toBe('Bangumi');
    expect(work.title).toBe('葬送的芙莉莲');
    expect(work.originalTitle).toBe('Sousou no Frieren');
    expect(work.type).toBe('动画');
    expect(work.meta).toContain('2023-09-29');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- src/search/adapters/bangumi.test.js`

Expected: FAIL with function not defined。

- [ ] **Step 3: 实现 Bangumi adapter**

创建 `src/search/adapters/bangumi.js`：

```js
import { stripHtml, normalizeUrl, uniqueTags, getYear } from '../html.js';

const BANGUMI_TYPE_LABELS = {
  1: '轻小说/书籍',
  2: '动画',
  3: '音乐',
  4: 'Galgame/游戏',
  6: '三次元',
};

export function normalizeBangumiItem(item) {
  const title = item.name_cn || item.name || '未命名条目';
  const summary = item.short_summary || item.summary || '';
  const releaseDate = item.date || '';
  const tags = uniqueTags((item.tags || []).map((tag) => tag.name));

  return {
    id: `bangumi-${item.id}`,
    source: 'bangumi',
    sourceLabel: 'Bangumi',
    sourceId: String(item.id),
    sourceUrl: `https://bgm.tv/subject/${item.id}`,
    title,
    originalTitle: item.name && item.name !== title ? item.name : '',
    cover: normalizeUrl(item.images?.large || item.images?.medium || item.images?.grid || ''),
    type: BANGUMI_TYPE_LABELS[item.type] || 'ACGN',
    summary: stripHtml(summary),
    releaseDate,
    releaseYear: getYear(releaseDate),
    tags,
    meta: [releaseDate, item.score ? `${item.score} 分` : '', item.rank ? `Rank ${item.rank}` : ''].filter(Boolean),
  };
}

export async function searchBangumi(keyword, { signal, fetchImpl = fetch } = {}) {
  const payload = {
    keyword,
    sort: 'match',
    filter: { type: [1, 2, 4], nsfw: false },
  };

  const response = await fetchImpl('https://api.bgm.tv/v0/search/subjects?limit=12&offset=0', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`.trim());
  }

  const json = await response.json();
  return (json.data || []).map(normalizeBangumiItem);
}
```

把 `searchService.js` 注册 Bangumi adapter：

```js
import { searchBangumi } from './adapters/bangumi.js';
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- src/search/adapters/bangumi.test.js`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/search/adapters/bangumi.js src/search/adapters/bangumi.test.js src/search/searchService.js
git commit -m "feat: port bangumi search adapter"
```

---

## Task 4: 迁移 AGE、咕咕番、girigiri愛、NyaFun、豆瓣适配器

**Files:**
- Create: `src/search/adapters/age.js`
- Create: `src/search/adapters/gugu.js`
- Create: `src/search/adapters/girigiri.js`
- Create: `src/search/adapters/nyafun.js`
- Create: `src/search/adapters/douban.js`
- Create: `src/search/adapters/age.test.js`
- Create: `src/search/adapters/gugu.test.js`
- Create: `src/search/adapters/girigiri.test.js`
- Create: `src/search/adapters/nyafun.test.js`
- Create: `src/search/adapters/douban.test.js`
- Modify: `src/search/searchService.js`

- [ ] **Step 1: 写每个 adapter 的 fixture 测试**

每个测试文件至少包含一个 `normalize*Item()` 测试，锁定：

- `source`
- `sourceLabel`
- `sourceId`
- `sourceUrl`
- `title`
- `type`
- `releaseYear`
- `tags` 或 `meta`

示例（AGE）：

```js
import { describe, it, expect } from 'vitest';
import { normalizeAgeItem } from './age.js';

describe('age adapter', () => {
  it('normalizes age search result', () => {
    const work = normalizeAgeItem({
      id: '123',
      title: '某动画',
      cover: 'https://img.example/age.jpg',
      url: 'https://www.agemys.org/detail/123',
      year: '2024',
      summary: '简介',
    });

    expect(work.source).toBe('age');
    expect(work.sourceLabel).toBe('AGE动漫');
    expect(work.type).toBe('动画');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- src/search/adapters/age.test.js`

Expected: FAIL，适配器导出缺失。

- [ ] **Step 3: 先实现最小可用的适配器骨架**

每个 adapter 文件都遵循相同模式：

```js
import { stripHtml, normalizeUrl, uniqueTags, getYear } from '../html.js';

export function normalizeAgeItem(item) {
  return {
    id: `age-${item.id}`,
    source: 'age',
    sourceLabel: 'AGE动漫',
    sourceId: String(item.id),
    sourceUrl: item.url || '',
    title: item.title || '未命名条目',
    originalTitle: item.originalTitle || '',
    cover: normalizeUrl(item.cover || ''),
    type: '动画',
    summary: stripHtml(item.summary || ''),
    releaseDate: item.releaseDate || '',
    releaseYear: item.year || getYear(item.releaseDate),
    tags: uniqueTags(item.tags || []),
    meta: [item.year || item.releaseDate || ''].filter(Boolean),
  };
}

export async function searchAge(keyword, { signal, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(`/api/sources/age/search?wd=${encodeURIComponent(keyword)}`, { signal });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
  const html = await response.text();
  return parseAgeHtml(html);
}
```

同样方式补齐 `gugu / girigiri / nyafun / douban`。

对豆瓣，允许先返回“影视/动画”这类宽类型，保证第一版可用，不强行做复杂语义分类。

- [ ] **Step 4: 给 searchService 注册六个 adapter**

在 `src/search/searchService.js` 中建立固定映射：

```js
import { searchBangumi } from './adapters/bangumi.js';
import { searchAge } from './adapters/age.js';
import { searchGugu } from './adapters/gugu.js';
import { searchGirigiri } from './adapters/girigiri.js';
import { searchDouban } from './adapters/douban.js';
import { searchNyafun } from './adapters/nyafun.js';
```

并实现：

```js
const SEARCHERS = {
  bangumi: searchBangumi,
  age: searchAge,
  gugu: searchGugu,
  girigiri: searchGirigiri,
  douban: searchDouban,
  nyafun: searchNyafun,
};
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm test`

Expected: 所有 adapter 测试通过，旧聚合测试已不再依赖被删除的 provider。

- [ ] **Step 6: 提交**

```bash
git add src/search/adapters src/search/searchService.js
git commit -m "feat: port anime trace style adapters"
```

---

## Task 5: 重写搜索面板为单来源模式

**Files:**
- Modify: `src/components/SearchPanel.jsx`
- Modify: `src/styles.css`
- Modify: `src/components/WorkCard.jsx`（仅核对展示，不大改）

- [ ] **Step 1: 写 UI 行为测试或组件冒烟测试**

如果现有测试体系不覆盖 React 组件，就至少补一个纯逻辑测试，锁定单来源状态选择的默认值与提交行为；如果已有组件测试环境，再为 `SearchPanel` 写一个最小渲染测试，确认默认显示一个来源选择器而不是多选 chip。

最小逻辑测试示例：

```js
import { describe, it, expect } from 'vitest';
import { DEFAULT_SOURCE_ID } from '../search/sources.js';

describe('search panel defaults', () => {
  it('defaults to bangumi', () => {
    expect(DEFAULT_SOURCE_ID).toBe('bangumi');
  });
});
```

- [ ] **Step 2: 运行测试确认失败或确认现状**

Run: `npm test`

Expected: 如果是组件测试，当前 UI 与单来源断言不符；如果是逻辑测试，则先确认现有实现尚未迁移。

- [ ] **Step 3: 将 SearchPanel 改为单来源搜索**

把 `SearchPanel.jsx` 中的：

- `sources` 多选数组
- `toggleSource`
- `searchAllSources`
- 多来源错误汇总
- 多 chip 并行开关

改成：

```js
const [sourceId, setSourceId] = useState(DEFAULT_SOURCE_ID);
const [keyword, setKeyword] = useState('');
const [results, setResults] = useState([]);
const [error, setError] = useState('');
```

提交时调用：

```js
const response = await searchSource(sourceId, query, { signal: controller.signal });
setResults(response.items);
setError(response.error || '');
```

UI 改成：

- 一个来源选择器
- 一个关键词输入框
- 一个搜索按钮
- 单来源说明文本
- 单来源错误区

保留 `WorkCard` 渲染方式不变。

- [ ] **Step 4: 调整样式**

在 `src/styles.css` 中将原多 chip source bar 改成单来源 selector 布局，确保：

- 小屏可换行
- 选中态明显
- 不破坏现有 card grid

- [ ] **Step 5: 运行前端测试与手工检查**

Run: `npm test && npm run build`

Expected: 通过；页面中只显示单来源选择器，不再显示多选 chip 列表。

- [ ] **Step 6: 提交**

```bash
git add src/components/SearchPanel.jsx src/styles.css src/components/WorkCard.jsx
git commit -m "feat: switch search panel to single-source mode"
```

---

## Task 6: 替换 Vite 与 Worker 代理白名单

**Files:**
- Modify: `vite.config.js`
- Modify: `worker/router.js`
- Modify: `worker/index.js`
- Modify: `worker/router.test.js`

- [ ] **Step 1: 写代理路由测试**

更新 `worker/router.test.js`，把旧 `/api/anilist`、`/api/vndb`、`/api/ymgal` 白名单测试删掉，替换为六个新前缀：

```js
import { describe, it, expect } from 'vitest';
import { matchRoute, rewritePath } from './router.js';

describe('matchRoute', () => {
  it('matches the six allowed source prefixes', () => {
    expect(matchRoute('/api/sources/bangumi/search')).not.toBeNull();
    expect(matchRoute('/api/sources/age/search')).not.toBeNull();
    expect(matchRoute('/api/sources/gugu/search')).not.toBeNull();
    expect(matchRoute('/api/sources/girigiri/search')).not.toBeNull();
    expect(matchRoute('/api/sources/douban/search')).not.toBeNull();
    expect(matchRoute('/api/sources/nyafun/search')).not.toBeNull();
  });

  it('rejects unknown prefixes', () => {
    expect(matchRoute('/api/evil/x')).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- worker/router.test.js`

Expected: FAIL，旧路由白名单不符。

- [ ] **Step 3: 改写 router 白名单**

把 `worker/router.js` 改成新路由表：

```js
export const ROUTES = {
  '/api/sources/bangumi': { target: 'https://api.bgm.tv', headers: { 'User-Agent': 'MyACGNJourney' } },
  '/api/sources/age': { target: 'https://www.agemys.org', headers: {} },
  '/api/sources/gugu': { target: 'https://www.gugufan.com', headers: {} },
  '/api/sources/girigiri': { target: 'https://www.girigirilove.com', headers: {} },
  '/api/sources/douban': { target: 'https://movie.douban.com', headers: {} },
  '/api/sources/nyafun': { target: 'https://www.nyafun.com', headers: {} },
};
```

保留：

- `matchRoute()` 最长前缀匹配
- `rewritePath()` 去前缀并折叠双斜杠
- `corsHeaders()`

`worker/index.js` 保持原有安全模式，只是改用新 ROUTES。

- [ ] **Step 4: 改写 Vite dev proxy**

在 `vite.config.js` 中，把旧 proxy 条目改成同构白名单：

```js
proxy: {
  '/api/sources/bangumi': { target: 'https://api.bgm.tv', ... },
  '/api/sources/age': { target: 'https://www.agemys.org', ... },
  '/api/sources/gugu': { target: 'https://www.gugufan.com', ... },
  '/api/sources/girigiri': { target: 'https://www.girigirilove.com', ... },
  '/api/sources/douban': { target: 'https://movie.douban.com', ... },
  '/api/sources/nyafun': { target: 'https://www.nyafun.com', ... },
}
```

- [ ] **Step 5: 运行测试与代理冒烟**

Run: `npm test && npm run build`

Expected: 代理测试通过，构建通过。

- [ ] **Step 6: 提交**

```bash
git add vite.config.js worker/router.js worker/index.js worker/router.test.js
git commit -m "feat: replace search proxies with source whitelist"
```

---

## Task 7: 清理旧搜索核心与同步文档

**Files:**
- Modify: `src/api/search.js`
- Modify: `src/api/search.test.js`
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/PROGRESS.md`

- [ ] **Step 1: 删除旧聚合测试依赖**

把 `src/api/search.test.js` 中对 `searchAllSources`、AniList、VNDB、月幕Galgame、萌娘百科聚合逻辑的测试全部删掉，保留新 search service / adapter 测试入口即可。

- [ ] **Step 2: 删除旧聚合导出**

确认 `src/api/search.js` 不再导出旧的：

- `DIRECT_BASES`
- `searchAllSources`
- `normalizeAniListItem`
- `normalizeVndbItem`
- `normalizeYmgalItem`
- `buildMoegirlParams`
- `isMoegirlWork`

如果需要兼容短期过渡，只允许它 re-export `src/search/searchService.js` 和 `src/search/sources.js`，不允许继续保留旧多源逻辑。

- [ ] **Step 3: 更新 README**

把 README 搜索段改成：

- 单来源检索
- 六个来源列表
- 结果可加入我的库
- 不再提 AniList / VNDB / 月幕Galgame / 萌娘百科 的聚合搜索入口

- [ ] **Step 4: 更新架构与进度文档**

同步 `docs/ARCHITECTURE.md` 与 `docs/PROGRESS.md`：

- 搜索模式改为单来源
- 列出六个新来源
- 说明参考《漫迹》
- 记录第一版边界：不做多源并行聚合，不做播放链接解析，不做账号同步

- [ ] **Step 5: 运行全量验证**

Run: `npm test && npm run build`

Expected: 通过。

- [ ] **Step 6: 提交**

```bash
git add src/api/search.js src/api/search.test.js README.md docs/ARCHITECTURE.md docs/PROGRESS.md
git commit -m "docs: align search docs with single-source mode"
```

---

## Task 8: 浏览器与回退验证

**Files:**
- No new files unless某个 adapter 需要补 fixture

- [ ] **Step 1: 本地启动应用**

Run: `npm run dev`

Expected: Vite 正常启动。

- [ ] **Step 2: 手工验证六个来源**

在浏览器中逐个测试：

- Bangumi
- AGE动漫
- 咕咕番
- girigiri愛
- 豆瓣
- NyaFun

关键词建议：`葬送的芙莉莲`、`白色相簿2`、`孤独摇滚`。

Expected:

- 单来源切换正常
- 结果返回后可加入我的库
- 来源失败时显示清晰错误
- 未知来源接口返回 404

- [ ] **Step 3: 确认回退点**

如果某个来源在当前网络环境不可用，记下：

- 是来源站结构问题
- 还是代理/CORS 问题
- 还是解析器问题

如果核心搜索链路整体不可用，直接丢弃 `feat/anime-trace-style-search` 分支即可，不把双系统长期留在主线里。

- [ ] **Step 4: 提交或整理后续修复**

若验证通过，最终补一个收尾提交；若失败，记录失败来源并继续在分支上修复。

```bash
git status
git add .
git commit -m "fix: finalize single-source search validation"
```

---

## Self-Review Checklist

- Spec 覆盖了单来源搜索、六个来源、代理白名单、UI 改造、错误处理、测试、文档同步。
- 没有使用 TBD / TODO / implement later 之类占位词。
- 所有任务都有明确文件、测试和提交步骤。
- 新旧搜索核心边界清晰：旧多源聚合逻辑必须退出主流程。
- 来源范围与用户确认一致：Bangumi、AGE动漫、咕咕番、girigiri愛、豆瓣、NyaFun。
