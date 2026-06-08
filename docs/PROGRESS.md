# 项目进度记录

> 最后更新：2026-06-08
> 当前版本：`v0.8` ｜ 默认分支：`main` ｜ 远程：github.com/ChibaRie/acgn_journey

## 当前状态

| 项 | 状态 |
|---|---|
| 版本 | v0.8 |
| 主要形态 | Electron 桌面软件 + 本机 SQLite |
| 在线演示 | GitHub Pages |
| 线上地址 | https://chibarie.github.io/acgn_journey/ |
| 搜索模式 | 直连优先的 anime_trace 式单来源检索 |
| 默认搜索源 | AGE动漫、萌娘百科、MangaBaka、Bangumi |
| 截图识别 | trace.moe |
| 数据持久化 | 本机 SQLite，浏览器 LocalStorage 作为 fallback |

## v0.8 交付内容

### 1. AI 用户画像实验

- 新增 AI 画像入口，基于作品库聚合摘要生成结构化偏好画像。
- 桌面模式支持 OpenAI-compatible LLM 配置与本机代理调用；Pages 仅提供 Prompt 预览和复制。
- LLM 配置支持获取模型列表、测试连通性、一键清除，Prompt 预览默认折叠。
- 默认温度为 `0.8`，用户确认前不会发起模型调用。
- 默认不发送完整库、短评全文、作品简介、封面或来源链接，API Key 仅保存在本机 settings。

### 2. 搜索结果扩容

- 文字搜索结果上限从 12 条提升到 24 条。
- AGE动漫、萌娘百科、MangaBaka 与 Bangumi adapter 共用统一结果数量常量。
- 补充来源 adapter、搜索分发、AI 画像构建、本机 LLM 代理与 UI 相关测试。

### 3. 文档、版本与测试同步

- package 版本更新到 `0.8.0`，导出备份格式版本号同步更新到 `0.8.0`。
- README、架构、部署与进度文档同步说明 AI 画像实验、Pages 调用边界和搜索结果扩容。
- GitHub Actions Pages 部署测试环境同步使用 Node 24，以覆盖 `node:sqlite` 本机服务测试。

## v0.7.7 交付内容

### 1. MangaBaka 轻小说搜索

- 新增 MangaBaka 轻小说源，支持中文、日文与英文标题检索。
- MangaBaka 使用支持 CORS 的官方 API，由浏览器直接访问，不加入 Worker 代理路由。
- 当前文字搜索源顺序为 AGE动漫、萌娘百科、MangaBaka、Bangumi；trace.moe 继续独立负责截图识别。

### 2. 条款、版本与测试同步

- MangaBaka 数据仅按非商业与署名要求使用，具体要求见 [MangaBaka Terms of Service](https://mangabaka.org/about/terms)。
- package 版本和导出备份版本号同步更新到 `0.7.7`。
- README、架构与部署文档同步说明来源用途和浏览器直连/CORS 边界。

## v0.7.6 交付内容

### 1. 我的库视图切换

- 新增列表与方块两种作品库浏览方式。
- 方块视图采用封面主导的响应式卡片布局，桌面自动多列、窄屏双列、极窄屏单列。
- 首次使用保持列表视图，后续自动恢复用户上次选择。

### 2. 交互能力保持一致

- 列表与方块视图共用现有筛选结果和作品数据。
- 方块视图继续支持编辑、删除、批量选择、批量修改状态和批量删除。
- 补充视图偏好归一化、持久化与存储不可用回退测试。

### 3. 文档、版本与测试同步

- package 版本和导出备份版本号同步更新到 `0.7.6`。
- README、进度记录和架构文档同步补充作品库视图切换。
- 当前真实测试集为 14 个文件、55 个用例。

## v0.7.5 交付内容

### 1. 多格式备份导出

- 设置面板新增备份文件格式选择，支持 `JSON`、`XML` 和 `CSV`。
- JSON 继续作为完整恢复格式；XML/CSV 作为可读、可迁移的导出格式。
- 导出文件名统一使用 `acgn_journey-backup-日期.格式`。

### 2. JSON 批量导入

- `批量导入` 页面支持选择 JSON 文件。
- 支持本项目导出的完整 JSON 备份，也支持直接 records 数组 JSON。
- 导入来源列表新增 `acgn_journey JSON`，自动识别 `.json` 文件。

### 3. 应用内确认弹窗统一

- 新增通用确认弹窗组件。
- 备份导入覆盖、批量导入覆盖和我的库删除确认均使用应用内弹窗。
- 移除相关流程中的浏览器原生 `confirm`。

### 4. 文档、版本与测试同步

- package 版本和导出备份版本号同步更新到 `0.7.5`。
- README、进度记录和架构文档同步补充本次功能。
- 新增导出格式与 JSON 导入测试。

## v0.7.3 交付内容

### 1. 封面与进入动效

- 新增整屏封面入口，标题更新为“由此开启你的ACGN之旅”。
- 封面移除按钮，改为点击任意位置进入主体。
- 封面退场、主体显现与 tab 切换增加统一过渡动画。

### 2. 我的库删除确认

- `我的库` 的删除提示改为页面内弹窗，不再使用浏览器原生 `confirm`。
- 单条删除与批量删除共用同一确认层，支持取消与确认删除。

### 3. 文档与版本同步

- 版本号同步更新到 `v0.7.3`。
- README、进度记录与导出备份版本号保持一致。

## v0.7.0 交付内容

### 1. 桌面软件入口

- 新增 `electron/main.mjs`，使用 Electron 创建本地桌面窗口。
- 新增 `npm run desktop:start`，面向正式本地使用。
- 桌面窗口默认加载 `http://127.0.0.1:5188`，窗口标题为 `acgn_journey`。
- Electron 禁用 Node 注入，启用 `contextIsolation` 与 `sandbox`，外部链接交给系统浏览器打开。

### 2. 桌面启动器

- 新增 `scripts/desktop.mjs`。
- 启动器会按需检查并启动：
  - 本机 SQLite 数据服务：`127.0.0.1:5198`
  - 本机静态应用运行时：`127.0.0.1:5188`
  - Electron 桌面窗口
- 已存在可用服务时会复用，避免重复占用端口。
- 由启动器创建的子进程会在桌面窗口关闭后自动收口。
- 桌面入口会在 `dist` 不存在或过期时自动执行 `npm run build`，再服务生产构建文件。
- 启动日志写入 `desktop-launch.log`，该文件已加入 `.gitignore`。

### 3. 本机 SQLite 持久化

- `scripts/local-data-server.mjs` 使用 Node 24 的 `node:sqlite` 在用户设备上维护数据库。
- 作品库、背景和主题偏好优先写入 SQLite。
- 本机服务不可用时，前端回退到浏览器 LocalStorage，保证在线演示仍可使用。
- 默认数据库路径：
  - Windows：`%APPDATA%\acgn_journey\acgn_journey.sqlite`
  - macOS：`~/Library/Application Support/acgn_journey/acgn_journey.sqlite`
  - Linux：`$XDG_DATA_HOME/acgn_journey/acgn_journey.sqlite` 或 `~/.local/share/acgn_journey/acgn_journey.sqlite`
- 可通过 `ACGN_DATA_DIR` 或 `ACGN_DB_PATH` 覆盖。

### 4. 文档定位调整

- README 改为优先介绍桌面模式。
- DEPLOYMENT 明确区分桌面正式使用与 GitHub Pages 在线演示。
- ARCHITECTURE 更新为 Electron + Vite + 本机数据服务的架构。
- 导出备份版本号更新为 `0.7.0`。

## v0.6.0 交付内容

- 新增本机 SQLite 数据服务。
- `npm run app` 联动启动本机数据服务和 Vite 前端。
- 前端读取本机服务失败时回退到 LocalStorage。

## v0.5.4 交付内容

- 搜索核心替换为 anime_trace 式单来源模式：先选来源，再搜索作品。
- 默认来源调整为 AGE动漫、萌娘百科、Bangumi。
- 移除咕咕番、girigiri愛、豆瓣、NyaFun 等不稳定或不可直连来源。
- 新增 trace.moe 截图识别。
- AGE动漫搜索结果解析首播时间、制作公司和剧情类型/标签，并保存为 `animeTags`。
- 新增统计页标签词云与 `scripts/tag_wordcloud.py` 离线词云脚本。
- 新增我的库批量管理：选择当前筛选结果、批量修改状态、批量删除。
- 项目名、GitHub 仓库、GitHub Pages 地址、备份导出前缀与 LocalStorage 新键统一更新为 `acgn_journey`。

## 历史版本摘要

### v0.4

- 移除 Bilibili 搜索源。
- 新增自定义背景功能。

### v0.3

- 接入 AniList、VNDB、月幕Galgame。
- 部署到 GitHub Pages + Cloudflare Worker。
- 引入 Vitest 测试。

### v0.2

- 首个完整功能版本：作品库管理、分类筛选、时间线、统计面板、实体库存、批量导入和 JSON 备份。

## 发布注意

- push 到 `main` 会触发 GitHub Actions 发布在线演示。
- 在线演示不等同于桌面软件，无法启动本机 SQLite 服务。
- 桌面正式使用路径是 `npm run desktop:start`。
- 第三方站点 HTML 结构可能变化；若某个来源突然无结果，优先检查对应 adapter 的解析规则。
