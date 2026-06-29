// ============================================================
// FluidMusic — Foam Bubble System
// Reference: Mineradio-MacOS 泡沫·珍珠虹彩·柔波浮沉 preset
// Multi-layer sphere particle groups, pearl iridescence
// Audio-driven float + rotation, random color palette every 30s
// ============================================================
(function () {
  if (typeof THREE === 'undefined') {
    console.warn('FoamSystem: THREE not loaded');
    window.FoamSystem = { init: function () { return false; } };
    return;
  }

  const FoamSystem = {
    scene: null,
    camera: null,
    renderer: null,
    foamPoints: null,
    material: null,
    time: 0,
    colorTimer: 0,
    colorBase: new THREE.Color('#faf5f0'),    // Pearl white
    colorAccent: new THREE.Color('#99ccff'),   // Soft blue
    iridescence: 0.6,
    bubbleCount: 80,
    floatAmplitude: 1.0,
    initialized: false,
  };

  // ── Color palettes ──
  const palettes = [
    { base: '#faf5f0', accent: '#99ccff' },  // Pearl + soft blue
    { base: '#fff8f0', accent: '#ff99bb' },  // Pearl + soft pink
    { base: '#f8f8ff', accent: '#99ffcc' },  // Pearl + soft mint
    { base: '#fff5f5', accent: '#ddbbff' },  // Pearl + lavender
    { base: '#f5f5ff', accent: '#ffcc88' },  // Pearl + warm peach
    { base: '#f0f0ff', accent: '#88ddff' },  // Pearl + sky blue
  ];

  function randomPalette() {
    const p = palettes[Math.floor(Math.random() * palettes.length)];
    FoamSystem.colorBase.set(p.base);
    FoamSystem.colorAccent.set(p.accent);
  }

  function createShaderMaterial() {
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
        uColorBase: { value: FoamSystem.colorBase },
        uColorAccent: { value: FoamSystem.colorAccent },
        uIridescence: { value: FoamSystem.iridescence },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    });
  }

  function buildBubbleGeometry(count) {
    const positions = [];
    const sizes = [];
    const phases = [];
    const frequencies = [];
    const layers = [];

    // Arrange bubbles in an organic cluster
    const clusterRadius = 2.0;
    for (let i = 0; i < count; i++) {
      // Spherical distribution with some randomness
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const r = clusterRadius * Math.pow(Math.random(), 0.5) * 1.2;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.cos(phi) * 0.6; // Flatten vertically
      const z = r * Math.sin(phi) * Math.sin(theta);

      positions.push(x, y, z);

      // Vary bubble sizes
      sizes.push(2.0 + Math.random() * 6.0);

      // Random phase for different float timing
      phases.push(Math.random());

      // Frequency variation
      frequencies.push(0.3 + Math.random() * 1.0);

      // Layer assignment for audio response
      layers.push(Math.random()); // 0=bass-heavy, 1=treble-heavy
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
    geo.setAttribute('aFrequency', new THREE.Float32BufferAttribute(frequencies, 1));
    geo.setAttribute('aLayer', new THREE.Float32BufferAttribute(layers, 1));

    return geo;
  }

  function init(canvas) {
    if (FoamSystem.initialized) return true;
    try {
      const renderer = new THREE.WebGLRenderer({ canvas: canvas || document.getElementById('foam-canvas'), alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);

      // Get container size or use defaults
      const container = canvas ? canvas.parentElement : document.getElementById('foam-visualizer-layer');
      const w = container ? container.clientWidth : 380;
      const h = container ? container.clientHeight : 60;
      renderer.setSize(w, h);

      FoamSystem.renderer = renderer;
      FoamSystem.scene = new THREE.Scene();
      FoamSystem.camera = new THREE.PerspectiveCamera(40, w / Math.max(h, 1), 0.1, 30);
      FoamSystem.camera.position.set(0, 1.5, 8);
      FoamSystem.camera.lookAt(0, 0, 0);

      FoamSystem.material = createShaderMaterial();
      const geometry = buildBubbleGeometry(FoamSystem.bubbleCount);
      FoamSystem.foamPoints = new THREE.Points(geometry, FoamSystem.material);
      FoamSystem.scene.add(FoamSystem.foamPoints);

      // Initial palette
      randomPalette();

      FoamSystem.initialized = true;
      console.log('Foam System initialized with', FoamSystem.bubbleCount, 'bubbles');
      return true;
    } catch (e) {
      console.error('Foam System init failed:', e);
      return false;
    }
  }

  function tick(dt) {
    if (!FoamSystem.initialized) return;
    FoamSystem.time += dt || 0.016;

    // Update uniforms
    const u = FoamSystem.material.uniforms;
    u.uTime.value = FoamSystem.time;
    u.uColorBase.value.copy(FoamSystem.colorBase);
    u.uColorAccent.value.copy(FoamSystem.colorAccent);
    u.uIridescence.value = FoamSystem.iridescence;

    // Audio reactivity
    if (typeof FluidAudio !== 'undefined' && FluidAudio.bands) {
      u.uBass.value = FluidAudio.bands.bass;
      u.uMid.value = FluidAudio.bands.mid;
      u.uTreble.value = FluidAudio.bands.treble;
      u.uEnergy.value = FluidAudio.bands.energy;
    }

    // Auto color rotation every 30 seconds
    FoamSystem.colorTimer += dt || 0.016;
    if (FoamSystem.colorTimer >= 30) {
      FoamSystem.colorTimer = 0;
      randomPalette();
    }

    // Gentle camera rotation
    FoamSystem.camera.position.x = Math.sin(FoamSystem.time * 0.15) * 1.5;
    FoamSystem.camera.position.z = 8 + Math.cos(FoamSystem.time * 0.1) * 0.5;
    FoamSystem.camera.lookAt(0, 0, 0);
  }

  function updateFoamVisibility() {
  const layer = document.getElementById('foam-visualizer-layer');
  if (!layer) return;
  if (typeof FluidAudio !== 'undefined' && FluidAudio.playing) {
    layer.classList.add('active');
  } else {
    layer.classList.remove('active');
  }
}

function render() {
    if (!FoamSystem.initialized || !FoamSystem.renderer) return;
    FoamSystem.renderer.render(FoamSystem.scene, FoamSystem.camera);
  }

  function resize() {
    if (!FoamSystem.initialized) return;
    const container = document.getElementById('foam-visualizer-layer');
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    FoamSystem.renderer.setSize(w, h);
    FoamSystem.camera.aspect = w / Math.max(h, 1);
    FoamSystem.camera.updateProjectionMatrix();
  }

  // ── Public API ──
  FoamSystem.init = init;
  FoamSystem.tick = tick;
  FoamSystem.render = render;
  FoamSystem.updateFoamVisibility = updateFoamVisibility;
  FoamSystem.resize = resize;

  FoamSystem.setCount = function (n) {
    if (!FoamSystem.initialized) return;
    if (FoamSystem.foamPoints) {
      FoamSystem.foamPoints.geometry.dispose();
    }
    FoamSystem.bubbleCount = n;
    FoamSystem.foamPoints.geometry = buildBubbleGeometry(n);
  };

  FoamSystem.setIridescence = function (v) {
    FoamSystem.iridescence = v;
    if (FoamSystem.material) FoamSystem.material.uniforms.uIridescence.value = v;
  };

  FoamSystem.setFloatAmplitude = function (v) {
    FoamSystem.floatAmplitude = v;
  };

  window.FoamSystem = FoamSystem;
  window.addEventListener('resize', resize);
  console.log('FluidMusic Foam System loaded');
})();
