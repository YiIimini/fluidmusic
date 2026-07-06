// ============================================================
// FluidMusic — Particle Cover System (Reusable)
// Reference: Mineradio-MacOS buildCoverParticleGeometry()
// Sand-like fine particles, 118×118 grid, multi-layer frequency drive
// Orbit controls, entrance/disperse animations
// ============================================================
(function () {
  if (typeof THREE === 'undefined') {
    console.warn('ParticleCover: THREE not loaded');
    window.ParticleCover = { init: function () { return false; } };
    return;
  }

  const ParticleCover = {
    scene: null,
    camera: null,
    renderer: null,
    particleSystem: null,
    geometry: null,
    material: null,
    texture: null,
    resolution: 160,
    layers: 4,
    transition: 0, // 0=dissolved, 1=formed
    targetTransition: 0,
    transitionSpeed: 0.8,
    time: 0,
    initialized: false,
    mouseDown: false,
    mouseX: 0,
    mouseY: 0,
    targetRotX: 0,
    targetRotY: 0,
    rotX: 0,
    rotY: 0,
    zoom: 3.0,
    coverUrl: null,
  };

  // ── Build particle geometry from image ──
  function buildCoverParticleGeometry(image, resolution) {
    const res = resolution || 160;
    const canvas = document.createElement('canvas');
    canvas.width = res;
    canvas.height = res;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, res, res);
    const imageData = ctx.getImageData(0, 0, res, res);

    const positions = [];
    const randoms = [];
    const layers = [];
    const uvs = [];

    const halfRes = (res - 1) / 2;
    const spacing = 1.0 / res;
    const PLANE_SPREAD = 3.8; // Larger spread — particles extend beyond container for 3D breakout

    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const idx = (y * res + x) * 4;
        const r = imageData.data[idx];
        const g = imageData.data[idx + 1];
        const b = imageData.data[idx + 2];
        // alpha channel (unused)

        const brightness = (r + g + b) / 3 / 255;

        // Grid position centered, scaled to fill viewport
        const px = (x - halfRes) * spacing * PLANE_SPREAD;
        const py = (y - halfRes) * spacing * PLANE_SPREAD * -1; // Flip Y
        const pz = 0;

        positions.push(px, py, pz);
        randoms.push(Math.random());

        // Assign layer based on brightness
        let layer;
        if (brightness > 0.6) layer = 0; // Front / Bass
        else if (brightness > 0.3) layer = 0.5; // Mid
        else layer = 1.0; // Back / Treble

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

  function createShaderMaterial(texture) {
    // ── Generate soft dot texture (Mineradio-style uDotTex) ──
    const dotCanvas = document.createElement('canvas');
    dotCanvas.width = 64; dotCanvas.height = 64;
    const dotCtx = dotCanvas.getContext('2d');
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

    // ── Vertex Shader — ALL particles respond to ALL audio bands with continuous undulation ──
    const vertexShader = [
      'uniform float uTime; uniform float uBass; uniform float uMid; uniform float uTreble; uniform float uEnergy;',
      'uniform float uTransition; uniform float uPixel; uniform float uColorBoost;',
      'uniform vec2 uMouse; uniform float uBreath;',
      'uniform sampler2D uTexture;',
      'attribute float aRandom; attribute float aLayer;',
      'varying vec3 vColor; varying float vBright; varying float vRipple; varying float vAlpha; varying float vSourceLum;',
      'float hash(float n){return fract(sin(n)*43758.5453123);}',
      'float noise3D(vec3 p){vec3 f=fract(p);f=f*f*(3.0-2.0*f);float n=dot(floor(p),vec3(1.0,57.0,113.0));return mix(mix(mix(hash(n),hash(n+1.0),f.x),mix(hash(n+57.0),hash(n+58.0),f.x),f.y),mix(mix(hash(n+113.0),hash(n+114.0),f.x),mix(hash(n+170.0),hash(n+171.0),f.x),f.y),f.z);}',
      'void main(){',
      'vec2 texUv = uv;',
      'vec3 pos = position;',
      // ── Enhanced spiral scatter (Mineradio-MacOS style) ──
      'float scatter = 1.0 - uTransition; float scatterStr = scatter * 3.5;',
      'float spiralAngle = aRandom * 6.28318 + uTime * 0.6 * scatter;',
      'float spiralRadius = (0.25 + aRandom * 0.75) * scatterStr;',
      'float orbitSpeed = mix(0.5, 1.5, aRandom);',
      'pos.x += cos(spiralAngle * orbitSpeed) * spiralRadius * scatter;',
      'pos.y += sin(spiralAngle * orbitSpeed) * spiralRadius * scatter;',
      'pos.z += sin(spiralAngle * 1.7 + aRandom * 3.0) * spiralRadius * 0.6 * scatter;',
      // ── Mouse interaction: particles subtly repel from cursor ──
      'vec3 mouseWorld = vec3(uMouse.x * 3.2, uMouse.y * 3.2, 0.0);',
      'float mouseDist = length(pos.xy - mouseWorld.xy);',
      'float mouseForce = smoothstep(2.0, 0.0, mouseDist) * uTransition * 0.35;',
      'vec2 repelDir = normalize(pos.xy - mouseWorld.xy + 0.001);',
      'pos.xy += repelDir * mouseForce * 0.45;',
      // ── Audio-reactive breathing: whole cloud expands/contracts ──
      'float breathScale = 1.0 + uBreath * 0.06;',
      'pos *= breathScale;',
      // ── ALL particles respond to ALL audio — continuous undulating motion ──
      'float n = noise3D(vec3(pos.xy * 0.8, uTime * 0.6 + aRandom * 5.0));',
      'float waveA = sin(uTime * 0.9 + aRandom * 12.0) * 0.5 + 0.5;',
      'float waveB = cos(uTime * 1.3 + aRandom * 7.0 + pos.x * 2.0) * 0.5 + 0.5;',
      'float waveC = sin(uTime * 1.7 + aRandom * 18.0 + pos.y * 1.5) * 0.5 + 0.5;',
      // ── Real 3D depth: z-layering based on brightness + audio ──
      'float bassPush = uBass * (0.8 + waveA * 0.5);',
      'float midRipple = uMid * (0.5 + waveB * 0.7) * 0.8;',
      'float trebleSparkle = uTreble * (0.4 + waveC * 0.8) * 0.6;',
      'float noiseShift = (n - 0.5) * 0.5 * uEnergy;',
      'float totalLift = bassPush + midRipple + trebleSparkle + noiseShift;',
      'float baseZ = (1.0 - aLayer) * 0.8;',
      'pos.z += baseZ + totalLift * (0.5 + aRandom * 0.4);',
      // Lateral audio-driven drift
      'pos.x += sin(uTime * 0.7 + aRandom * 9.0 + pos.z * 2.0) * uMid * 0.15;',
      'pos.y += cos(uTime * 0.8 + aRandom * 11.0 + pos.z * 1.5) * uTreble * 0.12;',
      // Sample cover texture for color
      'vec3 texColor = texture2D(uTexture, texUv).rgb;',
      'float lum = dot(texColor, vec3(0.299, 0.587, 0.114));',
      'vColor = pow(max(texColor, vec3(0.0)), vec3(1.0 / max(0.35, uColorBoost)));',
      'vBright = 0.82 + uEnergy * 0.35 + uBass * 0.12 + uMid * 0.06 + lum * 0.45 + uTransition * 0.15;',
      'vSourceLum = lum;',
      'vRipple = totalLift;',
      'vAlpha = uTransition * uTransition * (3.0 - 2.0 * uTransition);',
      // ── Depth-aware point size ──
      'vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);',
      'float depthFactor = min(1.0, 3.0 / max(0.3, -mvPosition.z));',
      'float audioBoost = 1.0 + uEnergy * 0.4 + uBass * 0.25 + waveA * 0.12;',
      'float sz = clamp(2.8 * depthFactor * audioBoost, 0.9, 4.5);',
      'gl_PointSize = sz * uPixel;',
      'gl_Position = projectionMatrix * mvPosition;',
      '}',
    ].join('\n');

    // ── Fragment Shader (Mineradio-style: soft dot, discard black, rim lighting) ──
    const fragmentShader = [
      'precision highp float;',
      'uniform sampler2D uDotTex;',
      'uniform float uAlpha, uEnergy, uBass;',
      'varying vec3 vColor; varying float vBright; varying float vRipple; varying float vAlpha; varying float vSourceLum;',
      'void main(){',
      'vec4 tex = texture2D(uDotTex, gl_PointCoord);',
      'if (tex.a < 0.02) discard;',
      'vec3 col = vColor * vBright;',
      // Audio ripple boost
      'col = mix(col, col * 1.2, vRipple * 0.35);',
      // ── Depth-based coloring (Mineradio-MacOS holographic style) ──',
      // Bright pixels (front layer) get warm golden tint, dark pixels (back) get cool blue tint',
      'float warmth = vSourceLum;',
      'vec3 warmTint = vec3(1.10, 0.88, 0.70);',
      'vec3 coolTint = vec3(0.72, 0.78, 1.10);',
      'vec3 depthColor = mix(coolTint, warmTint, warmth);',
      'col = col * depthColor;',
      // Discard black/dark particles (negative space)
      'float keepBlack = 1.0 - smoothstep(0.025, 0.115, vSourceLum);',
      'float nonBlack = 1.0 - keepBlack;',
      // ── 3D rim lighting with specular highlight ──
      'float dotDist = length(gl_PointCoord - vec2(0.5)) * 2.0;',
      'float rim = smoothstep(0.35, 0.85, dotDist) * (1.0 - smoothstep(0.85, 1.05, dotDist)) * tex.a;',
      'float specular = smoothstep(0.55, 0.7, dotDist) * (1.0 - smoothstep(0.7, 0.8, dotDist)) * tex.a * 0.6;',
      'float outLum = dot(col, vec3(0.299, 0.587, 0.114));',
      'float lightParticle = smoothstep(0.45, 0.85, outLum) * nonBlack;',
      'float darkParticle = (1.0 - smoothstep(0.15, 0.45, outLum)) * nonBlack;',
      // Rim darkens edges for sphere-like 3D
      'col = mix(col, vec3(0.02), rim * lightParticle * 0.45);',
      'col = mix(col, vec3(0.95), rim * darkParticle * 0.25);',
      // Specular hot spot for glossy 3D look
      'col += vec3(0.25, 0.22, 0.35) * specular * lightParticle;',
      // Energy glow — warm/cool shift based on audio
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
        uMouse: { value: new THREE.Vector2(0, 0) },
        uBreath: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    });
  }

  function init(canvas, imageUrl) {
    console.log('[ParticleCover] init START | canvas:', !!canvas, '| imageUrl:', (imageUrl||'').substring(0, 30));
    if (ParticleCover.initialized) { console.log('[ParticleCover] already initialized'); return true; }
    try {
      // Use shared renderer if available, otherwise create fallback
      const useShared = (typeof RendererManager !== 'undefined' && RendererManager.initialized);
      if (!useShared) {
        console.log('[ParticleCover] Creating standalone WebGL renderer (fallback)...');
        const renderer = new THREE.WebGLRenderer({ canvas: canvas || undefined, alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        const containerEl = canvas ? canvas.parentElement : document.getElementById('particle-cover-container');
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
        ParticleCover.renderer = renderer;
        console.log('[ParticleCover] Standalone WebGL renderer created | canvas size:', cw, 'x', ch);
      } else {
        console.log('[ParticleCover] Using shared RendererManager');
      }
      ParticleCover.scene = new THREE.Scene();
      ParticleCover.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 20);
      ParticleCover.camera.position.z = ParticleCover.zoom;
      // Create material eagerly (before image loads) so onTrackChange can update it immediately
      ParticleCover.material = createShaderMaterial(null);
      console.log('[ParticleCover] Material created eagerly');

      // Load demo image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        console.log('[ParticleCover] Image loaded OK | building geometry...');
        try { if (typeof fluidmusic !== 'undefined' && fluidmusic.log) fluidmusic.log('ParticleCover image OK, building geometry...'); } catch(_) {}
        // Create texture from loaded image (draw to canvas for CanvasTexture)
        const texCanvas = document.createElement('canvas');
        texCanvas.width = img.width;
        texCanvas.height = img.height;
        const texCtx = texCanvas.getContext('2d');
        texCtx.drawImage(img, 0, 0);
        const texture = new THREE.CanvasTexture(texCanvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        ParticleCover.texture = texture;
        // Create material with texture for real image colors
        ParticleCover.material = createShaderMaterial(texture);
        ParticleCover.geometry = buildCoverParticleGeometry(img, ParticleCover.resolution);
        if (ParticleCover.particleSystem) {
          ParticleCover.scene.remove(ParticleCover.particleSystem);
        }
        ParticleCover.particleSystem = new THREE.Points(ParticleCover.geometry, ParticleCover.material);
        ParticleCover.scene.add(ParticleCover.particleSystem);
        console.log('[ParticleCover] Particle system added to scene, ' + ParticleCover.geometry.attributes.position.count + ' particles');
        try { if (typeof fluidmusic !== 'undefined' && fluidmusic.log) fluidmusic.log('ParticleCover: ' + ParticleCover.geometry.attributes.position.count + ' particles ready'); } catch(_) {}

        // Register with shared renderer NOW (scene is populated)
        if (typeof RendererManager !== 'undefined' && RendererManager.initialized && !ParticleCover._registered) {
          RendererManager.registerLayer('particle', ParticleCover.scene, ParticleCover.camera, {
            tick: tick,
            visible: true,
          });
          ParticleCover._registered = true;
          console.log('[ParticleCover] Registered with RendererManager');
        }

        // Entrance animation
        ParticleCover.targetTransition = 1;
        ParticleCover.transitionSpeed = 1.0 / 0.6; // 0.6s fast entrance (matches Mineradio)
      };
      // Route remote images through cover proxy to avoid CORS tainting
      const initUrl = imageUrl || 'assets/icon.png';
      const isRemote = initUrl.startsWith('https://') || initUrl.startsWith('http://');
      if (!isRemote) img.crossOrigin = 'anonymous';
      img.src = isRemote
        ? 'http://127.0.0.1:' + (window.location.port || 3000) + '/api/cover-proxy?url=' + encodeURIComponent(initUrl)
        : initUrl;

      // Mouse interaction — hover-based 3D orbit (no click needed)
      const container = canvas && canvas.parentElement ? canvas.parentElement : document.getElementById("particle-cover-container");
      if (container) {
        container.addEventListener('mousemove', (e) => {
          const rect = container.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          // Map mouse position to rotation: center = no rotation, edges = max rotation
          const dx = (e.clientX - cx) / (rect.width / 2);
          const dy = (e.clientY - cy) / (rect.height / 2);
          ParticleCover.targetRotY = dx * 0.5;
          ParticleCover.targetRotX = -dy * 0.4;
          // Store mouse position for particle repulsion (clip-space: -1 to 1)
          ParticleCover.mouseX = dx;
          ParticleCover.mouseY = -dy;
        });
        container.addEventListener('mouseleave', () => {
          // Return to neutral when mouse leaves
          ParticleCover.targetRotY = 0;
          ParticleCover.targetRotX = 0;
          ParticleCover.mouseX = 0;
          ParticleCover.mouseY = 0;
        });
        container.addEventListener('wheel', (e) => {
          e.preventDefault();
          ParticleCover.zoom += e.deltaY * 0.005;
          ParticleCover.zoom = Math.max(1.8, Math.min(5.0, ParticleCover.zoom));
        });
      }

      ParticleCover.initialized = true;
      // Registration happens in img.onload above (scene must be populated first)
      console.log('Particle Cover initialized (registration deferred until image loads)');
      try { if (typeof fluidmusic !== 'undefined' && fluidmusic.log) fluidmusic.log('ParticleCover init OK'); } catch(_) {}
      return true;
    } catch (e) {
      console.error('Particle Cover init failed:', e);
      try { if (typeof fluidmusic !== 'undefined' && fluidmusic.log) fluidmusic.log('ParticleCover init FAILED: ' + e.message); } catch(_) {}
      return false;
    }
  }

  function tick(dt) {
    if (!ParticleCover.initialized) return;
    // Guard: skip tick until texture and geometry are fully loaded
    if (!ParticleCover.texture || !ParticleCover.geometry) return;
    ParticleCover.time += dt || 0.016;

    // Play-state driven visibility: dissolve when silent, form when playing
    if (typeof FluidAudio !== 'undefined') {
      ParticleCover.targetTransition = FluidAudio.playing ? 1 : 0;
    }

    // Smooth transition
    ParticleCover.transition += (ParticleCover.targetTransition - ParticleCover.transition) * (ParticleCover.transitionSpeed || 0.8);
    ParticleCover.material.uniforms.uTime.value = ParticleCover.time;
    ParticleCover.material.uniforms.uTransition.value = ParticleCover.transition;

    // Audio reactivity
    if (typeof FluidAudio !== 'undefined' && FluidAudio.bands) {
      ParticleCover.material.uniforms.uBass.value = FluidAudio.bands.bass;
      ParticleCover.material.uniforms.uMid.value = FluidAudio.bands.mid;
      ParticleCover.material.uniforms.uTreble.value = FluidAudio.bands.treble;
      ParticleCover.material.uniforms.uEnergy.value = FluidAudio.bands.energy;
      // Smooth breath: low-pass filter the energy for gentle breathing pulse
      var targetBreath = FluidAudio.bands.energy * 0.7 + FluidAudio.bands.bass * 0.3;
      var currentBreath = ParticleCover.material.uniforms.uBreath.value;
      ParticleCover.material.uniforms.uBreath.value = currentBreath + (targetBreath - currentBreath) * 0.15;
    }

    // Mouse position uniform (clip-space, already stored by mousemove)
    ParticleCover.material.uniforms.uMouse.value.set(
      ParticleCover.mouseX || 0,
      ParticleCover.mouseY || 0
    );

    // Smooth orbit rotation
    ParticleCover.rotX += (ParticleCover.targetRotX - ParticleCover.rotX) * 0.08;
    ParticleCover.rotY += (ParticleCover.targetRotY - ParticleCover.rotY) * 0.08;

    ParticleCover.camera.position.set(
      Math.sin(ParticleCover.rotY) * ParticleCover.zoom,
      Math.sin(ParticleCover.rotX) * ParticleCover.zoom,
      Math.cos(ParticleCover.rotY) * ParticleCover.zoom
    );
    ParticleCover.camera.lookAt(0, 0, 0);
  }

  function render() {
    if (!ParticleCover.initialized) return;
    // Guard: skip render until we have geometry to draw
    if (!ParticleCover.particleSystem || !ParticleCover.texture) return;
    // Rendering is handled by RendererManager when available
    if (typeof RendererManager !== 'undefined' && RendererManager.initialized) return;
    if (!ParticleCover.renderer) return;
    ParticleCover.renderer.render(ParticleCover.scene, ParticleCover.camera);
  }

  // ── Public API ──
  ParticleCover.init = init;
  ParticleCover.tick = tick;
  ParticleCover.render = render;

  ParticleCover.setResolution = function (r) {
    if (r === ParticleCover.resolution) return;
    ParticleCover.resolution = r;
    // Trigger rebuild with current image
    if (ParticleCover.texture && ParticleCover.coverUrl) {
      console.log('[ParticleCover] Resolution changed to ' + r + ', reloading cover...');
      ParticleCover.loadImage(ParticleCover.coverUrl);
    }
  };

  ParticleCover.dissolve = function (callback) {
    ParticleCover.targetTransition = 0;
    ParticleCover.transitionSpeed = 2.5; // 0.4s dissolve
    if (callback) setTimeout(callback, 400);
  };

  ParticleCover.form = function (callback) {
    ParticleCover.targetTransition = 1;
    ParticleCover.transitionSpeed = 1.25; // 0.8s form
    if (callback) setTimeout(callback, 800);
  };

  ParticleCover.loadImage = function (imageUrl) {
    if (!imageUrl) {
      console.warn('[ParticleCover] loadImage called with empty URL, skipping');
      return;
    }
    const rawUrl = String(imageUrl).replace(/^http:/, 'https:');

    // Route remote URLs through local proxy to avoid CORS canvas tainting
    // (getImageData requires untainted canvas for pixel reading)
    const isRemote = rawUrl.startsWith('https://') || rawUrl.startsWith('http://');
    const url = isRemote
      ? 'http://127.0.0.1:' + (window.location.port || 3000) + '/api/cover-proxy?url=' + encodeURIComponent(rawUrl)
      : rawUrl;

    ParticleCover.coverUrl = rawUrl; // stored for resolution changes
    console.log('[ParticleCover] loadImage START:', rawUrl.substring(0, 60), '| proxied:', isRemote, '| material:', !!ParticleCover.material);
    const img = new Image();
    // No crossOrigin needed since proxy handles CORS
    if (!isRemote) img.crossOrigin = 'anonymous';
    img.onload = function () {
      try {
        // Update texture
        const texCanvas2 = document.createElement('canvas');
        texCanvas2.width = img.width;
        texCanvas2.height = img.height;
        const texCtx2 = texCanvas2.getContext('2d');
        texCtx2.drawImage(img, 0, 0);
        const texture = new THREE.CanvasTexture(texCanvas2);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        ParticleCover.texture = texture;
        // Always update material texture (material exists eagerly)
        if (ParticleCover.material && ParticleCover.material.uniforms) {
          ParticleCover.material.uniforms.uTexture.value = texture;
          console.log('[ParticleCover] Texture updated in material');
        }
        // Rebuild geometry
        if (ParticleCover.geometry) ParticleCover.geometry.dispose();
        ParticleCover.geometry = buildCoverParticleGeometry(img, ParticleCover.resolution);
        // Swap geometry if particle system exists, otherwise create one
        if (ParticleCover.particleSystem) {
          ParticleCover.particleSystem.geometry = ParticleCover.geometry;
        } else {
          // Particle system not ready yet — create it now
          ParticleCover.particleSystem = new THREE.Points(ParticleCover.geometry, ParticleCover.material);
          ParticleCover.scene.add(ParticleCover.particleSystem);
          ParticleCover.targetTransition = 1;
          ParticleCover.transitionSpeed = 1.0 / 0.6;
          console.log('[ParticleCover] Created particle system from loadImage');
        }
        // Re-register with updated scene if needed
        if (typeof RendererManager !== 'undefined' && RendererManager.initialized && !ParticleCover._registered) {
          RendererManager.registerLayer('particle', ParticleCover.scene, ParticleCover.camera, {
            tick: tick,
            visible: true,
          });
          ParticleCover._registered = true;
        }
        console.log('[ParticleCover] Cover loaded successfully:', url.substring(0, 60));
      } catch(e) {
        console.warn('[ParticleCover] Failed to rebuild:', e.message, e.stack);
      }
    };
    img.onerror = function () {
      console.warn('[ParticleCover] Failed to load image:', url.substring(0, 80));
    };
    img.src = url;
  };

  ParticleCover.setScatterStrength = function (_v) { /* future: drive uniform */ };
  ParticleCover.setSensitivity = function (_v) { /* future use */ };
  ParticleCover.setRotationSpeed = function (_v) { /* future use */ };

  // Resize handler
  function onResize() {
    if (!ParticleCover.initialized) return;
    const containerEl = document.getElementById('particle-cover-container');
    if (!containerEl) return;
    const cw = containerEl.clientWidth;
    const ch = containerEl.clientHeight;

    if (typeof RendererManager !== 'undefined' && RendererManager.initialized) {
      // No viewport constraint — particles render full-screen
    } else if (ParticleCover.renderer) {
      ParticleCover.renderer.setSize(cw, ch);
    }
    ParticleCover.camera.aspect = cw / Math.max(ch, 1);
    ParticleCover.camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', function() {
    onResize();
  });

  if (typeof __FM !== 'undefined') __FM.register('particleCover', [], function () { return ParticleCover; }, { priority: 7 });
  window.ParticleCover = ParticleCover;
  console.log('FluidMusic Particle Cover loaded');
})();
