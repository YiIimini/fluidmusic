# FluidMusic GPU 性能审计 v1.1.0

> 基于当前代码的深度GPU占用分析与优化方案

---

## 一、当前渲染管线

```
requestAnimationFrame (60fps)
  └─ FluidBackground.tick()    — 更新 uniforms
  └─ ParticleCover.tick()      — 更新粒子动画
  └─ RendererManager.render()  — 单次 WebGL 提交
       ├─ FluidBg scene         — 全屏 quad + FBM frag shader (3.5KB GLSL)
       └─ ParticleCover scene   — 25,600 顶点 + 自定义 shader
```

## 二、GPU 负载分析

### 2.1 FluidBackground (全屏着色器)

| 指标 | 值 | 影响 |
|------|-----|------|
| 着色器大小 | 3,498 bytes GLSL | 编译时间 ~5ms |
| FBM octaves | 估计 3-5 层 | 每像素 15-25 次噪声采样 |
| 分辨率 | 全屏 (1700×980) | 1,666,000 像素 |
| 每帧计算量 | ~40M 噪声采样 | 🔴 最大瓶颈 |

**优化方案：**

```glsl
// 1. 降采样渲染 → 1/2 分辨率 FBO → 双线性上采样
// GPU 像素计算量降 75%，视觉差异极小

// 2. 预计算噪声查找表 → 纹理采样替代实时计算
// 3 octaves 的噪声值预处理为 256×256 RGBA 纹理
// 每帧: 1次纹理采样 vs. 15次 sin/cos/fract 计算
```

### 2.2 ParticleCover (粒子系统)

| 指标 | 值 | 影响 |
|------|-----|------|
| 顶点数 | 25,600 (160×160) | 每帧顶点着色器 ×25,600 |
| 图层 | 3层 (Bass/Mid/Treble) | 分层Z位移计算 |
| 过渡动画 | scatter/speed uniforms | 切歌时额外计算 |
| 鼠标交互 | uMouse uniform | 每帧更新 |

**优化方案：**

```js
// 1. 动态LOD: 根据窗口大小和FPS自动调整分辨率
// 全屏 1700px → 160 分辨率
// 窗口 900px  → 100 分辨率  
// FPS < 45   → 降一档

// 2. 合并3层为单层 → 用 vertex shader 中的 brightness 分支
// 减少 draw calls: 3 → 1

// 3. 闲置时冻结粒子: 音频暂停 + 无过渡 → 跳过 tick()
```

### 2.3 DOM 涟漪系统

| 指标 | 值 | 影响 |
|------|-----|------|
| 类型 | CSS animation (非GPU) | 主线程合成 |
| 峰值涟漪数 | ~10-20个同时 | 每个触发 repaint |
| 动画属性 | width/height/opacity | 触发布局重算 |

**优化方案：**

```css
/* 使用 transform + opacity 替代 width/height（GPU合成，不触发layout） */
.ripple-ring {
  animation: ripple-expand 1.2s ease-out forwards;
  will-change: transform, opacity;
}
@keyframes ripple-expand {
  0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
  /* 用 scale 替代 width/height 变化 — 完全GPU合成 */
}
```

### 2.4 帧率与功耗

| 状态 | 当前 | 优化后目标 |
|------|------|:--:|
| 播放中 | 60fps | 60fps (不变) |
| 暂停 | 2fps | **0fps** (完全停止WebGL) |
| 隐藏 | 0fps | 0fps ✅ |
| 仅涟漪 | N/A | CSS only, 0 WebGL |

## 三、优化实施路线

### 🔴 P0 — 本周 (预计省 40-50% GPU)

1. **FluidBg 降采样渲染**
   - 渲染到 1/2 分辨率 FBO → 上采样到全屏
   - 改动: `fluid-bg.js` 20行
   - 收益: GPU像素计算 -75%

2. **涟漪 CSS 优化**
   - width/height → transform:scale
   - 改动: `components.css` 15行
   - 收益: 主线程 repaint 消除

3. **闲置完全停止**
   - `_lowPowerMode` 触发时跳过 rendererManager.render()
   - 改动: `app.js` 3行
   - 收益: 暂停时 GPU = 0

### 🟡 P1 — 下周 (预计再省 15-20%)

4. **噪声预计算纹理**
   - 256×256 RGBA 噪声LUT → 替换实时FBM
   - 改动: `fluid-bg.js` + 新纹理资源
   - 收益: shader 复杂度降 80%

5. **ParticleCover 帧率自适应**
   - FPS < 45 → 分辨率自动降档
   - 改动: `particle-cover.js` 30行
   - 收益: 低性能设备自动保护

### 🟢 P2 — 后续

6. **Shader 编译缓存**
   - THREE.ShaderMaterial 实例复用
   - 改动: 各渲染模块
   - 收益: 启动 -200ms

7. **WebGL 2.0 特性**
   - instanced rendering, UBO
   - 需要 Three.js 升级

---

## 四、验收标准

- [ ] macOS 活动监视器 GPU 占用: 播放 ≤50%, 暂停 = 0
- [ ] 13" MacBook Pro 60fps 稳定
- [ ] Chrome DevTools → GPU帧时间 ≤8ms
- [ ] 涟漪动画不触发 Layout (Performance面板确认)
