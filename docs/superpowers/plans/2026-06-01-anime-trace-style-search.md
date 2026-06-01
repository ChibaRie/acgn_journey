# 漫迹式单来源搜索核心替换 — 当前执行计划

日期：2026-06-01
状态：已调整，原六来源执行计划废弃

## 目标

保留《漫迹》式单来源检索交互，但将默认来源收窄到墙内直连优先、已验证可浏览器读取的来源。

## 当前来源

- AGE动漫（直连）
- 萌娘百科（直连）
- Bangumi（需代理；未配置代理时尝试官方 API 直连 fallback）
- trace.moe 截图识别（独立面板）

## 已执行

- 删除咕咕番、girigiri愛、豆瓣、NyaFun adapter 与测试。
- 删除上述来源的 Vite dev proxy 配置。
- 删除上述来源的 Cloudflare Worker 白名单路由。
- 更新 README、部署文档、进度记录和架构文档。
- 将默认来源改为 AGE动漫，来源顺序改为 AGE动漫、萌娘百科、Bangumi。
- 新增 trace.moe 截图识别面板。
- AGE动漫解析首播时间、制作公司、剧情类型/标签，并单独保存为 `animeTags` 供词云使用。

## 验收标准

- UI 只展示 AGE动漫、萌娘百科、Bangumi 三个文字搜索源。
- AGE动漫、萌娘百科标注直连，Bangumi 标注需代理。
- 截图识别面板可用图片 URL 或本地截图调用 trace.moe。
- 默认搜索不请求 `/api/sources/*`，优先浏览器直连。
- 废弃来源访问 `/api/sources/gugu`、`/api/sources/girigiri`、`/api/sources/douban`、`/api/sources/nyafun` 时匹配不到 Worker 路由。
- `npm test` 和 `npm run build` 通过。

## 未来新增来源门槛

新增来源前必须先验证：

- 中国大陆网络可访问。
- 浏览器直连 CORS 可用，或 Worker fallback 可稳定部署。
- 返回内容不是跳转/校验页。
- HTML/JSON 解析规则有 fixture 测试覆盖。
