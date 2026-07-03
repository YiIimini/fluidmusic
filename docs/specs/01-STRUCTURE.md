# 01 — 结构设计 (Structure)

> 目录组织 · 模块边界 · 依赖关系 · TypeScript 迁移路径

---

## 1. 现状分析

### 1.1 当前目录结构

```
FluidMusic/
├── public/                    # 渲染进程（前端全部内容）
│   ├── index.html             # 1800行单文件 HTML+CSS
│   ├── js/                    # 18个IIFE模块平铺
│   ├── shaders/               # GLSL着色器
│   ├── vendor/three.min.js    # Three.js vendored
│   └── assets/icon.png        # 应用图标
├── desktop/                   # Electron主进程
│   ├── main.js                # 907行
│   ├── preload.js             # 86行
│   ├── menu.js                # 130行
│   ├── cookie-store.js        # 133行
│   └── updater.js             # 112行
├── server.js                  # Express API代理 520行
├── tests/                     # 4个单元测试
└── build/                     # macOS构建资源
```

### 1.2 核心问题

| 问题 | 严重度 | 说明 |
|------|:---:|------|
| 18文件平铺 `public/js/` | 🔴 | 无分层，依赖关系由 `<script>` 加载顺序隐含 |
| `app.js` 1647行 | 🔴 | 混合初始化、渲染循环、事件处理、键盘、启动 |
| `bubble-chamber.js` 1191行 | 🟡 | 4个Chamber逻辑 + 播放列表 + 歌词全在一个文件 |
| `index.html` 1800行 | 🟡 | CSS全在一个文件，样式散落各处 |
| IIFE + `window.X` 全局 | 🔴 | 15+全局变量污染，无tree-shaking |
| 无类型定义 | 🟡 | `typeof X !== 'undefined'` 满屏守卫 |
| `module-registry.js` 半成品 | 🟡 | DI容器已创建但仅部分模块使用 |

---

## 2. 目标状态

### 2.1 目标目录结构

```
FluidMusic/
├── src/                       # 渲染进程源码（新）
│   ├── app.ts                 # 编排入口（≤300行）
│   ├── types/                 # ═══ 零依赖层 ═══
│   │   ├── index.ts           #   统一导出
│   │   ├── track.ts           #   Track, Playlist, Album
│   │   ├── user.ts            #   UserProfile, LoginState
│   │   ├── settings.ts        #   DIY设置完整类型
│   │   ├── audio.ts           #   AudioBand, EQPreset
│   │   └── events.ts          #   EventBus事件类型枚举
│   ├── core/                  # ═══ 核心引擎层 ═══
│   │   ├── audio-engine.ts    #   Web Audio API封装（≤300行）
│   │   ├── api-bridge.ts      #   平台API桥接（≤250行）
│   │   ├── data-cache.ts      #   IndexedDB缓存层（≤200行）
│   │   ├── event-bus.ts       #   事件总线（≤80行）
│   │   └── app-store.ts       #   集中状态管理（≤200行）
│   ├── renderer/              # ═══ 渲染层 ═══
│   │   ├── renderer-manager.ts #   统一WebGL管理（≤200行）
│   │   ├── fluid-bg.ts        #   流体背景（≤200行）
│   │   ├── particle-cover.ts  #   粒子封面（≤400行）
│   │   ├── foam-system.ts     #   泡沫系统（≤300行）
│   │   ├── foam-equalizer.ts  #   Canvas 2D均衡器（≤400行）
│   │   └── spectrum-3d.ts     #   3D频谱（≤250行）
│   ├── ui/                    # ═══ UI层 ═══
│   │   ├── bubble-chamber/    #   气泡仓（拆分为子模块）
│   │   │   ├── index.ts       #     编排（≤150行）
│   │   │   ├── chamber-base.ts #    基础仓行为（≤150行）
│   │   │   ├── playlist-chamber.ts # 歌单仓（≤250行）
│   │   │   ├── lyric-chamber.ts #    歌词仓（≤250行）
│   │   │   ├── queue-chamber.ts #    队列仓（≤200行）
│   │   │   └── controller.ts  #     底部控制器（≤200行）
│   │   ├── search.ts          #   搜索（≤250行）
│   │   ├── user-panel.ts      #   用户面板（≤250行）
│   │   └── diy-settings/      #   DIY设置（拆分为子模块）
│   │       ├── index.ts
│   │       └── tabs/          #     每个Tab独立文件
│   ├── platform/              # ═══ 平台功能层 ═══
│   │   ├── i18n.ts            #   国际化
│   │   ├── favorites.ts       #   收藏管理
│   │   ├── lastfm.ts          #   Last.fm
│   │   └── custom-playlists.ts #  自定义歌单
│   └── styles/                # ═══ 样式层 ═══
│       ├── variables.css      #   CSS自定义属性
│       ├── base.css           #   基础重置+排版
│       ├── layout.css         #   Z层布局+Grid
│       ├── components.css     #   组件样式
│       ├── animations.css     #   弹簧动画+贝塞尔
│       └── themes/            #   主题变体
├── desktop/                   # Electron主进程（保持）
│   ├── main.ts
│   ├── preload.ts
│   ├── menu.ts
│   ├── cookie-store.ts
│   └── updater.ts
├── server.ts                  # Express API代理（保持）
├── public/                    # 静态资源
│   ├── shaders/               # GLSL着色器（保持）
│   └── assets/                # 图标、字体等
├── tests/                     # 测试
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── build/                     # 构建资源
```

### 2.2 模块边界规则

1. **`types/`** — 零依赖，可被所有层 import
2. **`core/`** — 只依赖 `types/`，不依赖 `renderer/` `ui/` `platform/`
3. **`renderer/`** — 依赖 `types/` + `core/`，不依赖 `ui/`
4. **`ui/`** — 依赖 `types/` + `core/` + `renderer/`，不反向
5. **`platform/`** — 依赖 `types/` + `core/`，独立于 `ui/`
6. **`app.ts`** — 编排层，依赖所有层

### 2.3 依赖注入规范

```ts
// 模块注册（app.ts 初始化时）
ModuleRegistry.register('audioEngine', [], () => new AudioEngine());
ModuleRegistry.register('eventBus', [], () => new EventBus());
ModuleRegistry.register('appStore', ['eventBus'], (bus) => new AppStore(bus));
ModuleRegistry.register('particleCover', ['rendererManager', 'appStore'],
  (rm, store) => new ParticleCover(rm, store));

// 模块获取
const audio = ModuleRegistry.get<AudioEngine>('audioEngine');
```

---

## 3. 改造步骤

### Step 1: 创建新目录骨架（不破坏现有代码）
- 创建 `src/types/`、`src/core/`、`src/renderer/`、`src/ui/`、`src/platform/`、`src/styles/`
- 创建 `tsconfig.json`（允许 `.js` 和 `.ts` 共存）
- 配置 Vite 指向新 `src/` 目录

### Step 2: 类型定义层（第1批迁移）
- 从现有代码中提取所有隐式类型，写入 `src/types/`
- 优先定义：`Track`, `Playlist`, `UserProfile`, `DIYSettings`, `AudioBand`
- 验收：`tsc --noEmit` 零错误

### Step 3: 核心引擎层（第2批迁移）
- `event-bus.ts`（新建）
- `data-cache.ts`（从 localStorage → IndexedDB 重写）
- `audio-engine.ts`（迁移+类型化）
- `api-bridge.ts`（迁移+类型化）
- `app-store.ts`（新建）

### Step 4: 渲染层 + UI层（第3-4批迁移）
- 渲染模块逐文件迁移，保持现有功能
- `bubble-chamber.js` 拆分为 5 个子模块
- `diy-settings.js` 拆分为 Tab 子模块
- CSS 从 `index.html` 提取到 `src/styles/`

### Step 5: 编排层
- 新建 `app.ts`（初始化顺序、事件连线）
- 删除旧 `public/js/app.js`
- 更新 `index.html` 使用 Vite 的 `<script type="module" src="...">`

---

## 4. 验收标准

- [ ] `src/` 目录结构符合目标，每文件 ≤500 行
- [ ] `tsc --noEmit` 零错误
- [ ] 所有模块通过 ModuleRegistry 获取依赖，无 `window.X` 直接访问
- [ ] CSS 完全从 HTML 中分离
- [ ] `npm run dev`（Vite + Electron）正常启动
- [ ] `npm run build:renderer` 构建成功
- [ ] 现有 35 个单元测试全部通过
- [ ] `index.html` ≤200 行（仅骨架结构）
