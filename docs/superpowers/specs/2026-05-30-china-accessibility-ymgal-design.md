# 大陆可达性优化：搜索源直连分流 + 接入 ymgal — 设计文档

> 日期：2026-05-30
> 状态：已批准，待实现

## 1. 背景与问题

线上搜索链路为：浏览器 → Cloudflare Worker 代理（`*.workers.dev`）→ 上游 API。实测确认 `workers.dev` 默认域名在中国大陆被 DNS 污染/封锁，导致大陆用户"搜不到任何作品"——请求连第一跳（代理入口）都到不了。

换部署平台（Vercel/Railway）治不了本：它们的默认免费域名（`*.vercel.app`、`*.up.railway.app`）在大陆同样被墙。治本需自定义域名（买域名）或国内备案，超出本次范围。

本次采用务实方案（方案 C/1）：**让支持 CORS 的源绕过代理直连官方 API**，使大陆裸连环境下至少 Bangumi + 萌娘百科可用，彻底告别"什么都搜不到"。同时接入月幕 Galgame（ymgal）作为增强源。

## 2. 实测结论（CORS 与可达性）

| 源 | CORS 直连 | 大陆可达 | 分类 |
|---|---|---|---|
| Bangumi (`api.bgm.tv`) | ✅ `Allow-Origin: *` | ✅ | **直连源** |
| 萌娘百科 (`zh.moegirl.org.cn`) | ✅（需 `origin=*` 参数） | ✅ | **直连源** |
| Bilibili | ❌ 412 反爬、无 CORS | ✅ | 需代理源 |
| AniList | ❌ 无 CORS | ⚠️ 上游也常被墙 | 需代理源 |
| VNDB | ❌ 无 CORS | ⚠️ 上游也常被墙 | 需代理源 |
| ymgal (`www.ymgal.games`) | ❌ 无 CORS、OPTIONS 403 | ✅ 国内站可达 | 需代理源 |

**关键限制**：ymgal 大陆裸连仍不可用（CORS 拦截 + 代理入口被墙）。但其唯一障碍是 CORS——一旦代理入口可达（如日后绑自定义域名），ymgal 即为大陆最稳的 Galgame 源。本次接入为此做准备，并在有代理的环境（本地 dev 部分受限、未来域名）下可用。

## 3. 决策记录

| 决策点 | 选择 | 理由 |
|---|---|---|
| 源分流机制 | `directConnect` 标记，直连源绕过 `API_BASE` | 贴合实测，大陆裸连零依赖 |
| 直连源 | Bangumi、萌娘百科 | 实测支持 CORS + 大陆可达 |
| 萌娘 CORS | 请求加 `origin=*` 参数 | MediaWiki 需此参数才回 CORS 头 |
| ymgal token | Worker 端获取 + 内存缓存约 55 分钟 | 前端无感；token 端点也无 CORS，只能 Worker 端换；避免 429 |
| ymgal 凭证 | 公开凭证仅存 Worker 代码 | 不进前端 bundle |
| ymgal 搜索模式 | 仅 list 模式 | 够用，YAGNI |
| UI | 直连源 chip 加"· 直连"标记 | 帮大陆用户识别稳定源 |
| dev 下 ymgal | 因缺 token 可能搜不出，可接受 | dev 不跑 Worker；完整验证在 Worker 部署后 |
| 使用条款 | README 注明数据来源「月幕Galgame」 | 满足 ymgal 非商业 + 署名要求 |

## 4. 前端 search.js 改造

### 4.1 源分流

```js
const DIRECT_BASES = {
  bangumi: 'https://api.bgm.tv',
  moegirl: 'https://zh.moegirl.org.cn',
};
```

`buildApiUrl` 保持现状供需代理源使用；直连源在各自 `search*` 函数中直接用 `DIRECT_BASES[源]` 拼官方 URL，不经 `API_BASE`。直连源在 dev 和 prod 都打官方域名（不再依赖 Vite 的 `/api/bangumi` 转发；该 dev 代理保留作兼容，无害）。

### 4.2 萌娘 origin 参数

`searchMoegirl` 的 `URLSearchParams` 增加 `origin: '*'`，启用 MediaWiki CORS。

### 4.3 降级保证

`searchAllSources` 已用 `Promise.allSettled`，单源失败独立上报。大陆环境下需代理源失败时，直连源结果照常展示。

## 5. ymgal 接入

### 5.1 前端

新增 `searchYmgal`（走 `/api/ymgal`，需代理源）+ `normalizeYmgalItem`。

请求：`GET /api/ymgal/open/archive/search-game?mode=list&keyword=<kw>&pageNum=1&pageSize=12`

归一化 `data.result[]` → SearchWork：

| 字段 | 来源 |
|---|---|
| `id` | `ymgal-{id}` |
| `source` | `ymgal` |
| `sourceLabel` | `月幕Galgame` |
| `sourceId` | `String(id)` |
| `sourceUrl` | `https://www.ymgal.games/ga{id}` |
| `title` | `chineseName \|\| name` |
| `originalTitle` | `name`（若与 title 不同） |
| `cover` | `mainImg` |
| `type` | `Galgame/游戏` |
| `summary` | `''`（list 模式无简介） |
| `releaseDate`/`releaseYear` | `releaseDate` |
| `tags` | `[orgName, haveChinese ? '有中文' : ''].filter(Boolean)` |
| `meta` | `[releaseDate, orgName].filter(Boolean)` |

错误处理：外层 `{success, code, data}`，`code !== 0` 抛错（同 Bilibili 模式）。

### 5.2 Worker 端 OAuth

`worker/router.js` 路由表加 `/api/ymgal` → `target: 'https://www.ymgal.games'`，标记 `needsYmgalAuth: true`。

`worker/index.js` 转发 ymgal 请求前：
1. 检查模块级缓存 `{ token, expiresAt }`
2. 过期/无 → 调 `GET /oauth/token?grant_type=client_credentials&client_id=ymgal&client_secret=luna0327&scope=public`，缓存 `expiresAt = now + 55min`
3. 注入 `Authorization: Bearer <token>` + `version: 1` + `Accept: application/json;charset=utf-8`
4. CORS 头照常回填（ymgal 无 CORS，靠 Worker 补）

token 刷新判断抽为纯函数 `shouldRefreshToken(cache, now)` 以便单测。

## 6. dev 代理 + UI

- `vite.config.js` 加 `/api/ymgal` 代理（dev 下无 token 注入，ymgal 受限，可接受）。
- `SOURCE_LABELS` 加 `ymgal: '月幕Galgame'`；`DEFAULT_SOURCES` 加 `'ymgal'` → 共 7 源。
- SearchPanel：直连源（bangumi/moegirl）chip 加"· 直连"标记（纯展示，数据驱动）。

## 7. 测试

- `normalizeYmgalItem` 纯函数单测（中文名优先、id/url、机构兜底 tag、code≠0 抛错）
- 源分流单测：直连源返回官方域名 URL、需代理源返回 `/api/` 路径
- Worker `matchRoute` 加 ymgal 路由测试
- `shouldRefreshToken(cache, now)` 纯函数单测（过期判断）

## 8. 文档

- `README.md`：源列表加 ymgal、注明"数据来源：月幕Galgame"；说明直连源/需代理源区分；v0.3 更新记录补本次改动
- `docs/DEPLOYMENT.md`：补 ymgal OAuth 说明 + dev 下 ymgal 受限说明

## 9. 范围之外（YAGNI）

- ymgal 精确搜索模式（只用 list）
- token 持久化（内存缓存足够，不引入 KV）
- 自定义背景功能（用户已暂缓）
- 解决 workers.dev 被墙本身（需域名，另案）

## 10. 核心价值与已知限制

**价值**：大陆用户即使代理完全不通，打开站点 Bangumi + 萌娘可直连搜索，告别"搜不到任何作品"。有代理时 7 源全开。

**已知限制**：ymgal / Bilibili / AniList / VNDB 在大陆裸连仍不可用（CORS + 代理入口被墙）。真正解决需自定义域名（另案）。
