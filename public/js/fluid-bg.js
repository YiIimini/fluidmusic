// ============================================================
// FluidMusic — Fluid Background
// Full-screen water ripple dynamic background with deep base color
// Reference: Mineradio-MacOS ShojiWM liquid-terminal shader
// ============================================================
(function () {
  if (typeof THREE === 'undefined') {
    console.warn('FluidBG: THREE not loaded');
    window.FluidBackground = { init: function () { return false; }, tick: function () {}, resize: function () {} };
    return;
  }

  const FluidBG = {
    scene: null,
    camera: null,
    material: null,
    mesh: null,
    time: 0,
    intensity: 0.8,
    speed: 1.0,
    colorAccent: new THREE.Color('#1144aa'),
    initialized: false,
    // GPU downsampling: render bg at 1/2 resolution then upsample
    _renderTarget: null,
    _upsampleScene: null,
    _upsampleQuad: null,
  };

  function init(canvas) {
    if (FluidBG.initialized) return true;
    try {
      // Use shared renderer manager instead of creating own WebGL context
      if (typeof RendererManager === 'undefined' || !RendererManager.initialized) {
        if (typeof RendererManager !== 'undefined') RendererManager.init();
        if (!RendererManager.initialized) {
          console.warn('[FluidBG] RendererManager not available, creating fallback renderer');
          const canvasEl = canvas || document.getElementById('bg-canvas');
          const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, alpha: true, antialias: false });
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
          renderer.setClearColor(0x000000, 0);
          renderer.setSize(window.innerWidth, window.innerHeight);
          canvasEl.style.opacity = '0.4';
          FluidBG.renderer = renderer;
        }
      }

      FluidBG.scene = new THREE.Scene();
      FluidBG.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
      FluidBG.camera.position.z = 1;

      const uniforms = {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uIntensity: { value: FluidBG.intensity },
        uSpeed: { value: FluidBG.speed },
        uColorBase: { value: new THREE.Color('#0d0d1a') },
        uColorAccent: { value: FluidBG.colorAccent },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uEnergy: { value: 0 },
        uNoiseScale: { value: 0.5 },
        uNoiseTex: { value: null },
      };

      // Precompute noise lookup table — replaces 5-octave realtime FBM
      var noiseCanvas = document.createElement('canvas');
      noiseCanvas.width = 512;
      noiseCanvas.height = 512;
      var nctx = noiseCanvas.getContext('2d');
      var noiseData = nctx.createImageData(512, 512);
      for (var y = 0; y < 512; y++) {
        for (var x = 0; x < 512; x++) {
          var idx = (y * 512 + x) * 4;
          // Simple hash-based noise (faster than sin/cos in JS)
          var nx = (x * 0.01 + y * 0.007);
          var ny = (y * 0.01 - x * 0.007);
          var n = Math.sin(nx * 12.9898 + ny * 78.233) * 43758.5453;
          n = n - Math.floor(n);
          noiseData.data[idx] = noiseData.data[idx+1] = noiseData.data[idx+2] = Math.floor(n * 255);
          noiseData.data[idx+3] = 255;
        }
      }
      nctx.putImageData(noiseData, 0, 0);
      var noiseTexture = new THREE.CanvasTexture(noiseCanvas);
      noiseTexture.magFilter = THREE.LinearFilter;
      noiseTexture.minFilter = THREE.LinearFilter;
      noiseTexture.wrapS = THREE.RepeatWrapping;
      noiseTexture.wrapT = THREE.RepeatWrapping;
      uniforms.uNoiseTex.value = noiseTexture;

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
        'uniform vec3 uColorBase; uniform vec3 uColorAccent; uniform float uBass; uniform float uMid; uniform float uTreble; uniform float uEnergy;',
        'uniform sampler2D uNoiseTex;',
        'varying vec2 vUv;',
        'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
        'float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);float a=hash(i);float b=hash(i+vec2(1.0,0.0));float c=hash(i+vec2(0.0,1.0));float d=hash(i+vec2(1.0,1.0));return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}',
        'float fbm(vec2 p){float n=0.0;n+=texture2D(uNoiseTex,p*0.3).r*0.5;n+=texture2D(uNoiseTex,p*0.7+0.3).r*0.3;n+=texture2D(uNoiseTex,p*1.5+0.7).r*0.15;n+=texture2D(uNoiseTex,p*3.0+1.1).r*0.05;return n;}',
        'void main(){',
        'vec2 uv=gl_FragCoord.xy/uResolution;vec2 c=uv-vec2(0.5);float ar=uResolution.x/uResolution.y;vec2 uva=vec2(c.x*ar,c.y);float d=length(uva);',
        'float r1=sin(d*15.0-uTime*uSpeed*0.6)*0.5+0.5;r1*=smoothstep(1.0,0.0,d)*0.3;',
        'float r2=sin(d*25.0-uTime*uSpeed*1.2)*0.5+0.5;r2*=smoothstep(0.8,0.2,d)*0.25;',
        'float r3=sin(d*40.0-uTime*uSpeed*1.8+noise(uv*3.0)*2.0)*0.5+0.5;r3*=smoothstep(0.5,0.0,d)*0.2;',
        'vec2 fuv=uv+vec2(sin(uv.y*4.0+uTime*0.3)*0.05,cos(uv.x*4.0+uTime*0.25)*0.05);',
        'float flow=fbm(fuv*3.0+uTime*0.15);',
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

      FluidBG.material = new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
      });

      FluidBG.mesh = new THREE.Mesh(geometry, FluidBG.material);
      FluidBG.mesh.frustumCulled = false;
      FluidBG.scene.add(FluidBG.mesh);

      // ── GPU downsampling: render fluid bg at 1/2 resolution via FBO ──
      // Reduces pixel shader invocations by 75% with minimal visual difference
      var hw = Math.max(1, Math.floor(window.innerWidth / 2));
      var hh = Math.max(1, Math.floor(window.innerHeight / 2));
      FluidBG._renderTarget = new THREE.WebGLRenderTarget(hw, hh, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
      });
      // Upsample scene: single fullscreen quad that draws the FBO texture to screen
      FluidBG._upsampleScene = new THREE.Scene();
      var upsampleGeo = new THREE.PlaneGeometry(2, 2);
      var upsampleMat = new THREE.ShaderMaterial({
        uniforms: { uTex: { value: FluidBG._renderTarget.texture } },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }',
        fragmentShader: 'uniform sampler2D uTex; varying vec2 vUv; void main() { gl_FragColor = texture2D(uTex, vUv); }',
        depthWrite: false,
      });
      FluidBG._upsampleQuad = new THREE.Mesh(upsampleGeo, upsampleMat);
      FluidBG._upsampleQuad.frustumCulled = false;
      FluidBG._upsampleScene.add(FluidBG._upsampleQuad);

      FluidBG.initialized = true;

      // Register with shared renderer manager — upsample scene is the visible layer
      if (typeof RendererManager !== 'undefined' && RendererManager.initialized) {
        RendererManager.registerLayer('bg', FluidBG._upsampleScene, FluidBG.camera, {
          tick: tick,
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

  // Extra smoothing for fluid bg to prevent flicker
  var _smoothBass = 0, _smoothMid = 0, _smoothTreb = 0, _smoothEnergy = 0;

  function tick(dt) {
    if (!FluidBG.initialized) return;
    FluidBG.time += dt || 0.016;
    const u = FluidBG.material.uniforms;
    u.uTime.value = FluidBG.time;

    // ── GPU downsampling: render fluid scene to 1/2-res FBO ──
    if (FluidBG._renderTarget && typeof RendererManager !== 'undefined' && RendererManager.initialized) {
      var r = RendererManager.renderer;
      r.setRenderTarget(FluidBG._renderTarget);
      r.render(FluidBG.scene, FluidBG.camera);
      r.setRenderTarget(null);
    }

    // Heavy smoothing on audio to eliminate visual flicker/strobing
    if (typeof FluidAudio !== 'undefined' && FluidAudio.bands) {
      var s = 0.04; // slow smoothing factor
      _smoothBass += (FluidAudio.bands.bass - _smoothBass) * s;
      _smoothMid += (FluidAudio.bands.mid - _smoothMid) * s;
      _smoothTreb += (FluidAudio.bands.treble - _smoothTreb) * s;
      _smoothEnergy += (FluidAudio.bands.energy - _smoothEnergy) * s;
      u.uBass.value = _smoothBass * 0.5;       // Reduced amplitude
      u.uMid.value = _smoothMid * 0.4;
      u.uTreble.value = _smoothTreb * 0.3;
      u.uEnergy.value = _smoothEnergy * 0.4;
    }
  }

  function render() {
    // Rendering is handled by RendererManager; this is a no-op fallback
    if (typeof RendererManager !== 'undefined' && RendererManager.initialized) return;
    // Fallback: direct render if RendererManager not available (no downsampling)
    if (!FluidBG.initialized || !FluidBG.renderer) return;
    FluidBG.renderer.render(FluidBG.scene, FluidBG.camera);
  }

  function resize() {
    if (!FluidBG.initialized) return;
    if (typeof RendererManager !== 'undefined' && RendererManager.initialized) {
      RendererManager.resize(window.innerWidth, window.innerHeight);
    } else if (FluidBG.renderer) {
      FluidBG.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    FluidBG.material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    // Rebuild downsample render target at new 1/2 resolution
    if (FluidBG._renderTarget) {
      FluidBG._renderTarget.setSize(
        Math.max(1, Math.floor(window.innerWidth / 2)),
        Math.max(1, Math.floor(window.innerHeight / 2))
      );
    }
  }

  function setIntensity(v) { FluidBG.intensity = v; if (FluidBG.material) FluidBG.material.uniforms.uIntensity.value = v; }
  function setSpeed(v) { FluidBG.speed = v; if (FluidBG.material) FluidBG.material.uniforms.uSpeed.value = v; }
  function setNoiseScale(v) { if (FluidBG.material && FluidBG.material.uniforms.uNoiseScale) FluidBG.material.uniforms.uNoiseScale.value = v; }

  FluidBG.init = init;
  FluidBG.tick = tick;
  FluidBG.render = render;
  FluidBG.resize = resize;
  FluidBG.setIntensity = setIntensity;
  FluidBG.setSpeed = setSpeed;
  FluidBG.setNoiseScale = setNoiseScale;

  if (typeof __FM !== 'undefined') __FM.register('fluidBg', [], function () { return FluidBG; }, { priority: 7 });
  window.FluidBackground = FluidBG;
  window.addEventListener('resize', resize);
  console.log('FluidMusic Fluid Background loaded');
})();
