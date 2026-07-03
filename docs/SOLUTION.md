# FluidMusic macOS 优化解决方案

> 基于综合分析报告 (ANALYSIS.md) 制定的具体实施方案

---

## 目录

1. [Bug 修复方案](#1-bug-修复方案)
2. [macOS 原生集成方案](#2-macos-原生集成方案)
3. [性能优化方案](#3-性能优化方案)
4. [代码架构升级方案](#4-代码架构升级方案)
5. [安全加固方案](#5-安全加固方案)
6. [实施路线图](#6-实施路线图)

---

## 1. Bug 修复方案

### 1.1 Audio Element 内存泄漏修复

**问题：** 曲目切换时旧 Audio 元素未彻底清理

**方案：**

```js
// audio-engine.js — createAudioElement() 替换
function createAudioElement(url) {
  // 1. 彻底销毁旧元素
  if (FluidAudio.audio) {
    FluidAudio.audio.pause();
    FluidAudio.audio.removeAttribute('src');
    // 移除所有事件监听器
    FluidAudio.audio.oncanplay = null;
    FluidAudio.audio.onplay = null;
    FluidAudio.audio.onpause = null;
    FluidAudio.audio.onended = null;
    FluidAudio.audio.ontimeupdate = null;
    FluidAudio.audio.onerror = null;
    FluidAudio.audio.load();  // 触发 GC 回收
    FluidAudio.audio = null;
  }

  // 2. 断开旧 MediaElementSource
  if (FluidAudio.source) {
    try { FluidAudio.source.disconnect(); } catch(e) {}
    FluidAudio.source = null;
  }

  // 3. 创建新元素（原有逻辑）
  const audio = new Audio();
  // ... 其余不变
}
```

**影响文件：** `public/js/audio-engine.js` — 17 行变更  
**验证方式：** Chrome DevTools → Performance Monitor → JS Heap Size，播放 100+ 曲目观察内存趋势

---

### 1.2 WebGL 上下文合并

**问题：** 4 个独立 WebGLRenderer 占用过量 GPU 资源

**方案：合并为单一 WebGL 上下文 + 多个 Scene**

```js
// 新建 module: public/js/renderer-manager.js
const RendererManager = {
  renderer: null,    // 单一 THREE.WebGLRenderer
  scenes: {},        // { bg, particle, foam, spectrum }
  cameras: {},
  canvasMap: {},     // sceneKey → canvas element

  init() {
    // 创建单一离屏渲染器
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,  // 节省 GPU 内存
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 使用单个全屏 Canvas，通过 scissor/viewport 分区渲染
    // 或使用 renderer.autoClear = false + 手动 clear + 多 scene 渲染
  },

  register(key, scene, camera, canvas) {
    this.scenes[key] = scene;
    this.cameras[key] = camera;
    this.canvasMap[key] = canvas;
  },

  render() {
    this.renderer.autoClear = true;
    // 按 Z-order 顺序渲染各层
    const order = ['bg', 'spectrum', 'particle', 'foam'];
    for (const key of order) {
      if (this.scenes[key] && this.scenes[key].visible !== false) {
        this.renderer.render(this.scenes[key], this.cameras[key]);
        this.renderer.autoClear = false;  // 后续层不清除，叠加渲染
      }
    }
  },

  resize(w, h) {
    this.renderer.setSize(w, h);
    for (const cam of Object.values(this.cameras)) {
      if (cam.aspect) {
        cam.aspect = w / Math.max(h, 1);
        cam.updateProjectionMatrix();
      }
    }
  }
};
```

**改造步骤：**

1. 新建 `renderer-manager.js`，提供统一 WebGL 管理
2. 修改 `fluid-bg.js` — 使用 RendererManager 注册，移除自有 Renderer
3. 修改 `particle-cover.js` — 同上
4. 修改 `foam-system.js` — 同上
5. 修改 `spectrum-3d.js` — 同上
6. 修改 `app.js` 渲染循环 — 单次 `RendererManager.render()` 替代 4 次独立渲染

**预期收益：** GPU 内存占用从 ~400MB 降至 ~100MB，帧率提升 20-30%

---

### 1.3 登录窗口超时机制

**问题：** Cookie 轮询永不超时

**方案：**

```js
// desktop/main.js — createLoginWindow() 函数内
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 分钟

// 在 pollTimer 之后添加：
const timeoutTimer = setTimeout(() => {
  console.log('[LoginWindow] Timeout — closing window');
  finish({ ok: false, cancelled: true, message: '登录超时，请重试' });
}, LOGIN_TIMEOUT_MS);

// 在 finish() 函数内添加：
if (timeoutTimer) clearTimeout(timeoutTimer);
```

**影响文件：** `desktop/main.js` — 5 行新增

---

### 1.4 进度条拖拽隔离

**问题：** 全局 mousemove/mouseup 监听与其他 UI 冲突

**方案：** 将事件监听器绑定到进度条元素自身，并增加指针捕获

```js
// app.js — setupControllerButtons() 进度条部分替换为：
progressBar.addEventListener('mousedown', (e) => {
  isDraggingProgress = true;
  progressBar.classList.add('dragging');
  progressBar.setPointerCapture(e.pointerId);  // ← 关键：锁定指针事件
  seekTo(e.clientX);
  spawnParticle(e.clientX, e.clientY);
});

progressBar.addEventListener('pointermove', (e) => {
  if (!isDraggingProgress) return;
  seekTo(e.clientX);
  if (Math.random() < 0.3) spawnParticle(e.clientX, e.clientY);
});

progressBar.addEventListener('pointerup', () => {
  isDraggingProgress = false;
  progressBar.classList.remove('dragging');
});
// 移除 document.addEventListener('mousemove', ...)
// 移除 document.addEventListener('mouseup', ...)
```

**影响文件：** `public/js/app.js` — 12 行变更

---

### 1.5 渲染进程崩溃恢复

**问题：** 主窗口无崩溃恢复机制

**方案：**

```js
// desktop/main.js — 在 createWindow() 中添加：
mainWindow.webContents.on('render-process-gone', (event, details) => {
  console.error('[MainWindow] Renderer crashed:', details.reason, details.exitCode);
  // 尝试重新加载页面
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadURL(`http://127.0.0.1:${mainServerPort}`).catch((e) => {
      console.error('[MainWindow] Reload failed:', e.message);
    });
  }
});

// 同时监听 unresponsive 事件
mainWindow.webContents.on('unresponsive', () => {
  console.warn('[MainWindow] Renderer unresponsive');
  // 可选：显示系统对话框提示用户
});
```

**影响文件：** `desktop/main.js` — 10 行新增

---

### 1.6 中等优先级 Bug 修复简表

| Bug | 方案 | 文件 | 行数 |
|-----|------|------|------|
| B6 窗口可调整 | 改为 `resizable: true` + `minWidth: 900` | main.js | 1 |
| B7 歌词二分查找 | 实现标准二分查找替换线性搜索 | bubble-chamber.js | 10 |
| B8 初始化竞态 | 在 `tick()` 和 `render()` 中添加 `if (!this.texture) return;` | particle-cover.js | 4 |
| B9 URL 缓存过期 | QQ URL 缓存 TTL 改为 25 分钟（< 30分钟有效期） | data-cache.js | 1 |
| B10 Escape 冲突 | 仅在无 overlay 打开时才退出全屏 | main.js + app.js | 8 |
| B11 Demo 无 URL | 替换为真实的免费音频 URL 或默认播放本地静音 | app.js | 5 |

---

## 2. macOS 原生集成方案

### 2.1 应用程序菜单栏

**方案：** 使用 Electron `Menu` API 构建标准 macOS 菜单

```js
// desktop/menu.js (新建)
const { Menu, app, shell } = require('electron');

function createMenu(mainWindow) {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { label: '关于 FluidMusic', role: 'about' },
        { type: 'separator' },
        { label: '偏好设置...', accelerator: 'Cmd+,',
          click: () => mainWindow.webContents.send('open-settings') },
        { type: 'separator' },
        { label: '隐藏 FluidMusic', accelerator: 'Cmd+H', role: 'hide' },
        { label: '隐藏其他', accelerator: 'Cmd+Shift+H', role: 'hideOthers' },
        { label: '显示全部', role: 'unhide' },
        { type: 'separator' },
        { label: '退出 FluidMusic', accelerator: 'Cmd+Q', role: 'quit' },
      ]
    }] : []),
    {
      label: '播放',
      submenu: [
        { label: '播放/暂停', accelerator: 'Space',
          click: () => mainWindow.webContents.send('media-control', 'toggle') },
        { label: '下一曲', accelerator: 'Cmd+Right',
          click: () => mainWindow.webContents.send('media-control', 'next') },
        { label: '上一曲', accelerator: 'Cmd+Left',
          click: () => mainWindow.webContents.send('media-control', 'prev') },
        { type: 'separator' },
        { label: '音量增加', accelerator: 'Cmd+Up',
          click: () => mainWindow.webContents.send('media-control', 'vol-up') },
        { label: '音量减小', accelerator: 'Cmd+Down',
          click: () => mainWindow.webContents.send('media-control', 'vol-down') },
      ]
    },
    {
      label: '窗口',
      submenu: [
        { label: '关闭窗口', accelerator: 'Cmd+W', role: 'close' },
        { label: '最小化', accelerator: 'Cmd+M', role: 'minimize' },
        { label: '缩放', role: 'zoom' },
        { type: 'separator' },
        { label: '进入全屏', accelerator: 'Cmd+Ctrl+F', role: 'togglefullscreen' },
      ]
    },
    {
      label: '帮助',
      submenu: [
        { label: '项目主页',
          click: () => shell.openExternal('https://github.com/user/fluidmusic') },
      ]
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { createMenu };
```

**影响文件：** 新建 `desktop/menu.js` + 修改 `desktop/main.js` 中调用

---

### 2.2 媒体键 (Media Keys) 集成

**方案：** 使用 Electron `systemPreferences` + `globalShortcut` 或 `MediaPlayPause` 等

```js
// desktop/main.js — 在 app.whenReady() 中添加
const { systemPreferences } = require('electron');

if (process.platform === 'darwin') {
  // 注册媒体键处理
  systemPreferences.on('media-pause', () => {
    mainWindow?.webContents.send('media-control', 'pause');
  });
  // 注意：Electron 的 media key 支持有限，推荐使用
  // Bearer MPRIS 或使用 native module: node-mac-media-keys

  // 替代方案：使用 globalShortcut 注册媒体键
  const { globalShortcut } = require('electron');
  globalShortcut.register('MediaPlayPause', () => {
    mainWindow?.webContents.send('media-control', 'toggle');
  });
  globalShortcut.register('MediaNextTrack', () => {
    mainWindow?.webContents.send('media-control', 'next');
  });
  globalShortcut.register('MediaPreviousTrack', () => {
    mainWindow?.webContents.send('media-control', 'prev');
  });
}
```

**注意：** macOS 上 `globalShortcut.register('MediaPlayPause')` 仅在应用获得焦点时有效。完整方案应使用 `MPNowPlayingInfoCenter`（需要一个原生 Node 模块），或等待 Electron 的 `systemMediaTransport` API 成熟。

**推荐方案：** 使用 `node-mac-media-keys` npm 包获取系统级媒体键事件。

---

### 2.3 Now Playing 集成 (macOS 控制中心)

**方案：** 通过原生模块设置 MPNowPlayingInfoCenter

```js
// 需要原生 addon 或使用 Electron 的 systemPreferences
// 当前 Electron v33 的 Media Player API 方案：

const { BrowserWindow } = require('electron');

// 在 createWindow() 后：
mainWindow.webContents.executeJavaScript(`
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'FluidMusic',
      artist: '准备播放',
      album: '',
      artwork: [{ src: 'assets/icon.png', sizes: '300x300', type: 'image/png' }]
    });

    navigator.mediaSession.setActionHandler('play', () => {
      window.dispatchEvent(new CustomEvent('media-control', { detail: 'play' }));
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      window.dispatchEvent(new CustomEvent('media-control', { detail: 'pause' }));
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      window.dispatchEvent(new CustomEvent('media-control', { detail: 'prev' }));
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      window.dispatchEvent(new CustomEvent('media-control', { detail: 'next' }));
    });
  }
`);
```

此方案使用 Web 标准的 Media Session API，在 macOS Sequoia 的 Safari/WebKit 中有基础支持。在渲染进程中，每次曲目切换时更新 `navigator.mediaSession.metadata` 即可在控制中心显示。

**影响文件：** `desktop/main.js` + `public/js/app.js`

---

### 2.4 Dock 菜单

```js
// desktop/main.js
const { Menu, app } = require('electron');

const dockMenu = Menu.buildFromTemplate([
  { label: '播放/暂停',
    click: () => mainWindow?.webContents.send('media-control', 'toggle') },
  { label: '下一曲',
    click: () => mainWindow?.webContents.send('media-control', 'next') },
  { label: '上一曲',
    click: () => mainWindow?.webContents.send('media-control', 'prev') },
  { type: 'separator' },
  { label: '显示窗口',
    click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
]);
app.dock.setMenu(dockMenu);
```

---

### 2.5 代码签名与公证配置

**方案：** 更新 `package.json` build 配置

```json
{
  "build": {
    "appId": "com.fluidmusic.desktop",
    "productName": "FluidMusic",
    "mac": {
      "category": "public.app-category.music",
      "target": [
        { "target": "dmg", "arch": ["x64", "arm64"] },
        { "target": "zip", "arch": ["x64", "arm64"] }
      ],
      "icon": "build/icon.icns",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist",
      "notarize": {
        "teamId": "YOUR_APPLE_TEAM_ID"
      }
    },
    "afterSign": "scripts/notarize.js"
  }
}
```

**新建文件：** `build/entitlements.mac.plist`
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.device.audio-input</key>
  <true/>
  <key>com.apple.security.network.client</key>
  <true/>
</dict>
</plist>
```

---

### 2.6 深色模式响应

```js
// desktop/main.js
const { nativeTheme } = require('electron');

nativeTheme.on('updated', () => {
  mainWindow?.webContents.send('theme-changed',
    nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
});
```

**渲染进程接收：**
```js
// preload.js 中添加
onThemeChanged: (callback) => {
  ipcRenderer.on('theme-changed', (_event, theme) => callback(theme));
}
```

---

## 3. 性能优化方案

### 3.1 渲染可见性管理

**方案：** 仅在需要时渲染各视觉层

```js
// app.js — 改进 animate() 函数
function animate(timestamp) {
  requestAnimationFrame(animate);
  const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.1) : 0.016;
  lastTime = timestamp;

  // 仅在有音频播放或转场动画时渲染视觉层
  const isActive = (typeof FluidAudio !== 'undefined' && FluidAudio.playing)
    || (typeof ParticleCover !== 'undefined'
        && Math.abs(ParticleCover.transition - ParticleCover.targetTransition) > 0.001);

  if (isActive) {
    RendererManager.render(); // 统一渲染入口
  }

  // DOM 更新（仅在时间变化时）
  if (typeof FluidAudio !== 'undefined' && FluidAudio.audio
      && !isNaN(FluidAudio.audio.duration)) {
    const currSec = Math.floor(FluidAudio.audio.currentTime);
    if (currSec !== _lastDisplayedSecond) {
      _lastDisplayedSecond = currSec;
      updateProgressDisplay();
    }
  }
}

// 窗口不可见时降低帧率
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // 切换到 4fps 低频更新
    _lowPowerMode = true;
  } else {
    _lowPowerMode = false;
  }
});
```

---

### 3.2 启动性能优化

**方案：** 渐进式加载 + 并行初始化

```
优化后的启动流程：
┌─────────────────────────────────────────────────────┐
│ 0ms   HTML 解析 → 显示骨架屏                          │
│ 50ms  Three.js 异步加载 (动态 import/defer)           │
│ 100ms 关键模块并行初始化:                              │
│       ├─ I18N.init()         (0ms，纯数据)            │
│       ├─ Favorites.init()    (0ms，localStorage)      │
│       ├─ FluidAudio.init()   (10ms，AudioContext)     │
│       └─ ApiBridge.init()    (IPC 请求，异步)          │
│ 200ms 视觉模块异步初始化:                              │
│       ├─ FluidBackground.init()                       │
│       ├─ ParticleCover.init()                         │
│       └─ BubbleChamber.init()                        │
│ 300ms 加载缓存数据 → 立即显示歌单                       │
│ 500ms 后台请求 API → 增量更新                          │
│ 800ms 隐藏 loading overlay                            │
└─────────────────────────────────────────────────────┘
```

**具体措施：**

1. **Three.js 延迟加载：**
```html
<!-- index.html: 使用 defer -->
<script src="vendor/three.min.js" defer></script>
```

2. **非关键模块延迟初始化：**
```js
// app.js — 使用 requestIdleCallback 延迟非关键初始化
requestIdleCallback(() => {
  if (typeof FoamEqualizer !== 'undefined') FoamEqualizer.init();
  if (typeof Spectrum3D !== 'undefined') Spectrum3D.init();
}, { timeout: 2000 });
```

3. **粒子几何体构建离屏化：**
```js
// particle-cover.js — 使用 OffscreenCanvas
function buildCoverParticleGeometry(image, resolution) {
  // 使用 OffscreenCanvas 避免阻塞主线程
  const canvas = new OffscreenCanvas(resolution, resolution);
  // ... 其余逻辑
}
```

---

### 3.3 网络请求优化

**方案：** 并发控制 + 请求去重 + 优先级

```js
// 新建: public/js/request-queue.js
const RequestQueue = {
  pending: new Map(),   // key → Promise (去重)
  concurrency: 4,      // 最大并发数
  waiting: [],         // 等待队列

  async fetch(key, fetcher, priority = 0) {
    // 去重：相同请求复用进行中的 Promise
    if (this.pending.has(key)) return this.pending.get(key);

    const promise = this._execute(key, fetcher);
    this.pending.set(key, promise);

    promise.finally(() => this.pending.delete(key));
    return promise;
  },

  async _execute(key, fetcher) {
    // 控制并发数
    while (this.pending.size >= this.concurrency) {
      await Promise.race([...this.pending.values()]);
    }
    return fetcher();
  }
};
```

**预缓存批处理优化：**
```js
// app.js — prefetchAllPlaylistSongs() 重写
async function prefetchAllPlaylistSongs(playlists) {
  const BATCH_SIZE = 4;     // 每批 4 个并发
  const BATCH_DELAY = 2000; // 批次间延迟 2 秒（而非每项 1.5 秒）

  const all = [...(playlists.netease || []), ...(playlists.qq || [])];

  for (let i = 0; i < all.length; i += BATCH_SIZE) {
    const batch = all.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(batch.map(pl =>
      RequestQueue.fetch(`playlist:${pl.platform}:${pl.id}`,
        () => fetchAndCachePlaylist(pl))
    ));
    if (i + BATCH_SIZE < all.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }
  }
}
```

---

### 3.4 DOM 更新批量化

**方案：** 使用 `DocumentFragment` + `requestAnimationFrame` 批处理

```js
// bubble-chamber.js — renderTrackList() 优化
function renderTrackList(tracks, currentIndex, sourcePlaylist) {
  const container = document.getElementById('playlist-items');
  if (!container) return;

  // 使用 DocumentFragment 批量 DOM 操作
  const fragment = document.createDocumentFragment();

  // Play All 按钮
  if (tracks.length > 0) {
    const playAll = createPlayAllButton(tracks);
    fragment.appendChild(playAll);
  }

  // 虚拟滚动：仅渲染可见区域 + 缓冲区
  const VISIBLE_COUNT = 30;
  const BUFFER = 10;
  const startIdx = 0;
  const endIdx = Math.min(tracks.length, VISIBLE_COUNT + BUFFER);

  for (let i = startIdx; i < endIdx; i++) {
    fragment.appendChild(createTrackRow(tracks[i], i));
  }

  container.innerHTML = '';
  container.appendChild(fragment);

  // 懒加载剩余曲目
  if (tracks.length > endIdx) {
    requestIdleCallback(() => {
      for (let i = endIdx; i < tracks.length; i++) {
        container.appendChild(createTrackRow(tracks[i], i));
      }
    }, { timeout: 5000 });
  }
}
```

---

### 3.5 渲染循环优化

```js
// app.js — 优化后的 animate()
const _domCache = {}; // DOM 元素引用缓存
function $(id) {
  if (!_domCache[id]) _domCache[id] = document.getElementById(id);
  return _domCache[id];
}

function animate(timestamp) {
  requestAnimationFrame(animate);

  const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;

  // 音频未播放且无动画转场 → 跳过视觉渲染
  const shouldRenderVisuals = FluidAudio.playing
    || ParticleCover.transition !== ParticleCover.targetTransition;

  if (shouldRenderVisuals) {
    RendererManager.update(dt);     // 统一 tick
    RendererManager.render();       // 统一 render
  }

  // 时间/进度条更新降至 250ms 间隔（从每帧降至每秒 4 次）
  if (shouldRenderVisuals && timestamp - _lastUIUpdate > 250) {
    _lastUIUpdate = timestamp;
    updateTimeDisplay();
    updateProgressBar();
  }
}

let _lastUIUpdate = 0;
```

---

## 4. 代码架构升级方案

### 4.1 模块化迁移路径

**阶段一（低风险）：** 保持 IIFE 模式，引入模块注册中心

```js
// public/js/module-registry.js
window.__FM = {
  modules: {},
  register(name, deps, factory) {
    this.modules[name] = { deps, factory, instance: null };
  },
  get(name) {
    const m = this.modules[name];
    if (!m) throw new Error(`Module ${name} not found`);
    if (!m.instance) {
      m.instance = m.factory(...m.deps.map(d => this.get(d)));
    }
    return m.instance;
  }
};
```

**阶段二（中期）：** 引入 Vite 构建

```
npm install -D vite
```

- 将 JS 文件改为 ES Modules (`export` / `import`)
- Vite 配置处理 Three.js 的 tree-shaking
- 开发模式使用 HMR 热更新
- 生产构建输出优化后的 bundle

**阶段三（长期）：** TypeScript 迁移

```
npm install -D typescript @types/three
```

- 优先为核心模块添加类型：`audio-engine.ts`, `api-bridge.ts`, `data-cache.ts`
- 定义共享接口：`Track`, `Playlist`, `UserProfile`, `Settings`
- 逐步迁移，允许 `.js` 和 `.ts` 共存

---

### 4.2 测试基础设施

```bash
# 单元测试
npm install -D vitest jsdom

# E2E 测试
npm install -D playwright @playwright/test
```

**目录结构：**
```
tests/
├── unit/
│   ├── audio-engine.test.js
│   ├── data-cache.test.js
│   ├── i18n.test.js
│   ├── favorites.test.js
│   └── bubble-chamber.test.js  (lyric parsing, filtering)
├── integration/
│   ├── api-bridge.test.js
│   └── playback-flow.test.js
└── e2e/
    ├── app-launch.spec.js
    ├── login-flow.spec.js
    └── playback.spec.js
```

**CI 配置 (GitHub Actions)：**
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test
      - run: npm run lint
  build:
    needs: test
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: FluidMusic-dmg
          path: dist/*.dmg
```

---

## 5. 安全加固方案

### 5.1 Cookie 安全存储

**方案：** 使用 macOS Keychain 存储敏感 Cookie

```js
// desktop/main.js
const { safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

function saveSecureCookie(platform, cookieText) {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(cookieText);
    const filePath = path.join(app.getPath('userData'), `.${platform}-cookie.enc`);
    fs.writeFileSync(filePath, encrypted);
  }
}

function loadSecureCookie(platform) {
  const filePath = path.join(app.getPath('userData'), `.${platform}-cookie.enc`);
  if (fs.existsSync(filePath) && safeStorage.isEncryptionAvailable()) {
    const encrypted = fs.readFileSync(filePath);
    return safeStorage.decryptString(encrypted);
  }
  return '';
}
```

### 5.2 Sandbox 启用

```js
// desktop/main.js — 主窗口 webPreferences
webPreferences: {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,  // ← 改为 true
  backgroundThrottling: false,
}
```

启用 sandbox 后，需要确保所有 OS 级操作（文件读取、网络等）都通过 preload 暴露的 IPC 接口，而非在渲染进程中直接使用 Node API。当前项目已经通过 preload 隔离，满足 sandbox 要求。

### 5.3 Content Security Policy

```html
<!-- public/index.html <head> 添加 -->
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'unsafe-inline';
    img-src 'self' https: data: blob:;
    media-src 'self' https:;
    connect-src 'self' http://127.0.0.1:* https://*.music.163.com https://*.qq.com https://*.y.qq.com;
    font-src 'self' https://fonts.gstatic.com;">
```

---

## 6. 实施路线图

### 第一阶段：关键 Bug 修复（1-2 周）

```
Week 1-2 ─────────────────────────────────────
├── B1  音频内存泄漏           1h  ██
├── B2  WebGL 上下文合并        4h  ████████
├── B3  登录超时               0.5h █
├── B4  进度条拖拽冲突          1h  ██
├── B5  渲染崩溃恢复           1h  ██
├── B6  窗口可调整大小          0.1h █
├── B8  初始化竞态            0.5h █
├── B10 Escape 冲突           1h  ██
└── 测试验证                  2h  ████
                         ─────────
                          ~11 hours
```

### 第二阶段：macOS 原生集成（2-3 周）

```
Week 3-5 ─────────────────────────────────────
├── 应用菜单栏               2h  ████
├── 媒体键集成               3h  ██████
├── Now Playing / 控制中心    4h  ████████
├── Dock 菜单               1h  ██
├── 深色模式响应            1h  ██
├── 代码签名 + 公证配置      4h  ████████
├── Apple Silicon 原生构建   2h  ████
└── Traffic Light 优化      2h  ████
                         ─────────
                          ~19 hours
```

### 第三阶段：性能优化（3-4 周）

```
Week 6-9 ─────────────────────────────────────
├── 渲染可见性管理           3h  ██████
├── 启动性能优化            4h  ████████
├── 网络请求优化            3h  ██████
├── DOM 更新批量化          4h  ████████
├── 渲染循环优化            3h  ██████
├── Canvas 2D 异步化         2h  ████
├── 存储优化（base64→文件）  2h  ████
└── 性能测试与基准建立      3h  ██████
                         ─────────
                          ~24 hours
```

### 第四阶段：架构升级（4-6 周）

```
Week 10-15 ───────────────────────────────────
├── 模块注册中心             3h  ██████
├── Vite 构建集成            8h  ████████████████
├── TypeScript 核心模块      8h  ████████████████
├── 单元测试编写            12h  ████████████████████████
├── E2E 测试编写             6h  ████████████
├── CI/CD 配置              4h  ████████
├── CSP 安全头               2h  ████
├── Keychain Cookie 存储    3h  ██████
└── 代码清理与文档更新       4h  ████████
                         ─────────
                          ~50 hours
```

### 第五阶段：功能完善（持续）

```
Week 16+ ──────────────────────────────────────
├── 搜索功能                 12h  ████████████████████████
├── 播放失败诊断              4h  ████████
├── 自定义播放列表            8h  ████████████████
├── 睡眠定时器                2h  ████
├── 迷你播放器模式            8h  ████████████████
├── 音频均衡器               16h  ████████████████████████████████
├── Last.fm 集成              6h  ████████████
└── ...更多功能
                         ─────────
                          按需迭代
```

---

### 优先级矩阵

```
                    高影响
                      │
          ┌───────────┼───────────┐
          │  Phase 2  │  Phase 1  │
          │  macOS    │  Bug      │
          │  原生集成  │  修复     │
          │           │           │
低努力 ───┼───────────┼───────────┼─── 高努力
          │           │           │
          │  Phase 3  │  Phase 4  │
          │  性能优化  │  架构升级  │
          │           │           │
          └───────────┼───────────┘
                      │
                    低影响
```

---

> **建议：** 第一阶段和第二阶段可以并行推进（Bug 修复和 macOS 集成互不阻塞）。第三阶段性能优化应在 Bug 修复完成后进行，以避免在性能分析中混入 Bug 导致的噪声。第四阶段架构升级建议在功能稳定后进行，以降低重构风险。
