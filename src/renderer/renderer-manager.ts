// ============================================================
// FluidMusic — Shared WebGL Renderer Manager (TypeScript)
// Consolidates 4 independent WebGL contexts into 1 shared context
// Reduces GPU memory from ~400MB to ~100MB
// Migrated from public/js/renderer-manager.js
// ============================================================

import type { Scene, Camera, WebGLRenderer, PerspectiveCamera } from 'three';
import type { AudioBands } from '../types/audio';

// Three.js is loaded as a global script at runtime (window.THREE).
// Individual type imports above give us compile-time types;
// at runtime we access the library through this global.
declare const THREE: any;

// ---- Types ----

export interface LayerViewport {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RegisterLayerOpts {
  /** Per-frame update callback. Receives dt (seconds) and optional audio bands. */
  tick?: (dt: number, bands?: AudioBands) => void;
  /** Whether the layer is initially visible. Default true. */
  visible?: boolean;
}

export interface LayerEntry {
  key: string;
  scene: Scene;
  camera: Camera;
  tickFn: ((dt: number, bands?: AudioBands) => void) | null;
  visible: boolean;
  viewport?: LayerViewport;
  onResize?: (w: number, h: number) => void;
}

// ---- RendererManager ----

export class RendererManager {
  renderer: WebGLRenderer | null = null;
  canvas: HTMLCanvasElement | null = null;
  layers: LayerEntry[] = [];
  initialized = false;

  // Performance monitoring for adaptive frame rate
  private frameTimestamps: number[] = [];
  private targetFPS = 60;
  private currentFPS = 60;
  private lastFrameTime = 0;
  private fpsUpdateInterval = 2000; // Re-evaluate every 2s
  private lastFPSEval = 0;

  /**
   * Initialise the shared WebGL renderer on the #bg-canvas element.
   * Safe to call multiple times — subsequent calls are no-ops.
   * Returns true on success.
   */
  init(): boolean {
    if (this.initialized) return true;

    try {
      const canvas = document.getElementById('bg-canvas') as HTMLCanvasElement | null;
      if (!canvas) {
        console.error('[RendererManager] Canvas #bg-canvas not found');
        return false;
      }

      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.autoClear = true;

      // Ensure canvas fills viewport
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '0';

      this.renderer = renderer;
      this.canvas = canvas;
      this.initialized = true;
      console.log('[RendererManager] Shared WebGL renderer initialized');
      return true;
    } catch (e) {
      console.error('[RendererManager] Init failed:', e);
      return false;
    }
  }

  /**
   * Register a visual layer.
   * Layers are rendered in registration order (last = on top).
   * If a layer with the same key already exists it is replaced.
   */
  registerLayer(
    key: string,
    scene: Scene,
    camera: Camera,
    opts?: RegisterLayerOpts,
  ): void {
    this.layers = this.layers.filter(l => l.key !== key);
    this.layers.push({
      key,
      scene,
      camera,
      tickFn: opts?.tick ?? null,
      visible: opts?.visible !== false,
    });
    console.log(
      '[RendererManager] Registered layer:',
      key,
      '| total layers:',
      this.layers.length,
    );
  }

  /**
   * Set the sub-region viewport for a specific layer (e.g. particle cover).
   */
  setLayerViewport(key: string, x: number, y: number, w: number, h: number): void {
    const layer = this.layers.find(l => l.key === key);
    if (layer) {
      layer.viewport = { x, y, w, h };
    }
  }

  /**
   * Toggle layer visibility.
   */
  setLayerVisible(key: string, visible: boolean): void {
    const layer = this.layers.find(l => l.key === key);
    if (layer) layer.visible = visible;
  }

  /**
   * Run per-frame tick for all registered layers.
   */
  tickAll(dt: number, bands?: AudioBands): void {
    for (const layer of this.layers) {
      if (layer.tickFn && layer.visible) {
        try {
          layer.tickFn(dt, bands);
        } catch (_e) {
          /* silently ignore per-frame tick errors */
        }
      }
    }
  }

  /**
   * Composite all visible layers to the shared canvas in Z-order.
   * @param timestamp - optional high-res timestamp (performance.now) for adaptive FPS.
   */
  render(timestamp?: number): void {
    if (!this.initialized || !this.renderer) return;
    const ts = timestamp ?? performance.now();
    if (!this.shouldRenderFrame(ts)) return;
    const r = this.renderer;

    r.autoClear = true;
    let first = true;

    for (const layer of this.layers) {
      if (!layer.visible) continue;
      if (!layer.scene || !layer.camera) continue;

      // Reset viewport to full canvas for each layer
      r.setViewport(0, 0, r.domElement.width, r.domElement.height);
      r.setScissor(0, 0, r.domElement.width, r.domElement.height);

      // For sub-region layers (particle cover, spectrum), use scissor/viewport
      if (layer.viewport) {
        const vp = layer.viewport;
        r.setViewport(vp.x, vp.y, vp.w, vp.h);
        r.setScissor(vp.x, vp.y, vp.w, vp.h);
        r.setScissorTest(true);
      }

      r.render(layer.scene, layer.camera);

      if (layer.viewport) {
        r.setScissorTest(false);
      }

      // After first layer, don't clear — subsequent layers composite on top
      if (first) {
        r.autoClear = false;
        first = false;
      }
    }
  }

  /**
   * Resize the shared canvas and update all camera aspects.
   */
  resize(w?: number, h?: number): void {
    if (!this.initialized || !this.renderer) return;

    const width = w ?? window.innerWidth;
    const height = h ?? window.innerHeight;

    this.renderer.setSize(width, height);

    for (const layer of this.layers) {
      if (layer.camera) {
        // Only PerspectiveCamera has aspect
        if ((layer.camera as PerspectiveCamera).isPerspectiveCamera) {
          const cam = layer.camera as PerspectiveCamera;
          cam.aspect = width / Math.max(height, 1);
          cam.updateProjectionMatrix();
        }
      }
      // Notify layer of resize if it has a handler
      if (layer.onResize) {
        try {
          layer.onResize(width, height);
        } catch (_e) {
          /* ignore */
        }
      }
    }
  }

  /**
   * Evaluate recent frame timestamps and adapt target FPS.
   * Drops to 30fps when GPU struggles, ramps back to 60fps when smooth.
   */
  private evaluatePerformance(timestamp: number): void {
    if (timestamp - this.lastFPSEval < this.fpsUpdateInterval) return;
    this.lastFPSEval = timestamp;

    // Calculate current FPS from recent timestamps
    if (this.frameTimestamps.length >= 30) {
      const elapsed = timestamp - this.frameTimestamps[0];
      this.currentFPS = (this.frameTimestamps.length / elapsed) * 1000;

      // Adaptive target: drop to 30fps if struggling, back to 60 if smooth
      if (this.currentFPS < 45) {
        this.targetFPS = 30;
      } else if (this.currentFPS > 55 && this.targetFPS < 60) {
        this.targetFPS = Math.min(60, this.targetFPS + 15);
      }
    }

    // Keep rolling window of timestamps
    this.frameTimestamps.push(timestamp);
    if (this.frameTimestamps.length > 60) this.frameTimestamps.shift();
  }

  /**
   * Returns true when enough wall-clock time has elapsed since the last
   * rendered frame, based on the current adaptive target FPS.
   */
  shouldRenderFrame(timestamp: number): boolean {
    this.evaluatePerformance(timestamp);
    const interval = 1000 / this.targetFPS;
    if (timestamp - this.lastFrameTime < interval) return false;
    this.lastFrameTime = timestamp;
    return true;
  }

  /**
   * Expose current measured FPS for downstream LOD consumers.
   */
  getCurrentFPS(): number {
    return this.currentFPS;
  }

  /**
   * Remove and clean up a single layer by key.
   */
  disposeLayer(key: string): void {
    const idx = this.layers.findIndex(l => l.key === key);
    if (idx !== -1) {
      this.layers.splice(idx, 1);
      console.log('[RendererManager] Disposed layer:', key);
    }
  }

  /**
   * Full teardown: dispose the WebGL renderer and clear all layers.
   */
  dispose(): void {
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    this.layers = [];
    this.canvas = null;
    this.initialized = false;
    console.log('[RendererManager] Disposed');
  }
}
