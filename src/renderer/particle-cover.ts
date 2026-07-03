// ============================================================
// FluidMusic — Particle Cover System (TypeScript)
// Reference: Mineradio-MacOS buildCoverParticleGeometry()
// Sand-like fine particles, 160x160 grid, multi-layer frequency drive
// Orbit controls, entrance/disperse animations
// Migrated from public/js/particle-cover.js
// ============================================================

declare const THREE: any;

// Runtime globals from other modules (JS-side or not yet migrated).
declare const FluidAudio: { bands: { bass: number; mid: number; treble: number; energy: number } } | undefined;
declare const RendererManager: {
  initialized: boolean;
  registerLayer: (key: string, scene: any, camera: any, opts?: { tick?: (dt: number) => void; visible?: boolean }) => void;
} | undefined;
declare const __FM: { register: (name: string, deps: string[], factory: () => any, opts?: { priority?: number }) => void } | undefined;
declare const fluidmusic: { log: (msg: string) => void } | undefined;

// ---- Module-level helpers (stateless) ----

function buildCoverParticleGeometry(image: HTMLImageElement, resolution: number): any {
  const res = resolution || 118;
  const canvas = document.createElement('canvas');
  canvas.width = res;
  canvas.height = res;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0, res, res);
  const imageData = ctx.getImageData(0, 0, res, res);

  const positions: number[] = [];
  const randoms: number[] = [];
  const layers: number[] = [];
  const uvs: number[] = [];

  const halfRes = (res - 1) / 2;
  const spacing = 1.0 / res;
  const PLANE_SPREAD = 3.8;

  for (let y = 0; y < res; y++) {
    for (let x = 0; x < res; x++) {
      const idx = (y * res + x) * 4;
      const r = imageData.data[idx];
      const g = imageData.data[idx + 1];
      const b = imageData.data[idx + 2];

      const brightness = (r + g + b) / 3 / 255;

      const px = (x - halfRes) * spacing * PLANE_SPREAD;
      const py = (y - halfRes) * spacing * PLANE_SPREAD * -1;
      const pz = 0;

      positions.push(px, py, pz);
      randoms.push(Math.random());

      let layer: number;
      if (brightness > 0.6) layer = 0;
      else if (brightness > 0.3) layer = 0.5;
      else layer = 1.0;

      layers.push(layer);
      uvs.push(x / res, y / res);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aRandom', new THREE.Float32BufferAttribute(randoms, 1));
  geometry.setAttribute('aLayer', new THREE.Float32BufferAttribute(layers, 1));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

  return geometry;
}

function createShaderMaterial(texture: any | null): any {
  // Soft dot texture (Mineradio-style uDotTex)
  const dotCanvas = document.createElement('canvas');
  dotCanvas.width = 64; dotCanvas.height = 64;
  const dotCtx = dotCanvas.getContext('2d')!;
  const gradient = dotCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.4)');
  gradient.addColorStop(0.85, 'rgba(255,255,255,0.05)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  dotCtx.fillStyle = gradient;
  dotCtx.fillRect(0, 0, 64, 64);
  const dotTex = new THREE.CanvasTexture(dotCanvas);
  dotTex.minFilter = THREE.LinearFilter;
  dotTex.magFilter = THREE.LinearFilter;

  const vertexShader = [
    'uniform float uTime; uniform float uBass; uniform float uMid; uniform float uTreble; uniform float uEnergy;',
    'uniform float uTransition; uniform float uPixel; uniform float uColorBoost;',
    'uniform sampler2D uTexture;',
    'attribute float aRandom; attribute float aLayer;',
    'varying vec3 vColor; varying float vBright; varying float vRipple; varying float vAlpha; varying float vSourceLum;',
    'float hash(float n){return fract(sin(n)*43758.5453123);}',
    'float noise3D(vec3 p){vec3 f=fract(p);f=f*f*(3.0-2.0*f);float n=dot(floor(p),vec3(1.0,57.0,113.0));return mix(mix(mix(hash(n),hash(n+1.0),f.x),mix(hash(n+57.0),hash(n+58.0),f.x),f.y),mix(mix(hash(n+113.0),hash(n+114.0),f.x),mix(hash(n+170.0),hash(n+171.0),f.x),f.y),f.z);}',
    'void main(){',
    'vec2 texUv = uv;',
    'vec3 pos = position;',
    'float scatter = 1.0 - uTransition; float scatterStr = scatter * 3.5;',
    'float angle = aRandom * 6.28318;',
    'float radius = hash(aRandom + uTime * 0.035) * scatterStr;',
    'pos.x += cos(angle) * radius * scatter;',
    'pos.y += sin(angle) * radius * scatter;',
    'pos.z += (hash(aRandom * 2.0) - 0.5) * scatterStr * 2.5 * scatter;',
    'float n = noise3D(vec3(pos.xy * 0.8, uTime * 0.6 + aRandom * 5.0));',
    'float waveA = sin(uTime * 0.9 + aRandom * 12.0) * 0.5 + 0.5;',
    'float waveB = cos(uTime * 1.3 + aRandom * 7.0 + pos.x * 2.0) * 0.5 + 0.5;',
    'float waveC = sin(uTime * 1.7 + aRandom * 18.0 + pos.y * 1.5) * 0.5 + 0.5;',
    'float bassPush = uBass * (0.8 + waveA * 0.5);',
    'float midRipple = uMid * (0.5 + waveB * 0.7) * 0.8;',
    'float trebleSparkle = uTreble * (0.4 + waveC * 0.8) * 0.6;',
    'float noiseShift = (n - 0.5) * 0.5 * uEnergy;',
    'float totalLift = bassPush + midRipple + trebleSparkle + noiseShift;',
    'float baseZ = (1.0 - aLayer) * 0.8;',
    'pos.z += baseZ + totalLift * (0.5 + aRandom * 0.4);',
    'pos.x += sin(uTime * 0.7 + aRandom * 9.0 + pos.z * 2.0) * uMid * 0.15;',
    'pos.y += cos(uTime * 0.8 + aRandom * 11.0 + pos.z * 1.5) * uTreble * 0.12;',
    'vec3 texColor = texture2D(uTexture, texUv).rgb;',
    'float lum = dot(texColor, vec3(0.299, 0.587, 0.114));',
    'vColor = pow(max(texColor, vec3(0.0)), vec3(1.0 / max(0.35, uColorBoost)));',
    'vBright = 0.82 + uEnergy * 0.35 + uBass * 0.12 + uMid * 0.06 + lum * 0.45 + uTransition * 0.15;',
    'vSourceLum = lum;',
    'vRipple = totalLift;',
    'vAlpha = uTransition * uTransition * (3.0 - 2.0 * uTransition);',
    'vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);',
    'float depthFactor = min(1.0, 3.0 / max(0.3, -mvPosition.z));',
    'float audioBoost = 1.0 + uEnergy * 0.4 + uBass * 0.25 + waveA * 0.12;',
    'float sz = clamp(2.8 * depthFactor * audioBoost, 0.9, 4.5);',
    'gl_PointSize = sz * uPixel;',
    'gl_Position = projectionMatrix * mvPosition;',
    '}',
  ].join('\n');

  const fragmentShader = [
    'precision highp float;',
    'uniform sampler2D uDotTex;',
    'uniform float uAlpha; uniform float uEnergy;',
    'varying vec3 vColor; varying float vBright; varying float vRipple; varying float vAlpha; varying float vSourceLum;',
    'void main(){',
    'vec4 tex = texture2D(uDotTex, gl_PointCoord);',
    'if (tex.a < 0.02) discard;',
    'vec3 col = vColor * vBright;',
    'col = mix(col, col * 1.2, vRipple * 0.35);',
    'float keepBlack = 1.0 - smoothstep(0.025, 0.115, vSourceLum);',
    'float nonBlack = 1.0 - keepBlack;',
    'float dotDist = length(gl_PointCoord - vec2(0.5)) * 2.0;',
    'float rim = smoothstep(0.35, 0.85, dotDist) * (1.0 - smoothstep(0.85, 1.05, dotDist)) * tex.a;',
    'float specular = smoothstep(0.55, 0.7, dotDist) * (1.0 - smoothstep(0.7, 0.8, dotDist)) * tex.a * 0.6;',
    'float outLum = dot(col, vec3(0.299, 0.587, 0.114));',
    'float lightParticle = smoothstep(0.45, 0.85, outLum) * nonBlack;',
    'float darkParticle = (1.0 - smoothstep(0.15, 0.45, outLum)) * nonBlack;',
    'col = mix(col, vec3(0.02), rim * lightParticle * 0.45);',
    'col = mix(col, vec3(0.95), rim * darkParticle * 0.25);',
    'col += vec3(0.25, 0.22, 0.35) * specular * lightParticle;',
    'float energyHue = mix(0.08, 0.02, uBass);',
    'col += vec3(0.06 + energyHue, 0.04, 0.2 - energyHue) * uEnergy * tex.a * 0.4;',
    'col = clamp(col, vec3(0.0), vec3(1.8));',
    'float finalAlpha = tex.a * uAlpha * vAlpha;',
    'finalAlpha *= 0.3 + nonBlack * 0.7;',
    'if (finalAlpha < 0.003) discard;',
    'gl_FragColor = vec4(col, finalAlpha);',
    '}',
  ].join('\n');

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uEnergy: { value: 0 },
      uTransition: { value: 0 },
      uTexture: { value: texture || null },
      uDotTex: { value: dotTex },
      uAlpha: { value: 1.0 },
      uPixel: { value: 1.5 },
      uColorBoost: { value: 1.15 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  });
}

// ---- ParticleCover class ----

export class ParticleCover {
  scene: any = null;
  camera: any = null;
  renderer: any = null;
  particleSystem: any = null;
  geometry: any = null;
  material: any = null;
  texture: any = null;

  resolution = 160;
  layers = 4;
  transition = 0;
  targetTransition = 0;
  transitionSpeed = 0.8;
  time = 0;
  initialized = false;

  mouseDown = false;
  mouseX = 0;
  mouseY = 0;
  targetRotX = 0;
  targetRotY = 0;
  rotX = 0;
  rotY = 0;
  zoom = 3.0;
  coverUrl: string | null = null;

  _registered = false;

  // Cached source image for rebuilds
  private _sourceImage: HTMLImageElement | null = null;

  /**
   * Initialise the particle cover system.
   * @param canvas - optional canvas element (or element containing the canvas)
   * @param imageUrl - initial cover image URL
   */
  init(canvas?: HTMLElement, imageUrl?: string): boolean {
    console.log('[ParticleCover] init START | canvas:', !!canvas, '| imageUrl:', (imageUrl || '').substring(0, 30));
    if (this.initialized) { console.log('[ParticleCover] already initialized'); return true; }

    try {
      const useShared = (typeof RendererManager !== 'undefined' && RendererManager.initialized);
      if (!useShared) {
        console.log('[ParticleCover] Creating standalone WebGL renderer (fallback)...');
        const canvasEl = canvas || document.getElementById('particle-canvas');
        const renderer = new THREE.WebGLRenderer({
          canvas: canvasEl,
          alpha: true,
          antialias: true,
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        const containerEl = canvas ? (canvas as any).parentElement : document.getElementById('particle-cover-container');
        let cw = containerEl ? containerEl.clientWidth : 0;
        let ch = containerEl ? containerEl.clientHeight : 0;
        if (!cw || !ch) { cw = 300; ch = 300; }
        renderer.setSize(cw, ch);
        renderer.setClearColor(0x000000, 0);
        const canv = renderer.domElement;
        canv.style.width = cw + 'px';
        canv.style.height = ch + 'px';
        canv.style.display = 'block';
        canv.style.position = 'absolute';
        canv.style.top = '0';
        canv.style.left = '0';
        canv.style.zIndex = '5';
        canv.style.pointerEvents = 'none';
        canv.style.borderRadius = '14px';
        this.renderer = renderer;
        console.log('[ParticleCover] Standalone WebGL renderer created | canvas size:', cw, 'x', ch);
      } else {
        console.log('[ParticleCover] Using shared RendererManager');
      }

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 20);
      this.camera.position.z = this.zoom;

      // Create material eagerly (before image loads)
      this.material = createShaderMaterial(null);
      console.log('[ParticleCover] Material created eagerly');

      // Load demo image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        console.log('[ParticleCover] Image loaded OK | building geometry...');
        try { if (typeof fluidmusic !== 'undefined' && fluidmusic.log) fluidmusic.log('ParticleCover image OK, building geometry...'); } catch (_) { /* ignore */ }

        // Cache source image for future LOD rebuilds
        this._sourceImage = img;

        const texCanvas = document.createElement('canvas');
        texCanvas.width = img.width;
        texCanvas.height = img.height;
        const texCtx = texCanvas.getContext('2d')!;
        texCtx.drawImage(img, 0, 0);
        const texture = new THREE.CanvasTexture(texCanvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        this.texture = texture;

        this.material = createShaderMaterial(texture);
        this.geometry = buildCoverParticleGeometry(img, this.resolution);

        if (this.particleSystem) {
          this.scene.remove(this.particleSystem);
        }
        this.particleSystem = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.particleSystem);
        console.log('[ParticleCover] Particle system added to scene, ' + this.geometry.attributes.position.count + ' particles');
        try { if (typeof fluidmusic !== 'undefined' && fluidmusic.log) fluidmusic.log('ParticleCover: ' + this.geometry.attributes.position.count + ' particles ready'); } catch (_) { /* ignore */ }

        // Register with shared renderer NOW (scene is populated)
        if (typeof RendererManager !== 'undefined' && RendererManager.initialized && !this._registered) {
          RendererManager.registerLayer('particle', this.scene, this.camera, {
            tick: this.tick.bind(this),
            visible: true,
          });
          this._registered = true;
          console.log('[ParticleCover] Registered with RendererManager');
        }

        // Entrance animation
        this.targetTransition = 1;
        this.transitionSpeed = 1.0 / 0.6;
      };

      const initUrl = imageUrl || 'assets/icon.png';
      const isRemote = initUrl.startsWith('https://') || initUrl.startsWith('http://');
      if (!isRemote) img.crossOrigin = 'anonymous';
      img.src = isRemote
        ? 'http://127.0.0.1:' + (window.location.port || 3000) + '/api/cover-proxy?url=' + encodeURIComponent(initUrl)
        : initUrl;

      // Mouse interaction — hover-based 3D orbit
      const container = canvas && (canvas as any).parentElement
        ? (canvas as any).parentElement
        : document.getElementById('particle-cover-container');
      if (container) {
        container.addEventListener('mousemove', (e: MouseEvent) => {
          const rect = container.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dx = (e.clientX - cx) / (rect.width / 2);
          const dy = (e.clientY - cy) / (rect.height / 2);
          this.targetRotY = dx * 0.5;
          this.targetRotX = -dy * 0.4;
        });
        container.addEventListener('mouseleave', () => {
          this.targetRotY = 0;
          this.targetRotX = 0;
        });
        container.addEventListener('wheel', (e: WheelEvent) => {
          e.preventDefault();
          this.zoom += e.deltaY * 0.005;
          this.zoom = Math.max(1.8, Math.min(5.0, this.zoom));
        });
      }

      this.initialized = true;
      console.log('Particle Cover initialized (registration deferred until image loads)');
      try { if (typeof fluidmusic !== 'undefined' && fluidmusic.log) fluidmusic.log('ParticleCover init OK'); } catch (_) { /* ignore */ }
      return true;
    } catch (e: any) {
      console.error('Particle Cover init failed:', e);
      try { if (typeof fluidmusic !== 'undefined' && fluidmusic.log) fluidmusic.log('ParticleCover init FAILED: ' + e.message); } catch (_) { /* ignore */ }
      return false;
    }
  }

  /**
   * Per-frame update. Feed audio bands into shader uniforms, animate transitions,
   * and smoothly rotate the camera toward mouse-driven target angles.
   */
  tick(dt?: number): void {
    if (!this.initialized) return;
    if (!this.texture || !this.geometry) return;

    this.time += dt || 0.016;

    // Smooth transition
    this.transition += (this.targetTransition - this.transition) * (this.transitionSpeed || 0.8);
    this.material.uniforms.uTime.value = this.time;
    this.material.uniforms.uTransition.value = this.transition;

    // Audio reactivity
    if (typeof FluidAudio !== 'undefined' && FluidAudio.bands) {
      this.material.uniforms.uBass.value = FluidAudio.bands.bass;
      this.material.uniforms.uMid.value = FluidAudio.bands.mid;
      this.material.uniforms.uTreble.value = FluidAudio.bands.treble;
      this.material.uniforms.uEnergy.value = FluidAudio.bands.energy;
    }

    // Smooth orbit rotation
    this.rotX += (this.targetRotX - this.rotX) * 0.08;
    this.rotY += (this.targetRotY - this.rotY) * 0.08;

    this.camera.position.set(
      Math.sin(this.rotY) * this.zoom,
      Math.sin(this.rotX) * this.zoom,
      Math.cos(this.rotY) * this.zoom,
    );
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * Render the particle cover scene.
   * When RendererManager is active it handles compositing; this is a fallback.
   */
  render(): void {
    if (!this.initialized) return;
    if (!this.particleSystem || !this.texture) return;
    if (typeof RendererManager !== 'undefined' && RendererManager.initialized) return;
    if (!this.renderer) return;
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Load a new cover image and rebuild the particle geometry.
   */
  loadImage(imageUrl: string): void {
    if (!imageUrl) {
      console.warn('[ParticleCover] loadImage called with empty URL, skipping');
      return;
    }
    const rawUrl = String(imageUrl).replace(/^http:/, 'https:');

    const isRemote = rawUrl.startsWith('https://') || rawUrl.startsWith('http://');
    const url = isRemote
      ? 'http://127.0.0.1:' + (window.location.port || 3000) + '/api/cover-proxy?url=' + encodeURIComponent(rawUrl)
      : rawUrl;

    this.coverUrl = rawUrl;
    console.log('[ParticleCover] loadImage START:', rawUrl.substring(0, 60), '| proxied:', isRemote, '| material:', !!this.material);

    const img = new Image();
    if (!isRemote) img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        // Cache source image for future LOD rebuilds
        this._sourceImage = img;
        const texCanvas2 = document.createElement('canvas');
        texCanvas2.width = img.width;
        texCanvas2.height = img.height;
        const texCtx2 = texCanvas2.getContext('2d')!;
        texCtx2.drawImage(img, 0, 0);
        const texture = new THREE.CanvasTexture(texCanvas2);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        this.texture = texture;

        if (this.material && this.material.uniforms) {
          this.material.uniforms.uTexture.value = texture;
          console.log('[ParticleCover] Texture updated in material');
        }

        if (this.geometry) this.geometry.dispose();
        this.geometry = buildCoverParticleGeometry(img, this.resolution);

        if (this.particleSystem) {
          this.particleSystem.geometry = this.geometry;
        } else {
          this.particleSystem = new THREE.Points(this.geometry, this.material);
          this.scene.add(this.particleSystem);
          this.targetTransition = 1;
          this.transitionSpeed = 1.0 / 0.6;
          console.log('[ParticleCover] Created particle system from loadImage');
        }

        if (typeof RendererManager !== 'undefined' && RendererManager.initialized && !this._registered) {
          RendererManager.registerLayer('particle', this.scene, this.camera, {
            tick: this.tick.bind(this),
            visible: true,
          });
          this._registered = true;
        }
        console.log('[ParticleCover] Cover loaded successfully:', url.substring(0, 60));
      } catch (e: any) {
        console.warn('[ParticleCover] Failed to rebuild:', e.message, e.stack);
      }
    };
    img.onerror = () => {
      console.warn('[ParticleCover] Failed to load image:', url.substring(0, 80));
    };
    img.src = url;
  }

  /**
   * Trigger dissolve animation (particles fly apart).
   */
  dissolve(callback?: () => void): void {
    this.targetTransition = 0;
    this.transitionSpeed = 2.5;
    if (callback) setTimeout(callback, 400);
  }

  /**
   * Trigger form animation (particles assemble).
   */
  form(callback?: () => void): void {
    this.targetTransition = 1;
    this.transitionSpeed = 1.25;
    if (callback) setTimeout(callback, 800);
  }

  /**
   * Change particle grid resolution and rebuild.
   */
  setResolution(r: number): void {
    if (r === this.resolution) return;
    this.resolution = r;
    if (this.texture && this.coverUrl) {
      console.log('[ParticleCover] Resolution changed to ' + r + ', reloading cover...');
      this.loadImage(this.coverUrl);
    }
  }

  setSensitivity(_v: number): void { /* future use */ }
  setRotationSpeed(_v: number): void { /* future use */ }

  /**
   * Handle resize (called by window resize listener).
   */
  resize(): void {
    if (!this.initialized) return;
    const containerEl = document.getElementById('particle-cover-container');
    if (!containerEl) return;
    const cw = containerEl.clientWidth;
    const ch = containerEl.clientHeight;

    if (typeof RendererManager !== 'undefined' && RendererManager.initialized) {
      // No viewport constraint — particles render full-screen via shared renderer
    } else if (this.renderer) {
      this.renderer.setSize(cw, ch);
    }
    this.camera.aspect = cw / Math.max(ch, 1);
    this.camera.updateProjectionMatrix();
  }

  /**
   * Full teardown: dispose of all GPU resources and remove listeners.
   */
  dispose(): void {
    if (this.geometry) { this.geometry.dispose(); this.geometry = null; }
    if (this.material) { this.material.dispose(); this.material = null; }
    if (this.texture) { this.texture.dispose(); this.texture = null; }
    if (this.renderer && typeof RendererManager === 'undefined') {
      this.renderer.dispose();
      this.renderer = null;
    }
    if (this.scene && this.particleSystem) {
      this.scene.remove(this.particleSystem);
    }
    this.particleSystem = null;
    this.scene = null;
    this.camera = null;
    this.initialized = false;
    this._registered = false;
    console.log('[ParticleCover] Disposed');
  }
}

// ---- Singleton & backward-compat exports ----

const instance = new ParticleCover();

if (typeof __FM !== 'undefined') {
  __FM.register('particleCover', [], () => instance, { priority: 7 });
}

(window as any).ParticleCover = instance;

export function getParticleCover(): ParticleCover {
  return instance;
}

export default instance;
