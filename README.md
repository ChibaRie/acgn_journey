# acgn_journey

个人 ACGN 作品记录管理软件。v0.7 开始，项目不再只把数据存在浏览器里，而是提供 Electron 桌面入口：应用窗口、本机数据服务和 SQLite 数据库都运行在用户自己的设备上。GitHub Pages 仍保留为在线演示版，但长期记录建议使用桌面模式。

当前版本：`v0.7.0`

## 本地运行

推荐桌面模式：

```powershell
npm install
npm run desktop:start
```

这会启动：

- Electron 桌面窗口。
- 本机前端运行时：`http://127.0.0.1:5188`，用于提供 `dist` 中的生产构建文件。
- 本机 SQLite 数据服务：`http://127.0.0.1:5198`。

关闭桌面窗口后，由 `desktop:start` 启动的本机服务会一并收口。默认数据库位置：

- Windows：`%APPDATA%\acgn_journey\acgn_journey.sqlite`
- macOS：`~/Library/Application Support/acgn_journey/acgn_journey.sqlite`
- Linux：`$XDG_DATA_HOME/acgn_journey/acgn_journey.sqlite` 或 `~/.local/share/acgn_journey/acgn_journey.sqlite`

可选覆盖：

```powershell
$env:ACGN_DATA_DIR="D:\acgn_journey_data"
npm run desktop:start
```

浏览器开发模式仍然可用：

```powershell
npm run app
```

常用命令：

- `npm run desktop:start`：启动本地桌面软件。
- `npm run app`：切换启动/停止浏览器开发模式。
- `npm run app:start`：启动本机数据服务与 Vite，并打开浏览器。
- `npm run app:stop`：停止当前项目的开发服务和本机数据服务。
- `npm run app:restart`：重启本机数据服务和开发服务。
- `npm run app:status`：查看运行状态。
- `npm run dev`：只启动 Vite，适合需要前台日志时使用。

## 在线演示

线上地址：https://chibarie.github.io/acgn_journey/

在线版是静态站，不能替用户启动本机软件进程。它会在无法连接本机 SQLite 服务时回退到浏览器 LocalStorage，因此清理浏览器数据可能导致在线版记录丢失。正式使用请运行桌面模式。

## 技术栈

| 层面 | 技术 | 说明 |
|------|------|------|
| 桌面壳 | Electron 38 | 本地窗口入口，加载本机应用运行时 |
| 前端框架 | React 19 + React-DOM | 函数组件 + Hooks |
| 构建工具 | Vite 7 + `@vitejs/plugin-react` | 原生 ESM、快速 HMR、dev server 代理 |
| 图标 | lucide-react | 轻量、Tree-shakable |
| 样式 | 原生 CSS + CSS Variables | `data-theme` 切换暗夜/日间主题 |
| 状态与持久化 | `useLibrary` Hook + 本机 SQLite / 浏览器回退 | 本机优先写盘，在线演示可降级 |
| 本地数据服务 | Node 24 + `node:sqlite` | 数据写入用户目录下的 SQLite 文件 |
| 单元测试 | Vitest | 覆盖搜索归一化与代理路由逻辑 |
| 数据源 | AGE动漫、萌娘百科、Bangumi、trace.moe | 作品文字检索 + 截图识别 |
| 在线部署 | GitHub Pages + GitHub Actions | 保留演示入口 |

## 已实现功能

- 单来源作品搜索：AGE动漫（直连）、萌娘百科（直连）、Bangumi（需代理/可 fallback）。
- trace.moe 截图识别：可上传本地截图或粘贴图片 URL，返回番名、集数、时间点、相似度，并可加入我的库。
- 我的库管理：编辑标题、类型、作品年份、状态、日期、评分、短评、标签；支持批量选择筛选结果、批量修改状态和批量删除。
- 我的库分类：支持按 Galgame、轻小说、动漫、漫画、其他和作品年份筛选。
- 个人历程：按年份分组展示，支持年份、类型、状态筛选。
- 统计面板：总作品数、已完成数、平均评分、标签词云、类型/作品年份/记录年份/状态/评分分布。
- 数据持久化：桌面/本地模式优先写入本机 SQLite，浏览器回退 key 为 `acgn_journey:records:v1`。
- 数据导出与备份：设置面板支持导出 JSON 备份，也支持导入备份覆盖恢复。
- 自定义背景：支持导入本地图片作为全局背景，可调节不透明度与模糊度；优先写入本机 SQLite。
- 实体库存管理：记录实体藏品的购买价格、渠道、摆放位置、限定版、开封状态、购买日期和备注。
- 批量导入：支持 Bangumi、MyAnimeList、AniList、VNDB 或通用 CSV 导入，也支持 MyAnimeList XML 导入。
- 可选离线词云：`scripts/tag_wordcloud.py` 可从导出的 JSON 备份生成独立交互式词云 HTML。

## 离线词云

```powershell
pip install pyecharts
python scripts/tag_wordcloud.py path\to\backup.json -o tag-wordcloud.html
```

先在设置面板导出 JSON 备份，再运行上述命令即可生成独立的交互式标签词云页面；未安装 `pyecharts` 时脚本会生成静态 HTML fallback。

## 更新记录

### v0.7.0（当前）

- **桌面软件入口**：新增 Electron 桌面窗口与 `npm run desktop:start`，应用可以作为本地软件运行。
- **本机服务联动**：桌面启动器会按需启动本机 SQLite 数据服务和本机静态应用运行时，并在窗口关闭后收掉自己启动的子进程。
- **本地持久化落地**：作品库、背景和主题偏好优先写入用户设备中的 SQLite 数据库，浏览器存储只作为降级 fallback。
- **文档定位调整**：README、部署文档、架构文档与进度记录均明确区分桌面正式使用和 GitHub Pages 在线演示。

### v0.6.0

- 新增 `scripts/local-data-server.mjs` 与 `node:sqlite` 本地数据服务。
- `npm run app` 可同时启动本机数据服务与 Vite 前端。

### v0.5.4

- 搜索核心替换为 anime_trace 式单来源模式。
- 默认来源调整为 AGE动漫、萌娘百科、Bangumi，并清理不稳定/不可直连的废弃源。
- 新增 trace.moe 截图识别。
- 新增标签词云与 `scripts/tag_wordcloud.py`。
- 新增我的库批量管理。
- 项目名、仓库、GitHub Pages 路径、导出文件前缀和文档统一为 `acgn_journey`。

### v0.4

- 移除 Bilibili 搜索源。
- 新增自定义背景功能。

### v0.3

- 接入 AniList、VNDB、月幕Galgame。
- 部署到 GitHub Pages + Cloudflare Worker。
- 引入 Vitest 测试。

### v0.2

- 首个完整功能版本：作品库管理、分类筛选、时间线、统计面板、实体库存、批量导入和 JSON 备份。

## 数据来源

- 作品数据默认来自 AGE动漫、萌娘百科与 Bangumi；截图识别来自 trace.moe。
- AGE动漫的检索 URL 与首版解析思路参考 [anime_trace](https://github.com/linyi102/anime_trace) 的公开实现，并按本项目的 Web/CORS 架构重写。
- trace.moe 接入参考 [soruly/trace.moe](https://github.com/soruly/trace.moe) 与公开 API 文档。

## 文档

- 架构设计：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 部署与运行：[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- 进度记录：[docs/PROGRESS.md](docs/PROGRESS.md)

## License

MIT License. See [LICENSE](LICENSE).
