# 大陆可达性优化 + ymgal 接入 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让支持 CORS 的源（Bangumi、萌娘）绕过代理直连，使大陆裸连可搜；并接入月幕 Galgame（ymgal）作为需代理增强源（Worker 端注入 OAuth token）。

**Architecture:** `search.js` 给直连源走官方域名（不经 `API_BASE`），需代理源保持 `/api/*` 路径。萌娘加 `origin=*` 启用 CORS。ymgal 走 `/api/ymgal`，Worker 端用公开凭证换 token（内存缓存约 55 分钟）并注入。沿用 `PROVIDERS` + `Promise.allSettled` 调度与 vitest 测试模式。

**Tech Stack:** React 19, Vite 7, vitest, Cloudflare Workers, ymgal OAuth2 (client_credentials)。

**前置：** 建立在当前 main（PR #1/#2 已合并：5 源 + Worker + CI 齐全）。Task 0 建分支。

---

## 文件结构

| 文件 | 职责 | 改动 |
|------|------|------|
| `src/api/search.js` | 源分流（DIRECT_BASES）+ 萌娘 origin=* + ymgal 归一化/查询/注册 | Modify |
| `src/api/search.test.js` | 分流 + ymgal 归一化单测 | Modify |
| `src/components/SearchPanel.jsx` | DEFAULT_SOURCES 加 ymgal + 直连源"· 直连"标记 | Modify |
| `worker/router.js` | 路由表加 ymgal + needsYmgalAuth + shouldRefreshToken 纯函数 | Modify |
| `worker/router.test.js` | ymgal 路由 + shouldRefreshToken 单测 | Modify |
| `worker/index.js` | ymgal 请求注入 OAuth token（内存缓存） | Modify |
| `vite.config.js` | 加 /api/ymgal dev 代理 | Modify |
| `README.md` / `docs/DEPLOYMENT.md` | 源说明、月幕来源、dev 限制 | Modify |

---

## Task 0: 建立工作分支

- [ ] **Step 1: 从最新 main 建分支**

```bash
cd "C:/Users/14507/Desktop/acgn_journey"
git checkout main && git pull origin main
git checkout -b feat/china-accessibility-ymgal
```
Expected: 新分支基于含 5 源 + Worker 的 main。

- [ ] **Step 2: 确认基线**

Run: `npm ci && npm test`
Expected: 26 测试通过（17 前端 + 9 worker）。

## Task 1: 源分流 — 直连源绕过代理（TDD）

让 Bangumi、萌娘走官方域名直连（不经 `API_BASE`），需代理源保持现状。新增 `directApiUrl` 纯函数。

**Files:**
- Modify: `src/api/search.js`
- Modify: `src/api/search.test.js`

- [ ] **Step 1: 写失败测试**

在 `src/api/search.test.js` 末尾追加：

```js
import { directApiUrl, DIRECT_BASES } from './search.js';

describe('directApiUrl', () => {
  it('routes a direct-connect source to its official domain', () => {
    expect(directApiUrl('bangumi', '/v0/search/subjects')).toBe('https://api.bgm.tv/v0/search/subjects');
  });

  it('routes moegirl to its official domain', () => {
    expect(directApiUrl('moegirl', '/api.php?x=1')).toBe('https://zh.moegirl.org.cn/api.php?x=1');
  });

  it('exposes only bangumi and moegirl as direct sources', () => {
    expect(Object.keys(DIRECT_BASES).sort()).toEqual(['bangumi', 'moegirl']);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL，`directApiUrl is not a function`。其余 26 仍绿。

- [ ] **Step 3: 实现 DIRECT_BASES + directApiUrl**

在 `src/api/search.js` 顶部、`buildApiUrl` 之后加入：

```js
export const DIRECT_BASES = {
  bangumi: 'https://api.bgm.tv',
  moegirl: 'https://zh.moegirl.org.cn',
};

export function directApiUrl(source, path) {
  return `${DIRECT_BASES[source]}${path}`;
}
```

- [ ] **Step 4: 改 Bangumi 与 萌娘 的请求用 directApiUrl**

找到 `searchBangumi` 里的：
```js
  const json = await fetchJson(buildApiUrl('/api/bangumi/v0/search/subjects?limit=12&offset=0'), {
```
改为：
```js
  const json = await fetchJson(directApiUrl('bangumi', '/v0/search/subjects?limit=12&offset=0'), {
```

找到 `searchMoegirl` 里的：
```js
  const json = await fetchJson(buildApiUrl(`/api/moegirl/api.php?${params}`), { signal });
```
改为：
```js
  const json = await fetchJson(directApiUrl('moegirl', `/api.php?${params}`), { signal });
```

（Bilibili/AniList/VNDB 的 `buildApiUrl(...)` 调用保持不变——它们仍走代理。）

- [ ] **Step 5: 运行测试确认通过**

Run: `npm test`
Expected: PASS，29 测试（26 + 3 新）。

- [ ] **Step 6: Commit**

```bash
git add src/api/search.js src/api/search.test.js
git commit -m "feat: route CORS-capable sources (bangumi, moegirl) direct, bypassing proxy"
```

---

## Task 2: 萌娘 origin=* 启用 CORS（TDD）

萌娘 MediaWiki 需请求带 `origin=*` 参数才返回 CORS 头。直连后必须补上。

**Files:**
- Modify: `src/api/search.js`
- Modify: `src/api/search.test.js`

- [ ] **Step 1: 写失败测试**

`searchMoegirl` 用 `URLSearchParams` 构造 query。为可测，抽出参数构造为纯函数 `buildMoegirlParams(keyword)`。先加测试：

```js
import { buildMoegirlParams } from './search.js';

describe('buildMoegirlParams', () => {
  it('includes origin=* to enable MediaWiki CORS', () => {
    const params = buildMoegirlParams('芙莉莲');
    expect(params.get('origin')).toBe('*');
    expect(params.get('gsrsearch')).toBe('芙莉莲');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL，`buildMoegirlParams is not a function`。

- [ ] **Step 3: 抽出并实现 buildMoegirlParams**

在 `src/api/search.js` 中，把 `searchMoegirl` 内现有的 `new URLSearchParams({...})` 整块抽成一个导出的纯函数（放在 `searchMoegirl` 之前），并加入 `origin: '*'`：

```js
export function buildMoegirlParams(keyword) {
  return new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrnamespace: '0',
    gsrlimit: '12',
    gsrsearch: keyword,
    prop: 'extracts|pageimages|info|categories',
    exintro: '1',
    explaintext: '1',
    exchars: '160',
    piprop: 'thumbnail',
    pithumbsize: '360',
    cllimit: '20',
    inprop: 'url',
    utf8: '1',
    origin: '*',
  });
}
```

然后把 `searchMoegirl` 里原来的 `const params = new URLSearchParams({...});` 替换为 `const params = buildMoegirlParams(keyword);`。

注意：以现有 `searchMoegirl` 实际的参数键为准照搬，只新增 `origin: '*'`。若现有键与上面有出入，保留现有键、只追加 `origin`。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`
Expected: PASS，30 测试。

- [ ] **Step 5: Commit**

```bash
git add src/api/search.js src/api/search.test.js
git commit -m "feat: add origin=* to moegirl query for direct CORS access"
```

## Task 3: ymgal 归一化 + 查询 + 注册（TDD）

新增第 7 源 ymgal（需代理源，走 `/api/ymgal`）。

**Files:**
- Modify: `src/api/search.js`
- Modify: `src/api/search.test.js`

- [ ] **Step 1: 写失败测试**

在 `src/api/search.test.js` 末尾追加：

```js
import { normalizeYmgalItem } from './search.js';

const ymgalItem = {
  id: 10886,
  name: 'White Album',
  chineseName: '白色相簿',
  mainImg: 'https://cdn.ymgal.games/archive/main/75/abc.webp',
  releaseDate: '1998-05-01',
  orgName: 'Leaf',
  haveChinese: true,
};

describe('normalizeYmgalItem', () => {
  it('prefers chineseName and builds id/url/type', () => {
    const w = normalizeYmgalItem(ymgalItem);
    expect(w.id).toBe('ymgal-10886');
    expect(w.source).toBe('ymgal');
    expect(w.sourceId).toBe('10886');
    expect(w.sourceUrl).toBe('https://www.ymgal.games/ga10886');
    expect(w.title).toBe('白色相簿');
    expect(w.originalTitle).toBe('White Album');
    expect(w.type).toBe('Galgame/游戏');
    expect(w.cover).toBe('https://cdn.ymgal.games/archive/main/75/abc.webp');
    expect(w.releaseYear).toBe('1998');
  });

  it('falls back to name when no chineseName', () => {
    const w = normalizeYmgalItem({ ...ymgalItem, id: 1, chineseName: '' });
    expect(w.title).toBe('White Album');
    expect(w.originalTitle).toBe('');
  });

  it('builds tags from org and chinese flag', () => {
    const w = normalizeYmgalItem(ymgalItem);
    expect(w.tags).toEqual(['Leaf', '有中文']);
  });
};
```

注意：上面最后一个 `};` 应为 `});` —— 实现时请写成正确的 `});` 闭合 describe。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL，`normalizeYmgalItem is not a function`。

- [ ] **Step 3: 实现 normalizeYmgalItem**

在 `src/api/search.js` 中（放在 `normalizeVndbItem` 之后），用 `export function`：

```js
export function normalizeYmgalItem(item) {
  const title = item.chineseName || item.name || '未命名游戏';
  const year = getYear(item.releaseDate);
  return {
    id: `ymgal-${item.id}`,
    source: 'ymgal',
    sourceLabel: SOURCE_LABELS.ymgal,
    sourceId: String(item.id),
    sourceUrl: `https://www.ymgal.games/ga${item.id}`,
    title,
    originalTitle: item.name && item.name !== title ? item.name : '',
    cover: normalizeUrl(item.mainImg || ''),
    type: 'Galgame/游戏',
    summary: '',
    releaseDate: item.releaseDate || '',
    releaseYear: year,
    tags: uniqueTags([item.orgName, item.haveChinese ? '有中文' : '']),
    meta: [item.releaseDate, item.orgName].filter(Boolean),
  };
}
```

- [ ] **Step 4: 加 searchYmgal + SOURCE_LABELS + PROVIDERS**

(a) `SOURCE_LABELS` 加一行：`ymgal: '月幕Galgame',`

(b) 在 `searchVndb` 之后加查询函数：

```js
async function searchYmgal(keyword, signal) {
  const params = new URLSearchParams({
    mode: 'list',
    keyword,
    pageNum: '1',
    pageSize: '12',
  });
  const json = await fetchJson(buildApiUrl(`/api/ymgal/open/archive/search-game?${params}`), {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (json.code !== 0) {
    throw new Error(json.msg || `ymgal 返回 code ${json.code}`);
  }
  return (json.data?.result || []).map(normalizeYmgalItem);
}
```

(c) `PROVIDERS` 加一行：`ymgal: searchYmgal,`

- [ ] **Step 5: 加 sourceLabel 断言锁定**

在 normalizeYmgalItem 第一个测试里追加一行（确认 SOURCE_LABELS 已接好）：
```js
    expect(w.sourceLabel).toBe('月幕Galgame');
```

- [ ] **Step 6: 运行测试确认通过**

Run: `npm test`
Expected: PASS，33 测试。

- [ ] **Step 7: Commit**

```bash
git add src/api/search.js src/api/search.test.js
git commit -m "feat: add ymgal (月幕Galgame) search source"
```

---

## Task 4: Worker 端 ymgal 路由 + OAuth token 注入（TDD 纯函数 + 编排）

**Files:**
- Modify: `worker/router.js`
- Modify: `worker/router.test.js`
- Modify: `worker/index.js`

- [ ] **Step 1: 写失败测试（router）**

在 `worker/router.test.js` 末尾追加：

```js
import { shouldRefreshToken } from './router.js';

describe('matchRoute ymgal', () => {
  it('matches /api/ymgal to ymgal target with auth flag', () => {
    const r = matchRoute('/api/ymgal/open/archive/search-game');
    expect(r.target).toBe('https://www.ymgal.games');
    expect(r.needsYmgalAuth).toBe(true);
  });
});

describe('shouldRefreshToken', () => {
  it('refreshes when no cache', () => {
    expect(shouldRefreshToken(null, 1000)).toBe(true);
  });
  it('refreshes when expired', () => {
    expect(shouldRefreshToken({ token: 'x', expiresAt: 500 }, 1000)).toBe(true);
  });
  it('reuses a valid cached token', () => {
    expect(shouldRefreshToken({ token: 'x', expiresAt: 5000 }, 1000)).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run worker/router.test.js`
Expected: FAIL（needsYmgalAuth 未定义 / shouldRefreshToken 未导出）。

- [ ] **Step 3: 实现 router 改动**

在 `worker/router.js` 的 `ROUTES` 对象加一条（注意 needsYmgalAuth 标记，其它源没有此字段）：

```js
  '/api/ymgal': { target: 'https://www.ymgal.games', headers: {}, needsYmgalAuth: true },
```

并新增导出纯函数：

```js
export function shouldRefreshToken(cache, now) {
  return !cache || !cache.token || now >= cache.expiresAt;
}
```

`matchRoute` 现有实现用 `{ prefix, ...ROUTES[prefix] }`，会自动带上 `needsYmgalAuth`，无需改。

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run worker/router.test.js`
Expected: PASS。

- [ ] **Step 5: 在 worker/index.js 加 token 注入**

在 `worker/index.js` 顶部 import 行追加 `shouldRefreshToken`：
```js
import { matchRoute, rewritePath, corsHeaders, shouldRefreshToken } from './router.js';
```

在文件顶部（export default 之前）加模块级缓存 + 取 token 函数：

```js
let ymgalTokenCache = null;

async function getYmgalToken(now = Date.now()) {
  if (!shouldRefreshToken(ymgalTokenCache, now)) return ymgalTokenCache.token;
  const url =
    'https://www.ymgal.games/oauth/token?grant_type=client_credentials&client_id=ymgal&client_secret=luna0327&scope=public';
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  const data = await resp.json();
  ymgalTokenCache = { token: data.access_token, expiresAt: now + 55 * 60 * 1000 };
  return ymgalTokenCache.token;
}
```

在 `fetch` handler 内，构造 `headers` 之后、发起 upstream 之前，加 ymgal 分支：

```js
    if (route.needsYmgalAuth) {
      const token = await getYmgalToken();
      headers.set('Authorization', `Bearer ${token}`);
      headers.set('version', '1');
      headers.set('Accept', 'application/json;charset=utf-8');
    }
```

- [ ] **Step 6: 静态检查 + 全量测试**

Run: `node --check worker/index.js && npm test`
Expected: 无语法错误；33 前端 + worker 测试全绿（worker router 现 12 个用例）。

- [ ] **Step 7: Commit**

```bash
git add worker/router.js worker/router.test.js worker/index.js
git commit -m "feat: proxy ymgal with cached OAuth token injection in Worker"
```

## Task 5: SearchPanel 加 ymgal + 直连源标记 + dev 代理

**Files:**
- Modify: `src/components/SearchPanel.jsx`
- Modify: `vite.config.js`

- [ ] **Step 1: DEFAULT_SOURCES 加 ymgal**

`src/components/SearchPanel.jsx` 第 7 行改为：
```js
const DEFAULT_SOURCES = ['bangumi', 'bilibili', 'moegirl', 'anilist_anime', 'anilist_manga', 'vndb', 'ymgal'];
```

- [ ] **Step 2: 直连源 chip 加"· 直连"标记**

在 SearchPanel 文件顶部（组件外）加一个常量：
```js
const DIRECT_SOURCES = new Set(['bangumi', 'moegirl']);
```

把 chip 渲染的 `{SOURCE_LABELS[source]}` 改为：
```js
            {SOURCE_LABELS[source]}
            {DIRECT_SOURCES.has(source) && <span className="source-direct"> · 直连</span>}
```

- [ ] **Step 3: 加 source-direct 样式**

在 `src/styles.css` 的 `.source-chip` 规则附近（找到 `.source-chip {` 那条之后）追加：
```css
.source-direct {
  opacity: 0.6;
  font-size: 0.85em;
}
```

- [ ] **Step 4: vite.config.js 加 /api/ymgal 代理**

在 `server.proxy` 对象中 `/api/vndb` 条目之后加入：
```js
      '/api/ymgal': {
        target: 'https://www.ymgal.games',
        changeOrigin: true,
        secure: true,
        headers: browserLikeHeaders,
        rewrite: (path) => path.replace(/^\/api\/ymgal/, ''),
      },
```

- [ ] **Step 5: 构建 + 测试确认无回归**

Run: `npm test && npm run build`
Expected: 测试全绿，build 成功（7 个 chip 渲染）。

- [ ] **Step 6: Commit**

```bash
git add src/components/SearchPanel.jsx vite.config.js src/styles.css
git commit -m "feat: enable ymgal source and mark direct-connect sources in search panel"
```

---

## Task 6: 文档更新

**Files:**
- Modify: `README.md`
- Modify: `docs/DEPLOYMENT.md`

- [ ] **Step 1: README 源列表 + 月幕来源 + 直连说明**

在 `README.md` 的「已实现功能」中，多源搜索那一条改为包含 ymgal，并在「跨域方案」段补充直连/代理区分。具体：

找到多源搜索功能项，确保提到 7 个源（含「月幕Galgame（Galgame）」）。

在「跨域方案」段落开头追加一段说明：
```markdown
搜索源分两类：**直连源**（Bangumi、萌娘百科，支持 CORS，浏览器直接访问官方 API，大陆网络无需代理即可用）与**需代理源**（Bilibili、AniList、VNDB、月幕Galgame，需经代理转发）。即使代理不可用，直连源仍可正常搜索。
```

在 README 末尾「License」之前加一段来源声明：
```markdown
## 数据来源

- 作品数据来自 Bangumi、Bilibili、萌娘百科、AniList、VNDB 与 [月幕Galgame](https://www.ymgal.games)。
- 月幕Galgame 数据通过其公开 API 获取，仅用于非商业的个人记录用途。
```

- [ ] **Step 2: README v0.3 更新记录补本次改动**

在「更新记录」的 v0.3 条目下追加：
```markdown
- **大陆可达性优化**：Bangumi、萌娘百科改为浏览器直连官方 API（支持 CORS），大陆网络无需代理即可搜索；新增月幕Galgame（ymgal）作为需代理的 Galgame 源（Worker 端注入 OAuth token）。
```

- [ ] **Step 3: DEPLOYMENT.md 补 ymgal OAuth + dev 限制**

在 `docs/DEPLOYMENT.md` 的 Worker 部分追加：
```markdown
## 月幕Galgame（ymgal）说明

- ymgal 接口需 OAuth2 认证。Worker 用公开凭证（`client_id=ymgal`）自动换取 access_token 并内存缓存约 55 分钟，前端无需配置。
- 本地开发限制：`npm run dev` 下不经过 Worker，ymgal 缺少 token 注入，可能搜不出结果。其余 6 源在 dev 下正常。ymgal 的完整功能需在 Worker 部署后验证。
```

- [ ] **Step 4: 确认链接 + Commit**

Run: `grep -q "月幕" README.md && grep -q "ymgal" docs/DEPLOYMENT.md && echo ok`
Expected: `ok`
```bash
git add README.md docs/DEPLOYMENT.md
git commit -m "docs: document direct/proxy sources and ymgal integration"
```

---

## Task 7: 收尾验证

- [ ] **Step 1: 全量测试 + 构建**

Run: `npm test && npm run build`
Expected: 全绿，build 成功。

- [ ] **Step 2: 确认直连源构建产物指向官方域名**

Run: `npm run build && grep -rq "api.bgm.tv" dist/ && grep -rq "zh.moegirl.org.cn" dist/ && echo "direct bases in bundle"`
Expected: `direct bases in bundle`（直连源官方域名已编译进前端 bundle，不依赖代理）。

- [ ] **Step 3: 模拟 CI 构建（注入代理 base，确认需代理源仍用 base）**

Run: `GITHUB_ACTIONS=1 VITE_API_BASE=https://acgn-proxy.example.workers.dev npm run build && grep -rq "acgn-proxy.example.workers.dev/api/ymgal\|acgn-proxy.example.workers.dev" dist/ && echo "proxy base injected for proxied sources"`
Expected: `proxy base injected ...`（ymgal 等需代理源用注入的 base）。

- [ ] **Step 4: 恢复本地构建**

Run: `npm run build`
Expected: 正常本地构建。

---

## 自审记录

- **Spec 覆盖：** 源分流 DIRECT_BASES（Task 1）、萌娘 origin=*（Task 2）、ymgal 归一化/查询/注册（Task 3）、Worker ymgal 路由 + OAuth 缓存（Task 4）、SOURCE_LABELS/DEFAULT_SOURCES 7 源 + 直连标记 + dev 代理（Task 3/5）、shouldRefreshToken 纯函数（Task 4）、文档 + 月幕来源 + dev 限制（Task 6）。全覆盖。
- **占位符扫描：** 无 TBD；代码步骤含完整代码。Task 3 Step 1 末尾 `};` 笔误已在该步显式标注须写为 `});`。
- **类型一致性：** `directApiUrl(source, path)`、`buildMoegirlParams(keyword)`、`normalizeYmgalItem(item)`、`shouldRefreshToken(cache, now)` 签名在定义与使用处一致；`needsYmgalAuth` 标记在 router 定义、index.js 消费一致；ymgal 的 `PROVIDERS` 键、`SOURCE_LABELS` 键、`DEFAULT_SOURCES` 项均为 `ymgal`，三处一致。
- **YAGNI：** 不做精确搜索模式、不做 token 持久化、不动背景功能。
- **一处依赖提示：** Task 4 的 worker token 缓存为模块级变量，Cloudflare 多 isolate 下最坏每 isolate 各换一次 token，仍远低于频率限制（spec §5.2 已述）。



