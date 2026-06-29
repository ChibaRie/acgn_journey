<div align="center">
  <h1>acgn_journey</h1>

  <p><strong>把看过、读过、玩过的作品，整理成一条可回看的 ACGN 旅程。</strong></p>

  <p>
    本地优先的个人作品库，支持作品搜索、列表与方块浏览、历程统计、实体收藏，
    <br>
    以及隐私可控的 AI 兴趣画像。
  </p>

  <p>
    <img src="https://img.shields.io/badge/version-v0.8-ff646d?style=flat-square" alt="当前版本 v0.8">
    <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-2f81f7?style=flat-square" alt="MIT License"></a>
    <img src="https://img.shields.io/badge/desktop-Electron_38-47848f?style=flat-square" alt="Electron 38">
    <a href="https://github.com/ChibaRie/acgn_journey/actions/workflows/deploy.yml"><img src="https://github.com/ChibaRie/acgn_journey/actions/workflows/deploy.yml/badge.svg" alt="部署状态"></a>
  </p>

  <p>
    <a href="https://chibarie.github.io/acgn_journey/"><strong>在线体验</strong></a>
    &nbsp;&nbsp;·&nbsp;&nbsp;
    <a href="#本地运行"><strong>桌面版启动</strong></a>
    &nbsp;&nbsp;·&nbsp;&nbsp;
    <a href="#已实现功能"><strong>功能一览</strong></a>
  </p>
</div>

> [!IMPORTANT]
> GitHub Pages 是静态演示版，数据会回退到浏览器 LocalStorage。长期使用建议运行桌面版，让作品库、设置和 LLM 配置保存在自己的设备上。

---

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
| 数据源 | AGE动漫、萌娘百科、MangaBaka、Bangumi；trace.moe | 作品文字检索 + 截图识别 |
| 在线部署 | GitHub Pages + GitHub Actions | 保留演示入口 |

## 已实现功能

- 单来源作品搜索：AGE动漫（直连）、萌娘百科（直连）、MangaBaka（轻小说、浏览器直连）、Bangumi（需代理/可 fallback），每次检索最多展示 24 条结果。
- trace.moe 截图识别：可上传本地截图或粘贴图片 URL，返回番名、集数、时间点、相似度，并可加入我的库。
- 我的库管理：支持列表/方块视图切换并记住上次选择；可编辑标题、类型、作品年份、状态、日期、评分、短评、标签，也支持批量选择筛选结果、批量修改状态和批量删除。
- 我的库分类：支持按 Galgame、轻小说、动漫、漫画、其他和作品年份筛选。
- 个人历程：按年份分组展示，支持年份、类型、状态筛选。
- 统计面板：总作品数、已完成数、平均评分、标签词云、类型/作品年份/记录年份/状态/评分分布。
- AI 用户画像实验：桌面模式可配置 OpenAI-compatible LLM，支持获取模型列表、测试连通性和清除配置，用本地聚合摘要生成结构化偏好画像；在线演示仅提供 Prompt 预览与复制。
- 数据持久化：桌面/本地模式优先写入本机 SQLite，浏览器回退 key 为 `acgn_journey:records:v1`。
- 数据导出与备份：设置面板支持按 JSON、XML 或 CSV 导出备份；JSON 备份可直接导入覆盖恢复。
- 自定义背景：支持导入本地图片作为全局背景，可调节不透明度与模糊度；优先写入本机 SQLite。
- 实体库存管理：记录实体藏品的购买价格、渠道、摆放位置、限定版、开封状态、购买日期和备注。
- 批量导入：支持本项目 JSON 备份、Bangumi、MyAnimeList、AniList、VNDB 或通用 CSV 导入，也支持 MyAnimeList XML 导入。
- 可选离线词云：`scripts/tag_wordcloud.py` 可从导出的 JSON 备份生成独立交互式词云 HTML。

## 离线词云

```powershell
pip install pyecharts
python scripts/tag_wordcloud.py path\to\backup.json -o tag-wordcloud.html
```

先在设置面板导出 JSON 备份，再运行上述命令即可生成独立的交互式标签词云页面；未安装 `pyecharts` 时脚本会生成静态 HTML fallback。

## 更新记录

### v0.8（当前）

- **AI 用户画像实验**：新增桌面优先的 AI 画像入口，默认只发送聚合统计和少量代表作品，不发送完整库、短评或简介。
- **LLM 配置增强**：支持 OpenAI-compatible 模型列表获取、连通性测试、一键清除配置，默认温度为 `0.8`，Prompt 预览默认折叠。
- **搜索结果扩容**：文字搜索结果上限从 12 条提升到 24 条，AGE动漫、萌娘百科、MangaBaka 与 Bangumi 使用统一结果数量。
- **隐私与在线边界**：桌面模式可真实调用本机 LLM 代理，GitHub Pages 仅提供 Prompt 预览和复制，不暴露真实 API Key 调用能力。
- **版本同步**：package 与导出备份版本号更新到 `0.8.0`。

### v0.7.7

- **MangaBaka 轻小说源**：新增中文、日文与英文标题检索，返回封面和结构化轻小说元数据。
- **浏览器直连**：MangaBaka API 支持 CORS，前端直接访问官方 API，不经过项目 Worker。
- **来源与条款同步**：文字搜索源更新为 AGE动漫、萌娘百科、MangaBaka、Bangumi；MangaBaka 数据按非商业与署名要求使用。
- **版本同步**：package 与导出备份版本号更新到 `0.7.7`。

### v0.7.6

- **我的库视图切换**：新增列表和方块两种浏览方式，方块视图采用封面主导的响应式卡片布局。
- **视图偏好记忆**：自动保存上次选择的作品库视图，并在下次进入时恢复。
- **操作能力保持一致**：两种视图均支持筛选、编辑、删除和批量管理。
- **文档与版本同步**：package、README、进度记录和导出备份版本号同步更新到 `v0.7.6`。

### v0.7.5

- **多格式备份导出**：设置面板新增导出格式选择，支持 JSON、XML 和 CSV 三种备份文件。
- **JSON 批量导入**：批量导入页支持读取本项目导出的 JSON 备份，也支持直接 records 数组 JSON。
- **确认弹窗统一**：备份覆盖、批量覆盖和删除确认统一改为应用内确认弹窗，不再依赖浏览器原生 `confirm`。
- **文档与版本同步**：package、README、进度记录、架构文档与导出备份版本号同步更新到 `v0.7.5`。

### v0.7.3

- **封面入口更新**：新增整屏封面，文案更新为“由此开启你的ACGN之旅”，点击任意位置即可进入主体。
- **页面内确认弹窗**：`我的库` 的删除提示改为应用内弹窗，不再使用浏览器原生提示框。
- **前端动效打磨**：封面进入、主体切换、面板与弹窗补充统一过渡动画，整体更像本地桌面软件。
- **文档同步**：README、进度记录与导出备份版本号同步更新到 `v0.7.3`。

### v0.7.0

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

- 文字搜索源依次为 AGE动漫、萌娘百科、MangaBaka 与 Bangumi；trace.moe 保持为独立的截图识别服务。
- AGE动漫的检索 URL 与首版解析思路参考 [anime_trace](https://github.com/linyi102/anime_trace) 的公开实现，并按本项目的 Web/CORS 架构重写。
- MangaBaka 用于轻小说检索，浏览器通过支持 CORS 的官方 API 直连。本项目仅以非商业方式使用并注明 MangaBaka 数据来源，具体要求见 [MangaBaka Terms of Service](https://mangabaka.org/about/terms)。
- trace.moe 接入参考 [soruly/trace.moe](https://github.com/soruly/trace.moe) 与公开 API 文档。

## 文档

- 架构设计：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 部署与运行：[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- 进度记录：[docs/PROGRESS.md](docs/PROGRESS.md)

## License

MIT License. See [LICENSE](LICENSE).
