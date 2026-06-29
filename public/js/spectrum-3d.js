// ============================================================
// FluidMusic — 3D Multi-Layer Particle Spectrum
// Multi-layer particle-based spectrum (non-traditional bars)
// 3D circular arrangement, draggable orbit
// ============================================================
(function () {
  if (typeof THREE === 'undefined') {
    console.warn('Spectrum3D: THREE not loaded');
    window.Spectrum3D = { init: function () { return false; } };
    return;
  }

  const Spectrum3D = {
    scene: null,
    camera: null,
    renderer: null,
    layers: [],
    layerCount: 3,
    particlesPerLayer: 180,
    radius: 3.5,
    time: 0,
    mouseDown: false,
    mouseX: 0,
    mouseY: 0,
    rotX: 0.3,
    rotY: 0,
    initialized: false,
  };

  function createLayer(yOffset, particleCount, color) {
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = Spectrum3D.radius;
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

    const points = new THREE.Points(geo, mat);
    return points;
  }

  function init(canvas) {
    if (Spectrum3D.initialized) return true;
    try {
      const renderer = new THREE.WebGLRenderer({ canvas: canvas || document.getElementById('spectrum-canvas'), alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);

      const container = canvas ? canvas.parentElement : document.getElementById('spectrum-container');
      const w = container ? container.clientWidth : 360;
      const h = container ? container.clientHeight : 80;
      renderer.setSize(w, h);

      Spectrum3D.renderer = renderer;
      Spectrum3D.scene = new THREE.Scene();
      Spectrum3D.camera = new THREE.PerspectiveCamera(50, w / Math.max(h, 1), 0.1, 30);
      Spectrum3D.camera.position.set(0, 0, 5);
      Spectrum3D.camera.lookAt(0, 0, 0);

      // Create 3 circular layers at different heights
      const layerConfigs = [
        { y: -0.3, color: '#ff6644', freqKey: 'bass' },     // Bass ring (reddish)
        { y: 0, color: '#44bbff', freqKey: 'mid' },         // Mid ring (blue)
        { y: 0.3, color: '#aa88ff', freqKey: 'treble' },     // Treble ring (purple)
      ];

      Spectrum3D.layers = layerConfigs.map((config, i) => {
        const points = createLayer(config.y, Spectrum3D.particlesPerLayer, config.color);
        points.userData = { freqKey: config.freqKey, baseY: config.y, color: config.color };
        Spectrum3D.scene.add(points);
        return points;
      });

      // Orbit via mouse drag
      if (container) {
        container.addEventListener('mousedown', (e) => {
          Spectrum3D.mouseDown = true;
          Spectrum3D.mouseX = e.clientX;
          Spectrum3D.mouseY = e.clientY;
        });
        container.addEventListener('mousemove', (e) => {
          if (Spectrum3D.mouseDown) {
            Spectrum3D.rotY += (e.clientX - Spectrum3D.mouseX) * 0.01;
            Spectrum3D.rotX += (e.clientY - Spectrum3D.mouseY) * 0.01;
            Spectrum3D.mouseX = e.clientX;
            Spectrum3D.mouseY = e.clientY;
          }
        });
        window.addEventListener('mouseup', () => { Spectrum3D.mouseDown = false; });
      }

      Spectrum3D.initialized = true;
      console.log('Spectrum 3D initialized');
      return true;
    } catch (e) {
      console.error('Spectrum 3D init failed:', e);
      return false;
    }
  }

  function tick(dt) {
    if (!Spectrum3D.initialized) return;
    Spectrum3D.time += dt || 0.016;

    // Update particles per layer
    Spectrum3D.layers.forEach((points) => {
      const freqKey = points.userData.freqKey;
      let freqValue = 0;
      if (typeof FluidAudio !== 'undefined' && FluidAudio.bands) {
        freqValue = FluidAudio.bands[freqKey] || 0;
      }

      const pos = points.geometry.attributes.position;
      const baseY = points.userData.baseY;

      for (let i = 0; i < Spectrum3D.particlesPerLayer; i++) {
        const angle = (i / Spectrum3D.particlesPerLayer) * Math.PI * 2;
        const phaseOffset = i * 0.35;
        const particleValue = freqValue * (0.5 + 0.5 * Math.sin(angle * 4 + Spectrum3D.time * 3 + phaseOffset));

        // Radial expansion based on frequency
        const radius = Spectrum3D.radius + particleValue * 2.5;
        pos.array[i * 3] = Math.cos(angle) * radius;
        pos.array[i * 3 + 1] = baseY + particleValue * 0.8;
        pos.array[i * 3 + 2] = Math.sin(angle) * radius;
      }
      pos.needsUpdate = true;

      // Opacity driven by energy
      if (typeof FluidAudio !== 'undefined' && FluidAudio.bands) {
        points.material.opacity = 0.3 + FluidAudio.bands.energy * 0.7;
      }
    });

    // Camera orbit
    Spectrum3D.camera.position.set(
      Math.sin(Spectrum3D.rotY) * 5,
      0.5 + Spectrum3D.rotX * 3,
      Math.cos(Spectrum3D.rotY) * 5
    );
    Spectrum3D.camera.lookAt(0, 0, 0);
  }

  function render() {
    if (!Spectrum3D.initialized || !Spectrum3D.renderer) return;
    Spectrum3D.renderer.render(Spectrum3D.scene, Spectrum3D.camera);
  }

  function resize() {
    if (!Spectrum3D.initialized) return;
    const container = document.getElementById('spectrum-container');
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    Spectrum3D.renderer.setSize(w, h);
    Spectrum3D.camera.aspect = w / Math.max(h, 1);
    Spectrum3D.camera.updateProjectionMatrix();
  }

  Spectrum3D.init = init;
  Spectrum3D.tick = tick;
  Spectrum3D.render = render;
  Spectrum3D.resize = resize;

  window.Spectrum3D = Spectrum3D;
  window.addEventListener('resize', resize);
  console.log('FluidMusic Spectrum 3D loaded');
})();
