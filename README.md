# My ACGN Journey

个人 ACGN 作品记录管理应用。当前版本是 React + Vite 单页应用，搜索侧通过 Vite dev server 代理聚合 Bangumi、Bilibili 与萌娘百科，本地库数据保存到浏览器 `LocalStorage`。

当前版本：`v0.3`

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

- 多源作品搜索：Bangumi、Bilibili 番剧搜索、萌娘百科 MediaWiki 查询。
- 搜索结果展示：标题、封面、类型、简介、来源站点和来源链接。
- Bangumi 与萌娘百科搜索结果会提取 tag；Bilibili 会兼容提取番剧风格/地区等标签。
- 一键加入我的库：默认标记为完成状态，并按类型显示“已看 / 已读 / 已玩”。
- 我的库管理：编辑标题、类型、作品年份、状态、日期、评分、短评、标签；删除记录。
- 我的库分类：支持按 Galgame、轻小说、动漫、漫画、其他和作品年份筛选。
- 个人历程：按年份分组展示，支持年份、类型、状态筛选。
- 统计面板：总作品数、已完成数、平均评分、类型/作品年份/记录年份/状态/评分分布。
- 数据持久化：`localStorage` key 为 `my-acgn-journey:records:v1`。
- 数据导出与备份：右下角设置面板支持导出 JSON 备份，也支持导入备份覆盖恢复。
- 实体库存管理：可记录实体藏品的购买价格、购买渠道、摆放位置、是否限定版、开封状态、购买日期和备注。
- 关系图谱：可建立系列作品、同一世界观、同一作者/会社、改编关系、衍生作品等关系，并用节点图展示。
- 批量导入：支持 Bangumi、MyAnimeList、AniList、VNDB 或通用 CSV 导入，也支持 MyAnimeList XML 导入；导入前可预览，支持合并或覆盖。

## v0.2 说明

当前仍是优先本地运行的纯前端版本。批量导入已经完成离线 XML/CSV 文件解析；授权 API 同步入口已在界面中预留，但 OAuth 回调、令牌保存和跨域代理应放到后端或 Serverless 中实现，不建议把长期访问令牌直接放在浏览器本地代码里。

## 跨域方案

浏览器页面只访问本地相对路径：

- `/api/bangumi/*` -> `https://api.bgm.tv/*`
- `/api/bilibili/*` -> `https://api.bilibili.com/*`
- `/api/moegirl/*` -> `https://zh.moegirl.org.cn/*`

这些代理配置在 [vite.config.js](vite.config.js) 中。后期如果需要部署为静态站，建议把同样的转发逻辑迁移到 Express、Cloudflare Workers、Vercel Functions 或 Nginx。

## 设计与数据模型

完整架构、数据模型和扩展方案见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## License

MIT License. See [LICENSE](LICENSE).
