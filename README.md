# acgn_journey

个人 ACGN 作品记录管理应用。v0.5 将搜索侧改为参考 [anime_trace](https://github.com/linyi102/anime_trace) 的单来源检索：先选择一个来源，再在该来源内搜索作品；同时接入 trace.moe 截图识别。本地库数据保存到浏览器 `LocalStorage`。

当前版本：`v0.5.4`

## 在线访问

线上地址：https://chibarie.github.io/acgn_journey/

本地库数据保存在浏览器。当前默认搜索源按 AGE动漫（直连）、萌娘百科（直连）、Bangumi（需代理）排序；部署方式见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 技术栈

| 层面 | 技术 | 说明 |
|------|------|------|
| 前端框架 | React 19 + React-DOM (`19.2.3`) | 函数组件 + Hooks |
| 构建工具 | Vite 7 (`7.2.6`) + `@vitejs/plugin-react` | 原生 ESM、快速 HMR、dev server 代理 |
| 图标 | lucide-react (`0.562.0`) | 轻量、Tree-shakable |
| 样式 | 原生 CSS + CSS Variables | 零依赖，`data-theme` 切换暗夜/日间双主题 |
| 状态与持久化 | `useLibrary` Hook + LocalStorage | 单键存储，自动同步，无外部状态库 |
| 单元测试 | Vitest (`4.1.7`) | 覆盖搜索归一化与 Worker 路由逻辑 |
| 搜索代理 | 直连优先；Vite dev proxy / Cloudflare Workers 仅保留已验证白名单 | 默认源可浏览器直连，避免依赖未同步部署的 Worker |
| 部署 | GitHub Pages + GitHub Actions（Node 20） | 推送 main 自动构建并发布 |
| 数据源 | AGE动漫、萌娘百科、Bangumi、trace.moe | 作品文字检索 + 截图识别 |

## 运行

```powershell
npm install
npm run app
```

默认开发地址：

```text
http://127.0.0.1:5188
```

统一启停工具：

- `npm run app`：自动判断当前状态，未运行时启动，已运行时停止。
- `npm run app:start`：启动开发服务并打开浏览器。
- `npm run app:stop`：停止当前项目的开发服务。
- `npm run app:restart`：重启开发服务。
- `npm run app:status`：查看运行状态。
- `npm run dev`：底层 Vite 开发命令，适合需要前台日志时手动使用。

可选离线词云：

```powershell
pip install pyecharts
python scripts/tag_wordcloud.py path\to\backup.json -o tag-wordcloud.html
```

先在设置面板导出 JSON 备份，再运行上述命令即可生成独立的交互式标签词云页面；未安装 `pyecharts` 时脚本会生成一个静态 HTML fallback。

## 已实现功能

- 单来源作品搜索：AGE动漫（直连）、萌娘百科（直连）、Bangumi（需代理）。
- trace.moe 截图识别：可上传本地截图或粘贴图片 URL，返回番名、集数、时间点、相似度，并可加入我的库。
- 搜索结果展示：标题、封面、类型、简介、来源站点和来源链接。
- 各源会尽量提取年份、评分、标签或状态等附加信息；AGE动漫会把首播年月、制作公司和剧情类型拆成独立 `animeTags`，便于后续词云统计。站点结构变化时会显示当前来源的错误。
- 一键加入我的库：默认标记为完成状态，并按类型显示“已看 / 已读 / 已玩”。
- 我的库管理：编辑标题、类型、作品年份、状态、日期、评分、短评、标签；删除记录；支持批量选择当前筛选结果、批量修改状态和批量删除。
- 我的库分类：支持按 Galgame、轻小说、动漫、漫画、其他和作品年份筛选。
- 个人历程：按年份分组展示，支持年份、类型、状态筛选。
- 统计面板：总作品数、已完成数、平均评分、标签词云、类型/作品年份/记录年份/状态/评分分布。
- 数据持久化：`localStorage` key 为 `acgn_journey:records:v1`。
- 数据导出与备份：右下角设置面板支持导出 JSON 备份，也支持导入备份覆盖恢复。
- 自定义背景：右下角设置面板支持导入本地图片作为全局背景，可调节不透明度与模糊度；图片以 base64 存入 LocalStorage，不上传云端。
- 实体库存管理：可记录实体藏品的购买价格、购买渠道、摆放位置、是否限定版、开封状态、购买日期和备注。
- 批量导入：支持 Bangumi、MyAnimeList、AniList、VNDB 或通用 CSV 导入，也支持 MyAnimeList XML 导入；导入前可预览，支持合并或覆盖。

## 更新记录

### v0.5.4（当前）

- **搜索核心替换为 anime_trace 式单来源模式**：移除旧的 AniList / VNDB / 月幕Galgame 聚合搜索入口，搜索 UI 改为“先选来源，再搜作品”。
- **代理白名单收窄**：本地 Vite proxy 与 Cloudflare Worker 仅保留仍有价值的 Bangumi / AGE动漫固定前缀，不通过 query/body 传入任意上游 URL。
- **结果入库流程不变**：搜索结果仍归一化为 `SearchWork`，继续复用「加入我的库」、时间线、统计和编辑流程。
- **直连热修**：线上默认来源收缩为实测可浏览器直连读取的萌娘百科、AGE动漫、Bangumi。
- **废弃源清理**：咕咕番、girigiri愛、豆瓣、NyaFun 因 CORS、接口限制或跳转校验问题已从默认 UI、adapter、测试、Vite 代理和 Worker 白名单中移除。
- **来源排序与标注**：搜索源改为 AGE动漫、萌娘百科、Bangumi；AGE动漫和萌娘百科标注“直连”，Bangumi 标注“需代理”。
- **trace.moe 截图识别**：新增“截图识别”面板，接入 trace.moe `/search?anilistInfo`，支持图片 URL 和本地截图上传。
- **AGE 元数据增强**：搜索结果中解析“首播时间”“制作公司”“剧情类型/标签”，其中动漫标签单独保存为 `animeTags`，不和用户标签混用。
- **统一启停工具**：移除旧 Windows 批处理入口，新增 `scripts/dev-server.mjs` 与 `npm run app*` 命令，跨平台管理本地开发服务。
- **界面收尾**：移除页面 ico 标识，在网页底部新增美观的 GitHub 仓库链接。
- **Bangumi 代理兼容修复**：前端恢复使用当前线上 Worker 已部署的 `/api/bangumi/*` 路径，同时 Worker 代码保留 `/api/sources/bangumi/*` 兼容路由。
- **标签词云**：统计页新增可点击标签词云，聚合用户标签与来源解析出的 `animeTags`；另提供 `scripts/tag_wordcloud.py` 从导出 JSON 生成独立词云 HTML。
- **我的库批量管理**：新增批量管理模式，可选择当前筛选结果、批量修改状态或批量删除选中记录。
- **项目重命名与版本同步**：项目名、GitHub 仓库、GitHub Pages 路径、导出文件前缀、文档与版本号统一更新为 `acgn_journey` / `v0.5.4`。

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
- 实体库存管理、批量导入（CSV / MyAnimeList XML 等）。
- 数据持久化到 LocalStorage，支持 JSON 备份导出/导入。
- 暗夜/日间双主题。

## 跨域方案

当前默认搜索源优先直连，避免线上 Worker 未同步部署时全部 404。实测可直连读取的来源按墙内优先排序：

- AGE动漫搜索页：`https://www.agedm.io/search?query=...`
- 萌娘百科 MediaWiki API：`https://zh.moegirl.org.cn/api.php?origin=*`
- Bangumi 官方 API：`https://api.bgm.tv/v0/search/subjects`（UI 标注为需代理；未配置代理时仍尝试官方 API 直连 fallback）
- trace.moe 截图识别 API：`https://api.trace.moe/search?anilistInfo`

当前保留的搜索代理路由仅用于本地验证或后续 fallback，不是默认搜索路径：

- `/api/bangumi/*` -> `https://api.bgm.tv/*`
- `/api/sources/bangumi/*` -> `https://api.bgm.tv/*`（兼容保留）
- `/api/sources/age/*` -> `https://www.agedm.io/*`

咕咕番、girigiri愛、豆瓣、NyaFun 已废弃。若未来重新接入，需先完成墙内可用性、CORS/代理、反爬跳转和解析稳定性验证，再新增 adapter 和路由。

## 设计与数据模型

完整架构、数据模型和扩展方案见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 数据来源

- 作品数据默认来自 AGE动漫、萌娘百科与 Bangumi；截图识别来自 trace.moe。
- AGE动漫的检索 URL 与首版解析思路参考了 [anime_trace](https://github.com/linyi102/anime_trace) 的公开实现，并按本项目的 Web/CORS 架构重写。
- trace.moe 接入参考 [soruly/trace.moe](https://github.com/soruly/trace.moe) 与公开 API 文档。

## License

MIT License. See [LICENSE](LICENSE).
