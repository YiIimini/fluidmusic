# 03 — 数据设计 (Data)

> 数据流 · 缓存策略 · 持久化方案 · API 层设计

---

## 1. 现状分析

### 1.1 数据存储现状

| 存储位置 | 内容 | 问题 |
|----------|------|------|
| `localStorage` | 歌单缓存、歌曲URL、DIY设置、收藏、自定义歌单、Last.fm配置、壁纸Base64 | 同步阻塞、5MB限制、无结构化查询 |
| 内存 | Cookie、播放状态、频谱数据 | 进程重启丢失 |
| 文件系统 | Cookie加密文件 (`userData/cookie.enc`) | ✅ 已用 `safeStorage` |
| 文件系统 | 设置JSON (`userData/fluidmusic-settings.json`) | ✅ 已用 IPC |

### 1.2 数据流现状

```
渲染进程                    主进程                  外部
┌──────────┐    IPC     ┌──────────┐    HTTP     ┌────────────┐
│ ApiBridge │◄──────────►│ server.js │◄──────────►│ music.163  │
│ (fetchApi)│           │ (Express) │           │ y.qq.com   │
└────┬─────┘           └──────────┘           └────────────┘
     │ 直接调用
┌────▼─────┐
│DataCache │ ← localStorage (同步阻塞)
└──────────┘
```

### 1.3 核心问题

| 问题 | 严重度 |
|------|:---:|
| localStorage 同步阻塞主线程 | 🟡 |
| QQ 歌曲 URL 30min 过期但缓存 6h | 🔴 |
| 无请求去重 —— 同一 URL 可能并发请求多次 | 🟡 |
| 壁纸 Base64 占用 2-5MB localStorage | 🟡 |
| 无增量更新 —— 歌单每次全量拉取 | 🟢 |

---

## 2. 目标状态

### 2.1 目标存储架构

```
┌─────────────────────────────────────────────────┐
│               Application Layer                  │
│  AppStore (内存, 响应式)                          │
│    ├── player: { track, queue, isPlaying, ... }  │
│    ├── user: { netease, qq }                     │
│    ├── cache: { playlists, songs, urls }         │
│    └── settings: DIYSettings                     │
└────────┬──────────────────┬─────────────────────┘
         │                  │
    ┌────▼─────┐      ┌─────▼──────┐
    │IndexedDB │      │ FileSystem │
    │(异步)    │      │ (via IPC)  │
    │          │      │            │
    │· 歌单数据 │      │· 壁纸文件   │
    │· 歌曲URL  │      │· Cookie    │
    │· 收藏     │      │  (加密)    │
    │· 自定义   │      │· 设置JSON  │
    │  歌单     │      │· 日志      │
    │· 用户配置 │      │            │
    └──────────┘      └────────────┘
```

### 2.2 API 请求层设计

```
┌──────────────────────────────────────┐
│           RequestQueue               │
│  ┌────────────────────────────────┐  │
│  │ pending: Map<key, Promise>     │  │ ← 请求去重
│  │ maxConcurrency: 4              │  │ ← 并发控制
│  │ waiting: PriorityQueue         │  │ ← 优先级队列
│  └────────────────────────────────┘  │
│                                      │
│  fetch(key, fn, priority): Promise   │
│  · 相同 key 复用进行中的 Promise     │
│  · 超过并发上限则排队                │
│  · priority 高的请求优先             │
└──────────────────────────────────────┘
```

### 2.3 缓存 TTL 策略

| 数据类型 | TTL | 原因 |
|----------|-----|------|
| QQ 歌曲 URL | 25 分钟 | QQ URL 约30分钟过期，留5分钟缓冲 |
| 网易歌曲 URL | 2 小时 | 网易 URL 有效期较长 |
| 歌单元数据 | 6 小时 | 歌单结构变化不频繁 |
| 歌单歌曲列表 | 1 小时 | 用户可能增删歌曲 |
| 搜索结果 | 5 分钟 | 搜索结果时效性强 |
| 歌词 | 24 小时 | 歌词几乎不变 |
| 用户信息 | 30 分钟 | 头像/昵称偶尔变化 |

---

## 3. 改造步骤

### Step 1: IndexedDB 封装层 (Phase 2)

```ts
// src/core/data-cache.ts（重写）
class DataCache {
  private db: IDBDatabase;

  async get<T>(store: string, key: string): Promise<T | null>;
  async set<T>(store: string, key: string, value: T, ttlMs?: number): Promise<void>;
  async getOrFetch<T>(store: string, key: string, fetcher: () => Promise<T>, ttlMs: number): Promise<T>;
  async clearExpired(): Promise<void>;  // 定期清理过期条目
  async clearStore(store: string): Promise<void>;
}

// 使用示例
const tracks = await cache.getOrFetch(
  'playlist-songs', `qq:${playlistId}`,
  () => apiBridge.fetchPlaylistTracks(playlistId, 'qq'),
  60 * 60 * 1000  // 1小时 TTL
);
```

### Step 2: RequestQueue 实现 (Phase 2)

```ts
// src/core/request-queue.ts（新建）
class RequestQueue {
  async fetch<T>(key: string, fetcher: () => Promise<T>, priority = 0): Promise<T>;
  cancel(key: string): void;
  clear(): void;
  get pendingCount(): number;
}
```

### Step 3: 数据迁移脚本 (Phase 4)

```ts
// 从 localStorage 迁移到 IndexedDB（一次性）
async function migrateFromLocalStorage() {
  const keys = [
    'fluidmusic_cache_*',     // 数据缓存
    'fluidmusic-favorites',   // 收藏
    'fluidmusic-custom-playlists', // 自定义歌单
    'fluidmusic-settings',    // DIY设置
    'fluidmusic-lastfm',      // Last.fm
  ];
  // 读取 → 转换 → 写入 IndexedDB → 清除 localStorage
}
```

### Step 4: 壁纸存储迁移 (Phase 4)

```ts
// 从 localStorage Base64 → 文件系统
// preload.js 暴露:
//   saveWallpaper(base64DataUrl): Promise<string>  → 返回文件路径
//   loadWallpaper(): Promise<string|null>
//   deleteWallpaper(): Promise<void>
```

---

## 4. 验收标准

- [ ] 所有数据读写操作异步（不阻塞主线程）
- [ ] QQ 歌曲 URL 缓存 ≤25 分钟自动过期
- [ ] 同一请求不会并发发送多次（RequestQueue 去重生效）
- [ ] 壁纸不再存储在 localStorage
- [ ] localStorage 总使用量 ≤1MB
- [ ] 从旧 localStorage 数据自动迁移到 IndexedDB（用户无感知）
- [ ] IndexedDB 总大小 ≤50MB（自动 LRU 淘汰）
