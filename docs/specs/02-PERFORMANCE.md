# 02 — 性能设计 (Performance)

> 渲染管线优化 · GPU/CPU · 内存管理 · 启动速度 · 网络效率

---

## 1. 现状分析

### 1.1 已完成的优化

| 项目 | 状态 | 详情 |
|------|:---:|------|
| WebGL 上下文合并 | ✅ | `RendererManager` 4→1，GPU 内存 ~400→~100MB |
| 暂停低功耗 | ✅ | 音频暂停 2fps，窗口隐藏 0fps |
| 进度条事件隔离 | ✅ | `pointermove` 替代全局 `mousemove` |

### 1.2 剩余问题

| 问题 | 影响 | 严重度 |
|------|------|:---:|
| 频谱每模块独立采样 | CPU浪费 | 🟡 |
| 启动串行初始化 | ~3-5s 白屏 | 🔴 |
| FoamEqualizer 主线程 Canvas 2D | 阻塞UI | 🟡 |
| 大歌单全量 DOM | 500+首时卡顿 | 🟡 |
| 粒子几何体主线程构建 | 启动延迟 | 🟡 |
| 壁纸 Base64 in localStorage | 2-5MB 存储浪费 | 🟢 |
| 渲染循环中反复 `getElementById` | 微小但可避免 | 🟢 |

---

## 2. 目标状态

### 2.1 性能指标目标

| 指标 | 现状 | v0.3.0 目标 |
|------|------|:----------:|
| 启动到可交互 | ~3-5s | ≤1.5s |
| 播放时帧率 | 55-60fps | 稳定 60fps |
| 暂停时帧率 | 2fps (刚加) | 0fps (完全停止) |
| 转场时帧率 | 60fps | 60fps |
| JS 堆内存 | ~80MB | ≤50MB |
| GPU 内存 | ~100MB | ≤80MB |
| 歌单滚动 (500首) | 卡顿 | 60fps 平滑 |

### 2.2 优化架构

```
┌──────────────────────────────────────────────────┐
│                 requestAnimationFrame             │
│                      app.ts                       │
│                        │                          │
│         ┌──────────────┼──────────────┐          │
│         ▼              ▼              ▼          │
│   ┌──────────┐  ┌────────────┐  ┌──────────┐    │
│   │AudioEngine│  │RendererMgr │  │UIManager  │    │
│   │.getSpectrum│ │.tickAll() │  │.update()  │    │
│   │(1次采样)  │  │.render()  │  │(节流250ms)│    │
│   └────┬─────┘  └─────┬──────┘  └──────────┘    │
│        │              │                           │
│   ┌────▼──────────────▼──────┐                   │
│   │   广播 bands 到所有层     │                   │
│   │   fluidBg, particle,     │                   │
│   │   foam, spectrum, eq     │                   │
│   └──────────────────────────┘                   │
│                                                  │
│   渲染策略:                                       │
│   · 播放中:     60fps 全渲染                      │
│   · 转场中:     60fps 全渲染                      │
│   · 暂停+无转场: 0fps  停止渲染                   │
│   · 窗口隐藏:    0fps  停止渲染                   │
└──────────────────────────────────────────────────┘
```

---

## 3. 改造步骤

### 3.1 启动性能优化 (P0 — Phase 1)

**目标**：3-5s → ≤1.5s

**措施**：

```
优化后启动时序:
T+0ms    HTML 解析 → 骨架屏渲染
T+50ms   Vite 预打包的 core 模块加载（type="module" async）
T+100ms  AudioContext 初始化（用户手势后延迟）
T+150ms  关键模块并行初始化:
         ├─ I18N.init()
         ├─ Favorites.init()
         ├─ AppStore.init()
         └─ ApiBridge.checkLogin()（异步，不阻塞）
T+300ms  缓存数据即时显示
T+500ms  视觉模块渐进初始化:
         ├─ RendererManager.init()
         ├─ FluidBackground.init()
         └─ ParticleCover.init()
T+800ms  隐藏骨架屏，显示UI
T+1500ms 后台: 网络请求 + 歌单同步（不阻塞UI）
```

**具体改动**：
1. `index.html` 添加骨架屏标记
2. 非关键模块用 `requestIdleCallback` 延迟初始化
3. Three.js 用动态 `import()` 延迟加载（首屏不需要 3D）
4. 缓存数据优先显示，网络数据后更新

### 3.2 渲染管线优化 (P0 — Phase 3)

**单次频谱采样广播**：
```ts
// 旧: 每个模块独立读 FluidAudio.bands
// 新: app.ts 中统一采样，传给 RendererManager
const bands = audioEngine.getSpectrum();        // 1次采样
rendererManager.tickAll(dt, bands);             // 广播
rendererManager.render();                        // 1次 GPU 提交
```

**渲染策略表**：
```ts
function shouldRender(store: AppStore): RenderLevel {
  if (document.hidden)               return 'off';
  if (store.player.isPlaying)        return 'full';
  if (store.ui.hasActiveTransition)  return 'full';
  return 'off';
}
```

**DOM 查询缓存**：
```ts
// 热路径中缓存 DOM 引用
const $ = (id: string) => {
  _cache[id] ??= document.getElementById(id);
  return _cache[id];
};
```

### 3.3 内存优化 (P1 — Phase 4)

| 项 | 方案 |
|----|------|
| 粒子几何体 | 切歌时 `dispose()` 旧 geometry + texture |
| Audio 元素 | 每个 Audio 只用一次，用完 `remove()` + `load()` + `= null` |
| Three.js 资源 | 统一在 `RendererManager.disposeLayer(key)` 中清理 |
| IndexedDB | 替代 localStorage 存大对象，自动 LRU 淘汰 |
| 壁纸 | 存为文件 (`userData/wallpaper`)，localStorage 仅存路径 |

### 3.4 Canvas 2D 异步化 (P2 — Phase 5)

```ts
// FoamEqualizer 迁移到 OffscreenCanvas
const offscreen = canvas.transferControlToOffscreen();
worker.postMessage({ canvas: offscreen }, [offscreen]);
// WebWorker 中执行 Canvas 2D 绘制，不阻塞主线程
```

### 3.5 大歌单虚拟滚动 (P1 — Phase 4)

```ts
// 仅渲染可见行 + 上下缓冲区
const VISIBLE = 25, BUFFER = 10;
const range = getVisibleRange(scrollTop, rowHeight, VISIBLE, BUFFER);
// 复用 DOM 节点池，position: absolute 定位
```

---

## 4. 验收标准

- [ ] 冷启动到可交互 ≤1.5s（MacBook Air M1 基准）
- [ ] 播放 100+ 曲目后 JS 堆 ≤60MB，无持续增长
- [ ] 暂停状态 GPU 使用率 = 0%
- [ ] 500首大歌单滚动 60fps
- [ ] Chrome DevTools Performance 录制无明显长任务（>50ms）
- [ ] `npx vite build` 构建时间 ≤10s
