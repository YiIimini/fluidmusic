// ============================================================
// FluidMusic — Foam/Irregular Background Renderer
// Ported from tests/tx/foam/index.html
// Uses global window.THREE, renders to #layer-bg
// ============================================================
(function () {
  'use strict';

  const THREE = window.THREE;
  if (!THREE) { console.warn('[FoamBG] THREE not loaded'); return; }

  const FOAM_GRID = 128;
  const IRREG_GRID = 80;
  const GRID = 96;
  const SPACING = 1.05;
  const SIZE = GRID * SPACING;
  const HALF = SIZE / 2;

  // ── Theme presets ──
  const THEMES = {
    nocturnal:    { base1:'#060a14', base2:'#0d1628', cool:'#4466cc', warm:'#dd4422', accent:'#33aaff', glow:0.9 },
    neon_tokyo:   { base1:'#0a081a', base2:'#140c30', cool:'#ee3399', warm:'#33ffbb', accent:'#ffffff', glow:2.2 },
    cyber_forest: { base1:'#060e0a', base2:'#0c1a10', cool:'#33ee88', warm:'#bbee33', accent:'#88ee55', glow:2.0 },
    minimal_mono: { base1:'#0d0d0d', base2:'#1a1a1a', cool:'#aaaaaa', warm:'#eeeeee', accent:'#eeeeee', glow:1.3 },
    ink_wash:     { base1:'#080c10', base2:'#0e141c', cool:'#4488aa', warm:'#d0c8b8', accent:'#bba066', glow:0.45 },
    royal:        { base1:'#0a0810', base2:'#120c1c', cool:'#7a44cc', warm:'#ffcc44', accent:'#ffdd88', glow:1.1 },
    ocean_reef:   { base1:'#040a14', base2:'#081828', cool:'#2266cc', warm:'#ff6688', accent:'#77bbff', glow:0.9 },
    aurora:       { base1:'#060c0a', base2:'#0c1420', cool:'#33cc88', warm:'#8844dd', accent:'#55eecc', glow:1.3 },
    foam_bubble:  { base1:'#0a0e1e', base2:'#0f1a38', cool:'#4477ee', warm:'#ee5533', accent:'#44ccff', glow:1.6 }
  };

  // ── Shared state ──
  let scene = null, camera = null;
  let foamMesh = null, foamMaterial = null, foamUniforms = null;
  let irregularMesh = null, irregularMaterial = null, irregularUniforms = null;
  let currentMode = 'foam';
  let isRunning = false;
  let terrainTime = 0;
  let rainDrops = [];
  const MAX_DROPS = 4;
  let dropSpawnTimer = 0;

  // Audio bands (updated externally)
  let audioBands = { subBass:0, bass:0, lowMid:0, mid:0, highMid:0, presence:0, brilliance:0, air:0, energy:0 };
  let audioActivity = 1.0;

  // Parameters (updated from settings)
  let heightScale = 1.0;
  let bandGain = 1.0;
  let currentThemeName = 'foam_bubble';

  const sharedTheme = {
    uBaseColor1: new THREE.Color('#0a0e1e'),
    uBaseColor2: new THREE.Color('#0f1a38'),
    uCoolCore:   new THREE.Color('#4477ee'),
    uWarmCore:   new THREE.Color('#ee5533'),
    uGlowIntensity: 1.6
  };

  // ═══════════════════════════════════════
  //  FOAM Vertex Shader
  // ═══════════════════════════════════════
  const foamVertShader = /* glsl */ `
uniform float uTime, uSubBass, uBass, uLowMid, uMid, uHighMid;
uniform vec3 uDrops[6];
uniform float uPresence, uBrilliance, uAir, uEnergy;
uniform float uHeightScale;
uniform float uBandGain[8];
varying float vHeight;
varying vec2 vWorldXZ;

float random(vec2 st) { return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 pos2D = position.xz;
  vWorldXZ = pos2D;
  float centerDist = length(pos2D);
  float globalFalloff = smoothstep(${HALF.toFixed(1)} * 1.15, ${HALF.toFixed(1)} * 0.45, centerDist);
  float idleElevation = (snoise(pos2D * 0.04 + uTime * 0.15) * 1.5 + snoise(pos2D * 0.09 - uTime * 0.07) * 0.8) * globalFalloff;
  float subLift = uSubBass * smoothstep(${HALF.toFixed(1)} * 0.55, 0.0, centerDist) * 3.5 * uBandGain[0];
  float bassLift = uBass * smoothstep(${HALF.toFixed(1)} * 0.75, 4.0, centerDist + snoise(pos2D * 0.07) * 6.0) * uBandGain[1] * 3.0;
  float lowMidLift = (uLowMid * 0.5 + uLowMid * snoise(pos2D * 0.15) * 0.75) * uBandGain[2];
  float midLift = uMid * max(0.0, sin(pos2D.x * 0.2 + pos2D.y * 0.2 - uTime * 2.0)) * 3.0 * uBandGain[3];
  float highMidLift = uHighMid * smoothstep(8.0, ${HALF.toFixed(1)} * 1.05, centerDist) * 2.0 * uBandGain[4];
  float audioElevation = (subLift + bassLift + lowMidLift + midLift + highMidLift) * globalFalloff;
  float elevation = (idleElevation + audioElevation) * uHeightScale;
  for (int i = 0; i < 6; i++) {
    float dx = pos2D.x - uDrops[i].x; float dz = pos2D.y - uDrops[i].y;
    float dt2 = sqrt(dx * dx + dz * dz);
    float ra = uDrops[i].z; float rl = max(0.0, 1.0 - ra / 3.5);
    elevation += sin(dt2 * 0.7 - ra * 2.5) * exp(-dt2 * 0.25) * rl * rl * 2.0;
  }
  vHeight = elevation / 4.0;
  vec3 newPosition = position;
  newPosition.y = elevation;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`;

  // ═══════════════════════════════════════
  //  FOAM Fragment Shader
  // ═══════════════════════════════════════
  const foamFragShader = /* glsl */ `
uniform float uTime, uAudioActivity;
uniform vec3 uBaseColor1, uBaseColor2, uCoolCore, uWarmCore;
uniform float uGlowIntensity;
varying float vHeight;
varying vec2 vWorldXZ;
float random(vec2 st) { return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float centerDist = length(vWorldXZ);
  float normHeight = clamp(vHeight, 0.0, 1.0);
  float warmBlend = smoothstep(0.0, 1.0, 0.5 - centerDist / 100.8 + sin(uTime * 0.25) * 0.15);
  vec3 zoneColor = mix(uCoolCore, uWarmCore, warmBlend);
  float rnd = random(vWorldXZ * 3.7);
  float MAX_R = 111.0;
  vec3 glow = mix(uBaseColor2, zoneColor, normHeight * 0.85) * uGlowIntensity * (1.0 - smoothstep(71.0, MAX_R, centerDist));
  vec3 body = mix(uBaseColor1, uBaseColor2, normHeight * (1.0 - smoothstep(65.5, MAX_R, centerDist)));
  float topInt = clamp(smoothstep(0.0, 0.3, normHeight) + 0.15, 0.0, 1.0);
  vec3 finalColor = mix(body, glow, topInt);
  float dither = (rnd - 0.5) * 0.06;
  float circleAlpha = 1.0 - smoothstep(MAX_R * 0.65, MAX_R, centerDist);
  float bgAlpha = mix(0.0, circleAlpha + dither, uAudioActivity);
  gl_FragColor = vec4(finalColor, bgAlpha);
}
`;

  // ═══════════════════════════════════════
  //  IRREGULAR Vertex Shader
  // ═══════════════════════════════════════
  const irregularVertShader = /* glsl */ `
uniform float uTime, uSubBass, uBass, uLowMid, uMid, uHighMid;
uniform vec3 uDrops[6];
uniform float uPresence, uBrilliance, uAir, uEnergy;
uniform float uHeightScale;
uniform float uBandGain;
varying float vHeight;
varying vec2 vWorldXZ;
float random(vec2 st) { return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 pos2D = position.xz;
  vWorldXZ = pos2D;
  float centerDist = length(pos2D);
  float wave = sin(pos2D.x * 0.15 + pos2D.y * 0.1 - uTime * 0.6) * 0.7 + 0.5;
  float globalFalloff = smoothstep(58.0, 22.7, centerDist);
  float idleElevation = wave * 1.5 * globalFalloff;
  float subLift = uSubBass * smoothstep(27.7, 0.0, centerDist) * 3.5 * uBandGain;
  float bassNoiseVal = sin(pos2D.x * 0.1 - pos2D.y * 0.12) * 6.0;
  float bassLift = uBass * smoothstep(37.8, 4.0, centerDist + bassNoiseVal) * (random(pos2D) * 0.6 + 0.4) * 3.0 * uBandGain;
  float lowMidLift = (uLowMid * 0.5 + uLowMid * random(pos2D) * 0.75) * uBandGain;
  float midLift = uMid * max(0.0, sin(pos2D.x * 0.2 + pos2D.y * 0.2 - uTime * 2.0)) * 2.5 * uBandGain;
  float highMidLift = uHighMid * smoothstep(8.0, 52.9, centerDist) * 1.8 * uBandGain;
  float audioElevation = (subLift + bassLift + lowMidLift + midLift + highMidLift) * globalFalloff;
  float elevation = (idleElevation + audioElevation) * uHeightScale;
  float rippleR = sin(centerDist * 0.12 - uTime * 0.6) * 0.5 + 0.5;
  elevation += rippleR * (1.0 - centerDist / 60.5) * uEnergy * 2.0;
  for (int i = 0; i < 6; i++) {
    float dx = pos2D.x - uDrops[i].x; float dz = pos2D.y - uDrops[i].y;
    float dt2 = sqrt(dx * dx + dz * dz);
    float ra = uDrops[i].z; float rl = max(0.0, 1.0 - ra / 3.5);
    elevation += sin(dt2 * 0.7 - ra * 2.5) * exp(-dt2 * 0.25) * rl * rl * 3.5;
  }
  vHeight = elevation / 5.0;
  vec3 newPosition = position;
  newPosition.y = elevation;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`;

  // ═══════════════════════════════════════
  //  IRREGULAR Fragment Shader
  // ═══════════════════════════════════════
  const irregularFragShader = /* glsl */ `
uniform float uTime, uAudioActivity;
uniform vec3 uBaseColor1, uBaseColor2, uCoolCore, uWarmCore;
uniform float uGlowIntensity;
varying float vHeight;
varying vec2 vWorldXZ;
float random(vec2 st) { return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float SPACING = 1.05;
  vec2 cellCoord = vWorldXZ / SPACING;
  vec2 cellCenter = (floor(cellCoord) + 0.5) * SPACING;
  vec2 cellLocal = abs(vWorldXZ - cellCenter) / SPACING;
  float GAP = 0.10;
  float edgeDist = 0.5 - max(cellLocal.x, cellLocal.y);
  float gapFactor = smoothstep(0.0, GAP, edgeDist);
  float centerDist = length(vWorldXZ);
  float normHeight = clamp(vHeight, 0.0, 1.0);
  float warmBlend = smoothstep(0.0, 1.0, 0.5 - centerDist / 100.8 + sin(uTime * 0.25) * 0.15);
  vec3 zoneColor = mix(uCoolCore, uWarmCore, warmBlend);
  float rnd = random(cellCenter);
  float MAX_R = 111.0;
  float distFade = 1.0 - smoothstep(MAX_R * 0.6, MAX_R, centerDist);
  vec3 glow = mix(uBaseColor2, zoneColor, normHeight * 0.85) * uGlowIntensity * distFade;
  vec3 body = mix(uBaseColor1, uBaseColor2, normHeight * distFade);
  float topInt = clamp(smoothstep(0.0, 0.3, normHeight) + 0.15, 0.0, 1.0);
  vec3 finalColor = mix(body, glow, topInt);
  float sideDarken = mix(0.25, 1.0, gapFactor);
  finalColor *= sideDarken;
  vec3 lightPos = vec3(sin(uTime * 0.25) * 28.0, 10.0, cos(uTime * 0.25) * 28.0);
  vec3 fragPos = vec3(vWorldXZ.x, normHeight * 5.0, vWorldXZ.y);
  vec3 L = normalize(lightPos - fragPos);
  float NdotL = max(0.0, L.y * 0.7 + 0.3);
  float spec = pow(NdotL, 14.0) * 0.38;
  float glint = smoothstep(0.06, 0.18, edgeDist);
  spec *= (0.4 + glint * 0.6);
  finalColor += zoneColor * spec;
  float aerialFog = smoothstep(MAX_R * 0.6, MAX_R, centerDist);
  vec3 atmosphericColor = mix(uBaseColor1, uBaseColor2, 0.4);
  finalColor = mix(finalColor, atmosphericColor, aerialFog * 0.5);
  float circleAlpha = 1.0 - smoothstep(MAX_R * 0.65, MAX_R, centerDist);
  float pillarMask = smoothstep(0.0, 0.15, gapFactor);
  float bgAlpha = mix(0.0, circleAlpha, uAudioActivity) * pillarMask;
  finalColor = min(finalColor, vec3(1.2));
  gl_FragColor = vec4(finalColor, bgAlpha);
}
`;

  // ═══════════════════════════════════════
  //  Create Foam plane
  // ═══════════════════════════════════════
  function createFoamPlane() {
    const initDropVec3 = () => new THREE.Vector3(180, 180, 100);
    const uniforms = {
      uTime: { value: 0 }, uSubBass: { value: 0 }, uBass: { value: 0 },
      uLowMid: { value: 0 }, uMid: { value: 0 }, uHighMid: { value: 0 },
      uPresence: { value: 0 }, uBrilliance: { value: 0 }, uAir: { value: 0 },
      uEnergy: { value: 0 }, uAudioActivity: { value: 1.0 },
      uBaseColor1: { value: sharedTheme.uBaseColor1.clone() },
      uBaseColor2: { value: sharedTheme.uBaseColor2.clone() },
      uCoolCore: { value: sharedTheme.uCoolCore.clone() },
      uWarmCore: { value: sharedTheme.uWarmCore.clone() },
      uGlowIntensity: { value: sharedTheme.uGlowIntensity },
      uHeightScale: { value: 1.0 },
      uBandGain: { value: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0] },
      uDrops: { value: [initDropVec3(), initDropVec3(), initDropVec3(), initDropVec3(), initDropVec3(), initDropVec3()] }
    };
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader: foamVertShader, fragmentShader: foamFragShader, transparent: true });
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, FOAM_GRID, FOAM_GRID);
    geo.rotateX(-Math.PI / 2);
    return { mesh: new THREE.Mesh(geo, material), material, uniforms };
  }

  // ═══════════════════════════════════════
  //  Create Irregular plane
  // ═══════════════════════════════════════
  function createIrregularPlane() {
    const initDropVec3 = () => new THREE.Vector3(180, 180, 100);
    const uniforms = {
      uTime: { value: 0 }, uSubBass: { value: 0 }, uBass: { value: 0 },
      uLowMid: { value: 0 }, uMid: { value: 0 }, uHighMid: { value: 0 },
      uPresence: { value: 0 }, uBrilliance: { value: 0 }, uAir: { value: 0 },
      uEnergy: { value: 0 }, uAudioActivity: { value: 1.0 },
      uBaseColor1: { value: sharedTheme.uBaseColor1.clone() },
      uBaseColor2: { value: sharedTheme.uBaseColor2.clone() },
      uCoolCore: { value: sharedTheme.uCoolCore.clone() },
      uWarmCore: { value: sharedTheme.uWarmCore.clone() },
      uGlowIntensity: { value: sharedTheme.uGlowIntensity },
      uHeightScale: { value: 1.0 }, uBandGain: { value: 1.0 },
      uDrops: { value: [initDropVec3(), initDropVec3(), initDropVec3(), initDropVec3(), initDropVec3(), initDropVec3()] }
    };
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader: irregularVertShader, fragmentShader: irregularFragShader, transparent: true, depthWrite: false });
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, IRREG_GRID, IRREG_GRID);
    geo.rotateX(-Math.PI / 2);
    return { mesh: new THREE.Mesh(geo, material), material, uniforms };
  }

  // ═══════════════════════════════════════
  //  Raindrop system
  // ═══════════════════════════════════════
  function spawnRaindrop() {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * HALF * 0.85;
    rainDrops.push({ x: Math.cos(angle) * dist, z: Math.sin(angle) * dist, birth: terrainTime });
    if (rainDrops.length > MAX_DROPS) rainDrops.shift();
  }

  function updateRaindrops(dt) {
    dropSpawnTimer += dt;
    if (dropSpawnTimer > 1.2 + Math.random() * 1.5 && rainDrops.length < MAX_DROPS) {
      dropSpawnTimer = 0; spawnRaindrop();
    }
    for (let i = rainDrops.length - 1; i >= 0; i--) {
      if (terrainTime - rainDrops[i].birth >= 3.5) rainDrops.splice(i, 1);
    }
  }

  // ═══════════════════════════════════════
  //  Update uniforms
  // ═══════════════════════════════════════
  function updateUniforms(uniforms, isFoam) {
    const u = uniforms, a = audioBands;
    u.uTime.value = terrainTime;
    u.uSubBass.value = a.subBass; u.uBass.value = a.bass;
    u.uLowMid.value = a.lowMid; u.uMid.value = a.mid;
    u.uHighMid.value = a.highMid; u.uPresence.value = a.presence;
    u.uBrilliance.value = a.brilliance; u.uAir.value = a.air;
    u.uEnergy.value = a.energy;
    audioActivity += ((a.energy > 0.005 ? 1 : 0.0) - audioActivity) * 0.04;
    u.uAudioActivity.value = audioActivity;
    u.uBaseColor1.value.copy(sharedTheme.uBaseColor1);
    u.uBaseColor2.value.copy(sharedTheme.uBaseColor2);
    u.uCoolCore.value.copy(sharedTheme.uCoolCore);
    u.uWarmCore.value.copy(sharedTheme.uWarmCore);
    u.uGlowIntensity.value = sharedTheme.uGlowIntensity;
    u.uHeightScale.value = heightScale;
    if (isFoam) {
      u.uBandGain.value = [bandGain, bandGain, bandGain, bandGain, bandGain, bandGain, bandGain, bandGain];
    } else {
      u.uBandGain.value = bandGain;
    }
    const drops = u.uDrops.value;
    for (let i = 0; i < 6; i++) {
      if (i < rainDrops.length) drops[i].set(rainDrops[i].x, rainDrops[i].z, terrainTime - rainDrops[i].birth);
      else drops[i].set(180, 180, 100);
    }
  }

  // ═══════════════════════════════════════
  //  Render loop
  // ═══════════════════════════════════════
  function refreshAudioBands() {
    if (typeof FluidAudio === 'undefined' || !FluidAudio.analyser || !FluidAudio.freqData) return;
    try {
      const rate = FluidAudio.ctx ? FluidAudio.ctx.sampleRate : 44100;
      const data = FluidAudio.freqData;
      const len = data.length;
      const bandRMS = (hz0, hz1) => {
        const binHz = rate / (len * 2);
        const a = Math.max(0, Math.floor(hz0 / binHz));
        const b = Math.min(len - 1, Math.ceil(hz1 / binHz));
        let sum = 0, count = 0;
        for (let i = a; i <= b; i++) { const v = data[i] / 255; sum += v * v; count++; }
        return count ? Math.sqrt(sum / count) : 0;
      };
      FluidAudio.analyser.getByteFrequencyData(data);
      audioBands.subBass    = bandRMS(20, 60);
      audioBands.bass       = bandRMS(60, 150);
      audioBands.lowMid     = bandRMS(150, 300);
      audioBands.mid        = bandRMS(300, 1200);
      audioBands.highMid    = bandRMS(1200, 3000);
      audioBands.presence   = bandRMS(3000, 6000);
      audioBands.brilliance = bandRMS(6000, 12000);
      audioBands.air        = bandRMS(12000, 20000);
      audioBands.energy     = bandRMS(20, 20000);
    } catch(e) { /* ignore */ }
  }
  function tickFn(dt) {
    if (!isRunning) return;
    terrainTime += dt || 0.016;
    updateRaindrops(dt || 0.016);
    refreshAudioBands();
    if (currentMode === 'foam' && foamUniforms) {
      updateUniforms(foamUniforms, true);
    } else if (currentMode === 'irregular' && irregularUniforms) {
      updateUniforms(irregularUniforms, false);
    }
  }

  // ═══════════════════════════════════════
  //  Public API
  // ═══════════════════════════════════════
  const FoamBG = {
    init() {
      if (isRunning) return;

      scene = new THREE.Scene();
      scene.background = null;
      camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 200);
      camera.position.set(Math.cos(0) * 30, 32, Math.sin(0) * 30);
      camera.lookAt(0, 0.5, 0);

      const foam = createFoamPlane();
      foamMesh = foam.mesh; foamMaterial = foam.material; foamUniforms = foam.uniforms;
      const irreg = createIrregularPlane();
      irregularMesh = irreg.mesh; irregularMaterial = irreg.material; irregularUniforms = irreg.uniforms;

      scene.add(foamMesh); scene.add(irregularMesh);
      foamMesh.scale.set(1.3, 1.0, 1.3);
      irregularMesh.scale.set(1.3, 1.0, 1.3);
      foamMesh.visible = (currentMode === 'foam');
      irregularMesh.visible = (currentMode === 'irregular');

      // Register with shared RendererManager (single WebGL context)
      if (typeof RendererManager !== 'undefined' && RendererManager.initialized) {
        RendererManager.registerLayer('foamBg', scene, camera, {
          tick: tickFn,
          bottom: true,
          visible: true,
          onResize: function(w, h) {
            camera.aspect = w / Math.max(h, 1);
            camera.updateProjectionMatrix();
          }
        });
        console.log('[FoamBG] Registered with RendererManager, mode:', currentMode);
      } else {
        console.warn('[FoamBG] RendererManager not available — foam will not render');
        return;
      }

      isRunning = true;
    },

    destroy() {
      isRunning = false;
      // Remove from RendererManager layer stack
      if (typeof RendererManager !== 'undefined') {
        RendererManager.layers = RendererManager.layers.filter(function(l) { return l.key !== 'foamBg'; });
      }
      if (foamMaterial) { foamMaterial.dispose(); foamMaterial = null; }
      if (irregularMaterial) { irregularMaterial.dispose(); irregularMaterial = null; }
      foamMesh = null; irregularMesh = null;
      foamUniforms = null; irregularUniforms = null;
      scene = null; camera = null;
      rainDrops = [];
      console.log('[FoamBG] Destroyed');
    },

    getAudioActivity() {
      return audioActivity;
    },

    setMode(mode) {
      currentMode = mode;
      if (foamMesh) foamMesh.visible = (mode === 'foam');
      if (irregularMesh) irregularMesh.visible = (mode === 'irregular');
      // console.log('[FoamBG] Mode:', mode);
    },

    setTheme(name) {
      currentThemeName = name;
      const t = THEMES[name] || THEMES['foam_bubble'];
      sharedTheme.uBaseColor1.set(t.base1);
      sharedTheme.uBaseColor2.set(t.base2);
      sharedTheme.uCoolCore.set(t.cool);
      sharedTheme.uWarmCore.set(t.warm);
      sharedTheme.uGlowIntensity = t.glow;
    },

    setParams(params) {
      if (params.heightScale !== undefined) heightScale = params.heightScale;
      if (params.bandGain !== undefined) bandGain = params.bandGain;
    },

    updateAudio(bands) {
      if (bands) audioBands = bands;
    },

    get isActive() { return isRunning; },
    get mode() { return currentMode; }
  };

  window.FoamBG = FoamBG;
  console.log('[FoamBG] Module registered');
})();
