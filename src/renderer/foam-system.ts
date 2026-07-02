// ============================================================
// FluidMusic — Foam Bubble System (TypeScript)
// Reference: Mineradio-MacOS foam pearl iridescence preset
// Multi-layer sphere particle groups, pearl iridescence
// Audio-driven float + rotation, random color palette every 30s
// Migrated from public/js/foam-system.js
// ============================================================

declare const THREE: any;

// Runtime globals from other modules.
declare const FluidAudio: { bands: { bass: number; mid: number; treble: number; energy: number } } | undefined;
declare const RendererManager: {
  initialized: boolean;
  registerLayer: (key: string, scene: any, camera: any, opts?: { tick?: (dt: number) => void; visible?: boolean }) => void;
} | undefined;
declare const __FM: { register: (name: string, deps: string[], factory: () => any, opts?: { priority?: number }) => void } | undefined;

// ---- Color palettes ----

interface Palette {
  base: string;
  accent: string;
}

const palettes: Palette[] = [
  { base: '#faf5f0', accent: '#99ccff' },
  { base: '#fff8f0', accent: '#ff99bb' },
  { base: '#f8f8ff', accent: '#99ffcc' },
  { base: '#fff5f5', accent: '#ddbbff' },
  { base: '#f5f5ff', accent: '#ffcc88' },
  { base: '#f0f0ff', accent: '#88ddff' },
];

// ---- Module-level helpers ----

function buildBubbleGeometry(count: number): any {
  const positions: number[] = [];
  const sizes: number[] = [];
  const phases: number[] = [];
  const frequencies: number[] = [];
  const layers: number[] = [];

  const clusterRadius = 2.0;
  for (let i = 0; i < count; i++) {
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = Math.random() * Math.PI * 2;
    const r = clusterRadius * Math.pow(Math.random(), 0.5) * 1.2;

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.cos(phi) * 0.6;
    const z = r * Math.sin(phi) * Math.sin(theta);

    positions.push(x, y, z);
    sizes.push(2.0 + Math.random() * 6.0);
    phases.push(Math.random());
    frequencies.push(0.3 + Math.random() * 1.0);
    layers.push(Math.random());
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
  geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
  geo.setAttribute('aFrequency', new THREE.Float32BufferAttribute(frequencies, 1));
  geo.setAttribute('aLayer', new THREE.Float32BufferAttribute(layers, 1));

  return geo;
}

// ---- FoamSystem class ----

export class FoamSystem {
  scene: any = null;
  camera: any = null;
  renderer: any = null;
  foamPoints: any = null;
  material: any = null;

  time = 0;
  colorTimer = 0;
  colorBase: any = null;
  colorAccent: any = null;
  iridescence = 0.6;
  bubbleCount = 80;
  floatAmplitude = 1.0;
  initialized = false;

  constructor() {
    if (typeof THREE !== 'undefined') {
      this.colorBase = new THREE.Color('#faf5f0');
      this.colorAccent = new THREE.Color('#99ccff');
    }
  }

  /**
   * Pick a random palette and update the base/accent colors.
   */
  private randomPalette(): void {
    const p = palettes[Math.floor(Math.random() * palettes.length)];
    if (this.colorBase) this.colorBase.set(p.base);
    if (this.colorAccent) this.colorAccent.set(p.accent);
  }

  /**
   * Create the custom shader material with inline GLSL.
   */
  private createShaderMaterial(): any {
    const vertexShader = [
      'uniform float uTime; uniform float uBass; uniform float uMid; uniform float uTreble; uniform float uEnergy;',
      'attribute float aSize; attribute float aPhase; attribute float aFrequency; attribute float aLayer;',
      'varying float vHeight; varying float vAlpha; varying vec3 vNormal; varying float vPhase;',
      'void main(){',
      'vPhase=aPhase;',
      'float floatWave=sin(uTime*(0.4+aFrequency*0.8)+aPhase*6.28318);',
      'float bassAmp=uBass*mix(0.5,1.5,1.0-aLayer);',
      'float midAmp=uMid*mix(0.3,1.0,abs(aLayer-0.5)*2.0);',
      'float trebleAmp=uTreble*mix(0.5,1.0,aLayer);',
      'float audioAmp=bassAmp+midAmp+trebleAmp;',
      'vec3 pos=position; float floatHeight=(0.8+audioAmp)*floatWave;',
      'pos.y+=floatHeight;',
      'pos.x+=sin(uTime*0.3+aPhase*3.0)*0.15*(1.0+audioAmp);',
      'pos.z+=cos(uTime*0.35+aPhase*2.5)*0.15*(1.0+audioAmp);',
      'float scalePulse=1.0+floatWave*(0.15+audioAmp*0.3); float size=aSize*scalePulse;',
      'vHeight=floatHeight; vAlpha=0.55+floatWave*0.2+audioAmp*0.25;',
      'vNormal=normalize(normalMatrix*normal);',
      'vec4 mv=modelViewMatrix*vec4(pos,1.0);',
      'gl_PointSize=size*(180.0/-mv.z); gl_Position=projectionMatrix*mv;',
      '}',
    ].join('\n');

    const fragmentShader = [
      'uniform float uTime; uniform float uEnergy; uniform vec3 uColorBase; uniform vec3 uColorAccent; uniform float uIridescence;',
      'varying float vHeight; varying float vAlpha; varying vec3 vNormal; varying float vPhase;',
      'void main(){',
      'vec2 center=gl_PointCoord-vec2(0.5); float dist=length(center);',
      'float sphere=1.0-smoothstep(0.42,0.5,dist);',
      'float highlight=exp(-dist*8.0)*0.4; float spec=pow(1.0-dist,3.0)*0.3;',
      'float iriShift=sin(dist*10.0-uTime*0.5+vPhase*3.0)*0.5+0.5;',
      'vec3 iriColor=mix(uColorBase,uColorAccent,iriShift*uIridescence);',
      'vec3 pearl=uColorBase*0.7+iriColor*0.3;',
      'vec3 color=pearl+vec3(1.0,0.95,0.9)*highlight*0.5+vec3(1.0)*spec*0.25;',
      'float edge=smoothstep(0.15,0.45,dist); color*=mix(0.6,1.0,edge);',
      'color*=0.9+uEnergy*0.3;',
      'float alpha=sphere*vAlpha; if(alpha<0.01)discard;',
      'gl_FragColor=vec4(color,alpha);',
      '}',
    ].join('\n');

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uEnergy: { value: 0 },
        uColorBase: { value: this.colorBase },
        uColorAccent: { value: this.colorAccent },
        uIridescence: { value: this.iridescence },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    });
  }

  /**
   * Initialise the foam bubble system.
   */
  init(_canvas?: HTMLElement): boolean {
    if (this.initialized) return true;

    try {
      const w = window.innerWidth || 1700;
      const h = window.innerHeight || 980;

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(40, w / Math.max(h, 1), 0.1, 30);
      this.camera.position.set(0, 1.5, 8);
      this.camera.lookAt(0, 0, 0);

      this.material = this.createShaderMaterial();
      const geometry = buildBubbleGeometry(this.bubbleCount);
      this.foamPoints = new THREE.Points(geometry, this.material);
      this.scene.add(this.foamPoints);

      this.randomPalette();

      this.initialized = true;

      // Foam is hidden by default; register but keep invisible
      if (typeof RendererManager !== 'undefined' && RendererManager.initialized) {
        RendererManager.registerLayer('foam', this.scene, this.camera, {
          tick: this.tick.bind(this),
          visible: false,
        });
      }

      console.log('Foam System initialized with', this.bubbleCount, 'bubbles (shared renderer)');
      return true;
    } catch (e) {
      console.error('Foam System init failed:', e);
      return false;
    }
  }

  /**
   * Per-frame update: advance time, push audio into uniforms, auto-rotate palette.
   */
  tick(dt?: number): void {
    if (!this.initialized) return;
    this.time += dt || 0.016;

    const u = this.material.uniforms;
    u.uTime.value = this.time;
    u.uColorBase.value.copy(this.colorBase);
    u.uColorAccent.value.copy(this.colorAccent);
    u.uIridescence.value = this.iridescence;

    // Audio reactivity
    if (typeof FluidAudio !== 'undefined' && FluidAudio.bands) {
      u.uBass.value = FluidAudio.bands.bass;
      u.uMid.value = FluidAudio.bands.mid;
      u.uTreble.value = FluidAudio.bands.treble;
      u.uEnergy.value = FluidAudio.bands.energy;
    }

    // Auto color rotation every 30 seconds
    this.colorTimer += dt || 0.016;
    if (this.colorTimer >= 30) {
      this.colorTimer = 0;
      this.randomPalette();
    }

    // Gentle camera rotation
    this.camera.position.x = Math.sin(this.time * 0.15) * 1.5;
    this.camera.position.z = 8 + Math.cos(this.time * 0.1) * 0.5;
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * Render fallback — normally handled by RendererManager.
   */
  render(): void {
    if (typeof RendererManager !== 'undefined' && RendererManager.initialized) return;
    if (!this.initialized || !this.renderer) return;
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Show/hide the foam visualizer based on audio playback state.
   */
  updateFoamVisibility(): void {
    const layer = document.getElementById('foam-visualizer-layer');
    if (!layer) return;
    if (typeof FluidAudio !== 'undefined' && (FluidAudio as any).playing) {
      layer.classList.add('active');
    } else {
      layer.classList.remove('active');
    }
  }

  /**
   * Handle window resize.
   */
  resize(): void {
    if (!this.initialized) return;
    if (typeof RendererManager !== 'undefined' && RendererManager.initialized) {
      this.camera.aspect = window.innerWidth / Math.max(window.innerHeight, 1);
      this.camera.updateProjectionMatrix();
      return;
    }
    if (!this.renderer) return;
    const w = window.innerWidth || 1700;
    const h = window.innerHeight || 980;
    this.renderer.setSize(w, h);
    const fc = this.renderer.domElement;
    fc.style.width = w + 'px';
    fc.style.height = h + 'px';
    this.camera.aspect = w / Math.max(h, 1);
    this.camera.updateProjectionMatrix();
  }

  /**
   * Change bubble count and rebuild geometry.
   */
  setCount(n: number): void {
    if (!this.initialized) return;
    if (this.foamPoints) {
      this.foamPoints.geometry.dispose();
    }
    this.bubbleCount = n;
    this.foamPoints.geometry = buildBubbleGeometry(n);
  }

  /**
   * Set iridescence strength (0-1).
   */
  setIridescence(v: number): void {
    this.iridescence = v;
    if (this.material) this.material.uniforms.uIridescence.value = v;
  }

  /**
   * Set float amplitude multiplier.
   */
  setFloatAmplitude(v: number): void {
    this.floatAmplitude = v;
  }

  /**
   * Full teardown: dispose GPU resources.
   */
  dispose(): void {
    if (this.foamPoints) {
      if (this.foamPoints.geometry) this.foamPoints.geometry.dispose();
      if (this.scene) this.scene.remove(this.foamPoints);
      this.foamPoints = null;
    }
    if (this.material) { this.material.dispose(); this.material = null; }
    if (this.renderer) { this.renderer.dispose(); this.renderer = null; }
    this.scene = null;
    this.camera = null;
    this.initialized = false;
    console.log('[FoamSystem] Disposed');
  }
}

// ---- Singleton & backward-compat exports ----

const instance = new FoamSystem();

if (typeof __FM !== 'undefined') {
  __FM.register('foamSystem', [], () => instance, { priority: 7 });
}

(window as any).FoamSystem = instance;

export function getFoamSystem(): FoamSystem {
  return instance;
}

export default instance;
