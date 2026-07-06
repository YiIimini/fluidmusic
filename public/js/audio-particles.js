// ============================================================
// FluidMusic — Audio-Reactive Particle Effect
// Canvas-based particles that jump with bass, fade when silent
// API: window.AudioParticles = { init(), destroy(), setVisible(bool) }
// ============================================================
(function () {
  'use strict';

  const CONFIG = {
    count: 100,            // particle count
    minSize: 1.5,          // min radius
    maxSize: 4.5,          // max radius
    bassScaleY: 120,       // how far bass pushes particles up
    midWobble: 30,         // horizontal wobble from mids
    spring: 0.12,          // spring-back stiffness (lower = lazier)
    damping: 0.82,         // velocity decay
    driftSpeed: 0.15,      // horizontal drift speed
    opacityAttack: 0.06,   // how fast particles appear
    opacityDecay: 0.03,    // how fast particles fade
    glowRadius: 8,         // shadow blur for glow
    hueBase: 260,          // base hue (purple-ish)
    hueRange: 40,          // hue variation
    particleAlpha: 0.75,   // max particle opacity
  };

  let canvas = null;
  let ctx = null;
  let particles = [];
  let animId = null;
  let isRunning = false;
  let visible = true;
  let targetAlpha = 0;
  let currentAlpha = 0;
  let audioEnergy = 0;
  let audioBass = 0;
  let audioMid = 0;
  let lastFrameTime = 0;

  // ── Particle class ──
  function Particle(w, h) {
    this.x = Math.random() * w;
    this.y = Math.random() * h;
    this.baseX = this.x;
    this.baseY = this.y;
    this.vx = 0;
    this.vy = 0;
    this.size = CONFIG.minSize + Math.random() * (CONFIG.maxSize - CONFIG.minSize);
    this.hue = CONFIG.hueBase + (Math.random() - 0.5) * CONFIG.hueRange;
    this.phase = Math.random() * Math.PI * 2;       // unique phase for per-particle variation
    this.speed = 0.6 + Math.random() * 0.8;          // response speed multiplier
    this.driftDir = (Math.random() - 0.5) * 2;       // drift direction bias
    this.opacity = 0;
  }

  Particle.prototype.update = function (dt, w, h, bass, mid) {
    // Spring force toward base position
    const dx = this.baseX - this.x;
    const dy = this.baseY - this.y;
    this.vx += dx * CONFIG.spring * this.speed;
    this.vy += dy * CONFIG.spring * this.speed;

    // Audio reaction: bass pushes UP, mid wobbles sideways
    const bassPush = bass * bass * CONFIG.bassScaleY * this.speed;
    const midPush = mid * CONFIG.midWobble * Math.sin(this.phase + audioEnergy * 3) * this.speed;
    this.vy -= bassPush;
    this.vx += midPush;

    // Slow drift
    this.vx += this.driftDir * CONFIG.driftSpeed * dt;
    this.baseX += this.driftDir * CONFIG.driftSpeed * dt * 0.3;

    // Damping
    this.vx *= CONFIG.damping;
    this.vy *= CONFIG.damping;

    // Integrate
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Phase advance
    this.phase += dt * 2 * this.speed;

    // Wrap around edges
    if (this.x < -20) { this.x = w + 20; this.baseX = this.x; }
    if (this.x > w + 20) { this.x = -20; this.baseX = this.x; }
    if (this.y < -20) { this.y = h + 20; this.baseY = this.y; }
    if (this.y > h + 20) { this.y = -20; this.baseY = this.y; }

    // Opacity follows energy
    this.opacity += (audioEnergy * CONFIG.particleAlpha - this.opacity) * 0.08;
  };

  Particle.prototype.draw = function (ctx) {
    if (this.opacity < 0.005) return;
    const alpha = Math.min(this.opacity, CONFIG.particleAlpha);
    const hue = this.hue + audioEnergy * 30; // hue shift with energy
    const sat = 60 + audioEnergy * 40;
    const light = 55 + audioEnergy * 30;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Glow
    ctx.shadowColor = `hsla(${hue}, ${sat}%, ${light}%, 0.6)`;
    ctx.shadowBlur = CONFIG.glowRadius + audioEnergy * 12;

    // Draw particle
    ctx.fillStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * (1 + audioEnergy * 0.5), 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // ── Audio data polling ──
  function pollAudio() {
    if (typeof FluidAudio === 'undefined') {
      audioBass = 0;
      audioMid = 0;
      audioEnergy = 0;
      return false;
    }

    // Check playing state
    const playing = FluidAudio.playing === true;

    if (playing && FluidAudio.bands) {
      audioBass = FluidAudio.bands.bass || 0;
      audioMid = FluidAudio.bands.mid || 0;
      audioEnergy = FluidAudio.bands.energy || 0;
    } else {
      audioBass = 0;
      audioMid = 0;
      audioEnergy = 0;
    }

    return playing;
  }

  // ── Resize ──
  function resize() {
    if (!canvas) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Reposition particles
    if (particles.length > 0) {
      for (const p of particles) {
        p.baseX = Math.random() * w;
        p.baseY = Math.random() * h;
        p.x = p.baseX;
        p.y = p.baseY;
      }
    }
  }

  // ── Animation loop ──
  function animate(timestamp) {
    if (!isRunning) return;

    const dt = lastFrameTime ? Math.min((timestamp - lastFrameTime) / 1000, 0.1) : 0.016;
    lastFrameTime = timestamp;

    const playing = pollAudio();
    targetAlpha = playing ? 1 : 0;

    // Smooth alpha transition
    if (targetAlpha > currentAlpha) {
      currentAlpha += CONFIG.opacityAttack;
      if (currentAlpha > targetAlpha) currentAlpha = targetAlpha;
    } else {
      currentAlpha -= CONFIG.opacityDecay;
      if (currentAlpha < targetAlpha) currentAlpha = targetAlpha;
    }

    const w = window.innerWidth;
    const h = window.innerHeight;

    ctx.clearRect(0, 0, w, h);

    // Only draw when visible
    if (currentAlpha > 0.001) {
      ctx.globalAlpha = currentAlpha;

      for (const p of particles) {
        p.update(dt, w, h, audioBass, audioMid);
        p.draw(ctx);
      }
    }

    animId = requestAnimationFrame(animate);
  }

  // ── Init ──
  function init() {
    if (isRunning) return;

    // Create canvas
    canvas = document.createElement('canvas');
    canvas.id = 'audio-particles-canvas';
    canvas.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;' +
      'pointer-events:none;z-index:2;';

    // Insert after wallpaper layer, before content
    const wallpaper = document.getElementById('wallpaper-layer');
    if (wallpaper && wallpaper.nextSibling) {
      wallpaper.parentNode.insertBefore(canvas, wallpaper.nextSibling);
    } else {
      document.body.appendChild(canvas);
    }

    ctx = canvas.getContext('2d');

    // Build particles
    const w = window.innerWidth;
    const h = window.innerHeight;
    particles = [];
    for (let i = 0; i < CONFIG.count; i++) {
      particles.push(new Particle(w, h));
    }

    resize();
    window.addEventListener('resize', resize);

    isRunning = true;
    currentAlpha = 0;
    targetAlpha = 0;
    lastFrameTime = 0;
    animId = requestAnimationFrame(animate);

    console.log('[AudioParticles] Initialized —', CONFIG.count, 'particles');
  }

  function destroy() {
    isRunning = false;
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
    window.removeEventListener('resize', resize);
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
    canvas = null;
    ctx = null;
    particles = [];
    console.log('[AudioParticles] Destroyed');
  }

  // ── Expose ──
  window.AudioParticles = { init, destroy };
})();
