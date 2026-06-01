# 部署与运行指南

acgn_journey 现在有两个入口：

- **桌面正式使用**：Electron + 本机 SQLite，数据保存在用户设备中。
- **在线演示**：GitHub Pages 静态站，只用于体验和展示；无法替用户启动本机进程。

## 一、本地桌面模式

推荐命令：

```powershell
npm install
npm run desktop:start
```

启动后会运行三部分：

| 部分 | 默认地址 | 说明 |
|---|---|---|
| Electron | 本地窗口 | 用户实际操作入口 |
| 本机应用运行时 | `http://127.0.0.1:5188` | 提供 `dist` 中的生产构建文件 |
| 本机数据服务 | `http://127.0.0.1:5198` | 读写 SQLite 数据库 |

默认数据位置：

- Windows：`%APPDATA%\acgn_journey\acgn_journey.sqlite`
- macOS：`~/Library/Application Support/acgn_journey/acgn_journey.sqlite`
- Linux：`$XDG_DATA_HOME/acgn_journey/acgn_journey.sqlite` 或 `~/.local/share/acgn_journey/acgn_journey.sqlite`

可用环境变量：

| 变量 | 作用 |
|---|---|
| `APP_HOST` | 前端运行时 host，默认 `127.0.0.1` |
| `APP_PORT` | 前端运行时端口，默认 `5188` |
| `DATA_HOST` | 本机数据服务 host，默认 `127.0.0.1` |
| `DATA_PORT` | 本机数据服务端口，默认 `5198` |
| `ACGN_DATA_DIR` | 覆盖 SQLite 数据目录 |
| `ACGN_DB_PATH` | 覆盖 SQLite 数据库完整路径 |

示例：

```powershell
$env:ACGN_DATA_DIR="D:\acgn_journey_data"
npm run desktop:start
```

## 二、浏览器本地开发模式

```powershell
npm run app
```

常用命令：

- `npm run app`：自动判断当前状态，未运行时启动，已运行时停止。
- `npm run app:start`：启动本机 SQLite 数据服务与开发服务并打开浏览器。
- `npm run app:stop`：停止当前项目的开发服务和本机数据服务。
- `npm run app:restart`：重启本机 SQLite 数据服务和开发服务。
- `npm run app:status`：查看运行状态。
- `npm run dev`：只启动 Vite，适合需要前台日志时使用。

## 三、GitHub Pages 在线演示

线上地址：

```text
https://chibarie.github.io/acgn_journey/
```

GitHub Pages 只发布静态前端。它无法部署或启动 `scripts/local-data-server.mjs`，因此无法保证像桌面模式一样写入用户设备里的 SQLite。在线演示在本机数据服务不可用时会回退到浏览器 LocalStorage。

发布步骤：

1. 仓库 Settings -> Pages -> Build and deployment -> Source 选择 **GitHub Actions**。
2. push 到 `main`，或在 Actions 页面手动运行 workflow。
3. 部署完成后访问 `https://chibarie.github.io/acgn_journey/`。

## 四、搜索代理与 Worker

默认搜索优先使用可直连来源：

- AGE动漫搜索页：`https://www.agedm.io/search?query=...`
- 萌娘百科 MediaWiki API：`https://zh.moegirl.org.cn/api.php?origin=*`
- trace.moe 截图识别 API：`https://api.trace.moe/search?anilistInfo`

Bangumi 在 UI 中标注为需代理；未配置 `VITE_API_BASE` 时，前端仍会尝试官方 API 直连 fallback。

Cloudflare Worker 目前只作为可选 fallback，保留固定白名单路由：

| 前端路径 | 上游 |
|---|---|
| `/api/bangumi/*` | `https://api.bgm.tv/*` |
| `/api/sources/bangumi/*` | `https://api.bgm.tv/*` |
| `/api/age/*` | `https://www.agedm.io/*` |
| `/api/sources/age/*` | `https://www.agedm.io/*` |

部署 Worker：

```bash
npm install -g wrangler
wrangler login
cd worker
wrangler deploy
```

如未来启用 Worker fallback，可在 GitHub Actions 变量中配置：

- Name：`VITE_API_BASE`
- Value：Worker URL，不带末尾斜杠

## 五、验证

推荐发布或提交前执行：

```powershell
npm test
npm run build
npm run app:status
```

桌面入口可用下面命令做语法检查：

```powershell
node --check scripts/desktop.mjs
node --check electron/main.mjs
```
