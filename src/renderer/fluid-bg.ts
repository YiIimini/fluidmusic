// ============================================================
// FluidMusic — Fluid Background (TypeScript)
// Full-screen water ripple dynamic background with deep base color
// Reference: Mineradio-MacOS ShojiWM liquid-terminal shader
// Migrated from public/js/fluid-bg.js
// ============================================================

import type { AudioBands } from '../types/audio';
import { RendererManager } from './renderer-manager';

// Three.js is loaded as a global script at runtime.
declare const THREE: any;

// Runtime globals from other modules (JS-side, not yet migrated to TS).
declare const FluidAudio: { bands: AudioBands } | undefined;
declare const __FM: { register: (name: string, deps: string[], factory: () => any, opts?: { priority?: number }) => void } | undefined;

// ---- Types ----

interface FluidBGUniforms {
  uTime: { value: number };
  uResolution: { value: any /* THREE.Vector2 */ };
  uIntensity: { value: number };
  uSpeed: { value: number };
  uColorBase: { value: any /* THREE.Color */ };
  uColorAccent: { value: any /* THREE.Color */ };
  uBass: { value: number };
  uMid: { value: number };
  uTreble: { value: number };
  uEnergy: { value: number };
  uNoiseScale: { value: number };
}

// ---- FluidBackground ----

export class FluidBackground {
  scene: any = null;
  camera: any = null;
  material: any = null;
  mesh: any = null;
  renderer: any = null;

  time = 0;
  intensity = 0.8;
  speed = 1.0;
  colorAccent: any;

  initialized = false;

  // Audio smoothing state (prevents visual flicker/strobing)
  private smoothBass = 0;
  private smoothMid = 0;
  private smoothTreb = 0;
  private smoothEnergy = 0;

  // Reference to the shared RendererManager singleton
  private rm: RendererManager | null = null;

  constructor() {
    if (typeof THREE !== 'undefined') {
      this.colorAccent = new THREE.Color('#1144aa');
    }
  }

  /**
   * Initialize the fluid background.
   * If a canvas element is provided it will be used as a fallback
   * when the shared RendererManager is not available.
   */
  init(canvas?: HTMLCanvasElement | string): boolean {
    if (this.initialized) return true;

    try {
      // Attempt to use the shared RendererManager singleton.
      // At runtime it may be on window (legacy JS) or instantiated from the TS module.
      const globalRM: RendererManager | undefined =
        (window as any).RendererManager ?? this.rm;

      if (!globalRM || !globalRM.initialized) {
        if (globalRM) globalRM.init();
        if (!globalRM || !globalRM.initialized) {
          console.warn('[FluidBG] RendererManager not available, creating fallback renderer');
          const canvasEl =
            typeof canvas === 'string'
              ? (document.getElementById(canvas) as HTMLCanvasElement | null)
              : (canvas as HTMLCanvasElement | undefined) ??
                (document.getElementById('bg-canvas') as HTMLCanvasElement | null);

          if (!canvasEl) {
            console.error('[FluidBG] No canvas available');
            return false;
          }

          const renderer = new THREE.WebGLRenderer({
            canvas: canvasEl,
            alpha: true,
            antialias: false,
          });
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
          renderer.setClearColor(0x000000, 0);
          renderer.setSize(window.innerWidth, window.innerHeight);
          canvasEl.style.opacity = '0.4';
          this.renderer = renderer;
        }
      }

      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
      this.camera.position.z = 1;

      const uniforms: FluidBGUniforms = {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uIntensity: { value: this.intensity },
        uSpeed: { value: this.speed },
        uColorBase: { value: new THREE.Color('#0d0d1a') },
        uColorAccent: { value: this.colorAccent },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uEnergy: { value: 0 },
        uNoiseScale: { value: 0.5 },  // Half resolution for noise computation
      };

      const geometry = new THREE.PlaneGeometry(2, 2);

      // Inline shader — same as fluid-bg.frag.glsl
      const vertexShader = [
        'varying vec2 vUv;',
        'void main() {',
        '  vUv = uv;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}',
      ].join('\n');

      const fragmentShader = [
        'uniform float uTime; uniform vec2 uResolution; uniform float uIntensity; uniform float uSpeed;',
        'uniform vec3 uColorBase; uniform vec3 uColorAccent; uniform float uBass; uniform float uMid; uniform float uTreble; uniform float uEnergy; uniform float uNoiseScale;',
        'varying vec2 vUv;',
        'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
        'float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);float a=hash(i);float b=hash(i+vec2(1.0,0.0));float c=hash(i+vec2(0.0,1.0));float d=hash(i+vec2(1.0,1.0));return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}',
        'float fbm(vec2 p){float v=0.0;float a=0.5;float f=1.0;for(int i=0;i<5;i++){v+=a*noise(p*f);f*=2.0;a*=0.5;}return v;}',
        'void main(){',
        'vec2 uv=gl_FragCoord.xy/uResolution;vec2 c=uv-vec2(0.5);float ar=uResolution.x/uResolution.y;vec2 uva=vec2(c.x*ar,c.y);float d=length(uva);',
        'float r1=sin(d*15.0-uTime*uSpeed*0.6)*0.5+0.5;r1*=smoothstep(1.0,0.0,d)*0.3;',
        'float r2=sin(d*25.0-uTime*uSpeed*1.2)*0.5+0.5;r2*=smoothstep(0.8,0.2,d)*0.25;',
        'float r3=sin(d*40.0-uTime*uSpeed*1.8+noise(uv*3.0)*2.0)*0.5+0.5;r3*=smoothstep(0.5,0.0,d)*0.2;',
        'vec2 fuv=uv+vec2(sin(uv.y*4.0+uTime*0.3)*0.05,cos(uv.x*4.0+uTime*0.25)*0.05);',
        'float flow=fbm(fuv*3.0*uNoiseScale+uTime*0.15);',
        'float bp=uBass*sin(d*8.0+uTime*0.8)*0.5+0.5;bp*=smoothstep(0.9,0.3,d)*0.15;',
        'float mr=uMid*sin(d*20.0+uTime*1.5+noise(uv*5.0))*0.5+0.5;mr*=smoothstep(0.7,0.1,d)*0.12;',
        'float sp=uTreble*hash(uv*uResolution*0.5+uTime*10.0)*smoothstep(0.4,0.0,d)*0.08;',
        'float fv=flow*0.15+(r1+r2+r3)*uIntensity+bp+mr+sp;',
        'float vignette=1.0-smoothstep(0.3,1.2,d)*0.6;',
        'vec3 col=uColorBase;',
        'vec3 rc=mix(uColorBase,uColorAccent*0.4,fv*2.0);col=mix(col,rc,fv*uIntensity);',
        'float cg=exp(-d*2.5)*0.06;col+=uColorAccent*cg;col*=vignette;col+=uEnergy*0.02;',
        'gl_FragColor=vec4(col,0.2);',
        '}',
      ].join('\n');

      this.material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
      });

      this.mesh = new THREE.Mesh(geometry, this.material);
      this.mesh.frustumCulled = false;
      this.scene.add(this.mesh);

      this.initialized = true;

      // Register with shared RendererManager if available.
      const rm = (window as any).RendererManager ?? this.rm;
      if (rm && rm.initialized) {
        rm.registerLayer('bg', this.scene, this.camera, {
          tick: this.tick.bind(this),
          visible: true,
        });
      }

      console.log('Fluid BG initialized');
      return true;
    } catch (e) {
      console.error('Fluid BG init failed:', e);
      return false;
    }
  }

  /**
   * Per-frame tick: advance time and feed smoothed audio bands into uniforms.
   */
  tick(dt?: number): void {
    if (!this.initialized || !this.material) return;

    this.time += dt || 0.016;
    const u = this.material.uniforms as FluidBGUniforms;
    u.uTime.value = this.time;

    // Heavy smoothing on audio to eliminate visual flicker/strobing.
    if (typeof FluidAudio !== 'undefined' && FluidAudio?.bands) {
      const s = 0.04; // slow smoothing factor
      this.smoothBass += (FluidAudio.bands.bass - this.smoothBass) * s;
      this.smoothMid += (FluidAudio.bands.mid - this.smoothMid) * s;
      this.smoothTreb += (FluidAudio.bands.treble - this.smoothTreb) * s;
      this.smoothEnergy += (FluidAudio.bands.energy - this.smoothEnergy) * s;

      u.uBass.value = this.smoothBass * 0.5;     // Reduced amplitude
      u.uMid.value = this.smoothMid * 0.4;
      u.uTreble.value = this.smoothTreb * 0.3;
      u.uEnergy.value = this.smoothEnergy * 0.4;
    }
  }

  /**
   * Render the scene.
   * When the shared RendererManager is active it handles compositing;
   * this is a fallback direct render.
   */
  render(): void {
    const rm = (window as any).RendererManager ?? this.rm;
    if (rm?.initialized) return; // handled by RendererManager

    if (!this.initialized || !this.renderer) return;
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Handle window resize.
   */
  resize(): void {
    if (!this.initialized) return;

    const rm = (window as any).RendererManager ?? this.rm;
    if (rm?.initialized) {
      rm.resize(window.innerWidth, window.innerHeight);
    } else if (this.renderer) {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    if (this.material?.uniforms) {
      (this.material.uniforms as FluidBGUniforms).uResolution.value.set(
        window.innerWidth,
        window.innerHeight,
      );
    }
  }

  /**
   * Set ripple intensity (0-1).
   */
  setIntensity(v: number): void {
    this.intensity = v;
    if (this.material?.uniforms) {
      (this.material.uniforms as FluidBGUniforms).uIntensity.value = v;
    }
  }

  /**
   * Set animation speed multiplier.
   */
  setSpeed(v: number): void {
    this.speed = v;
    if (this.material?.uniforms) {
      (this.material.uniforms as FluidBGUniforms).uSpeed.value = v;
    }
  }

  /**
   * Dispose all WebGL resources and unregister from RendererManager.
   */
  dispose(): void {
    const rm = (window as any).RendererManager ?? this.rm;
    if (rm?.initialized) {
      rm.unregisterLayer('bg');
    }

    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
    if (this.mesh?.geometry) {
      this.mesh.geometry.dispose();
    }
    if (this.scene) {
      this.scene.clear();
      this.scene = null;
    }
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    this.camera = null;
    this.mesh = null;
    this.initialized = false;
  }
}

// ---- Singleton & backward-compat exports ----

const instance = new FluidBackground();

// Register with module registry if available.
if (typeof __FM !== 'undefined') {
  __FM.register('fluidBg', [], () => instance, { priority: 7 });
}

// Expose on window for legacy JS consumers.
(window as any).FluidBackground = instance;

// Also export a factory that reconstructs on hot-reload.
export function getFluidBackground(): FluidBackground {
  return instance;
}

export default instance;
