// ============================================================
// FluidMusic — Foam Equalizer (Canvas 2D)
// 4 presets: Pearl Iridescence, Deep Sea Bubbles, Stardust Vortex, Aurora Fluid
// Replaces the old spectrum-3d.js with non-bar foam visuals
// ============================================================
(function () {
  'use strict';

  const FoamEqualizer = {
    canvas: null,
    ctx: null,
    container: null,
    width: 0,
    height: 0,
    dpr: 1,
    time: 0,
    preset: 'pearl',       // 'pearl' | 'deepsea' | 'stardust' | 'aurora'
    particles: [],
    bubbles: [],
    orbitRings: [],
    auroraBands: [],
    initialized: false,

    // Configurable parameters
    config: {
      density: 1.0,         // 0.1 - 2.0
      speed: 1.0,           // 0.1 - 2.0
      colorIntensity: 0.6,  // 0 - 1.0
      sizeScale: 1.0,       // 0.5 - 2.0
    },

    // Audio data
    audioBands: { bass: 0, mid: 0, treble: 0, energy: 0, subBands: new Array(16).fill(0) },
  };

  // ── PRIVATE: Sub-band analysis (16 bands for finer detail) ──
  function analyzeSubBands() {
    if (typeof FluidAudio === 'undefined' || !FluidAudio.freqData) return;
    const data = FluidAudio.freqData;
    const len = data.length;
    const bands = FoamEqualizer.audioBands.subBands;
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

  function readAudioBands() {
    if (typeof FluidAudio !== 'undefined' && FluidAudio.bands) {
      FoamEqualizer.audioBands.bass += (FluidAudio.bands.bass - FoamEqualizer.audioBands.bass) * 0.2;
      FoamEqualizer.audioBands.mid += (FluidAudio.bands.mid - FoamEqualizer.audioBands.mid) * 0.2;
      FoamEqualizer.audioBands.treble += (FluidAudio.bands.treble - FoamEqualizer.audioBands.treble) * 0.2;
      FoamEqualizer.audioBands.energy += (FluidAudio.bands.energy - FoamEqualizer.audioBands.energy) * 0.2;
    }
    analyzeSubBands();
  }

  // ═══════════════════════════════════════════════
  // PRESET 1: Pearl Iridescence (珍珠虹彩)
  // Soft pearl-toned spheres floating with frequency
  // ═══════════════════════════════════════════════

  function initPearlParticles() {
    const count = Math.floor(40 * FoamEqualizer.config.density);
    FoamEqualizer.particles = [];
    for (let i = 0; i < count; i++) {
      FoamEqualizer.particles.push({
        x: Math.random() * FoamEqualizer.width,
        y: FoamEqualizer.height * 0.3 + Math.random() * FoamEqualizer.height * 0.5,
        baseY: FoamEqualizer.height * 0.3 + Math.random() * FoamEqualizer.height * 0.5,
        r: (2 + Math.random() * 5) * FoamEqualizer.config.sizeScale,
        freqIdx: Math.floor(Math.random() * 16),
        phase: Math.random() * Math.PI * 2,
        speed: (0.3 + Math.random() * 0.7) * FoamEqualizer.config.speed,
        hue: 30 + Math.random() * 30,  // Warm pearl hues
        saturation: 10 + Math.random() * 20,
        lightness: 75 + Math.random() * 20,
        alpha: 0.3 + Math.random() * 0.4,
      });
    }
  }

  function renderPearl(ctx, t, w, h) {
    const particles = FoamEqualizer.particles;
    const subBands = FoamEqualizer.audioBands.subBands;

    ctx.clearRect(0, 0, w, h);

    for (const p of particles) {
      const freqVal = subBands[p.freqIdx] || 0;
      const floatOffset = Math.sin(t * p.speed * 1.5 + p.phase) * (8 + freqVal * 18 * FoamEqualizer.config.density);
      const y = p.baseY - floatOffset;
      const x = p.x + Math.cos(t * 0.5 + p.phase) * (2 + freqVal * 4);

      // Iridescence: hue shifts based on frequency
      const hueShift = freqVal * 40 * FoamEqualizer.config.colorIntensity;
      const hsl = `hsl(${p.hue + hueShift}, ${p.saturation}%, ${p.lightness + freqVal * 15}%)`;

      // Multi-layer rendering for pearl effect
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

  function initDeepSeaBubbles() {
    const count = Math.floor(50 * FoamEqualizer.config.density);
    FoamEqualizer.bubbles = [];
    for (let i = 0; i < count; i++) {
      FoamEqualizer.bubbles.push({
        x: Math.random() * FoamEqualizer.width,
        y: FoamEqualizer.height + Math.random() * 40,
        r: (1.5 + Math.random() * 6) * FoamEqualizer.config.sizeScale,
        baseSpeed: (0.3 + Math.random() * 0.8) * FoamEqualizer.config.speed,
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

  function renderDeepSea(ctx, t, w, h) {
    const bubbles = FoamEqualizer.bubbles;
    const energy = FoamEqualizer.audioBands.energy;

    // Deep gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, 'rgba(2, 8, 20, 0.15)');
    bgGrad.addColorStop(1, 'rgba(3, 18, 45, 0.25)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    for (const b of bubbles) {
      if (b.popped) {
        b.popTimer -= 0.016;
        // Render pop particles
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
          // Respawn at bottom
          b.y = h + 20;
          b.x = Math.random() * w;
          b.popped = false;
        }
        continue;
      }

      const freqIdx = Math.floor((b.x / w) * 16);
      const subBands = FoamEqualizer.audioBands.subBands;
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

      // Draw bubble
      const sizeBoost = 1 + freqVal * 0.4 * FoamEqualizer.config.sizeScale;
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

  function initStardustRings() {
    const ringCount = 4;
    FoamEqualizer.orbitRings = [];
    for (let r = 0; r < ringCount; r++) {
      const count = Math.floor((40 + r * 20) * FoamEqualizer.config.density);
      const ring = {
        radius: 25 + r * 18,
        particles: [],
        freqBand: r,  // 0=bass, 1=low-mid, 2=high-mid, 3=treble
      };
      for (let i = 0; i < count; i++) {
        ring.particles.push({
          angle: (i / count) * Math.PI * 2,
          speed: (0.3 + Math.random() * 0.5) * FoamEqualizer.config.speed,
          radialOffset: (Math.random() - 0.5) * 8,
          r: 0.8 + Math.random() * 2,
          hue: 200 + r * 40 + Math.random() * 20,
          alpha: 0.5 + Math.random() * 0.4,
          phase: Math.random() * Math.PI * 2,
          sparkTimer: Math.random() * 3,
        });
      }
      FoamEqualizer.orbitRings.push(ring);
    }
  }

  function renderStardust(ctx, t, w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const rings = FoamEqualizer.orbitRings;
    const subBands = FoamEqualizer.audioBands.subBands;

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
      // Get frequency for this ring (map to sub-bands)
      const bandStart = ring.freqBand * 4;
      let ringFreq = 0;
      for (let b = bandStart; b < bandStart + 4 && b < 16; b++) {
        ringFreq += subBands[b] || 0;
      }
      ringFreq /= 4;

      const baseRadius = ring.radius + ringFreq * 20 * FoamEqualizer.config.density;
      const alphaBoost = FoamEqualizer.config.colorIntensity;

      for (const p of ring.particles) {
        p.angle += p.speed * 0.03 * (1 + ringFreq * 2);
        if (p.angle > Math.PI * 2) p.angle -= Math.PI * 2;

        const r = baseRadius + p.radialOffset + Math.sin(t + p.phase) * (2 + ringFreq * 5);
        const x = cx + Math.cos(p.angle) * r;
        const y = cy + Math.sin(p.angle) * r * 0.55; // Flatten to ellipse

        // Twinkle
        p.sparkTimer -= 0.016;
        let spark = 1;
        if (p.sparkTimer <= 0) {
          p.sparkTimer = 2 + Math.random() * 4;
          spark = 1.8;
        }

        const alpha = p.alpha * (0.6 + ringFreq * 0.8) * alphaBoost * spark;

        // Draw particle with glow
        const glow = ctx.createRadialGradient(x, y, 0, x, y, p.r * 2.5);
        glow.addColorStop(0, `hsla(${p.hue}, 80%, 70%, ${alpha * 0.6})`);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, p.r * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Core
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

  function initAuroraBands() {
    const bandCount = 5;
    FoamEqualizer.auroraBands = [];
    for (let b = 0; b < bandCount; b++) {
      FoamEqualizer.auroraBands.push({
        yBase: (b + 1) / (bandCount + 1) * FoamEqualizer.height,
        points: [],
        freqBand: b,
        hue: [200, 160, 280, 30, 180][b],
        amplitude: 0,
      });
      // Generate control points for bezier-like fluid curves
      const pointCount = 12;
      for (let i = 0; i < pointCount; i++) {
        FoamEqualizer.auroraBands[b].points.push({
          x: (i / (pointCount - 1)) * FoamEqualizer.width,
          y: 0,
          phase: Math.random() * Math.PI * 2,
          speed: (0.4 + Math.random() * 0.6) * FoamEqualizer.config.speed,
          amplitude: 0.5 + Math.random() * 0.5,
        });
      }
    }
  }

  function renderAurora(ctx, t, w, h) {
    const bands = FoamEqualizer.auroraBands;
    const subBands = FoamEqualizer.audioBands.subBands;

    ctx.clearRect(0, 0, w, h);

    for (const band of bands) {
      const bandStart = band.freqBand * 3;
      let freqVal = 0;
      for (let b = bandStart; b < bandStart + 3 && b < 16; b++) {
        freqVal += subBands[b] || 0;
      }
      freqVal /= 3;
      band.amplitude += (freqVal - band.amplitude) * 0.08; // Very smooth

      const yBase = band.yBase;
      const amp = band.amplitude * 20 * FoamEqualizer.config.density;

      // Update control points
      for (const pt of band.points) {
        pt.y = Math.sin(t * pt.speed + pt.phase) * amp * pt.amplitude;
      }

      // Draw fluid band using quadratic curves
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

      // Stroke with glow
      const hue = band.hue + freqVal * 30 * FoamEqualizer.config.colorIntensity;
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

  function init(canvas) {
    if (FoamEqualizer.initialized) return true;
    try {
      FoamEqualizer.canvas = canvas || document.getElementById('foam-equalizer-canvas');
      FoamEqualizer.container = document.getElementById('foam-equalizer-container');
      if (!FoamEqualizer.canvas) {
        console.warn('FoamEqualizer: no canvas found');
        return false;
      }

      FoamEqualizer.ctx = FoamEqualizer.canvas.getContext('2d');
      FoamEqualizer.dpr = Math.min(window.devicePixelRatio, 2);

      resize();
      setPreset(FoamEqualizer.preset);

      FoamEqualizer.initialized = true;
      console.log('Foam Equalizer initialized with preset:', FoamEqualizer.preset);
      return true;
    } catch (e) {
      console.error('Foam Equalizer init failed:', e);
      return false;
    }
  }

  function resize() {
    if (!FoamEqualizer.container || !FoamEqualizer.canvas) return;
    const w = FoamEqualizer.container.clientWidth;
    const h = FoamEqualizer.container.clientHeight;
    FoamEqualizer.width = w;
    FoamEqualizer.height = h;
    FoamEqualizer.canvas.width = w * FoamEqualizer.dpr;
    FoamEqualizer.canvas.height = h * FoamEqualizer.dpr;
    FoamEqualizer.canvas.style.width = w + 'px';
    FoamEqualizer.canvas.style.height = h + 'px';
    if (FoamEqualizer.ctx) {
      FoamEqualizer.ctx.setTransform(FoamEqualizer.dpr, 0, 0, FoamEqualizer.dpr, 0, 0);
    }

    // Re-init particles for new size
    if (FoamEqualizer.initialized) {
      initPearlParticles();
      initDeepSeaBubbles();
      initStardustRings();
      initAuroraBands();
    }
  }

  function setPreset(presetName) {
    FoamEqualizer.preset = presetName;
    // Re-init particles for the new preset
    initPearlParticles();
    initDeepSeaBubbles();
    initStardustRings();
    initAuroraBands();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('fluidmusic-foam-preset', presetName);
    }
  }

  function tick(dt) {
    if (!FoamEqualizer.initialized) return;
    FoamEqualizer.time += (dt || 0.016) * FoamEqualizer.config.speed;
    readAudioBands();
  }

  function render() {
    if (!FoamEqualizer.initialized || !FoamEqualizer.ctx) return;
    const ctx = FoamEqualizer.ctx;
    const t = FoamEqualizer.time;
    const w = FoamEqualizer.width;
    const h = FoamEqualizer.height;

    switch (FoamEqualizer.preset) {
      case 'pearl': renderPearl(ctx, t, w, h); break;
      case 'deepsea': renderDeepSea(ctx, t, w, h); break;
      case 'stardust': renderStardust(ctx, t, w, h); break;
      case 'aurora': renderAurora(ctx, t, w, h); break;
      default: renderPearl(ctx, t, w, h);
    }
  }

  // ── Config setters ──
  function setDensity(v) { FoamEqualizer.config.density = Math.max(0.1, Math.min(2.0, v)); resize(); }
  function setSpeed(v) { FoamEqualizer.config.speed = Math.max(0.1, Math.min(2.0, v)); }
  function setColorIntensity(v) { FoamEqualizer.config.colorIntensity = Math.max(0, Math.min(1.0, v)); }
  function setSizeScale(v) { FoamEqualizer.config.sizeScale = Math.max(0.5, Math.min(2.0, v)); resize(); }

  FoamEqualizer.init = init;
  FoamEqualizer.tick = tick;
  FoamEqualizer.render = render;
  FoamEqualizer.resize = resize;
  FoamEqualizer.setPreset = setPreset;
  FoamEqualizer.setDensity = setDensity;
  FoamEqualizer.setSpeed = setSpeed;
  FoamEqualizer.setColorIntensity = setColorIntensity;
  FoamEqualizer.setSizeScale = setSizeScale;

  window.FoamEqualizer = FoamEqualizer;
  window.addEventListener('resize', resize);
  console.log('FluidMusic Foam Equalizer loaded');
})();
