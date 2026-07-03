# 04 — 逻辑设计 (Logic)

> 状态管理 · 事件总线 · 错误处理 · 业务流

---

## 1. 现状分析

### 1.1 状态管理现状

状态散落在各模块内部变量中，通过 `window.X` 全局互访：

```js
// 当前状态分布（部分）
FluidAudio.playing          // app.js、所有渲染模块都读
FluidAudio.bands            // 所有渲染模块每帧读
BubbleChamber._pinnedLeft   // bubble-chamber.js 内部
ApiBridge.loginStates       // api-bridge.js 内部
Favorites.items             // favorites.js 内部
DIYSettings._settings       // diy-settings.js 内部
// 没有单一真相源，没有变更通知机制
```

### 1.2 错误处理现状

```js
// 典型模式 —— 吞错无感知
try {
  const data = await ApiBridge.fetchApi('/api/netease/search', params);
} catch (e) {
  console.warn('search failed', e);  // 用户不知道发生了什么
  return [];                          // 静默返回空
}
```

### 1.3 核心问题

| 问题 | 严重度 |
|------|:---:|
| 无单一状态源，模块间直接读对方的内部变量 | 🔴 |
| 无变更通知 —— 模块不知道状态何时变化 | 🔴 |
| 错误静默吞掉，用户无感知 | 🟡 |
| 播放/登录流程用回调嵌套，难以追踪 | 🟡 |
| `app.js` 中事件处理散落各处 | 🟡 |

---

## 2. 目标状态

### 2.1 AppStore 设计

```ts
// src/core/app-store.ts
interface AppState {
  player: PlayerState;
  user: UserState;
  ui: UIState;
  settings: DIYSettings;
}

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  progress: number;      // 0-1
  volume: number;        // 0-1
  mode: 'sequential' | 'random' | 'single';
}

interface UserState {
  netease: LoginState | null;
  qq: LoginState | null;
}

interface UIState {
  activeOverlay: 'settings' | 'user' | 'search' | null;
  pinnedChambers: { left: boolean; right: boolean; top: boolean };
  theme: 'dark' | 'light';
}
```

**使用模式**：
```ts
// 读取状态
const track = store.state.player.currentTrack;

// 订阅变更
store.on('player:currentTrack', (track) => {
  particleCover.loadImage(track.coverUrl);
  uiManager.updateTrackInfo(track);
});

// 更新状态（唯一入口）
store.dispatch('player:play', track);
```

### 2.2 EventBus 设计

```ts
// src/core/event-bus.ts
type EventName =
  | 'track:change'       // 切歌
  | 'track:like'         // 收藏/取消
  | 'playback:state'     // 播放/暂停
  | 'playback:progress'  // 进度更新（节流）
  | 'login:complete'     // 登录完成
  | 'login:logout'       // 登出
  | 'settings:change'    // 设置变更
  | 'search:open'        // 搜索面板打开
  | 'error:show';        // 显示错误

class EventBus {
  on(event: EventName, handler: Function): () => void;  // 返回取消订阅函数
  emit(event: EventName, data?: any): void;
  once(event: EventName, handler: Function): void;
}
```

### 2.3 ErrorHandler 设计

```ts
// src/core/error-handler.ts
type ErrorSeverity = 'toast' | 'modal' | 'silent';

interface AppError {
  code: string;           // 'NETWORK_ERROR', 'PLAYBACK_FAILED', etc.
  message: string;        // 用户可读消息
  severity: ErrorSeverity;
  recoverable: boolean;   // 是否可自动恢复
  retry?: () => Promise<void>;
}

class ErrorHandler {
  handle(error: AppError): void;
  // toast: 底部通知 3s 消失
  // modal: 弹窗确认
  // silent: 仅日志
}
```

### 2.4 关键业务流程

**播放流程** (async/await 线性化)：
```ts
async function playTrack(track: Track): Promise<void> {
  try {
    store.dispatch('player:loading', true);
    const url = await getPlaybackUrl(track);     // 1. 获取URL（含过期重试）
    await audioEngine.load(url);                 // 2. 加载音频
    await audioEngine.play();                    // 3. 播放
    store.dispatch('player:play', track);        // 4. 更新状态
    eventBus.emit('track:change', track);        // 5. 通知UI
    lastfm.nowPlaying(track);                    // 6. 通知Last.fm
  } catch (e) {
    errorHandler.handle({
      code: 'PLAYBACK_FAILED',
      message: `无法播放: ${track.name}`,
      severity: 'toast',
      recoverable: true,
      retry: () => playTrack(track),
    });
  }
}
```

**登录流程**：
```ts
async function login(platform: 'netease' | 'qq'): Promise<UserProfile> {
  // 统一 Promise 化
  const cookies = await ipc.invoke('fluidmusic-login-platform', platform);
  if (!cookies) throw new AppError('LOGIN_CANCELLED', '登录已取消', 'silent', false);
  const profile = await apiBridge.fetchUserProfile(platform);
  store.dispatch(`user:${platform}:login`, { cookies, profile });
  eventBus.emit('login:complete', { platform, profile });
  return profile;
}
```

---

## 3. 改造步骤

### Step 1: EventBus + ErrorHandler (Phase 2)
- 新建 `src/core/event-bus.ts` 和 `src/core/error-handler.ts`
- 这两个模块零外部依赖，可独立开发测试

### Step 2: AppStore (Phase 2-3)
- 新建 `src/core/app-store.ts`
- 定义完整 `AppState` 类型
- 实现 `dispatch()` + `on()` 订阅机制

### Step 3: 业务流迁移 (Phase 3-4)
- `playTrack()` async/await 线性化
- `login()` Promise 化
- 用 `store.dispatch()` 替代直接修改全局变量
- 用 `eventBus.emit()` 替代模块间直接调用

### Step 4: 错误处理接入 (Phase 4)
- 所有 catch 分支改为 `errorHandler.handle()`
- 添加全局 `window.onerror` + `unhandledrejection` 兜底

---

## 4. 验收标准

- [ ] `AppStore` 是应用状态的唯一修改入口
- [ ] 所有跨模块通信通过 `EventBus`（不直接调用对方方法）
- [ ] 所有面向用户的错误通过 `ErrorHandler` 展示
- [ ] 播放/登录流程 async/await 线性化且可追踪
- [ ] 无模块直接读写其他模块的内部变量
- [ ] `AppStore` 每个 slice 有对应的单元测试
