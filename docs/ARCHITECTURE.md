# My ACGN Journey — 系统架构设计文档

## 1. 项目概述

My ACGN Journey 是一个个人ACG（动画、轻小说、Galgame）作品记录管理单页应用。用户可按单来源检索作品信息、将作品加入个人库、追踪观看/阅读/游玩进度、记录评分短评、管理实体藏品、构建作品关系图谱，并通过时间线和统计面板回顾个人历程。

## 2. 技术选型与架构决策

| 层面 | 选择 | 理由 |
|------|------|------|
| 前端框架 | React 19 + Vite 7 | 快速 HMR、原生 ESM、轻量 |
| 样式方案 | 原生 CSS (CSS Variables) | 零依赖、主题切换简单、体积小 |
| 状态管理 | useLibrary Hook + LocalStorage | 单页应用无需复杂状态库，自动持久化 |
| 路由 | Tab 状态切换 | 应用面板少、无需深层路由 |
| 图标 | Lucide React | 轻量、Tree-shakable、风格统一 |
| 搜索集成 | 直连优先的单来源 adapter + 可选白名单代理 | 参考 anime_trace 的单站点检索模型，同时降低线上代理部署依赖 |
| 数据持久化 | LocalStorage | 即刻可用、备份/恢复简单 |
| 图表 | 自定义 CSS Bar | 避免引入图表库，设计一致 |

**关键设计决策：**
- 采用原生 CSS Variables 实现暗夜/日间双主题，通过 `data-theme` 属性切换
- 搜索请求通过 `src/search/` 的来源 adapter 归一化；默认来源直接请求支持 CORS 的上游，非 CORS 友好来源再由 Vite/Worker 白名单代理转发
- 所有数据存储在 LocalStorage 单键下，导出为 JSON 备份文件
- 组件按面板（Panel）拆分，每个面板自包含状态和逻辑

## 3. 数据模型

### 3.1 核心实体：LibraryRecord（库记录）

```typescript
interface LibraryRecord {
  // 标识
  id: string;              // UUID v4
  workKey: string;         // 去重键: "{source}:{sourceId}"

  // 来源追踪
  source: string;          // 'bangumi' | 'moegirl' | 'age' | 'manual' 等
  sourceId: string;        // 数据源ID
  sourceUrl: string;       // 原始页面链接

  // 作品信息
  title: string;           // 作品标题（中文优先）
  originalTitle: string;   // 原标题/日文名
  cover: string;           // 封面图片URL
  type: string;            // 作品类型（动画、轻小说/书籍、Galgame/游戏、漫画等）
  summary: string;         // 作品简介
  releaseDate: string;     // 发售/播出日期
  releaseYear: string;     // 作品年份

  // 用户状态
  status: 'wish' | 'active' | 'done' | 'paused' | 'dropped';
  rating: number;          // 0-10 整数评分
  comment: string;         // 短评
  tags: string[];          // 用户标签

  // 时间追踪
  startedAt: string;       // 开始日期 (YYYY-MM-DD)
  finishedAt: string;      // 完成日期 (YYYY-MM-DD)
  addedAt: string;         // 加入库时间 (ISO 8601)
  updatedAt: string;       // 最后修改时间 (ISO 8601)

  // 扩展模块
  inventory: Inventory;    // 实体藏品信息
  relations: Relation[];   // 作品关系
}

interface Inventory {
  owned: boolean;
  format: 'light-novel' | 'bd' | 'game-disc' | 'game-card' | 'goods' | 'other';
  purchasePrice: string;
  purchaseChannel: string;
  shelfLocation: string;
  limitedEdition: boolean;
  openStatus: 'unknown' | 'sealed' | 'opened';
  purchasedAt: string;
  notes: string;
}

interface Relation {
  id: string;
  targetId: string;        // 关联作品ID
  type: 'series' | 'same_world' | 'same_creator' | 'adaptation' | 'spinoff' | 'other';
  note: string;
}
```

### 3.2 搜索临时实体：SearchWork

```typescript
interface SearchWork {
  id: string;              // "{source}-{sourceId}"
  source: string;
  sourceLabel: string;     // "Bangumi" | "萌娘百科" | "AGE动漫" | ...
  sourceId: string;
  sourceUrl: string;
  title: string;
  originalTitle: string;
  cover: string;
  type: string;
  summary: string;
  releaseDate: string;
  releaseYear: string;
  tags: string[];
  meta: string[];          // 附加元数据（评分/排名等）
}
```

### 3.3 状态流转

```
wish (想看) → active (在看) → done (已看)
    ↓            ↓               ↓
  dropped      paused ←──────────┘
  (抛弃)       (搁置)
```

状态标签根据作品类型自动适配文言：
- 动画: 想看/在看/已看
- 书籍/轻小说: 想读/在读/已读
- 游戏/Galgame: 想玩/在玩/已玩

## 4. 系统架构

### 4.1 组件树

```
App (状态根)
├── Topbar
│   ├── Brand (Logo + 标题 + 统计概览)
│   ├── TabBar (7个标签页切换)
│   └── TopbarMeta (总览数字)
├── Workspace (主内容区)
│   ├── SearchPanel
│   │   ├── SearchForm (关键词输入)
│   │   ├── SourceSelector (来源选择: Bangumi/萌娘百科/AGE动漫)
│   │   ├── WarningStrip (API错误提示)
│   │   ├── EmptyState (无结果)
│   │   └── ResultGrid
│   │       └── WorkCard[] (搜索结果卡片)
│   ├── LibraryPanel
│   │   ├── CategoryRow (分类筛选chip)
│   │   ├── YearCategoryRow (作品年份筛选chip)
│   │   ├── FilterRow (关键词+状态筛选)
│   │   ├── EmptyState
│   │   └── LibraryList
│   │       └── LibraryItem[] (库记录列表)
│   ├── InventoryPanel (实体库存)
│   ├── RelationGraphPanel (关系图谱)
│   ├── BulkImportPanel (批量导入)
│   ├── TimelinePanel (时间线)
│   └── StatsPanel (统计面板)
├── RecordEditor (编辑弹窗，模态)
├── SettingsPopover (设置面板)
├── FloatingToolbar (右下角主题/设置按钮)
└── Toast (操作提示)
```

### 4.2 数据流

```
                    ┌──────────────┐
                    │  LocalStorage │
                    │  (持久化层)    │
                    └──────┬───────┘
                           │ loadRecords() / saveRecords()
                    ┌──────▼───────┐
                    │  useLibrary  │
                    │  (状态管理)   │
                    │  - records   │
                    │  - addWork   │
                    │  - update    │
                    │  - delete    │
                    │  - hasWork   │
                    └──────┬───────┘
                           │ props/context
              ┌────────────┼────────────┐
              │            │            │
        SearchPanel  LibraryPanel  TimelinePanel
              │            │            │
          searchSource   filterRecords  getStats
              │            │            │
        ┌─────▼─────┐     │            │
        │ Vite Proxy │     │            │
        │ /api/*     │     │            │
        └─────┬─────┘     │            │
              │            │            │
          Source adapter
               │
        /api/sources/<id>
               │
        Vite proxy / Worker
```

### 4.3 API 集成架构

默认搜索源使用浏览器直连，只有非 CORS 友好来源才通过 Vite Dev Server 或 Cloudflare Worker 转发。前端不会传入任意上游 URL；代理候选源只能访问固定的 `/api/sources/<source>` 前缀。

```
浏览器 fetch('https://www.agedm.io/search?query=...')
    → AGE动漫搜索页
    → 返回带 Access-Control-Allow-Origin 的 HTML
    → adapter 解析为 SearchWork
```

**默认直连来源：**

| 来源 | 上游 | 数据格式 |
|------|---------|------|----------|
| Bangumi | `https://api.bgm.tv` | JSON |
| 萌娘百科 | `https://zh.moegirl.org.cn/api.php?origin=*` | JSON |
| AGE动漫 | `https://www.agedm.io/search?query=...` | HTML |

**代理候选来源：** 咕咕番、girigiri愛、豆瓣、NyaFun。它们需要 Worker/Vite 代理或额外反爬适配，当前不默认展示。

**搜索策略：**
1. UI 只维护一个 `sourceId`，切换来源不会自动发请求
2. `searchSource(sourceId, keyword)` 校验来源并调度对应 adapter
3. Adapter 负责拼 URL、请求、解析 HTML/JSON，并转换为统一的 `SearchWork`
4. 当前来源失败时只显示该来源错误，不再展示多来源错误列表

## 5. 关键模块设计

### 5.1 搜索模块 (`src/search/`)

- `sources.js`: 默认直连来源注册表、代理路径构造
- `searchService.js`: `searchSource(sourceId, keyword, options)` 单来源入口
- `html.js`: HTML/BBCode 清洗、URL 修补、年份与标签工具
- `adapters/*.js`: 每个来源一个 adapter，负责请求和归一化
- 支持 AbortController 取消请求

`src/api/search.js` 仅作为兼容导出层，转发 `src/search/` 的新接口。

### 5.2 状态管理 (`hooks/useLibrary.js`)

- `records` state 初始化自 LocalStorage
- 通过 `useEffect` 自动同步到 LocalStorage
- `hasWork(work)`: 通过 `workKey` 集合快速判断是否已入库
- `addWork(work)`: 从 SearchWork 创建新 record，默认状态为 'done'
- `updateRecord(id, patch)`: 部分更新，自动记录 updatedAt
- `deleteRecord(id)`: 同时清理相关 relations
- `replaceRecords()` / `mergeRecords()`: 导入场景

### 5.3 统计模块 (`utils/stats.js`)

- `getStats(records)`: 计算总览（总数、完成数、均分）和分布（类型/状态/年份/评分）
- `filterRecords(records, filters)`: 多条件筛选，支持 title/type/status/year/category/workYear

### 5.4 导入模块 (`utils/importers.js`)

- 支持格式: CSV（自动检测表头）、MyAnimeList XML
- 来源自动识别（通过文件名）
- 字段别名映射表（中英文双语表头兼容）
- 状态/评分/日期/类型智能解析和规范化

## 6. 主题系统

使用 CSS Variables 实现双主题：

```
:root                         → 日间主题
:root[data-theme="dark"]      → 暗夜主题
```

主题切换通过 `document.documentElement.dataset.theme` 设置，偏好保存在 LocalStorage。
首次加载通过 `prefers-color-scheme` 媒体查询自动选择。

## 7. 安全与性能

- 封面图片使用 `referrerPolicy="no-referrer"` 保护隐私
- 搜索请求支持 AbortController 取消
- 备份文件包含版本号防止格式不兼容
- `prefers-reduced-motion` 媒体查询支持
- 所有外部链接使用 `rel="noreferrer"`
- Touch target 最小 44x44px

## 8. 文件结构

```
My-ACGN-Journey/
├── index.html              # 入口 HTML
├── package.json            # 依赖说明
├── vite.config.js          # Vite 配置 + API 代理
├── img.ico                 # 网站图标
├── README.md               # 项目说明
├── LICENSE                 # MIT License
├── my-acgn-journey.bat     # 一键启停
├── start-dev.bat           # 仅启动
├── stop-dev.bat            # 仅停止
├── docs/
│   └── ARCHITECTURE.md     # 本文件
└── src/
    ├── main.jsx            # React 渲染入口
    ├── App.jsx             # 根组件（标签路由、状态协调）
    ├── styles.css          # 全局样式 + 主题变量
    ├── api/
    │   └── search.js       # 搜索兼容导出层
    ├── search/
    │   ├── sources.js      # 单来源注册表
    │   ├── searchService.js # 单来源搜索入口
    │   ├── html.js         # HTML/URL/标签工具
    │   └── adapters/       # Bangumi/萌娘百科/AGE + 代理候选 adapters
    ├── hooks/
    │   └── useLibrary.js   # 作品库状态管理 Hook
    ├── utils/
    │   ├── library.js      # 数据模型、CRUD 工具、序列化
    │   ├── stats.js        # 统计计算、筛选工具
    │   └── importers.js    # CSV/XML 导入解析
    └── components/
        ├── SearchPanel.jsx     # 搜索面板
        ├── WorkCard.jsx        # 搜索结果卡片
        ├── LibraryPanel.jsx    # 作品库面板
        ├── TimelinePanel.jsx   # 时间线面板
        ├── StatsPanel.jsx      # 统计面板
        ├── InventoryPanel.jsx  # 实体库存面板
        ├── RelationGraphPanel.jsx  # 关系图谱面板
        ├── BulkImportPanel.jsx # 批量导入面板
        ├── RecordEditor.jsx    # 记录编辑弹窗
        └── EmptyState.jsx      # 空状态占位组件
```

## 9. 后端扩展方案

当前版本为纯前端 SPA，数据存储在 LocalStorage。如需升级为后端驱动版本，建议方案：

### 9.1 最小迁移路径
- 将 `loadRecords()` / `saveRecords()` 替换为 REST API 调用
- 新增 Express/Koa 后端，提供 `/api/records` CRUD
- 搜索代理从 Vite 迁移到后端，支持生产环境部署
- 数据库选择：SQLite（轻量）或 PostgreSQL（扩展性）

### 9.2 API 同步增强
- 通过 OAuth 接入 Bangumi / AniList / VNDB 等授权同步能力
- 后端安全保存 access_token 和 refresh_token
- 定时同步用户在各平台的记录
- 冲突解决策略：本地优先、远端优先、合并

### 9.3 多端同步
- 引入用户认证（JWT 或 Session）
- 数据库替代 LocalStorage
- WebSocket 推送多端实时同步
