# 漫迹式单来源搜索核心替换 — 当前执行计划

日期：2026-06-01
状态：已调整，原六来源执行计划废弃

## 目标

保留《漫迹》式单来源检索交互，但将默认来源收窄到墙内直连优先、已验证可浏览器读取的来源。

## 当前来源

- 萌娘百科
- AGE动漫
- Bangumi

## 已执行

- 删除咕咕番、girigiri愛、豆瓣、NyaFun adapter 与测试。
- 删除上述来源的 Vite dev proxy 配置。
- 删除上述来源的 Cloudflare Worker 白名单路由。
- 更新 README、部署文档、进度记录和架构文档。
- 将默认来源改为萌娘百科，来源顺序改为萌娘百科、AGE动漫、Bangumi。

## 验收标准

- UI 只展示萌娘百科、AGE动漫、Bangumi。
- 默认搜索不请求 `/api/sources/*`，优先浏览器直连。
- 废弃来源访问 `/api/sources/gugu`、`/api/sources/girigiri`、`/api/sources/douban`、`/api/sources/nyafun` 时匹配不到 Worker 路由。
- `npm test` 和 `npm run build` 通过。

## 未来新增来源门槛

新增来源前必须先验证：

- 中国大陆网络可访问。
- 浏览器直连 CORS 可用，或 Worker fallback 可稳定部署。
- 返回内容不是跳转/校验页。
- HTML/JSON 解析规则有 fixture 测试覆盖。
