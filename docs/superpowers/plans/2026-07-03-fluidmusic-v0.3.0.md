# FluidMusic v0.3.0 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 FluidMusic 从 IIFE+全局变量的 v0.1.0 升级为 TypeScript+ES Modules+分层架构的 v0.3.0，补全 PRD 缺失功能。

**Architecture:** 方案 A（架构先行）— 先修基础 → TypeScript 核心迁移 → ES Modules + 渲染层 → UI层 + 功能补全 → 扩展 + 个性 → 打磨发布。每 Phase 内独立任务可并行分发 subagent。

**Tech Stack:** TypeScript 5.x, Electron 33, Three.js 0.149 (vendored), Vite 6, Vitest, ESLint 8

## Global Constraints

- 每文件 ≤500 行（拆大文件）
- `.js` 和 `.ts` 长期共存，新代码必须 `.ts`
- `src/types/` 零依赖；`src/core/` 只依赖 types；层级单向依赖
- 保持 `contextIsolation: true, nodeIntegration: false, sandbox: true`
- 现有 35 个测试必须持续通过
- 每次 commit 保持可工作状态

## File Structure Overview

```
Created:
  src/types/index.ts, track.ts, user.ts, settings.ts, audio.ts, events.ts
  src/core/event-bus.ts, app-store.ts, error-handler.ts, request-queue.ts
  src/core/data-cache.ts (重写, IndexedDB)
  src/ui/bubble-chamber/*.ts (拆分)
  src/ui/diy-settings/*.ts (拆分)
  src/styles/*.css (从 index.html 提取)
  src/app.ts (编排入口)
  desktop/lyric-window.ts
  public/lyric.html, public/mini-player.html
  tests/unit/event-bus.test.ts, app-store.test.ts, error-handler.test.ts, request-queue.test.ts
  tsconfig.json

Modified:
  src/core/audio-engine.ts (迁移), api-bridge.ts (迁移)
  src/renderer/*.ts (迁移)
  src/platform/i18n.ts, favorites.ts, lastfm.ts, custom-playlists.ts (迁移)
  public/index.html (精简为骨架)
  package.json (scripts + deps)
  vite.config.js (指向 src/)
  desktop/main.ts (迁移 + 新窗口管理)
  desktop/preload.ts (迁移)

Deleted (after migration verified):
  public/js/*.js (逐文件由 .ts 替换后删除)
```

---

## Phase 1: 基础加固 (Week 1-2)

### Task 1.1: 修复 ESLint 5 个 error

**Files:** `public/js/app.js`, `public/js/audio-engine.js`, `public/js/bubble-chamber.js`

**Description:** 修复 `no-inner-declarations` errors — 将 block 内的函数声明移到 block 外。不改变任何逻辑。

- [ ] **Step 1: 修复 app.js:226 和 :232** — 将 `onDrag` 和 `onDragEnd` 函数声明移到 `if` block 之外，改为在 block 内赋值

```js
// 修改前 (line 222-233):
function setupWindowDrag() {
  // ...
  header.addEventListener('mousedown', (e) => {
    // ...
    function onDrag(e) { /* ... */ }        // ← error
    function onDragEnd(e) { /* ... */ }      // ← error
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', onDragEnd);
  });
}

// 修改后:
function setupWindowDrag() {
  header.addEventListener('mousedown', (e) => {
    const startX = e.clientX, startY = e.clientY;
    const onDrag = (ev) => { /* ... same body ... */ };
    const onDragEnd = (ev) => {
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('mouseup', onDragEnd);
      /* ... same body ... */
    };
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', onDragEnd);
  });
}
```

- [ ] **Step 2: 修复 audio-engine.js:309** — 将 `onEndedHandler` 改为箭头函数赋值

- [ ] **Step 3: 修复 bubble-chamber.js:101 和 :150** — 同样改为箭头函数赋值

- [ ] **Step 4: 运行 lint 确认 errors=0**

```bash
npm run lint 2>&1 | grep "error"
# Expected: no output (only warnings remain)
```

- [ ] **Step 5: Commit**

```bash
git add public/js/app.js public/js/audio-engine.js public/js/bubble-chamber.js
git commit -m "fix: resolve all ESLint no-inner-declarations errors"
```

### Task 1.2: 补齐核心模块单元测试

**Files:**
- Create: `tests/unit/event-bus.test.js`, `tests/unit/data-cache-ttl.test.js`, `tests/unit/api-bridge.test.js`

**Parallel:** Yes — 3 test files are independent

- [ ] **Step 1: 创建 event-bus.test.js** — 测试 EventBus 的 on/emit/once/off 基本功能

```js
// tests/unit/event-bus.test.js
// Note: EventBus 尚未创建，先用接口约定写测试，后续 Phase 2 实现
describe('EventBus (interface contract)', () => {
  it('should register listener and receive events');
  it('should return unsubscribe function from on()');
  it('should support once() that fires only one time');
  it('should not deliver to unsubscribed listeners');
  it('should handle events with no listeners gracefully');
});
```

- [ ] **Step 2: 创建 data-cache-ttl.test.js** — 测试缓存过期逻辑

```js
// tests/unit/data-cache-ttl.test.js
describe('DataCache TTL', () => {
  it('should return cached value before TTL expires');
  it('should return null after TTL expires');
  it('should use 25min TTL for QQ song URLs');
  it('should use 2h TTL for Netease song URLs');
  it('should use 6h TTL for playlist metadata');
  it('should call fetcher on cache miss');
  it('should not call fetcher on cache hit');
});
```

- [ ] **Step 3: 创建 api-bridge.test.js** — 测试 API 参数构建和响应解析

```js
// tests/unit/api-bridge.test.js
describe('ApiBridge', () => {
  it('should build correct search URL for netease');
  it('should build correct search URL for QQ');
  it('should parse netease search response correctly');
  it('should parse QQ search response correctly');
  it('should handle empty search results');
  it('should handle network error gracefully');
});
```

- [ ] **Step 4: 运行测试确认新增测试可运行（即使部分 skip）**

```bash
npm test
# Expected: 35 existing pass + new tests (some may skip pending implementation)
```

- [ ] **Step 5: Commit**

```bash
git add tests/unit/
git commit -m "test: add contract tests for EventBus, DataCache TTL, ApiBridge"
```

### Task 1.3: 清理大文件 — 提取 CSS 到独立文件

**Files:**
- Create: `public/styles/variables.css`, `public/styles/base.css`, `public/styles/layout.css`, `public/styles/components.css`, `public/styles/animations.css`
- Modify: `public/index.html`

**Description:** 从 `index.html` 的 `<style>` 标签提取 CSS 到 5 个文件，HTML 只保留 `<link>` 引用。不改 CSS 内容。

- [ ] **Step 1: 提取 CSS 自定义属性 → `public/styles/variables.css`**

从 `index.html` 的 `:root { ... }` 和 CSS 变量声明中提取

- [ ] **Step 2: 提取基础样式 → `public/styles/base.css`**

提取 reset、body、typography 基础规则

- [ ] **Step 3: 提取布局样式 → `public/styles/layout.css`**

提取 Z-layer 布局、chamber 定位、grid/flex 布局

- [ ] **Step 4: 提取组件样式 → `public/styles/components.css`**

提取按钮、进度条、bubble chamber、DIY 弹窗等组件样式

- [ ] **Step 5: 提取动画样式 → `public/styles/animations.css`**

提取 `@keyframes`、`cubic-bezier` 动画定义

- [ ] **Step 6: 更新 `index.html`** — 删除 `<style>` 块，添加 `<link>` 引用

```html
<link rel="stylesheet" href="styles/variables.css">
<link rel="stylesheet" href="styles/base.css">
<link rel="stylesheet" href="styles/layout.css">
<link rel="stylesheet" href="styles/components.css">
<link rel="stylesheet" href="styles/animations.css">
```

- [ ] **Step 7: 验证** — 启动应用确认视觉无变化

```bash
npm start
# Visual check: UI looks identical
```

- [ ] **Step 8: Commit**

```bash
git add public/styles/ public/index.html
git commit -m "refactor: extract CSS from index.html into 5 modular stylesheets"
```

---

## Phase 2: TypeScript 核心迁移 (Week 3-4)

### Task 2.0: TypeScript 基础设施

**Files:**
- Create: `tsconfig.json`
- Modify: `package.json`, `vite.config.js`

**Description:** 配置 TypeScript 编译环境，允许 `.js` 和 `.ts` 共存。

- [ ] **Step 1: 安装 TypeScript**

```bash
npm install --save-dev typescript @types/node
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2021", "DOM", "DOM.Iterable"],
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "allowJs": true,
    "checkJs": false,
    "jsx": "preserve",
    "outDir": "./dist-ts",
    "rootDir": ".",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "public/js/**/*.js"],
  "exclude": ["node_modules", "dist", "dist-renderer", "public/vendor"]
}
```

- [ ] **Step 3: 更新 vite.config.js** — 添加对 `src/` 的处理

```js
// 添加 resolve.alias
resolve: {
  alias: {
    '@': resolve(__dirname, 'src'),
  },
},
```

- [ ] **Step 4: 更新 package.json scripts**

```json
"typecheck": "tsc --noEmit",
"lint": "ESLINT_USE_FLAT_CONFIG=false eslint src/ public/js/ --ext .js,.ts --max-warnings 50"
```

- [ ] **Step 5: 验证**

```bash
npx tsc --noEmit  # Should have 0 errors (only .ts in src/, currently empty)
npm test           # Existing tests still pass
```

- [ ] **Step 6: Commit**

```bash
git add tsconfig.json package.json vite.config.js
git commit -m "chore: add TypeScript infrastructure (allowJs, strict mode)"
```

### Task 2.1: 类型定义层 `src/types/`

**Files:**
- Create: `src/types/track.ts`, `src/types/user.ts`, `src/types/settings.ts`, `src/types/audio.ts`, `src/types/events.ts`, `src/types/index.ts`

**Parallel:** Yes — 6 files are independent, can be written in parallel

- [ ] **Step 1: 创建 `src/types/track.ts`**

```ts
export interface Track {
  id: string;
  name: string;
  artist: string;
  album?: string;
  coverUrl?: string;
  duration: number;          // seconds
  platform: 'netease' | 'qq' | 'local';
  url?: string;              // streaming URL (may expire)
  lyric?: string;            // raw LRC text
}

export interface Playlist {
  id: string;
  name: string;
  coverUrl?: string;
  trackCount: number;
  platform: 'netease' | 'qq' | 'local';
  tracks?: Track[];
  userId?: string;
  description?: string;
}

export interface SearchResult {
  tracks: Track[];
  total: number;
  hasMore: boolean;
}
```

- [ ] **Step 2: 创建 `src/types/user.ts`**

```ts
export interface UserProfile {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  platform: 'netease' | 'qq';
  vipType?: number;
  followCount?: number;
  fanCount?: number;
  playlistCount?: number;
}

export interface LoginState {
  platform: 'netease' | 'qq';
  isLoggedIn: boolean;
  profile: UserProfile | null;
  cookie: string;
}
```

- [ ] **Step 3: 创建 `src/types/settings.ts`**

```ts
export interface ParticleSettings {
  resolution: number;        // 60-200, default 118
  scatterStrength: number;   // 0-1
  sensitivity: number;       // 0-1
  rotationSpeed: number;     // 0-2
  colorScheme: 'warm' | 'cool' | 'original' | 'custom';
  particleSize: number;      // 1-4, default 2
}

export interface FoamSettings {
  count: number;             // 20-150
  size: number;              // 0.5-3
  iridescence: number;       // 0-1
  floatAmplitude: number;    // 0-1
  paletteId: number;         // 0-5
}

export interface LyricsSettings {
  visibleLines: number;      // 0-40, default 0 = all
  fontSize: number;          // 12-24
  textColor: string;
  highlightColor: string;
  fadeIntensity: number;     // 0-1
}

// ... playlist, spectrum, controller, fluidBg, chambers, system
export interface DIYSettings {
  particle: ParticleSettings;
  foam: FoamSettings;
  lyrics: LyricsSettings;
  playlist: PlaylistSettings;
  spectrum: SpectrumSettings;
  controller: ControllerSettings;
  fluidBg: FluidBgSettings;
  chambers: ChamberSettings;
  system: SystemSettings;
}
```

- [ ] **Step 4: 创建 `src/types/audio.ts`**

```ts
export interface AudioBands {
  bass: number;    // 20-250Hz, 0-1
  mid: number;     // 250-4kHz, 0-1
  treble: number;  // 4k-20kHz, 0-1
  energy: number;  // overall 0-1
}

export type EQPresetName = 'flat' | 'pop' | 'rock' | 'jazz' | 'classical' | 'bass' | 'vocal';

export type PlayMode = 'sequential' | 'random' | 'single';
```

- [ ] **Step 5: 创建 `src/types/events.ts`**

```ts
export const EventNames = {
  TRACK_CHANGE: 'track:change',
  TRACK_LIKE: 'track:like',
  PLAYBACK_STATE: 'playback:state',
  PLAYBACK_PROGRESS: 'playback:progress',
  LOGIN_COMPLETE: 'login:complete',
  LOGIN_LOGOUT: 'login:logout',
  SETTINGS_CHANGE: 'settings:change',
  SEARCH_OPEN: 'search:open',
  ERROR_SHOW: 'error:show',
} as const;

export type EventName = typeof EventNames[keyof typeof EventNames];
```

- [ ] **Step 6: 创建 `src/types/index.ts`** — 统一导出

```ts
export * from './track';
export * from './user';
export * from './settings';
export * from './audio';
export * from './events';
```

- [ ] **Step 7: 验证**

```bash
npx tsc --noEmit  # Should pass with no errors
```

- [ ] **Step 8: Commit**

```bash
git add src/types/
git commit -m "feat: define core type layer (Track, Playlist, Settings, Audio, Events)"
```

### Task 2.2: EventBus 实现

**Files:**
- Create: `src/core/event-bus.ts`
- Create: `tests/unit/event-bus.test.ts`

**Interfaces:**
- Produces: `EventBus` class with `on(name, fn): ()=>void`, `emit(name, data?)`, `once(name, fn)`, `off(name, fn)`, `removeAll()`

- [ ] **Step 1: 编写测试**

```ts
// tests/unit/event-bus.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../src/core/event-bus';

describe('EventBus', () => {
  it('should register listener and receive events', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on('test', handler);
    bus.emit('test', { value: 42 });
    expect(handler).toHaveBeenCalledWith({ value: 42 });
  });

  it('should return unsubscribe function', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const unsub = bus.on('test', handler);
    unsub();
    bus.emit('test');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should support once()', () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.once('test', handler);
    bus.emit('test');
    bus.emit('test');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should handle no listeners gracefully', () => {
    const bus = new EventBus();
    expect(() => bus.emit('nonexistent')).not.toThrow();
  });

  it('should support multiple listeners for same event', () => {
    const bus = new EventBus();
    const h1 = vi.fn(), h2 = vi.fn();
    bus.on('test', h1);
    bus.on('test', h2);
    bus.emit('test');
    expect(h1).toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx vitest run tests/unit/event-bus.test.ts
# Expected: FAIL — module not found
```

- [ ] **Step 3: 实现 EventBus**

```ts
// src/core/event-bus.ts
type EventHandler = (...args: any[]) => void;

export class EventBus {
  private listeners = new Map<string, Set<EventHandler>>();

  on(event: string, handler: EventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  once(event: string, handler: EventHandler): void {
    const wrapper = (...args: any[]) => {
      this.off(event, wrapper);
      handler(...args);
    };
    this.on(event, wrapper);
  }

  off(event: string, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  emit(event: string, data?: any): void {
    this.listeners.get(event)?.forEach(handler => {
      try { handler(data); } catch (e) { console.error('[EventBus]', event, e); }
    });
  }

  removeAll(): void {
    this.listeners.clear();
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx vitest run tests/unit/event-bus.test.ts
# Expected: 5/5 PASS
```

- [ ] **Step 5: Commit**

```bash
git add src/core/event-bus.ts tests/unit/event-bus.test.ts
git commit -m "feat: implement EventBus with on/once/emit/off"
```

### Task 2.3: ErrorHandler 实现

**Files:**
- Create: `src/core/error-handler.ts`
- Create: `tests/unit/error-handler.test.ts`

**Parallel with Task 2.2:** Yes

- [ ] **Step 1: 实现 ErrorHandler**

```ts
// src/core/error-handler.ts
export type ErrorSeverity = 'toast' | 'modal' | 'silent';

export interface AppError {
  code: string;
  message: string;
  severity: ErrorSeverity;
  recoverable: boolean;
  retry?: () => Promise<void>;
}

type ErrorListener = (error: AppError) => void;

export class ErrorHandler {
  private static listeners = new Set<ErrorListener>();

  static handle(error: AppError): void {
    console.error(`[${error.code}]`, error.message);
    this.listeners.forEach(fn => {
      try { fn(error); } catch (e) { /* swallow */ }
    });
  }

  static onError(fn: ErrorListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  static wrapAsync<T>(code: string, fn: () => Promise<T>, message?: string): Promise<T | null> {
    return fn().catch(e => {
      this.handle({
        code,
        message: message || e?.message || 'Unknown error',
        severity: 'toast',
        recoverable: true,
      });
      return null;
    });
  }
}
```

- [ ] **Step 2: 编写测试 + 验证**

```ts
// tests/unit/error-handler.test.ts
import { describe, it, expect, vi } from 'vitest';
import { ErrorHandler, AppError } from '../../src/core/error-handler';

describe('ErrorHandler', () => {
  it('should notify registered listeners', () => {
    const listener = vi.fn();
    ErrorHandler.onError(listener);
    const error: AppError = { code: 'TEST', message: 'test error', severity: 'toast', recoverable: false };
    ErrorHandler.handle(error);
    expect(listener).toHaveBeenCalledWith(error);
  });

  it('wrapAsync should catch and report errors', async () => {
    const listener = vi.fn();
    const unsub = ErrorHandler.onError(listener);
    const result = await ErrorHandler.wrapAsync('TEST', () => Promise.reject(new Error('boom')));
    expect(result).toBeNull();
    expect(listener).toHaveBeenCalled();
    unsub();
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add src/core/error-handler.ts tests/unit/error-handler.test.ts
git commit -m "feat: implement ErrorHandler with toast/modal/silent severity levels"
```

### Task 2.4: AppStore 实现

**Files:**
- Create: `src/core/app-store.ts`
- Create: `tests/unit/app-store.test.ts`

**Depends on:** Task 2.2 (EventBus), Task 2.1 (types)

- [ ] **Step 1: 实现 AppStore（精简版——先支持 player 和 ui slice）**

```ts
// src/core/app-store.ts
import { Track, PlayMode } from '../types/track';
import { UserProfile } from '../types/user';
import { DIYSettings } from '../types/settings';
import { EventBus } from './event-bus';
import { EventNames } from '../types/events';

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  progress: number;
  volume: number;
  mode: PlayMode;
}

interface UIState {
  activeOverlay: 'settings' | 'user' | 'search' | null;
  pinnedChambers: { left: boolean; right: boolean; top: boolean };
}

interface UserState {
  netease: UserProfile | null;
  qq: UserProfile | null;
}

export interface AppState {
  player: PlayerState;
  ui: UIState;
  user: UserState;
  settings: DIYSettings | null;
}

type StateListener = (state: AppState) => void;

const DEFAULT_PLAYER: PlayerState = {
  currentTrack: null, queue: [], queueIndex: -1,
  isPlaying: false, progress: 0, volume: 0.8, mode: 'sequential',
};

const DEFAULT_UI: UIState = {
  activeOverlay: null,
  pinnedChambers: { left: false, right: false, top: true },
};

const DEFAULT_USER: UserState = { netease: null, qq: null };

export class AppStore {
  private state: AppState;
  private listeners = new Set<StateListener>();

  constructor(private bus: EventBus) {
    this.state = {
      player: { ...DEFAULT_PLAYER },
      ui: { ...DEFAULT_UI },
      user: { ...DEFAULT_USER },
      settings: null,
    };
  }

  getState(): Readonly<AppState> { return this.state; }

  subscribe(fn: StateListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setState(partial: Partial<AppState>): void {
    Object.assign(this.state, partial);
    this.listeners.forEach(fn => fn(this.state));
  }

  // Player actions
  playTrack(track: Track): void {
    this.state.player.currentTrack = track;
    this.state.player.isPlaying = true;
    this.state.player.progress = 0;
    this.notify();
    this.bus.emit(EventNames.TRACK_CHANGE, track);
  }

  setPlaying(playing: boolean): void {
    this.state.player.isPlaying = playing;
    this.notify();
    this.bus.emit(EventNames.PLAYBACK_STATE, { playing });
  }

  setProgress(progress: number): void {
    this.state.player.progress = progress;
    this.notify();
  }

  setVolume(volume: number): void {
    this.state.player.volume = Math.max(0, Math.min(1, volume));
    this.notify();
  }

  setMode(mode: PlayMode): void {
    this.state.player.mode = mode;
    this.notify();
  }

  // UI actions
  setOverlay(overlay: UIState['activeOverlay']): void {
    this.state.ui.activeOverlay = overlay;
    this.notify();
  }

  toggleChamber(chamber: 'left' | 'right' | 'top'): void {
    this.state.ui.pinnedChambers[chamber] = !this.state.ui.pinnedChambers[chamber];
    this.notify();
  }

  // User actions
  setUser(platform: 'netease' | 'qq', profile: UserProfile | null): void {
    this.state.user[platform] = profile;
    this.notify();
    if (profile) this.bus.emit(EventNames.LOGIN_COMPLETE, { platform, profile });
    else this.bus.emit(EventNames.LOGIN_LOGOUT, { platform });
  }

  // Settings
  updateSettings(settings: DIYSettings): void {
    this.state.settings = settings;
    this.notify();
    this.bus.emit(EventNames.SETTINGS_CHANGE, settings);
  }

  private notify(): void {
    this.listeners.forEach(fn => fn(this.state));
  }
}
```

- [ ] **Step 2: 编写测试**

```ts
// tests/unit/app-store.test.ts
describe('AppStore', () => {
  it('should start with default player state');
  it('should update isPlaying on setPlaying()');
  it('should emit TRACK_CHANGE on playTrack()');
  it('should clamp volume to [0,1]');
  it('should toggle chamber pin state');
  it('should allow subscribers to receive state updates');
});
```

- [ ] **Step 3: 验证 + Commit**

### Task 2.5: DataCache 重写 (localStorage → IndexedDB)

**Files:**
- Create: `src/core/data-cache.ts`
- Create: `tests/unit/data-cache.test.ts`

**Depends on:** Task 2.1 (types)

- [ ] **Step 1: 实现 IndexedDB 封装**

```ts
// src/core/data-cache.ts
interface CacheEntry<T> {
  value: T;
  expiresAt: number;  // timestamp, 0 = never expires
}

const DB_NAME = 'fluidmusic-cache';
const DB_VERSION = 1;

export class DataCache {
  private db: IDBDatabase | null = null;

  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        ['playlists', 'songs', 'urls', 'lyrics', 'search', 'profiles'].forEach(name => {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name);
          }
        });
      };
      req.onsuccess = () => { this.db = req.result; resolve(); };
      req.onerror = () => reject(req.error);
    });
  }

  async get<T>(store: string, key: string): Promise<T | null> {
    if (!this.db) await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => {
        const entry = req.result as CacheEntry<T> | undefined;
        if (!entry) { resolve(null); return; }
        if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
          this.delete(store, key);  // async cleanup, don't await
          resolve(null);
          return;
        }
        resolve(entry.value);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async set<T>(store: string, key: string, value: T, ttlMs?: number): Promise<void> {
    if (!this.db) await this.open();
    const entry: CacheEntry<T> = {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : 0,
    };
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(store, 'readwrite');
      tx.objectStore(store).put(entry, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getOrFetch<T>(store: string, key: string, fetcher: () => Promise<T>, ttlMs: number): Promise<T> {
    const cached = await this.get<T>(store, key);
    if (cached !== null) return cached;
    const value = await fetcher();
    await this.set(store, key, value, ttlMs);
    return value;
  }

  async delete(store: string, key: string): Promise<void> { /* ... */ }
  async clearStore(store: string): Promise<void> { /* ... */ }
  async clearAll(): Promise<void> { /* ... */ }
}
```

- [ ] **Step 2: 运行测试 + Commit**

---

## Phase 3: ES Modules + 渲染层迁移 (Week 5-6)

### Task 3.1: Vite 接管开发流程

**Files:**
- Modify: `vite.config.js`, `package.json`, `public/index.html`

**Description:** 让 Vite 同时支持开发模式（HMR）和生产构建。Three.js 保持 vendored 全局加载方式（暂不改为 ES import，避免破坏所有渲染模块）。

- [ ] **Step 1: 更新 vite.config.js** — 完整配置

```js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname, '.'),
  publicDir: 'public',
  build: {
    outDir: resolve(__dirname, 'dist-renderer'),
    emptyOutDir: true,
    target: 'chrome130',
    minify: 'terser',
    terserOptions: { compress: { drop_console: false } },
    sourcemap: true,
    rollupOptions: {
      input: resolve(__dirname, 'public/index.html'),
    },
  },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true } },
  },
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
});
```

- [ ] **Step 2: 更新 package.json dev/build scripts**

```json
"dev:renderer": "vite",
"dev:electron": "electron .",
"dev": "concurrently \"npm run dev:renderer\" \"wait-on http://127.0.0.1:5173 && npm run dev:electron\"",
```

- [ ] **Step 3: 验证 Vite build 成功**

```bash
npm run build:renderer
# Expected: dist-renderer/ 包含构建产物
```

- [ ] **Step 4: Commit**

### Task 3.2: 迁移 audio-engine 到 TypeScript

**Files:**
- Create: `src/core/audio-engine.ts`
- Keep (as fallback): `public/js/audio-engine.js` (until verified)

**Depends on:** Task 2.1 (types), Task 2.4 (AppStore)

- [ ] **Step 1: 编写类型化 AudioEngine 类**

```ts
// src/core/audio-engine.ts
import { AudioBands, EQPresetName, PlayMode } from '../types/audio';
import { Track } from '../types/track';
import { AppStore } from './app-store';

const BASS_RANGE = [20, 250], MID_RANGE = [250, 4000], TREBLE_RANGE = [4000, 20000];

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private audio: HTMLAudioElement | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private gain: GainNode | null = null;
  private eqNodes: BiquadFilterNode[] = [];
  private freqData: Uint8Array | null = null;
  private _bands: AudioBands = { bass: 0, mid: 0, treble: 0, energy: 0 };
  private _smoothedBands = { ...this._bands };
  private _smoothing = 0.35;

  constructor(private store: AppStore) {}

  get bands(): AudioBands { return this._smoothedBands; }

  async init(): Promise<void> {
    this.ctx = new AudioContext();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

    this.gain = this.ctx.createGain();
    this.gain.connect(this.ctx.destination);
  }

  async loadTrack(url: string): Promise<void> { /* ... same logic, type-safe ... */ }
  async play(): Promise<void> { /* ... */ }
  pause(): void { /* ... */ }
  getSpectrum(): AudioBands { /* ... compute from freqData ... */ }
  setVolume(v: number): void { /* ... */ }
  dispose(): void { /* cleanup audio + source + ctx ... */ }
}
```

- [ ] **Step 2-4: 测试 + 验证 + Commit**

### Task 3.3: 迁移 api-bridge 到 TypeScript

**Files:** Create `src/core/api-bridge.ts`, `tests/unit/api-bridge.test.ts`

**Parallel with Task 3.2:** Yes

### Task 3.4: 迁移渲染层 (逐个模块)

**Files to migrate (can be parallelized):**
- `src/renderer/renderer-manager.ts` (from `public/js/renderer-manager.js`)
- `src/renderer/fluid-bg.ts` (from `public/js/fluid-bg.js`)
- `src/renderer/particle-cover.ts` (from `public/js/particle-cover.js`)
- `src/renderer/foam-system.ts` (from `public/js/foam-system.js`)
- `src/renderer/spectrum-3d.ts` (from `public/js/spectrum-3d.js`)

**Pattern for each module:**
1. 保持现有功能不变
2. 用 `import` 替代 `window.X` 全局访问
3. 导出类/接口
4. 通过 `ModuleRegistry` 获取依赖
5. 每个模块 ≤500 行

**Parallel dispatch:** 5 agents 并行迁移，每个负责 1 个模块

### Task 3.5: 迁移泡沫均衡器和平台模块

**Parallel dispatch:** 3 agents 并行
- Agent A: `src/renderer/foam-equalizer.ts` + OffscreenCanvas 改造
- Agent B: `src/platform/i18n.ts` + `src/platform/favorites.ts`
- Agent C: `src/platform/lastfm.ts` + `src/platform/custom-playlists.ts`

---

## Phase 4: UI层 + 功能补全 (Week 7-8)

### Task 4.1: 拆分 bubble-chamber

**Files:**
- Create: `src/ui/bubble-chamber/index.ts`, `chamber-base.ts`, `playlist-chamber.ts`, `lyric-chamber.ts`, `queue-chamber.ts`, `controller.ts`

**Description:** 将 1191 行的 `bubble-chamber.js` 拆分为 6 个文件，每个 ≤250 行。

- [ ] `chamber-base.ts` — 仓的通用行为：hover检测、pin/取消、弹簧动画触发
- [ ] `playlist-chamber.ts` — 左仓：歌单列表渲染、虚拟滚动
- [ ] `lyric-chamber.ts` — 右仓：歌词解析、LRC timestamp、二分查找
- [ ] `queue-chamber.ts` — 上仓：3D队列排列、Dock放大效果
- [ ] `controller.ts` — 下仓：播放控制按钮、进度条、音量
- [ ] `index.ts` — 编排：初始化4个仓 + 事件连线

### Task 4.2: 拆分 diy-settings + 补齐 9 Tab

**Files:**
- Create: `src/ui/diy-settings/index.ts` + `tabs/particle.ts`, `tabs/foam.ts`, `tabs/lyrics.ts`, `tabs/playlist.ts`, `tabs/spectrum.ts`, `tabs/controller.ts`, `tabs/fluidbg.ts`, `tabs/chambers.ts`, `tabs/system.ts`

**Parallel:** 9 Tab 文件可分配给 3 个 agent（每人 3 个 Tab）

### Task 4.3: 功能补全 — 桌面歌词窗口

**Files:**
- Create: `desktop/lyric-window.ts`, `public/lyric.html`

**Depends on:** Phase 3 完成（Vite 可用）

- [ ] **Step 1: 创建 lyric-window.ts**

```ts
// desktop/lyric-window.ts
import { BrowserWindow } from 'electron';
import path from 'path';

export function createLyricWindow(parent: BrowserWindow): BrowserWindow {
  const win = new BrowserWindow({
    width: 800, height: 120,
    frame: false, transparent: true, alwaysOnTop: true,
    resizable: true,
    parent,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
    },
  });
  win.loadFile(path.join(__dirname, '../public/lyric.html'));
  win.setVisibleOnAllWorkspaces(true);
  return win;
}
```

- [ ] **Step 2: 创建 lyric.html** — 极简页面，仅双行歌词 + CSS mask-image 淡化

### Task 4.4: 功能补全 — 迷你播放器

**Files:** Create `public/mini-player.html`

### Task 4.5: 功能补全 — Now Playing (Media Session API)

**Files:** Modify `src/core/audio-engine.ts` (添加 `updateMediaSession`)

```ts
function updateMediaSession(track: Track): void {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.name,
    artist: track.artist,
    album: track.album || '',
    artwork: track.coverUrl ? [{ src: track.coverUrl, sizes: '300x300', type: 'image/jpeg' }] : [],
  });
  navigator.mediaSession.setActionHandler('play', () => this.play());
  navigator.mediaSession.setActionHandler('pause', () => this.pause());
  navigator.mediaSession.setActionHandler('previoustrack', () => this.previous());
  navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
}
```

---

## Phase 5: 扩展 + 个性化 (Week 9-10)

### Task 5.1: 可视化预设 API

**Files:** Create `src/renderer/visualizer-registry.ts`

```ts
export interface VisualizerPreset {
  id: string; name: string; description: string;
  type: 'webgl' | 'canvas2d';
  init(canvas: HTMLCanvasElement): void;
  tick(dt: number, bands: AudioBands): void;
  render(): void;
  dispose(): void;
}

export class VisualizerRegistry {
  private static presets = new Map<string, VisualizerPreset>();
  static register(preset: VisualizerPreset): void { /* ... */ }
  static list(): VisualizerPreset[] { /* ... */ }
  static activate(id: string): void { /* ... */ }
}
```

### Task 5.2: 主题引擎

**Files:** Create `src/core/theme-manager.ts`

### Task 5.3: 预设系统 (3 个内置预设)

**Files:** Modify `src/ui/diy-settings/index.ts`

### Task 5.4: 配置导入导出

**Files:** Modify `src/ui/diy-settings/tabs/system.ts`

---

## Phase 6: 打磨发布 (Week 11-12)

### Task 6.1: E2E 测试

**Files:** Create `tests/e2e/app-launch.spec.js`, `tests/e2e/playback.spec.js`

### Task 6.2: 代码清理

- 删除旧的 `public/js/*.js` (已被 `.ts` 替代的文件)
- 清理未使用的 import
- ESLint warning 清零
- `npx tsc --noEmit` 零错误

### Task 6.3: 无障碍扫描

- 所有可交互元素添加 `aria-label`
- `<button>` 替代 `<div onclick>`
- `:focus-visible` 焦点环
- VoiceOver 基础测试

### Task 6.4: 打包验证 + 公证

```bash
npm run build
# Verify: dist/*.dmg + dist/*.zip
# Verify: app launches from DMG on clean macOS
```

---

## Parallel Execution Map

```
Phase 1 ────────────────────────────────────────────
  Task 1.1 ──┐
  Task 1.2 ──┤ 可并行 (3 个 agent)
  Task 1.3 ──┘

Phase 2 ────────────────────────────────────────────
  Task 2.0 ──→ 阻塞 (基础设施，必须先完成)
  Task 2.1 ──→ 阻塞 (类型层，所有后续任务依赖)
  Task 2.2 ──┐
  Task 2.3 ──┤ 可并行 (3 个 agent)
  Task 2.5 ──┘
  Task 2.4 ──→ 依赖 Task 2.2

Phase 3 ────────────────────────────────────────────
  Task 3.1 ──→ 阻塞 (Vite 配置先完成)
  Tasks 3.2-3.5 → 8 个迁移任务可分发给 4-6 个 agent 并行

Phase 4 ────────────────────────────────────────────
  Task 4.1 (bubble-chamber) ──→ 独立
  Task 4.2 (diy-settings)   ──→ 独立，与 4.1 并行
  Tasks 4.3-4.5 (功能补全)  ──┐ 3 个功能可并行

Phase 5 ────────────────────────────────────────────
  全部任务可并行分发

Phase 6 ────────────────────────────────────────────
  Task 6.1-6.2 ──→ 顺序执行 (先测试再清理)
  Task 6.3-6.4 ──→ 并行
```

## Verification Checklist (per Phase)

| Phase | Check |
|-------|-------|
| 1 | `npm test` (35+new pass), `npm run lint` (0 errors) |
| 2 | `npx tsc --noEmit` (0 errors), all new tests pass |
| 3 | `npm run build:renderer` 成功, `npm start` Electron 窗口正常 |
| 4 | 桌面歌词可拖拽, 迷你播放器切换正常, Now Playing 在控制中心显示 |
| 5 | 导入/导出主题正常, 9 Tab 全部可用, 预设一键切换 |
| 6 | E2E 通过, DMG 构建成功, VoiceOver 可读 |

---
