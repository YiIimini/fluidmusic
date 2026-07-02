// ============================================================
// FluidMusic — 3D Multi-Layer Particle Spectrum (TypeScript)
// 3 concentric circular particle rings (bass/red, mid/blue, treble/purple)
// Radial expansion driven by audio bands, mouse drag orbit
// Migrated from public/js/spectrum-3d.js
// ============================================================

declare const THREE: any;

// Runtime globals from other modules.
declare const FluidAudio: { bands: { bass: number; mid: number; treble: number; energy: number } } | undefined;
declare const RendererManager: {
  initialized: boolean;
  registerLayer: (key: string, scene: any, camera: any, opts?: { tick?: (dt: number) => void; visible?: boolean }) => void;
  setLayerViewport: (key: string, x: number, y: number, w: number, h: number) => void;
} | undefined;
declare const __FM: { register: (name: string, deps: string[], factory: () => any, opts?: { priority?: number }) => void } | undefined;

// ---- Layer config ----

interface LayerConfig {
  y: number;
  color: string;
  freqKey: string;
}

const layerConfigs: LayerConfig[] = [
  { y: -0.3, color: '#ff6644', freqKey: 'bass' },
  { y: 0, color: '#44bbff', freqKey: 'mid' },
  { y: 0.3, color: '#aa88ff', freqKey: 'treble' },
];

// ---- Module-level helpers ----

function createLayer(yOffset: number, particleCount: number, color: string, radius: number): any {
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = yOffset;
    positions[i * 3 + 2] = Math.sin(angle) * radius;

    const c = new THREE.Color(color);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.08,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.7,
  });

  return new THREE.Points(geo, mat);
}

// ---- Spectrum3D class ----

export class Spectrum3D {
  scene: any = null;
  camera: any = null;
  renderer: any = null;
  layers: any[] = [];

  layerCount = 3;
  particlesPerLayer = 180;
  radius = 3.5;

  time = 0;
  mouseDown = false;
  mouseX = 0;
  mouseY = 0;
  rotX = 0.3;
  rotY = 0;
  initialized = false;

  /**
   * Initialise the 3D particle spectrum.
   * @param canvas - optional canvas element or parent element
   */
  init(canvas?: HTMLElement): boolean {
    if (this.initialized) return true;

    try {
      const container = canvas
        ? (canvas as any).parentElement
        : document.getElementById('spectrum-container');
      const w = container ? container.clientWidth : 360;
      const h = container ? container.clientHeight : 80;

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(50, w / Math.max(h, 1), 0.1, 30);
      this.camera.position.set(0, 0, 5);
      this.camera.lookAt(0, 0, 0);

      // Create 3 circular layers at different heights
      this.layers = layerConfigs.map((config) => {
        const points = createLayer(config.y, this.particlesPerLayer, config.color, this.radius);
        points.userData = { freqKey: config.freqKey, baseY: config.y, color: config.color };
        this.scene.add(points);
        return points;
      });

      // Orbit via mouse drag
      if (container) {
        container.addEventListener('mousedown', (e: MouseEvent) => {
          this.mouseDown = true;
          this.mouseX = e.clientX;
          this.mouseY = e.clientY;
        });
        container.addEventListener('mousemove', (e: MouseEvent) => {
          if (this.mouseDown) {
            this.rotY += (e.clientX - this.mouseX) * 0.01;
            this.rotX += (e.clientY - this.mouseY) * 0.01;
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
          }
        });
        window.addEventListener('mouseup', () => { this.mouseDown = false; });
      }

      this.initialized = true;

      // Register with shared renderer manager for sub-region rendering
      if (typeof RendererManager !== 'undefined' && RendererManager.initialized && container) {
        const rect = container.getBoundingClientRect();
        RendererManager.registerLayer('spectrum', this.scene, this.camera, {
          tick: this.tick.bind(this),
          visible: true,
        });
        RendererManager.setLayerViewport(
          'spectrum',
          Math.round(rect.left * window.devicePixelRatio),
          Math.round((window.innerHeight - rect.bottom) * window.devicePixelRatio),
          Math.round(rect.width * window.devicePixelRatio),
          Math.round(rect.height * window.devicePixelRatio),
        );
      }

      console.log('Spectrum 3D initialized (shared renderer)');
      return true;
    } catch (e) {
      console.error('Spectrum 3D init failed:', e);
      return false;
    }
  }

  /**
   * Per-frame update: expand rings based on audio bands, orbit camera.
   */
  tick(dt?: number): void {
    if (!this.initialized) return;
    this.time += dt || 0.016;

    // Update particles per layer
    this.layers.forEach((points) => {
      const freqKey: string = points.userData.freqKey;
      let freqValue = 0;
      if (typeof FluidAudio !== 'undefined' && FluidAudio.bands) {
        freqValue = (FluidAudio.bands as any)[freqKey] || 0;
      }

      const pos = points.geometry.attributes.position;
      const baseY: number = points.userData.baseY;

      for (let i = 0; i < this.particlesPerLayer; i++) {
        const angle = (i / this.particlesPerLayer) * Math.PI * 2;
        const phaseOffset = i * 0.35;
        const particleValue = freqValue * (0.5 + 0.5 * Math.sin(angle * 4 + this.time * 3 + phaseOffset));

        // Radial expansion based on frequency
        const r = this.radius + particleValue * 2.5;
        pos.array[i * 3] = Math.cos(angle) * r;
        pos.array[i * 3 + 1] = baseY + particleValue * 0.8;
        pos.array[i * 3 + 2] = Math.sin(angle) * r;
      }
      pos.needsUpdate = true;

      // Opacity driven by energy
      if (typeof FluidAudio !== 'undefined' && FluidAudio.bands) {
        points.material.opacity = 0.3 + FluidAudio.bands.energy * 0.7;
      }
    });

    // Camera orbit
    this.camera.position.set(
      Math.sin(this.rotY) * 5,
      0.5 + this.rotX * 3,
      Math.cos(this.rotY) * 5,
    );
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * Render fallback — normally handled by RendererManager.
   */
  render(): void {
    if (!this.initialized) return;
    if (typeof RendererManager !== 'undefined' && RendererManager.initialized) return;
    if (!this.renderer) return;
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Handle resize of the spectrum container.
   */
  resize(): void {
    if (!this.initialized) return;
    const container = document.getElementById('spectrum-container');
    if (!container) return;
    const w = container.clientWidth || 360;
    const h = container.clientHeight || 80;
    if (this.renderer) {
      this.renderer.setSize(w, h);
    }
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
  }

  /**
   * Full teardown: dispose geometry/materials and clean up.
   */
  dispose(): void {
    for (const points of this.layers) {
      if (points.geometry) points.geometry.dispose();
      if (points.material) points.material.dispose();
      if (this.scene) this.scene.remove(points);
    }
    this.layers = [];
    if (this.renderer) { this.renderer.dispose(); this.renderer = null; }
    this.scene = null;
    this.camera = null;
    this.initialized = false;
    console.log('[Spectrum3D] Disposed');
  }
}

// ---- Singleton & backward-compat exports ----

const instance = new Spectrum3D();

if (typeof __FM !== 'undefined') {
  __FM.register('spectrum3d', [], () => instance, { priority: 6 });
}

(window as any).Spectrum3D = instance;

export function getSpectrum3D(): Spectrum3D {
  return instance;
}

export default instance;
