# My ACGN Journey

个人 ACGN 作品记录管理应用。v0.5 将搜索侧改为参考 [anime_trace](https://github.com/linyi102/anime_trace) 的单来源检索：先选择一个来源，再在该来源内搜索作品；本地库数据保存到浏览器 `LocalStorage`。

当前版本：`v0.5`

## 在线访问

线上地址：https://chibarie.github.io/My_ACGN_Journey/

本地库数据保存在浏览器。当前默认搜索源为浏览器可直连读取的 Bangumi、萌娘百科与 AGE动漫；部署方式见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 技术栈

| 层面 | 技术 | 说明 |
|------|------|------|
| 前端框架 | React 19 + React-DOM (`19.2.3`) | 函数组件 + Hooks |
| 构建工具 | Vite 7 (`7.2.6`) + `@vitejs/plugin-react` | 原生 ESM、快速 HMR、dev server 代理 |
| 图标 | lucide-react (`0.562.0`) | 轻量、Tree-shakable |
| 样式 | 原生 CSS + CSS Variables | 零依赖，`data-theme` 切换暗夜/日间双主题 |
| 状态与持久化 | `useLibrary` Hook + LocalStorage | 单键存储，自动同步，无外部状态库 |
| 单元测试 | Vitest (`4.1.7`) | 覆盖搜索归一化与 Worker 路由逻辑 |
| 搜索代理 | 直连优先；Vite dev proxy / Cloudflare Workers 作为增强 | 默认源可浏览器直连，代理用于后续扩展非 CORS 友好源 |
| 部署 | GitHub Pages + GitHub Actions（Node 20） | 推送 main 自动构建并发布 |
| 数据源 | Bangumi、萌娘百科、AGE动漫 | 单来源检索，一次只查询当前选中的来源 |

## 运行

```powershell
npm install
npm run dev
```

默认开发地址：

```text
http://127.0.0.1:5188
```

Windows 用户也可以直接双击：

- `my-acgn-journey.bat`：一键启停。未运行时启动，已运行时停止。
- `start-dev.bat`：仅启动项目，并自动打开浏览器。
- `stop-dev.bat`：仅停止当前项目的 Vite 开发服务。

这些脚本使用 `.bat` 文件自身目录 `%~dp0` 定位项目根目录，不写死用户名、桌面路径或盘符；仓库 clone 到任意 Windows 路径下都可以使用。

## 已实现功能

- 单来源作品搜索：Bangumi、萌娘百科、AGE动漫。
- 搜索结果展示：标题、封面、类型、简介、来源站点和来源链接。
- 各源会尽量提取年份、评分、标签或状态等附加信息；站点结构变化时会显示当前来源的错误。
- 一键加入我的库：默认标记为完成状态，并按类型显示“已看 / 已读 / 已玩”。
- 我的库管理：编辑标题、类型、作品年份、状态、日期、评分、短评、标签；删除记录。
- 我的库分类：支持按 Galgame、轻小说、动漫、漫画、其他和作品年份筛选。
- 个人历程：按年份分组展示，支持年份、类型、状态筛选。
- 统计面板：总作品数、已完成数、平均评分、类型/作品年份/记录年份/状态/评分分布。
- 数据持久化：`localStorage` key 为 `my-acgn-journey:records:v1`。
- 数据导出与备份：右下角设置面板支持导出 JSON 备份，也支持导入备份覆盖恢复。
- 自定义背景：右下角设置面板支持导入本地图片作为全局背景，可调节不透明度与模糊度；图片以 base64 存入 LocalStorage，不上传云端。
- 实体库存管理：可记录实体藏品的购买价格、购买渠道、摆放位置、是否限定版、开封状态、购买日期和备注。
- 关系图谱：可建立系列作品、同一世界观、同一作者/会社、改编关系、衍生作品等关系，并用节点图展示。
- 批量导入：支持 Bangumi、MyAnimeList、AniList、VNDB 或通用 CSV 导入，也支持 MyAnimeList XML 导入；导入前可预览，支持合并或覆盖。

## 更新记录

### v0.5（当前）

- **搜索核心替换为 anime_trace 式单来源模式**：移除旧的 AniList / VNDB / 月幕Galgame 聚合搜索入口，搜索 UI 改为“先选来源，再搜作品”。
- **代理白名单重建**：本地 Vite proxy 与 Cloudflare Worker 只允许 `/api/sources/<source>` 六个固定前缀，不通过 query/body 传入任意上游 URL。
- **结果入库流程不变**：搜索结果仍归一化为 `SearchWork`，继续复用「加入我的库」、时间线、统计和编辑流程。
- **直连热修**：线上默认来源收缩为实测可浏览器直连读取的 Bangumi、萌娘百科、AGE动漫；咕咕番、girigiri愛、豆瓣、NyaFun 保留为代理可用后的候选，不再默认展示导致 404。

### v0.4

- **移除 Bilibili 搜索源**：Bilibili 番剧搜索 API 需登录态/风控、且作为需代理源在大陆裸连不可用，移除后搜索来源由 6 个精简到 5 个（共 6 个 chip）。同步清理了 Vite 代理、Worker 路由表与相关单元测试。
- **新增自定义背景功能**：右下角设置面板新增「自定义背景」区，可导入本地图片作为全局背景，并实时调节不透明度（0–100%）与模糊度（0–30px）。图片经校验（限图片类型、4MB 以内、仅接受 `data:image/` 数据 URL）后以 base64 存入 LocalStorage，刷新后保留，可一键恢复默认。

### v0.3

- **新增两个搜索源**：AniList（动画/漫画，GraphQL API，拆为「AniList动画」「AniList漫画」两个独立可开关的源）与 VNDB（视觉小说/Galgame，Kana HTTPS API）。搜索栏来源 chip 由 3 个扩展到 6 个。
- **在线部署**：可部署为 GitHub Pages 静态站 + Cloudflare Worker 搜索代理。前端通过 `VITE_API_BASE` 环境变量在 dev（Vite 代理）与 prod（Worker）间切换，详见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。
- **引入单元测试**：新增 Vitest，覆盖各源搜索结果归一化与 Worker 路由逻辑。
- **大陆可达性优化**：Bangumi、萌娘百科改为浏览器直连官方 API（支持 CORS），大陆网络无需代理即可搜索；新增月幕Galgame（ymgal）作为需代理的 Galgame 源（Worker 端注入 OAuth token、内存缓存约 55 分钟）。
- 说明：仍为优先本地运行的纯前端版本。授权 API 同步入口已在界面预留，但 OAuth 回调与令牌保存应放到后端或 Serverless 中实现，不建议把长期访问令牌放在浏览器本地代码里。

### v0.2

- 首个完整功能版本：作品库管理、我的库分类与筛选、个人历程时间线、统计面板。
- 三源搜索：Bangumi、Bilibili、萌娘百科。
- 实体库存管理、作品关系图谱、批量导入（CSV / MyAnimeList XML 等）。
- 数据持久化到 LocalStorage，支持 JSON 备份导出/导入。
- 暗夜/日间双主题，Windows 一键启停脚本。

## 跨域方案

当前默认搜索源优先直连，避免线上 Worker 未同步部署时全部 404。实测可直连读取的来源：

- Bangumi 官方 API：`https://api.bgm.tv/v0/search/subjects`
- 萌娘百科 MediaWiki API：`https://zh.moegirl.org.cn/api.php?origin=*`
- AGE动漫搜索页：`https://www.agedm.io/search?query=...`

非 CORS 友好来源仍需固定白名单代理，避免 Worker 成为开放代理。前端如启用代理候选源，只访问 `/api/sources/<source>` 路径，由 Vite dev proxy 或 Cloudflare Worker 转发到固定上游。

当前保留的搜索代理候选路由：

- `/api/sources/bangumi/*` -> `https://api.bgm.tv/*`
- `/api/sources/age/*` -> `https://www.agedm.io/*`
- `/api/sources/gugu/*` -> `https://www.gugu3.com/*`
- `/api/sources/girigiri/*` -> `http://bgm.girigirilove.com/*`
- `/api/sources/douban/*` -> `https://m.douban.com/*`
- `/api/sources/nyafun/*` -> `https://www.nyadm.org/*`

**本地开发**通过 [vite.config.js](vite.config.js) 的 dev server 代理转发；**生产环境**通过 Cloudflare Worker（[worker/](worker/)）转发，路由表与 dev 代理结构一致。前端用 `VITE_API_BASE` 环境变量切换两者，dev 为空走 Vite 代理、prod 指向 Worker。

## 设计与数据模型

完整架构、数据模型和扩展方案见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 数据来源

- 作品数据默认来自 Bangumi、萌娘百科与 AGE动漫。
- AGE动漫的检索 URL 与首版解析思路参考了 [anime_trace](https://github.com/linyi102/anime_trace) 的公开实现，并按本项目的 Web/CORS 架构重写。

## License

MIT License. See [LICENSE](LICENSE).
