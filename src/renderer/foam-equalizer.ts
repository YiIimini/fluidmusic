// ============================================================
// FluidMusic — Foam Equalizer (Canvas 2D, TypeScript)
// 5 presets: Thermal, Pearl Iridescence, Deep Sea Bubbles,
//            Stardust Vortex, Aurora Fluid
// Non-bar foam visuals driven by frequency data
// Migrated from public/js/foam-equalizer.js
// ============================================================

declare const FluidAudio: {
  freqData: Uint8Array | undefined;
  bands: { bass: number; mid: number; treble: number; energy: number } | undefined;
} | undefined;

declare const __FM: {
  register: (name: string, deps: string[], factory: () => any, opts?: { priority?: number }) => void;
} | undefined;

// ---- Internal types ----

export type FoamPreset = 'thermal' | 'pearl' | 'deepsea' | 'stardust' | 'aurora';

export interface FoamConfig {
  density: number;
  speed: number;
  colorIntensity: number;
  sizeScale: number;
}

interface InternalAudioBands {
  bass: number;
  mid: number;
  treble: number;
  energy: number;
  subBands: number[];
}

interface PearlParticle {
  x: number;
  y: number;
  baseY: number;
  r: number;
  freqIdx: number;
  phase: number;
  speed: number;
  hue: number;
  saturation: number;
  lightness: number;
  alpha: number;
}

interface PopParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
}

interface DeepSeaBubble {
  x: number;
  y: number;
  r: number;
  baseSpeed: number;
  wobbleAmp: number;
  wobbleFreq: number;
  phase: number;
  hue: number;
  alpha: number;
  popped: boolean;
  popTimer: number;
  popParticles: PopParticle[];
}

interface OrbitParticle {
  angle: number;
  speed: number;
  radialOffset: number;
  r: number;
  hue: number;
  alpha: number;
  phase: number;
  sparkTimer: number;
}

interface OrbitRing {
  radius: number;
  particles: OrbitParticle[];
  freqBand: number;
}

interface AuroraPoint {
  x: number;
  y: number;
  phase: number;
  speed: number;
  amplitude: number;
}

interface AuroraBand {
  yBase: number;
  points: AuroraPoint[];
  freqBand: number;
  hue: number;
  amplitude: number;
}

interface ThermalGrain {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  r: number;
  depth: number;
  freqIdx: number;
  phase: number;
  speed: number;
  hueWarm: number;
  hueCool: number;
  alpha: number;
  life: number;
}

// ---- FoamEqualizer ----

export class FoamEqualizer {
  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  container: HTMLElement | null = null;
  width = 0;
  height = 0;
  dpr = 1;
  time = 0;
  preset: FoamPreset = 'thermal';
  particles: PearlParticle[] = [];
  bubbles: DeepSeaBubble[] = [];
  orbitRings: OrbitRing[] = [];
  auroraBands: AuroraBand[] = [];
  thermalGrains: ThermalGrain[] = [];
  initialized = false;

  config: FoamConfig = {
    density: 1.0,
    speed: 1.0,
    colorIntensity: 0.6,
    sizeScale: 1.0,
  };

  audioBands: InternalAudioBands = {
    bass: 0,
    mid: 0,
    treble: 0,
    energy: 0,
    subBands: new Array(16).fill(0),
  };

  // ── Private: Sub-band analysis (16 bands for finer detail) ──
  private analyzeSubBands(): void {
    if (!FluidAudio?.freqData) return;
    const data = FluidAudio.freqData;
    const len = data.length;
    const bands = this.audioBands.subBands;
    const bandSize = Math.floor(len / 16);
    for (let b = 0; b < 16; b++) {
      let sum = 0;
      const start = b * bandSize;
      const end = start + bandSize;
      for (let i = start; i < end && i < len; i++) {
        sum += data[i] / 255;
      }
      bands[b] += (sum / bandSize - bands[b]) * 0.15;
    }
  }

  private readAudioBands(): void {
    if (FluidAudio?.bands) {
      this.audioBands.bass += (FluidAudio.bands.bass - this.audioBands.bass) * 0.2;
      this.audioBands.mid += (FluidAudio.bands.mid - this.audioBands.mid) * 0.2;
      this.audioBands.treble += (FluidAudio.bands.treble - this.audioBands.treble) * 0.2;
      this.audioBands.energy += (FluidAudio.bands.energy - this.audioBands.energy) * 0.2;
    }
    this.analyzeSubBands();
  }

  // ═══════════════════════════════════════════════
  // PRESET 0: Thermal Sand (热力沙粒)
  // Fine sand-like particles with warm/cool color cycling
  // ═══════════════════════════════════════════════

  private initThermalSand(): void {
    const count = Math.floor(180 * this.config.density);
    this.thermalGrains = [];
    for (let i = 0; i < count; i++) {
      const depth = Math.random();
      this.thermalGrains.push({
        x: Math.random() * (this.width || 800),
        y: Math.random() * (this.height || 80),
        baseX: Math.random() * (this.width || 800),
        baseY: Math.random() * (this.height || 80),
        r: (0.6 + depth * 2.2) * this.config.sizeScale,
        depth: depth,
        freqIdx: Math.floor(Math.random() * 16),
        phase: Math.random() * Math.PI * 2,
        speed: (0.4 + depth * 0.8),
        hueWarm: 25 + Math.random() * 20,
        hueCool: 210 + Math.random() * 50,
        alpha: 0.2 + depth * 0.55,
        life: Math.random(),
      });
    }
  }

  private renderThermal(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
    const grains = this.thermalGrains;
    const subBands = this.audioBands.subBands;
    const energy = this.audioBands.energy || 0;
    const bass = this.audioBands.bass || 0;

    ctx.clearRect(0, 0, w, h);

    for (const g of grains) {
      const freqVal = subBands[g.freqIdx] || 0;

      const floatX = Math.sin(t * g.speed * 0.7 + g.phase * 5) * (2 + freqVal * 6);
      const floatY = Math.cos(t * g.speed * 0.9 + g.phase * 3 + g.life) * (3 + freqVal * 8);
      const pulse = 1 + energy * g.depth * 0.6 + freqVal * g.depth * 1.2;
      const x = g.baseX + floatX;
      const y = g.baseY + floatY - bass * g.depth * 4;

      const warmthShift = energy * 30;
      const hue = g.hueCool + (g.hueWarm - g.hueCool + warmthShift) * g.depth;
      const sat = 50 + g.depth * 30 + freqVal * 20;
      const light = 30 + g.depth * 45 + energy * 20;

      // Glow halo
      const glow = ctx.createRadialGradient(x, y, 0, x, y, g.r * pulse * 2.2);
      glow.addColorStop(0, `hsla(${hue}, ${sat}%, ${light}%, ${g.alpha * 0.8})`);
      glow.addColorStop(0.35, `hsla(${hue + 15}, ${sat}%, ${light - 10}%, ${g.alpha * 0.35})`);
      glow.addColorStop(0.7, `hsla(${hue + 30}, ${sat * 0.6}%, ${light - 20}%, ${g.alpha * 0.08})`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, g.r * pulse * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.fillStyle = `hsla(${hue + 20}, ${sat * 0.7}%, ${light + 20}%, ${g.alpha * 0.9})`;
      ctx.beginPath();
      ctx.arc(x, y, g.r * pulse * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ═══════════════════════════════════════════════
  // PRESET 1: Pearl Iridescence (珍珠虹彩)
  // Soft pearl-toned spheres floating with frequency
  // ═══════════════════════════════════════════════

  private initPearlParticles(): void {
    const count = Math.floor(40 * this.config.density);
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: this.height * 0.3 + Math.random() * this.height * 0.5,
        baseY: this.height * 0.3 + Math.random() * this.height * 0.5,
        r: (2 + Math.random() * 5) * this.config.sizeScale,
        freqIdx: Math.floor(Math.random() * 16),
        phase: Math.random() * Math.PI * 2,
        speed: (0.3 + Math.random() * 0.7) * this.config.speed,
        hue: 30 + Math.random() * 30,
        saturation: 10 + Math.random() * 20,
        lightness: 75 + Math.random() * 20,
        alpha: 0.3 + Math.random() * 0.4,
      });
    }
  }

  private renderPearl(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
    const particles = this.particles;
    const subBands = this.audioBands.subBands;

    ctx.clearRect(0, 0, w, h);

    for (const p of particles) {
      const freqVal = subBands[p.freqIdx] || 0;
      const floatOffset = Math.sin(t * p.speed * 1.5 + p.phase) * (8 + freqVal * 18 * this.config.density);
      const y = p.baseY - floatOffset;
      const x = p.x + Math.cos(t * 0.5 + p.phase) * (2 + freqVal * 4);

      const hueShift = freqVal * 40 * this.config.colorIntensity;
      const hsl = `hsl(${p.hue + hueShift}, ${p.saturation}%, ${p.lightness + freqVal * 15}%)`;

      // Outer glow
      const glow = ctx.createRadialGradient(x, y, 0, x, y, p.r * 1.6);
      glow.addColorStop(0, hsl.replace('%)', `%, ${p.alpha * 0.5})`).replace('hsl', 'hsla'));
      glow.addColorStop(0.5, hsl.replace('%)', `%, ${p.alpha * 0.15})`).replace('hsl', 'hsla'));
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, p.r * 1.6, 0, Math.PI * 2);
      ctx.fill();

      // Core
      const coreGrad = ctx.createRadialGradient(x - p.r * 0.25, y - p.r * 0.25, p.r * 0.05, x, y, p.r);
      coreGrad.addColorStop(0, `hsla(${p.hue + 10}, ${p.saturation}%, 95%, ${p.alpha * 0.8})`);
      coreGrad.addColorStop(0.4, `hsla(${p.hue}, ${p.saturation}%, ${p.lightness}%, ${p.alpha * 0.5})`);
      coreGrad.addColorStop(1, `hsla(${p.hue}, ${p.saturation + 10}%, ${p.lightness - 10}%, ${p.alpha * 0.1})`);
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(x, y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ═══════════════════════════════════════════════
  // PRESET 2: Deep Sea Bubbles (深海气泡)
  // Deep blue/cyan bubbles rising from bottom
  // ═══════════════════════════════════════════════

  private initDeepSeaBubbles(): void {
    const count = Math.floor(50 * this.config.density);
    this.bubbles = [];
    for (let i = 0; i < count; i++) {
      this.bubbles.push({
        x: Math.random() * this.width,
        y: this.height + Math.random() * 40,
        r: (1.5 + Math.random() * 6) * this.config.sizeScale,
        baseSpeed: (0.3 + Math.random() * 0.8) * this.config.speed,
        wobbleAmp: 0.5 + Math.random() * 2,
        wobbleFreq: 0.5 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
        hue: 190 + Math.random() * 40,
        alpha: 0.2 + Math.random() * 0.4,
        popped: false,
        popTimer: 0,
        popParticles: [],
      });
    }
  }

  private renderDeepSea(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
    const bubbles = this.bubbles;
    const energy = this.audioBands.energy;

    // Deep gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, 'rgba(2, 8, 20, 0.15)');
    bgGrad.addColorStop(1, 'rgba(3, 18, 45, 0.25)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    for (const b of bubbles) {
      if (b.popped) {
        b.popTimer -= 0.016;
        for (const pp of b.popParticles) {
          pp.x += pp.vx * 0.016;
          pp.y += pp.vy * 0.016;
          pp.life -= 0.02;
          pp.vy += 0.5 * 0.016;
          if (pp.life > 0) {
            ctx.fillStyle = `hsla(${b.hue}, 60%, 70%, ${pp.life})`;
            ctx.beginPath();
            ctx.arc(pp.x, pp.y, pp.r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        b.popParticles = b.popParticles.filter(pp => pp.life > 0);
        if (b.popTimer <= 0) {
          b.y = h + 20;
          b.x = Math.random() * w;
          b.popped = false;
        }
        continue;
      }

      const freqIdx = Math.floor((b.x / w) * 16);
      const subBands = this.audioBands.subBands;
      const freqVal = subBands[freqIdx] || 0;

      const riseSpeed = b.baseSpeed * (1 + freqVal * 1.5) * 40;
      b.y -= riseSpeed * 0.016;
      b.x += Math.sin(t * b.wobbleFreq + b.phase) * b.wobbleAmp * 30 * 0.016;

      // Pop at top
      if (b.y < -b.r) {
        b.popped = true;
        b.popTimer = 0.4;
        b.popParticles = [];
        const popCount = 4 + Math.floor(freqVal * 8);
        for (let j = 0; j < popCount; j++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 20 + Math.random() * 40;
          b.popParticles.push({
            x: b.x, y: b.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            r: 0.5 + Math.random() * 1.5,
            life: 0.3 + Math.random() * 0.4,
          });
        }
        continue;
      }

      const sizeBoost = 1 + freqVal * 0.4 * this.config.sizeScale;
      const r = b.r * sizeBoost;

      // Bubble glow
      const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 1.8);
      glow.addColorStop(0, `hsla(${b.hue}, 70%, 55%, ${b.alpha * 0.3})`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Bubble body
      const bodyGrad = ctx.createRadialGradient(b.x - r * 0.3, b.y - r * 0.3, r * 0.1, b.x, b.y, r);
      bodyGrad.addColorStop(0, `hsla(${b.hue + 10}, 40%, 80%, ${b.alpha * 0.4})`);
      bodyGrad.addColorStop(0.5, `hsla(${b.hue}, 50%, 55%, ${b.alpha * 0.2})`);
      bodyGrad.addColorStop(1, `hsla(${b.hue - 10}, 60%, 30%, ${b.alpha * 0.05})`);
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Highlight spec
      ctx.fillStyle = `rgba(255, 255, 255, ${b.alpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(b.x - r * 0.25, b.y - r * 0.25, r * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ═══════════════════════════════════════════════
  // PRESET 3: Stardust Vortex (星尘漩涡)
  // Particles in circular orbitals, multi-ring
  // ═══════════════════════════════════════════════

  private initStardustRings(): void {
    const ringCount = 4;
    this.orbitRings = [];
    for (let r = 0; r < ringCount; r++) {
      const count = Math.floor((40 + r * 20) * this.config.density);
      const ring: OrbitRing = {
        radius: 25 + r * 18,
        particles: [],
        freqBand: r,
      };
      for (let i = 0; i < count; i++) {
        ring.particles.push({
          angle: (i / count) * Math.PI * 2,
          speed: (0.3 + Math.random() * 0.5) * this.config.speed,
          radialOffset: (Math.random() - 0.5) * 8,
          r: 0.8 + Math.random() * 2,
          hue: 200 + r * 40 + Math.random() * 20,
          alpha: 0.5 + Math.random() * 0.4,
          phase: Math.random() * Math.PI * 2,
          sparkTimer: Math.random() * 3,
        });
      }
      this.orbitRings.push(ring);
    }
  }

  private renderStardust(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
    const cx = w / 2;
    const cy = h / 2;
    const rings = this.orbitRings;
    const subBands = this.audioBands.subBands;

    ctx.clearRect(0, 0, w, h);

    // Subtle center glow
    const ctrGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60);
    ctrGlow.addColorStop(0, 'rgba(130, 180, 255, 0.08)');
    ctrGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = ctrGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, 60, 0, Math.PI * 2);
    ctx.fill();

    for (const ring of rings) {
      const bandStart = ring.freqBand * 4;
      let ringFreq = 0;
      for (let b = bandStart; b < bandStart + 4 && b < 16; b++) {
        ringFreq += subBands[b] || 0;
      }
      ringFreq /= 4;

      const baseRadius = ring.radius + ringFreq * 20 * this.config.density;
      const alphaBoost = this.config.colorIntensity;

      for (const p of ring.particles) {
        p.angle += p.speed * 0.03 * (1 + ringFreq * 2);
        if (p.angle > Math.PI * 2) p.angle -= Math.PI * 2;

        const r = baseRadius + p.radialOffset + Math.sin(t + p.phase) * (2 + ringFreq * 5);
        const x = cx + Math.cos(p.angle) * r;
        const y = cy + Math.sin(p.angle) * r * 0.55;

        p.sparkTimer -= 0.016;
        let spark = 1;
        if (p.sparkTimer <= 0) {
          p.sparkTimer = 2 + Math.random() * 4;
          spark = 1.8;
        }

        const alpha = p.alpha * (0.6 + ringFreq * 0.8) * alphaBoost * spark;

        const glow = ctx.createRadialGradient(x, y, 0, x, y, p.r * 2.5);
        glow.addColorStop(0, `hsla(${p.hue}, 80%, 70%, ${alpha * 0.6})`);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, p.r * 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `hsla(${p.hue + 30}, 60%, 85%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ═══════════════════════════════════════════════
  // PRESET 4: Aurora Fluid (极光流体)
  // Flowing colored light bands, multi-layer frequency
  // ═══════════════════════════════════════════════

  private initAuroraBands(): void {
    const bandCount = 5;
    this.auroraBands = [];
    for (let b = 0; b < bandCount; b++) {
      const band: AuroraBand = {
        yBase: (b + 1) / (bandCount + 1) * this.height,
        points: [],
        freqBand: b,
        hue: [200, 160, 280, 30, 180][b],
        amplitude: 0,
      };
      const pointCount = 12;
      for (let i = 0; i < pointCount; i++) {
        band.points.push({
          x: (i / (pointCount - 1)) * this.width,
          y: 0,
          phase: Math.random() * Math.PI * 2,
          speed: (0.4 + Math.random() * 0.6) * this.config.speed,
          amplitude: 0.5 + Math.random() * 0.5,
        });
      }
      this.auroraBands.push(band);
    }
  }

  private renderAurora(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
    const bands = this.auroraBands;
    const subBands = this.audioBands.subBands;

    ctx.clearRect(0, 0, w, h);

    for (const band of bands) {
      const bandStart = band.freqBand * 3;
      let freqVal = 0;
      for (let b = bandStart; b < bandStart + 3 && b < 16; b++) {
        freqVal += subBands[b] || 0;
      }
      freqVal /= 3;
      band.amplitude += (freqVal - band.amplitude) * 0.08;

      const yBase = band.yBase;
      const amp = band.amplitude * 20 * this.config.density;

      for (const pt of band.points) {
        pt.y = Math.sin(t * pt.speed + pt.phase) * amp * pt.amplitude;
      }

      ctx.beginPath();
      const firstPt = band.points[0];
      ctx.moveTo(firstPt.x, yBase + firstPt.y);

      for (let i = 1; i < band.points.length - 1; i++) {
        const xc = (band.points[i].x + band.points[i + 1].x) / 2;
        const yc = (yBase + band.points[i].y + yBase + band.points[i + 1].y) / 2;
        ctx.quadraticCurveTo(band.points[i].x, yBase + band.points[i].y, xc, yc);
      }

      const lastPt = band.points[band.points.length - 1];
      ctx.lineTo(lastPt.x, yBase + lastPt.y);

      const hue = band.hue + freqVal * 30 * this.config.colorIntensity;
      const alpha = 0.15 + freqVal * 0.4;

      // Wide glow
      ctx.strokeStyle = `hsla(${hue}, 70%, 65%, ${alpha * 0.4})`;
      ctx.lineWidth = 4 + amp * 0.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Thin bright core
      ctx.strokeStyle = `hsla(${hue + 20}, 80%, 80%, ${alpha * 0.6})`;
      ctx.lineWidth = 1.5 + amp * 0.15;
      ctx.stroke();

      // Very wide ambient glow
      ctx.strokeStyle = `hsla(${hue}, 60%, 60%, ${alpha * 0.15})`;
      ctx.lineWidth = 12 + amp;
      ctx.stroke();
    }
  }

  // ═══════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════

  init(canvas?: HTMLCanvasElement | null): boolean {
    if (this.initialized) return true;
    try {
      this.canvas = canvas || (document.getElementById('foam-equalizer-canvas') as HTMLCanvasElement | null);
      this.container = document.getElementById('foam-equalizer-container');
      if (!this.canvas) {
        console.warn('FoamEqualizer: no canvas found');
        return false;
      }

      this.ctx = this.canvas.getContext('2d');
      this.dpr = Math.min(window.devicePixelRatio, 2);

      this.resize();
      this.setPreset(this.preset);

      this.initialized = true;
      console.log('Foam Equalizer initialized with preset:', this.preset);
      return true;
    } catch (e) {
      console.error('Foam Equalizer init failed:', e);
      return false;
    }
  }

  resize(): void {
    if (!this.container || !this.canvas) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.width = w;
    this.height = h;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    if (this.ctx) {
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    if (this.initialized) {
      this.initPearlParticles();
      this.initDeepSeaBubbles();
      this.initStardustRings();
      this.initAuroraBands();
    }
  }

  setPreset(presetName: FoamPreset): void {
    this.preset = presetName;
    this.initThermalSand();
    this.initPearlParticles();
    this.initDeepSeaBubbles();
    this.initStardustRings();
    this.initAuroraBands();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('fluidmusic-foam-preset', presetName);
    }
  }

  tick(dt?: number): void {
    if (!this.initialized) return;
    this.time += (dt || 0.016) * this.config.speed;
    this.readAudioBands();
  }

  render(): void {
    if (!this.initialized || !this.ctx) return;
    const ctx = this.ctx;
    const t = this.time;
    const w = this.width;
    const h = this.height;

    switch (this.preset) {
      case 'thermal': this.renderThermal(ctx, t, w, h); break;
      case 'pearl': this.renderPearl(ctx, t, w, h); break;
      case 'deepsea': this.renderDeepSea(ctx, t, w, h); break;
      case 'stardust': this.renderStardust(ctx, t, w, h); break;
      case 'aurora': this.renderAurora(ctx, t, w, h); break;
      default: this.renderThermal(ctx, t, w, h);
    }
  }

  // ── Config setters ──
  setDensity(v: number): void { this.config.density = Math.max(0.1, Math.min(2.0, v)); this.resize(); }
  setSpeed(v: number): void { this.config.speed = Math.max(0.1, Math.min(2.0, v)); }
  setColorIntensity(v: number): void { this.config.colorIntensity = Math.max(0, Math.min(1.0, v)); }
  setSizeScale(v: number): void { this.config.sizeScale = Math.max(0.5, Math.min(2.0, v)); this.resize(); }

  /**
   * Dispose: remove event listeners and clear canvas references.
   */
  dispose(): void {
    window.removeEventListener('resize', this._resizeHandler);
    this.canvas = null;
    this.ctx = null;
    this.container = null;
    this.initialized = false;
  }

  /** Resize handler reference for cleanup. Not part of public API. */
  _resizeHandler = (): void => this.resize();
}

// ── Singleton + backward-compat ──
const instance = new FoamEqualizer();

if (typeof __FM !== 'undefined') {
  __FM.register('foamEqualizer', [], () => instance, { priority: 6 });
}

(window as any).FoamEqualizer = instance;
window.addEventListener('resize', instance._resizeHandler);
console.log('FluidMusic Foam Equalizer loaded (TS)');
