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
  };

  function init(canvas) {
    if (FluidBG.initialized) return true;
    try {
      const canvasEl = canvas || document.getElementById('bg-canvas');
      const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, alpha: true, antialias: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.setSize(window.innerWidth, window.innerHeight);
      // 双保险：CSS opacity 让桌面透视
      canvasEl.style.opacity = '0.4';

      FluidBG.renderer = renderer;
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
        'uniform vec3 uColorBase; uniform vec3 uColorAccent; uniform float uBass; uniform float uMid; uniform float uTreble; uniform float uEnergy;',
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

      FluidBG.initialized = true;
      console.log('Fluid BG initialized');
      return true;
    } catch (e) {
      console.error('Fluid BG init failed:', e);
      return false;
    }
  }

  function tick(dt) {
    if (!FluidBG.initialized) return;
    FluidBG.time += dt || 0.016;
    const u = FluidBG.material.uniforms;
    u.uTime.value = FluidBG.time;

    // Audio reactivity
    if (typeof FluidAudio !== 'undefined' && FluidAudio.bands) {
      u.uBass.value = FluidAudio.bands.bass;
      u.uMid.value = FluidAudio.bands.mid;
      u.uTreble.value = FluidAudio.bands.treble;
      u.uEnergy.value = FluidAudio.bands.energy;
    }
  }

  function render() {
    if (!FluidBG.initialized || !FluidBG.renderer) return;
    FluidBG.renderer.render(FluidBG.scene, FluidBG.camera);
  }

  function resize() {
    if (!FluidBG.initialized) return;
    FluidBG.renderer.setSize(window.innerWidth, window.innerHeight);
    FluidBG.material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  }

  function setIntensity(v) { FluidBG.intensity = v; if (FluidBG.material) FluidBG.material.uniforms.uIntensity.value = v; }
  function setSpeed(v) { FluidBG.speed = v; if (FluidBG.material) FluidBG.material.uniforms.uSpeed.value = v; }

  FluidBG.init = init;
  FluidBG.tick = tick;
  FluidBG.render = render;
  FluidBG.resize = resize;
  FluidBG.setIntensity = setIntensity;
  FluidBG.setSpeed = setSpeed;

  window.FluidBackground = FluidBG;
  window.addEventListener('resize', resize);
  console.log('FluidMusic Fluid Background loaded');
})();
