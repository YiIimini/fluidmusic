# FluidMusic GPU 性能优化方案

> 基于代码审计的 GPU 占用过高分析与多方面优化策略

---

## 1. 当前 GPU 消耗分析

### 1.1 渲染负载来源

| 渲染层 | 类型 | GPU 估算 | 每帧计算 |
|--------|------|:------:|------|
| FluidBackground | WebGL 全屏 quad + FBM shader | ~15MB | 每像素多次 sin/cos/noise |
| ParticleCover | WebGL Points, ~41K 顶点 (3层) | ~25MB | 顶点着色器 3层 Z-displacement |
| FoamSystem | WebGL Points, ~80 球体 + 自定义shader | ~10MB | 顶点+片元 iridescence |
| Spectrum3D | WebGL Points, 3环 | ~5MB | 低负载 |
| FoamEqualizer | Canvas 2D (主线程) | ~15MB | 每帧 16 子频段粒子绘制 |
| **共享 WebGL context** | 1 个 WebGLRenderer | ~20MB | — |
| **总计** | | **~100MB** | |

### 1.2 核心问题

| 问题 | 严重度 | 说明 |
|------|:---:|------|
| 暂停/隐藏时全速渲染 | 🔴 已修复 | 低功耗模式 2fps→0fps |
| FBM 噪声每帧全屏计算 | 🔴 | fluid-bg frag shader 每像素迭代 octaves |
| 粒子顶点数过高 | 🟡 | 160×160×3层 = 76,800 顶点 |
| Canvas 2D 主线程同步 | 🟡 | FoamEqualizer 阻塞 UI |
| 帧缓冲未复用 | 🟡 | 每帧重新分配 render target |
| 无帧率自适应 | 🟡 | 不掉帧策略——始终 60fps |
| 着色器每帧字符串编译 | 🟢 | ShaderMaterial 每次 new 都编译 |

---

## 2. 优化方案

### 2.1 Shader 计算优化 (P0 — 预计省 30-40% GPU)

**FluidBackground FBM 降采样：**

```glsl
// 当前: 全分辨率 FBM 噪声 (每像素 3 octaves × 多层)
// 优化: 降采样到 1/4 分辨率做 FBM，然后双线性上采样

// 新增 uniform
uniform float uNoiseScale;  // 0.5 = half res, 0.25 = quarter res

// 优化后 main():
void main() {
    vec2 noiseUV = vUv * uNoiseScale;  // 低频采样
    float noise = fbm(noiseUV * 3.0);   // 在低分辨率下计算
    // ... 其余逻辑不变，用低分辨率 noise 驱动
}
```

**预期收益：** FBM 像素计算量降 75%（1/4 分辨率），视觉差异极小（噪声本身就是低频纹理）。

**ParticleCover LOD (Level of Detail)：**

```ts
// particle-cover.ts — 根据窗口可见性/性能动态调整分辨率
class ParticleCover {
  private resolution: number = 160;
  private targetResolution: number = 160;
  
  // 性能自适应
  updateLOD(averageFPS: number): void {
    if (averageFPS < 45) {
      this.targetResolution = Math.max(80, this.resolution - 20);
    } else if (averageFPS > 58 && this.resolution < this.targetResolution) {
      this.resolution = Math.min(160, this.resolution + 10);
    }
    if (this.resolution !== this.targetResolution) {
      this.rebuildGeometry();  // 仅重建几何体，保留纹理
    }
  }
}
```

**预期收益：** 低性能设备上顶点数从 76,800 降至 ~19,200（80×80×3）。

### 2.2 帧率自适应 (P0 — 省电+降温)

```ts
// src/renderer/renderer-manager.ts — 添加自适应帧率
class RendererManager {
  private frameTimestamps: number[] = [];
  private targetFPS = 60;
  private currentFPS = 60;
  
  // 每 2 秒评估一次帧率
  private evaluatePerformance(timestamp: number): void {
    this.frameTimestamps.push(timestamp);
    if (this.frameTimestamps.length > 120) this.frameTimestamps.shift();
    if (this.frameTimestamps.length >= 60) {
      const elapsed = this.frameTimestamps[this.frameTimestamps.length-1] - this.frameTimestamps[0];
      this.currentFPS = (this.frameTimestamps.length / elapsed) * 1000;
      
      // 自适应目标
      if (this.currentFPS < 50) this.targetFPS = 30;
      else if (this.currentFPS > 58) this.targetFPS = 60;
      else this.targetFPS = 45;
    }
  }

  shouldRenderFrame(timestamp: number): boolean {
    const interval = 1000 / this.targetFPS;
    return (timestamp - this.lastFrameTime) >= interval;
  }
}
```

**预期收益：** GPU 负载自适应——MacBook Air 上降至 30fps，MacBook Pro 保持 60fps。

### 2.3 Render Target 复用 (P1)

```ts
// 当前: 每帧隐式分配 framebuffer
// 优化: 预分配 render target 并复用

class RendererManager {
  private renderTarget: THREE.WebGLRenderTarget | null = null;
  
  init(canvas: HTMLCanvasElement): void {
    // 预分配一个与 canvas 同尺寸的 render target
    this.renderTarget = new THREE.WebGLRenderTarget(canvas.width, canvas.height, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: false,   // 不需要深度缓冲
      stencilBuffer: false, // 不需要模板缓冲
    });
  }
  
  render(): void {
    this.renderer.setRenderTarget(this.renderTarget);
    // ... render layers ...
    this.renderer.setRenderTarget(null);
  }
  
  dispose(): void {
    this.renderTarget?.dispose();
  }
}
```

**预期收益：** 减少 GPU 内存分配/释放抖动。

### 2.4 Canvas 2D → WebGL 迁移 (P1)

FoamEqualizer 是唯一使用 Canvas 2D 的模块。Canvas 2D 在主线程同步绘制，无法利用 GPU 加速。

```ts
// 方案: 将 FoamEqualizer 5 个预设改写为 WebGL 着色器
// 注册到 RendererManager 作为额外渲染层

// 短期：OffscreenCanvas + WebWorker
const offscreen = canvas.transferControlToOffscreen();
const worker = new Worker('/js/foam-equalizer-worker.js');
worker.postMessage({ canvas: offscreen }, [offscreen]);
```

**预期收益：** Canvas 2D 主线程时间从 ~5ms→0ms，GPU 利用率提升。

### 2.5 着色器预编译 & 缓存 (P2)

```ts
// 当前: 每次 new THREE.ShaderMaterial 都编译 GLSL
// 优化: 缓存编译后的 shader program

const shaderCache = new Map<string, THREE.ShaderMaterial>();

function getCachedShaderMaterial(id: string, vert: string, frag: string, uniforms: any): THREE.ShaderMaterial {
  const key = `${id}:${vert.length}:${frag.length}`;
  if (shaderCache.has(key)) {
    const cached = shaderCache.get(key)!;
    // 更新 uniforms，复用 program
    Object.assign(cached.uniforms, uniforms);
    return cached;
  }
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms,
    transparent: true,
    depthWrite: false,
  });
  shaderCache.set(key, mat);
  return mat;
}
```

**预期收益：** 模块初始化时间减少 ~200ms。

### 2.6 requestAnimationFrame 节流 (P2)

```ts
// 在低功耗基础上，增加"静止检测"
// 如果连续 5 秒无用户交互 + 音频暂停 → 完全停止 rAF

let idleTimer: ReturnType<typeof setTimeout> | null = null;
const IDLE_TIMEOUT = 5000; // 5 秒静止后完全停止

function resetIdleTimer(): void {
  if (idleTimer) clearTimeout(idleTimer);
  if (!_lowPowerMode) _lowPowerMode = false;
  idleTimer = setTimeout(() => {
    _lowPowerMode = true; // 完全停止渲染
  }, IDLE_TIMEOUT);
}

document.addEventListener('mousemove', resetIdleTimer);
document.addEventListener('keydown', resetIdleTimer);
```

---

## 3. 多层优化策略总结

| 层 | 策略 | 收益 | 实现复杂度 | 优先级 |
|----|------|------|:---:|:---:|
| Shader | FBM 降采样 | GPU -30% | 低 (改 uniform) | P0 |
| Shader | 粒子 LOD | GPU -15% | 中 (重建几何) | P0 |
| 帧率 | 自适应目标FPS | GPU -25% | 低 (添加检测) | P0 |
| 内存 | Render target 复用 | 减少抖动 | 低 (预分配) | P1 |
| 架构 | Canvas 2D → WebGL | 主线程 -5ms | 高 (重写着色器) | P1 |
| 编译 | Shader 预编译缓存 | 启动 -200ms | 低 (加缓存) | P2 |
| 节能 | 静止检测完全停止 | 闲置 0 GPU | 低 (加定时器) | P2 |

### 3.1 分阶段实施

```
Week 1 (P0)  ■■■  降采样 + 自适应帧率 + 粒子LOD
  └─ 预期: GPU 占用降 40-50%，macOS 活动监视器可见明显下降

Week 2 (P1)  ■■   Render target 复用 + Canvas2D WebWorker
  └─ 预期: 主线程更流畅，无 Canvas 2D 阻塞

Week 3 (P2)  ■■   Shader 缓存 + 静止检测
  └─ 预期: 启动更快，闲置零功耗
```

### 3.2 验收标准

- [ ] macOS 活动监视器 → GPU 占用：播放时 ≤60MB，暂停时 ≤10MB
- [ ] MacBook Air M1 上稳定 ≥45fps
- [ ] 电池模式下自动降至 30fps
- [ ] 静止 5 秒后 GPU 占用 = 0
- [ ] Chrome DevTools → GPU 帧时间：每帧 ≤8ms
