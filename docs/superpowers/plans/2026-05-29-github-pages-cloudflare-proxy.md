# GitHub Pages 部署 + Cloudflare Worker 代理 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 My ACGN Journey 部署到 GitHub Pages，用一个 Cloudflare Worker 代理 5 个搜索源的上游 API，使线上搜索可用。

**Architecture:** 前端通过 `VITE_API_BASE` 环境变量决定 API 地址（dev 空值走 Vite proxy、prod 指向 Worker）。单个 Cloudflare Worker 用路径前缀路由表转发到 5 个上游并回填 CORS。GitHub Actions 构建并部署 Pages。

**Tech Stack:** React 19, Vite 7, vitest, Cloudflare Workers (wrangler), GitHub Actions / Pages。

**前置依赖：** 本计划建立在 PR #1（AniList/VNDB 5 源）已合并进 main 的基础上。Task 0 处理合并与分支。

---

## 文件结构

| 文件 | 职责 | 改动 |
|------|------|------|
| `src/api/search.js` | 加 `API_BASE` 常量 + 5 处路径前缀 | Modify |
| `src/api/search.test.js` | 加 API_BASE dev 默认值测试 | Modify |
| `worker/router.js` | 纯函数：路由匹配、路径改写、CORS 头构造（可单测） | Create |
| `worker/router.test.js` | router 纯函数单测 | Create |
| `worker/index.js` | Worker fetch handler（用 router.js） | Create |
| `worker/wrangler.toml` | Worker 配置 + ALLOWED_ORIGIN var | Create |
| `vite.config.js` | base 子路径（仅 CI） | Modify |
| `.github/workflows/deploy.yml` | CI：test 门禁 → build → 部署 Pages | Create |
| `docs/DEPLOYMENT.md` | 人工部署步骤 | Create |
| `README.md` | 在线访问 + 部署段、v0.3 源 | Modify |

**架构关键点：** Worker 的可测逻辑全部放进 `worker/router.js`（纯函数，无网络），`worker/index.js` 只做 `fetch` 编排（取 router 结果 → 发上游 → 套 CORS）。这样 CI 的 vitest 能覆盖路由/改写/CORS，无需真实网络。

---

## Task 0: 合并 PR #1 并建立部署工作分支

**这是协调步骤，非代码。执行者必须在动手前与控制者/用户确认合并动作。**

- [ ] **Step 1: 确认 PR #1 可合并**

Run: `gh pr view 1 --json state,mergeable,statusCheckRollup`
Expected: state OPEN, mergeable MERGEABLE。若有冲突先停下报告。

- [ ] **Step 2: 合并 PR #1 进 main**

Run: `gh pr merge 1 --squash --delete-branch=false`
（用 squash 把 9 个提交压成一个干净的 feature 提交进 main。保留远程分支以防回溯。）
Expected: "Merged"。

- [ ] **Step 3: 在本地 main 同步并基于它建立部署分支**

```bash
cd "C:/Users/14507/Desktop/My-ACGN-Journey"
git checkout main && git pull origin main
git checkout -b feat/deploy-pages-worker
```
Expected: 新分支基于含 5 源的 main。

- [ ] **Step 4: 把已提交的部署 spec 带入新分支**

部署设计 spec 当前在旧 worktree 分支上。从那里 cherry-pick 或重新确认它在新分支可见：
```bash
git checkout feat/deploy-pages-worker -- docs/superpowers/specs/2026-05-29-github-pages-cloudflare-proxy-design.md 2>/dev/null || echo "spec 需从 worktree 分支 cherry-pick"
git log --oneline -1 -- docs/superpowers/specs/2026-05-29-github-pages-cloudflare-proxy-design.md
```
若 spec 不在新分支，从 worktree 分支 cherry-pick 那个提交（`git cherry-pick 3cfec97`）。确保 spec + 本计划都在 `feat/deploy-pages-worker` 上。

- [ ] **Step 5: 确认基线**

Run: `npm ci && npm test && npm run build`
Expected: 14 测试通过，build 成功（含 5 源）。

## Task 1: 前端 API_BASE 改造（TDD）

让前端通过 `VITE_API_BASE` 决定 API 地址：dev 空值（走 Vite proxy，行为不变），prod 注入 Worker URL。

**Files:**
- Modify: `src/api/search.js`
- Modify: `src/api/search.test.js`

- [ ] **Step 1: 写失败测试**

在 `src/api/search.test.js` 末尾追加。注意：测试运行时 `import.meta.env.VITE_API_BASE` 未设，故 `API_BASE` 应为 `''`，所有源路径以 `/api/` 开头不变。我们导出一个构造路径的纯函数 `buildApiUrl` 来验证。

```js
import { buildApiUrl } from './search.js';

describe('buildApiUrl', () => {
  it('keeps bare /api path when API_BASE is empty (dev)', () => {
    expect(buildApiUrl('/api/bangumi/v0/search')).toBe('/api/bangumi/v0/search');
  });

  it('prefixes API_BASE when set (prod simulated)', () => {
    expect(buildApiUrl('/api/vndb/vn', 'https://w.example.dev')).toBe('https://w.example.dev/api/vndb/vn');
  });

  it('strips a trailing slash on the base to avoid double slashes', () => {
    expect(buildApiUrl('/api/anilist', 'https://w.example.dev/')).toBe('https://w.example.dev/api/anilist');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL，`buildApiUrl is not a function`。其余 14 测试仍绿。

- [ ] **Step 3: 实现 buildApiUrl + API_BASE，改 5 处调用**

在 `src/api/search.js` 顶部（`SOURCE_LABELS` 之前）加：

```js
const API_BASE = import.meta.env.VITE_API_BASE || '';

export function buildApiUrl(path, base = API_BASE) {
  return base ? `${base.replace(/\/$/, '')}${path}` : path;
}
```

把 5 处 fetch 调用的路径包进 `buildApiUrl(...)`：
- `fetchJson('/api/bangumi/v0/search/subjects?limit=12&offset=0', ...)` → `fetchJson(buildApiUrl('/api/bangumi/v0/search/subjects?limit=12&offset=0'), ...)`
- `fetchJson(\`/api/bilibili/x/web-interface/search/type?${params}\`, ...)` → `fetchJson(buildApiUrl(\`/api/bilibili/x/web-interface/search/type?${params}\`), ...)`
- `fetchJson(\`/api/moegirl/api.php?${params}\`, ...)` → `fetchJson(buildApiUrl(\`/api/moegirl/api.php?${params}\`), ...)`
- `fetchJson('/api/anilist', ...)` → `fetchJson(buildApiUrl('/api/anilist'), ...)`
- `fetchJson('/api/vndb/vn', ...)` → `fetchJson(buildApiUrl('/api/vndb/vn'), ...)`

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`
Expected: PASS，全部 17 测试绿（14 + 3 新）。

- [ ] **Step 5: 确认 dev 构建行为不变**

Run: `npm run build`
Expected: build 成功。（dev 下 `VITE_API_BASE` 未设，路径仍是 `/api/...`，Vite proxy 照常工作。）

- [ ] **Step 6: Commit**

```bash
git add src/api/search.js src/api/search.test.js
git commit -m "feat: route API calls through VITE_API_BASE for production proxy"
```

---

## Task 2: Worker 路由纯函数（TDD）

把 Worker 的可测逻辑（路由匹配、路径改写、CORS 头）放进 `worker/router.js` 纯函数，先 TDD。

**Files:**
- Create: `worker/router.js`
- Create: `worker/router.test.js`

- [ ] **Step 1: 写失败测试**

创建 `worker/router.test.js`：

```js
import { describe, it, expect } from 'vitest';
import { matchRoute, rewritePath, corsHeaders } from './router.js';

describe('matchRoute', () => {
  it('matches a known prefix to its target + headers', () => {
    const r = matchRoute('/api/bilibili/x/web-interface/search/type');
    expect(r.target).toBe('https://api.bilibili.com');
    expect(r.headers.Referer).toBe('https://www.bilibili.com/');
  });

  it('matches vndb prefix', () => {
    expect(matchRoute('/api/vndb/vn').target).toBe('https://api.vndb.org/kana');
  });

  it('returns null for unknown prefix (whitelist closed)', () => {
    expect(matchRoute('/api/evil/passthrough')).toBeNull();
    expect(matchRoute('/')).toBeNull();
  });
});

describe('rewritePath', () => {
  it('strips the prefix and keeps the remainder', () => {
    expect(rewritePath('/api/bangumi', '/api/bangumi/v0/search/subjects')).toBe('/v0/search/subjects');
  });

  it('falls back to / when the stripped path is empty (anilist fix)', () => {
    expect(rewritePath('/api/anilist', '/api/anilist')).toBe('/');
  });

  it('keeps vndb subpath', () => {
    expect(rewritePath('/api/vndb', '/api/vndb/vn')).toBe('/vn');
  });
});

describe('corsHeaders', () => {
  it('uses the configured allowed origin', () => {
    const h = corsHeaders('https://chibarie.github.io');
    expect(h['Access-Control-Allow-Origin']).toBe('https://chibarie.github.io');
    expect(h['Access-Control-Allow-Methods']).toContain('POST');
    expect(h['Access-Control-Allow-Headers']).toContain('Content-Type');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run worker/router.test.js`
Expected: FAIL，模块或导出未定义。

- [ ] **Step 3: 实现 router.js**

创建 `worker/router.js`：

```js
export const ROUTES = {
  '/api/bangumi': {
    target: 'https://api.bgm.tv',
    headers: { 'User-Agent': 'MyACGNJourney/0.3 (https://github.com/ChibaRie/My_ACGN_Journey)' },
  },
  '/api/bilibili': {
    target: 'https://api.bilibili.com',
    headers: { Referer: 'https://www.bilibili.com/', Origin: 'https://www.bilibili.com' },
  },
  '/api/moegirl': { target: 'https://zh.moegirl.org.cn', headers: {} },
  '/api/anilist': { target: 'https://graphql.anilist.co', headers: {} },
  '/api/vndb': { target: 'https://api.vndb.org/kana', headers: {} },
};

export function matchRoute(pathname) {
  const prefix = Object.keys(ROUTES)
    .filter((p) => pathname === p || pathname.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? { prefix, ...ROUTES[prefix] } : null;
}

export function rewritePath(prefix, pathname) {
  return pathname.slice(prefix.length) || '/';
}

export function corsHeaders(allowedOrigin) {
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run worker/router.test.js`
Expected: PASS，全部 router 用例绿。

- [ ] **Step 5: 确认全量测试无回归**

Run: `npm test`
Expected: PASS（前端 17 + worker router 用例全绿；vitest 默认会收集 worker/*.test.js）。

- [ ] **Step 6: Commit**

```bash
git add worker/router.js worker/router.test.js
git commit -m "feat: add Cloudflare Worker routing pure functions"
```

## Task 3: Worker fetch handler + wrangler 配置

用 router.js 编排实际转发。这部分做真实网络 I/O，不单测（端到端由用户部署后验证）；逻辑保持极薄。

**Files:**
- Create: `worker/index.js`
- Create: `worker/wrangler.toml`

- [ ] **Step 1: 实现 worker/index.js**

```js
import { matchRoute, rewritePath, corsHeaders } from './router.js';

export default {
  async fetch(request, env) {
    const allowed = env.ALLOWED_ORIGIN || 'https://chibarie.github.io';
    const cors = corsHeaders(allowed);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const route = matchRoute(url.pathname);
    if (!route) {
      return new Response('Not found', { status: 404, headers: cors });
    }

    const upstreamPath = rewritePath(route.prefix, url.pathname);
    const upstreamUrl = `${route.target}${upstreamPath}${url.search}`;

    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.set(
      'User-Agent',
      'Mozilla/5.0 (compatible; MyACGNJourney/0.3; +https://github.com/ChibaRie/My_ACGN_Journey)',
    );
    for (const [k, v] of Object.entries(route.headers)) headers.set(k, v);

    const init = {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    };

    const upstream = await fetch(upstreamUrl, init);
    const respHeaders = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(cors)) respHeaders.set(k, v);
    return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
  },
};
```

- [ ] **Step 2: 创建 wrangler.toml**

`worker/wrangler.toml`:

```toml
name = "acgn-proxy"
main = "index.js"
compatibility_date = "2025-05-01"

[vars]
ALLOWED_ORIGIN = "https://chibarie.github.io"
```

- [ ] **Step 3: 静态校验**

Run: `node --check worker/index.js`
Expected: 无语法错误。
（不在 CI 跑 wrangler；Worker 部署是用户手动步骤。本步只确保文件语法正确。）

- [ ] **Step 4: 确认全量测试仍绿**

Run: `npm test`
Expected: PASS（index.js 无测试，但不应破坏既有用例）。

- [ ] **Step 5: Commit**

```bash
git add worker/index.js worker/wrangler.toml
git commit -m "feat: add Cloudflare Worker fetch handler and config"
```

---

## Task 4: Vite base 路径 + GitHub Actions 部署

**Files:**
- Modify: `vite.config.js`
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: 加 base 子路径（仅 CI）**

在 `vite.config.js` 的 `defineConfig({...})` 对象里，`plugins` 之前加一行：

```js
  base: process.env.GITHUB_ACTIONS ? '/My_ACGN_Journey/' : '/',
```

（dev/本地 build 用 `/`；只有在 GitHub Actions 环境用仓库名子路径。）

- [ ] **Step 2: 本地确认 base 默认值不变**

Run: `npm run build`
Expected: build 成功，产物引用 `/assets/...`（根路径，因本地无 GITHUB_ACTIONS 环境变量）。

- [ ] **Step 3: 创建 deploy workflow**

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          VITE_API_BASE: ${{ vars.VITE_API_BASE }}
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 4: 校验 workflow YAML**

Run: `node -e "const y=require('fs').readFileSync('.github/workflows/deploy.yml','utf8'); if(!y.includes('upload-pages-artifact')||!y.includes('npm test')) throw new Error('workflow missing required steps'); console.log('ok')"`
Expected: `ok`（确认 test 门禁与 artifact 上传都在）。

- [ ] **Step 5: Commit**

```bash
git add vite.config.js .github/workflows/deploy.yml
git commit -m "ci: build with API base and deploy to GitHub Pages"
```

---

## Task 5: 部署文档 + README 更新

**Files:**
- Create: `docs/DEPLOYMENT.md`
- Modify: `README.md`

- [ ] **Step 1: 写 docs/DEPLOYMENT.md**

```markdown
# 部署指南

本项目部署为 GitHub Pages 静态站 + Cloudflare Worker 搜索代理。前端自动通过 GitHub Actions 部署；Worker 需手动部署一次。

## 一、部署 Cloudflare Worker（搜索代理）

线上搜索（Bangumi / Bilibili / 萌娘百科 / AniList / VNDB）依赖该 Worker 转发，规避浏览器 CORS。

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
2. 仓库 Settings → Secrets and variables → Actions → **Variables** 标签 → New repository variable：
   - Name: `VITE_API_BASE`
   - Value: 第一步记下的 Worker URL（不带末尾斜杠）
3. push 到 `main`（或在 Actions 页手动 Run workflow）触发部署。
4. 部署完成后访问 `https://chibarie.github.io/My_ACGN_Journey/`。

## 本地开发

本地 `npm run dev` 不需要 Worker：dev 下 `VITE_API_BASE` 为空，搜索请求走 Vite dev-server proxy（见 `vite.config.js`）。
```

- [ ] **Step 2: 更新 README.md**

在 README "## 运行" 段之前插入"## 在线访问"段：

```markdown
## 在线访问

线上地址：https://chibarie.github.io/My_ACGN_Journey/

本地库数据保存在浏览器，多源搜索通过 Cloudflare Worker 代理访问 Bangumi、Bilibili、萌娘百科、AniList、VNDB。部署方式见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。
```

并在"## 已实现功能"的多源搜索那一条，把来源更新为包含 AniList 与 VNDB（如果 PR #1 合并时未更新的话）：找到"多源作品搜索：Bangumi、Bilibili 番剧搜索、萌娘百科 MediaWiki 查询。"，确认其后已包含 AniList（动画/漫画）与 VNDB；若没有则补上。

- [ ] **Step 3: 确认 README 链接有效**

Run: `test -f docs/DEPLOYMENT.md && grep -q "在线访问" README.md && echo ok`
Expected: `ok`。

- [ ] **Step 4: Commit**

```bash
git add docs/DEPLOYMENT.md README.md
git commit -m "docs: add deployment guide and online access to README"
```

---

## Task 6: 收尾验证

- [ ] **Step 1: 全量测试 + 构建**

Run: `npm test && npm run build`
Expected: 全部测试绿，build 成功。

- [ ] **Step 2: 模拟 CI 构建（注入 base + API base）**

Run: `GITHUB_ACTIONS=1 VITE_API_BASE=https://acgn-proxy.example.workers.dev npm run build && grep -q "/My_ACGN_Journey/assets" dist/index.html && echo "base ok"`
Expected: `base ok`（确认 CI 环境下产物用子路径，且注入的 API base 进入 bundle）。

- [ ] **Step 3: 确认注入的 API base 进入产物**

Run: `grep -rq "acgn-proxy.example.workers.dev" dist/ && echo "api base injected"`
Expected: `api base injected`。

- [ ] **Step 4: 清理模拟构建产物**

Run: `npm run build`
Expected: 重新以本地（非 CI）配置构建，恢复正常 dist。

---

## 自审记录

- **Spec 覆盖：** 前端 API_BASE（Task 1）、Worker 路由表/CORS/白名单（Task 2-3）、CORS 收紧 ALLOWED_ORIGIN（Task 2-3）、vite base 子路径（Task 4）、CI test 门禁 + VITE_API_BASE Variable（Task 4）、DEPLOYMENT.md（Task 5）、README 更新（Task 5）、先合并 PR #1（Task 0）、Worker 手动部署边界（DEPLOYMENT.md）。全覆盖。
- **占位符扫描：** 无 TBD/TODO，代码步骤均含完整代码。
- **类型一致性：** `buildApiUrl(path, base)`、`matchRoute`/`rewritePath`/`corsHeaders` 签名在定义（Task 1/2）与使用（Task 3 index.js）处一致；`ROUTES` 前缀与前端 `/api/*` 路径一致。
- **YAGNI：** 不做 404.html、自定义域名、CI 自动部署 Worker。
- **一处注意：** Task 6 Step 2 假设 vitest 不会把 `worker/*.test.js` 当成前端测试时报错——worker router 是纯 ESM，无 DOM 依赖，可被同一 vitest 进程收集；若 CI 需隔离再分 config（当前不需要，YAGNI）。


