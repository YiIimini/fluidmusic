// ============================================================
// FluidMusic — 3D Lyrics Scene
// Full-screen 3D lyrics + cover particles + star river effect
// References: Mineradio-MacOS 3D lyrics prototype
// Integrates with RendererManager for shared WebGL context
// ============================================================
(function () {
  'use strict';
  const _TDL_DEBUG = false;  // Set to true to re-enable verbose debug logging

  if (typeof THREE === 'undefined') {
    console.warn('ThreeDLyricsScene: THREE not loaded');
    window.ThreeDLyricsScene = { init: function () { return false; }, tick: function () {}, setActive: function () {} };
    return;
  }

  // ── Constants ──
  var GRID = 118;
  var PLANE_SIZE = 4.8;
  var RIPPLE_MAX = 12;
  var FONT_WEIGHT = 900;
  var LYRIC_CANVAS_W = 2048;
  var LYRIC_CANVAS_H = 256;

  var ThreeDLyrics = {
    scene: null,
    camera: null,
    particleSystem: null,
    particleGeo: null,
    particleMat: null,
    coverTex: null,
    hasCover: false,
    lyricsGroup: null,
    lineSlots: [],
    starRiver: null,
    ripples: [],
    rippleTex: null,
    rippleIdx: 0,
    lastRippleAt: 0,
    lastBassRising: false,
    rippleRegions: [],
    orbitTheta: 0,
    orbitPhi: 0,
    orbitDistance: 9.5,
    isDragging: false,
    prevMouse: { x: 0, y: 0 },
    time: 0,
    initialized: false,
    _active: false,
    _registered: false,
    _fadeStart: 0,
    _loadedCoverImg: null,
    _dotTexture: null,
    _uniforms: null,

    config: {
      lineCount: 5,
      currentColor: '#ffd700',
      otherColor: '#cccccc',
      fontFamily: "'PingFang SC','Noto Sans SC','Microsoft YaHei',Arial,sans-serif",
      fontSize: 120,
      lineSpacing: 1.2,
      highlightEffect: '无',
      titleFontSize: 140,
      artistFontSize: 80,
      titleColor: '#ffd700',
      artistColor: '#c0c0c0',
      titleEffect: '发光',
      pointScale: 1.6,
      intensity: 1.8,
      depth: 1.6,
      starCount: 800,
      starSize: 0.07,
      starOpacity: 1.0,
      starSpeed: 0.0025,
      starColor: '#88ccff',
      starCanvasSize: 12.0,
      bgOpacity: 0.0,
    },

    _lyricsLines: [],
    _currentLyricIdx: 0,
  };

  var uniforms = {};
  var BASS_THRESHOLD = 0.25;
  var RIPPLE_COOLDOWN = 0.32;

  // ── Helpers ──
  function lightenColor(hex, factor) {
    var c = new THREE.Color(hex);
    c.r = Math.min(1, c.r * factor);
    c.g = Math.min(1, c.g * factor);
    c.b = Math.min(1, c.b * factor);
    return '#' + c.getHexString();
  }

  // ── Dot texture ──
  function makeDotTexture() {
    var cv = document.createElement('canvas'); cv.width = cv.height = 64;
    var ctx = cv.getContext('2d');
    var g = ctx.createRadialGradient(32, 32, 0, 32, 32, 31);
    g.addColorStop(0.00, 'rgba(255,255,255,0.96)');
    g.addColorStop(0.42, 'rgba(255,255,255,0.78)');
    g.addColorStop(0.72, 'rgba(255,255,255,0.22)');
    g.addColorStop(1.00, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    var tex = new THREE.CanvasTexture(cv);
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  // ── Particle geometry ──
  function buildParticleGeometry(grid) {
    var count = grid * grid;
    var positions = new Float32Array(count * 3);
    var uvs = new Float32Array(count * 2);
    var rand = new Float32Array(count);
    var texelStep = 1 / grid;
    for (var i = 0; i < count; i++) {
      var gx = i % grid, gy = Math.floor(i / grid);
      var u = (gx + 0.5) * texelStep, v = (gy + 0.5) * texelStep;
      var px = gx / (grid - 1), py = gy / (grid - 1);
      positions[i * 3] = (px - 0.5) * PLANE_SIZE;
      positions[i * 3 + 1] = (py - 0.5) * PLANE_SIZE;
      positions[i * 3 + 2] = 0;
      uvs[i * 2] = u;
      uvs[i * 2 + 1] = v;
      rand[i] = Math.random();
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aUv', new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
    return geo;
  }

  // ── Ripple system ──
  function initRippleRegions() {
    if (ThreeDLyrics.rippleRegions.length) return;
    var ps = PLANE_SIZE;
    for (var ry = 0; ry < 3; ry++)
      for (var rx = 0; rx < 3; rx++) {
        ThreeDLyrics.rippleRegions.push({
          x: (rx / 2 - 0.5) * ps * 0.72,
          y: (ry / 2 - 0.5) * ps * 0.72,
        });
      }
  }

  function triggerRipple(x, y, strength) {
    var r = ThreeDLyrics.ripples[ThreeDLyrics.rippleIdx];
    r.x = x; r.y = y; r.age = 0; r.str = strength;
    ThreeDLyrics.rippleIdx = (ThreeDLyrics.rippleIdx + 1) % RIPPLE_MAX;
  }

  function updateRipples(dt, bass, time) {
    var isBassHit = bass > BASS_THRESHOLD && !ThreeDLyrics.lastBassRising;
    ThreeDLyrics.lastBassRising = bass > BASS_THRESHOLD * 0.75;
    if (isBassHit && (time - ThreeDLyrics.lastRippleAt) > RIPPLE_COOLDOWN) {
      ThreeDLyrics.lastRippleAt = time;
      var count = 2 + (Math.random() < 0.5 ? 0 : 1);
      var used = {};
      for (var k = 0; k < count; k++) {
        var idx, tries = 0;
        do { idx = Math.floor(Math.random() * 9); tries++; } while (used[idx] && tries < 12);
        used[idx] = true;
        var reg = ThreeDLyrics.rippleRegions[idx];
        var jx = reg.x + (Math.random() - 0.5) * 0.7;
        var jy = reg.y + (Math.random() - 0.5) * 0.7;
        triggerRipple(jx, jy, 0.65 + bass * 1.4 + Math.random() * 0.25);
      }
    }

    var rippleData = ThreeDLyrics.rippleTex.image.data;
    for (var i = 0; i < RIPPLE_MAX; i++) {
      var r = ThreeDLyrics.ripples[i];
      if (r.str > 0.005) {
        r.age += dt;
        if (r.age > 2.0) { r.str = 0; r.age = -10; }
      }
      var off = i * 4;
      rippleData[off] = r.x;
      rippleData[off + 1] = r.y;
      rippleData[off + 2] = r.age;
      rippleData[off + 3] = r.str;
    }
    ThreeDLyrics.rippleTex.needsUpdate = true;

    var active = 0;
    for (var j = 0; j < RIPPLE_MAX; j++) if (ThreeDLyrics.ripples[j].str > 0.005) active++;
    return active;
  }

  // ── Cover texture loading ──
  function loadCoverImage(img) {
    var size = 512;
    var cv = document.createElement('canvas');
    cv.width = cv.height = size;
    var ctx = cv.getContext('2d');
    var minDim = Math.min(img.width, img.height);
    var sx = (img.width - minDim) / 2;
    var sy = (img.height - minDim) / 2;
    ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

    if (ThreeDLyrics.coverTex) ThreeDLyrics.coverTex.dispose();
    ThreeDLyrics.coverTex = new THREE.CanvasTexture(cv);
    ThreeDLyrics.coverTex.minFilter = THREE.LinearFilter;
    ThreeDLyrics.coverTex.magFilter = THREE.LinearFilter;
    ThreeDLyrics.coverTex.wrapS = THREE.ClampToEdgeWrapping;
    ThreeDLyrics.coverTex.wrapT = THREE.ClampToEdgeWrapping;
    if (THREE.LinearSRGBColorSpace) ThreeDLyrics.coverTex.colorSpace = THREE.LinearSRGBColorSpace;
    ThreeDLyrics._uniforms.uCoverTex.value = ThreeDLyrics.coverTex;
    ThreeDLyrics.hasCover = true;
    ThreeDLyrics._uniforms.uHasCover.value = 1;

    // Rebuild particle geometry with new cover
    rebuildCoverParticles();
    _TDL_DEBUG && console.log('[3d-lyrics] Cover loaded, particles rebuilt');
  }

  function rebuildCoverParticles() {
    if (!ThreeDLyrics.initialized) return;
    if (!ThreeDLyrics._registered) {
      // Register when particles ready
      registerWithRenderer();
    }
  }

  // ── Shaders ──
  var vs = [
    'precision highp float;',
    'uniform float uTime, uBass, uMid, uTreble, uBeat, uEnergy;',
    'uniform float uIntensity, uPointScale, uSpeed, uTwist;',
    'uniform float uColorBoost, uScatter, uDepth;',
    'uniform float uHasCover, uMouseActive;',
    'uniform sampler2D uCoverTex, uRippleTex;',
    'uniform int uRippleCount;',
    'uniform vec2 uMouseXY;',
    'uniform float uPixel;',
    'attribute vec2 aUv;',
    'attribute float aRand;',
    'varying vec3 vColor;',
    'varying float vBright, vRipple, vAlpha, vSourceLum;',
    '#define PI 3.14159265359',
    'vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}',
    'vec4 mod289v(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}',
    'vec4 perm(vec4 x){return mod289v(((x*34.0)+1.0)*x);}',
    'float snoise(vec3 v){',
    ' const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);',
    ' vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);',
    ' vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);',
    ' vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod289(i);',
    ' vec4 p=perm(perm(perm(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));',
    ' float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);',
    ' vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;',
    ' vec4 h=1.0-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);',
    ' vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));',
    ' vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;',
    ' vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);',
    ' vec4 norm=inversesqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));',
    ' p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;',
    ' vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;',
    ' return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}',
    'vec2 safeCoverUv(vec2 uv){return clamp(uv,vec2(0.0012),vec2(0.9988));}',
    'vec3 sampleCover(vec2 uv){return texture2D(uCoverTex,safeCoverUv(uv)).rgb;}',
    'float rippleSumAt(vec2 p,out float maxAmp){',
    ' float sum=0.0;maxAmp=0.0;',
    ' for(int ri=0;ri<12;ri++){if(ri>=uRippleCount)break;',
    '  float vC=(float(ri)+0.5)/12.0;vec4 rd=texture2D(uRippleTex,vec2(0.5,vC));',
    '  float age=rd.z,str=rd.w;if(str<0.005||age<0.0||age>2.0)continue;',
    '  float dx=p.x-rd.x,dy=p.y-rd.y,dist=sqrt(dx*dx+dy*dy);',
    '  float lifeN=age/2.0,fadeIn=smoothstep(0.0,0.06,age),fadeOut=1.0-smoothstep(0.7,1.0,lifeN);',
    '  float env=fadeIn*fadeOut,bulgeW=0.55+age*0.80;',
    '  float bulge=exp(-dist*dist/(2.0*bulgeW*bulgeW))*(1.0-smoothstep(0.0,0.55,lifeN));',
    '  float waveR=age*2.10,ringW=0.40+age*0.22;',
    '  float ring=exp(-pow((dist-waveR)/ringW,2.0));',
    '  float local=(bulge*2.4+ring*1.30)*env*str;sum+=local;maxAmp=max(maxAmp,abs(local));}return sum;}',
    'void main(){',
    ' float t=uTime*uSpeed;vec3 pos=position;',
    ' vec2 sampleUv=safeCoverUv(aUv);vec3 coverColor=sampleCover(sampleUv);',
    ' float maxRippleAmp=0.0,rippleZ=0.0;',
    ' vec3 defC=mix(vec3(0.03,0.02,0.05),mix(vec3(0.04,0.03,0.07),vec3(0.03,0.04,0.06),aUv.x),aUv.y);',
    ' vColor=mix(defC,coverColor,uHasCover);vAlpha=1.0;float K=uIntensity*1.6;',
    ' rippleZ=rippleSumAt(pos.xy,maxRippleAmp);',
    ' float midN=snoise(vec3(pos.x*1.4,pos.y*1.4,t*0.55))*0.6+snoise(vec3(pos.x*2.8+5.0,pos.y*2.8-3.0,t*0.85))*0.4;',
    ' float midMask=0.55+0.45*snoise(vec3(pos.x*0.4,pos.y*0.4,t*0.18));',
    ' float midDisp=midN*uMid*0.55*midMask*K;',
    ' float trebleJ=snoise(vec3(pos.x*6.5,pos.y*6.5,t*3.5+aRand*4.0))*uTreble*0.18*K;',
    ' float bassBreath=snoise(vec3(pos.x*0.35,pos.y*0.35,t*0.4))*uBass*0.42*K;',
    ' pos.z=(rippleZ*1.30+midDisp+trebleJ+bassBreath)*uDepth;',
    ' if(uMouseActive>0.5){float mdx=pos.x-uMouseXY.x,mdy=pos.y-uMouseXY.y,md=sqrt(mdx*mdx+mdy*mdy);',
    '  if(md<1.0){float push=(1.0-md)*(1.0-md);pos.z+=push*0.55*uDepth;}}',
    ' if(uScatter>0.001){vec2 jdir=vec2(cos(aRand*6.2831),sin(aRand*6.2831));pos.xy+=jdir*uScatter*(0.05+uTreble*0.10);}',
    ' if(uTwist>0.001){float ta=uTwist*pos.z*0.6,cs=cos(ta),sn=sin(ta);pos.xy=mat2(cs,-sn,sn,cs)*pos.xy;}',
    ' vSourceLum=dot(max(vColor,vec3(0.0)),vec3(0.299,0.587,0.114));',
    ' vColor=pow(max(vColor,vec3(0.0)),vec3(1.0/max(0.35,uColorBoost)));',
    ' vBright=0.82+maxRippleAmp*0.55+uBass*0.10+uEnergy*0.05;',
    ' vRipple=clamp(maxRippleAmp*1.5,0.0,1.0);',
    ' vec4 mvPos=modelViewMatrix*vec4(pos,1.0);',
    ' float depthSize=36.0/max(0.5,-mvPos.z);',
    ' float audioBoost=1.0+maxRippleAmp*0.7+uBeat*0.30;',
    ' float sz=clamp(depthSize*audioBoost,1.05,4.95);',
    ' gl_PointSize=sz*uPixel*uPointScale;',
    ' gl_Position=projectionMatrix*mvPos;}',
  ].join('\n');

  var fs = [
    'precision highp float;',
    'uniform sampler2D uDotTex;',
    'uniform float uAlpha;',
    'varying vec3 vColor;',
    'varying float vBright,vRipple,vAlpha,vSourceLum;',
    'void main(){',
    ' vec4 tex=texture2D(uDotTex,gl_PointCoord);if(tex.a<0.02)discard;',
    ' vec3 col=vColor*vBright;col=mix(col,col*1.2,vRipple*0.4);',
    ' float keepBlack=1.0-smoothstep(0.025,0.115,vSourceLum),nonBlack=1.0-keepBlack;',
    ' float dotDist=length(gl_PointCoord-vec2(0.5))*2.0;',
    ' float readableRim=smoothstep(0.44,0.94,dotDist)*(1.0-smoothstep(0.94,1.08,dotDist))*tex.a;',
    ' float outLum=dot(col,vec3(0.299,0.587,0.114));',
    ' float lightP=smoothstep(0.50,0.82,outLum)*nonBlack;',
    ' float darkP=(1.0-smoothstep(0.20,0.50,outLum))*nonBlack;',
    ' col=mix(col,vec3(0.0),readableRim*lightP*0.38);col=mix(col,vec3(1.0),readableRim*darkP*0.20);',
    ' col=clamp(col,vec3(0.0),vec3(1.6));',
    ' float alpha=tex.a*uAlpha*max(vAlpha,0.15);',
    ' gl_FragColor=vec4(col,alpha);}',
  ].join('\n');

  // ── Lyrics text rendering ──
  var LINE_HEIGHT_FACTOR = 0.0035;
  var PLANE_W = 6.0;

  function renderTextToCanvas(ctx, w, h, text, fontSize, colorHex, effect) {
    ctx.clearRect(0, 0, w, h);
    if (!text || !text.trim()) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = FONT_WEIGHT + ' ' + fontSize + 'px ' + ThreeDLyrics.config.fontFamily;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    switch (effect) {
      case '发光':
        ctx.shadowColor = colorHex;
        ctx.shadowBlur = fontSize * 0.28;
        ctx.fillStyle = colorHex;
        ctx.fillText(text, w / 2, h / 2);
        ctx.fillText(text, w / 2, h / 2);
        ctx.shadowBlur = fontSize * 0.12;
        ctx.fillStyle = lightenColor(colorHex, 1.3);
        ctx.fillText(text, w / 2, h / 2);
        break;
      case '描边':
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = fontSize * 0.06;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(text, w / 2, h / 2);
        ctx.fillStyle = colorHex;
        ctx.fillText(text, w / 2, h / 2);
        break;
      case '渐变':
        var grad = ctx.createLinearGradient(0, h * 0.05, 0, h * 0.95);
        grad.addColorStop(0, lightenColor(colorHex, 1.5));
        grad.addColorStop(0.45, colorHex);
        grad.addColorStop(1, lightenColor(colorHex, 0.65));
        ctx.fillStyle = grad;
        ctx.fillText(text, w / 2, h / 2);
        break;
      default:
        ctx.fillStyle = colorHex;
        ctx.fillText(text, w / 2, h / 2);
        break;
    }
  }

  function disposeSlot(slot) {
    if (!slot) return;
    if (slot.group) {
      if (slot.group.parent) slot.group.parent.remove(slot.group);
      if (slot.frontMesh) {
        if (slot.frontMesh.material) {
          if (slot.frontMesh.material.map) slot.frontMesh.material.map.dispose();
          slot.frontMesh.material.dispose();
        }
        if (slot.frontMesh.geometry) slot.frontMesh.geometry.dispose();
      }
      if (slot.backMesh && slot.backMesh.geometry) slot.backMesh.geometry.dispose();
    }
    if (slot.texture) slot.texture.dispose();
    slot.group = null; slot.frontMesh = null; slot.backMesh = null;
    slot.texture = null; slot.canvas = null; slot.ctx = null; slot.mat = null;
  }

  function ensureLineSlots(count) {
    while (ThreeDLyrics.lineSlots.length > count) {
      disposeSlot(ThreeDLyrics.lineSlots.pop());
    }
    while (ThreeDLyrics.lineSlots.length < count) {
      var canvas = document.createElement('canvas');
      canvas.width = LYRIC_CANVAS_W;
      canvas.height = LYRIC_CANVAS_H;
      var ctx = canvas.getContext('2d');
      var texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;

      var aspect = LYRIC_CANVAS_H / LYRIC_CANVAS_W;
      var planeH = PLANE_W * aspect;
      var frontGeo = new THREE.PlaneGeometry(PLANE_W, planeH, 1, 1);
      var mat = new THREE.MeshBasicMaterial({
        map: texture, transparent: true, depthWrite: false, depthTest: false, side: THREE.FrontSide
      });
      var frontMesh = new THREE.Mesh(frontGeo, mat);
      frontMesh.renderOrder = 10;
      var backGeo = new THREE.PlaneGeometry(PLANE_W, planeH, 1, 1);
      var backMesh = new THREE.Mesh(backGeo, mat);
      backMesh.renderOrder = 10;
      backMesh.rotation.y = Math.PI;

      var group = new THREE.Group();
      group.add(frontMesh);
      group.add(backMesh);

      var slot = {
        canvas: canvas, ctx: ctx, texture: texture,
        group: group, frontMesh: frontMesh, backMesh: backMesh,
        mat: mat, baseOpacity: 1.0, isCurrent: false,
      };
      ThreeDLyrics.lyricsGroup.add(group);
      ThreeDLyrics.lineSlots.push(slot);
    }
  }

  function updateLyricLines() {
    var allLines = ThreeDLyrics._lyricsLines;
    _TDL_DEBUG && console.log('[3D-TDL] updateLyricLines: allLines=' + (allLines ? allLines.length : 'null') + ' lineSlots.length=' + ThreeDLyrics.lineSlots.length + ' lyricsGroup=' + !!ThreeDLyrics.lyricsGroup);
    if (!allLines || allLines.length === 0) {
      // Hide all slots
      for (var i = 0; i < ThreeDLyrics.lineSlots.length; i++) {
        if (ThreeDLyrics.lineSlots[i].group) ThreeDLyrics.lineSlots[i].group.visible = false;
      }
      _TDL_DEBUG && console.log('[3D-TDL] updateLyricLines: no lines, all slots hidden');
      return;
    }

    var cfg = ThreeDLyrics.config;

    // Title-artist mode: 2-line display when right chamber is open
    var isTitleMode = (allLines.length === 2);

    if (isTitleMode) {
      ensureLineSlots(2);
      var titleFS = cfg.titleFontSize || 140;
      var artistFS = cfg.artistFontSize || 80;
      var tColor = cfg.titleColor || '#ffd700';
      var aColor = cfg.artistColor || '#c0c0c0';
      var tEffect = cfg.titleEffect || '发光';

      // Slot 0: song title (big, highlighted)
      renderTextToCanvas(ThreeDLyrics.lineSlots[0].ctx, LYRIC_CANVAS_W, LYRIC_CANVAS_H, allLines[0], titleFS, tColor, tEffect);
      ThreeDLyrics.lineSlots[0].texture.needsUpdate = true;
      ThreeDLyrics.lineSlots[0].group.visible = true;
      ThreeDLyrics.lineSlots[0].baseOpacity = 1;
      ThreeDLyrics.lineSlots[0].group.position.set(0, 0.25, 0.1);

      // Slot 1: artist (smaller, plain)
      renderTextToCanvas(ThreeDLyrics.lineSlots[1].ctx, LYRIC_CANVAS_W, LYRIC_CANVAS_H, allLines[1], artistFS, aColor, '無');
      ThreeDLyrics.lineSlots[1].texture.needsUpdate = true;
      ThreeDLyrics.lineSlots[1].group.visible = true;
      ThreeDLyrics.lineSlots[1].baseOpacity = 1;
      ThreeDLyrics.lineSlots[1].group.position.set(0, -0.3, 0.1);

      for (var hi3 = 2; hi3 < ThreeDLyrics.lineSlots.length; hi3++) {
        ThreeDLyrics.lineSlots[hi3].group.visible = false;
      }
      return;
    }

    var lineCount = cfg.lineCount || 5;
    if (lineCount % 2 === 0) lineCount++;

    var currentLineIdx = ThreeDLyrics._currentLyricIdx;
    if (currentLineIdx < 0) currentLineIdx = 0;
    if (currentLineIdx >= allLines.length) currentLineIdx = allLines.length - 1;

    ensureLineSlots(lineCount);

    var halfN = Math.floor(lineCount / 2);
    var startIdx = currentLineIdx - halfN;
    if (startIdx < 0) startIdx = 0;
    if (startIdx + lineCount > allLines.length) {
      startIdx = Math.max(0, allLines.length - lineCount);
    }

    // Center the current line: offset group Y so current line is at visual center
    var centerSlotIdx = currentLineIdx - startIdx;
    ThreeDLyrics._baseGroupY = (centerSlotIdx - halfN) * LINE_HEIGHT_FACTOR * cfg.fontSize * cfg.lineSpacing;
    ThreeDLyrics.lyricsGroup.position.y = ThreeDLyrics._baseGroupY;

    var currentColor = cfg.currentColor || '#ffd700';
    var otherColor = cfg.otherColor || '#cccccc';
    var fontSize = cfg.fontSize || 120;
    var spacingMultiplier = cfg.lineSpacing || 1.2;
    var surroundRatio = 0.65;
    var highlightEffect = cfg.highlightEffect || '無';

    var lineSpacing = LINE_HEIGHT_FACTOR * fontSize * spacingMultiplier;

    for (var i = 0; i < lineCount; i++) {
      var lineIdx = startIdx + i;
      var slot = ThreeDLyrics.lineSlots[i];
      var hasText = lineIdx < allLines.length && allLines[lineIdx].trim().length > 0;
      var isEmptyLine = lineIdx < allLines.length && allLines[lineIdx].trim().length === 0;
      var distance = Math.abs(lineIdx - currentLineIdx);
      var isCurrent = (distance === 0);

      if (lineIdx < allLines.length && (hasText || isEmptyLine)) {
        var color = isCurrent ? currentColor : otherColor;
        var effect = isCurrent ? highlightEffect : '無';
        var effectiveFontSize = isCurrent ? fontSize : Math.max(18, Math.round(fontSize * Math.pow(surroundRatio, distance)));
        var baseOpacity = isCurrent ? 1.0 : Math.max(0.10, 1.0 - distance * 0.25);

        if (hasText) {
          renderTextToCanvas(slot.ctx, LYRIC_CANVAS_W, LYRIC_CANVAS_H, allLines[lineIdx], effectiveFontSize, color, effect);
        } else {
          slot.ctx.clearRect(0, 0, LYRIC_CANVAS_W, LYRIC_CANVAS_H);
        }
        slot.texture.needsUpdate = true;
        slot.group.visible = true;
        slot.baseOpacity = baseOpacity;
        slot.isCurrent = isCurrent;

        var relOffset = lineIdx - currentLineIdx;
        slot.group.position.y = -relOffset * lineSpacing;
        slot.group.position.z = -Math.abs(relOffset) * lineSpacing * 0.4;
        slot.group.scale.setScalar(1.0);
      } else {
        slot.group.visible = false;
      }
    }
    // Debug log after positioning
    var visCount = 0;
    for (var j = 0; j < ThreeDLyrics.lineSlots.length; j++) {
      if (ThreeDLyrics.lineSlots[j].group && ThreeDLyrics.lineSlots[j].group.visible) visCount++;
    }
    _TDL_DEBUG && console.log('[3D-TDL] updateLyricLines DONE: ' + visCount + '/' + lineCount + ' slots visible, startIdx=' + startIdx + ' currentLine=' + currentLineIdx + ' fontSize=' + fontSize + ' lineSpacing=' + lineSpacing.toFixed(3));
  }

  // ── Star river ──
  function buildStarGeometry(count) {
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(count * 3);
    var s = ThreeDLyrics.config.starCanvasSize;
    for (var i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * s;
      pos[i * 3 + 1] = (Math.random() - 0.5) * s;
      pos[i * 3 + 2] = (Math.random() - 0.5) * s;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return geo;
  }

  function ensureStarRiver() {
    if (ThreeDLyrics.starRiver) return ThreeDLyrics.starRiver;
    var geo = buildStarGeometry(ThreeDLyrics.config.starCount);
    var mat = new THREE.PointsMaterial({
      size: ThreeDLyrics.config.starSize,
      color: new THREE.Color(ThreeDLyrics.config.starColor),
      map: ThreeDLyrics._dotTexture,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      transparent: true,
      opacity: ThreeDLyrics.config.starOpacity,
    });
    var points = new THREE.Points(geo, mat);
    points.renderOrder = 45;
    points.position.set(0, 0.15, 1.5);
    ThreeDLyrics.scene.add(points);
    ThreeDLyrics.starRiver = points;
    return points;
  }

  function rebuildStarRiver() {
    if (!ThreeDLyrics.starRiver) return;
    var oldGeo = ThreeDLyrics.starRiver.geometry;
    ThreeDLyrics.starRiver.geometry = buildStarGeometry(ThreeDLyrics.config.starCount);
    oldGeo.dispose();
  }

  // ── Camera ──
  function updateCameraPosition() {
    var sp = Math.sin(ThreeDLyrics.orbitPhi), cp = Math.cos(ThreeDLyrics.orbitPhi);
    var st = Math.sin(ThreeDLyrics.orbitTheta), ct = Math.cos(ThreeDLyrics.orbitTheta);
    ThreeDLyrics.camera.position.x = ThreeDLyrics.orbitDistance * cp * st;
    ThreeDLyrics.camera.position.y = ThreeDLyrics.orbitDistance * sp;
    ThreeDLyrics.camera.position.z = ThreeDLyrics.orbitDistance * cp * ct;
    ThreeDLyrics.camera.lookAt(0, 0, 0);
  }

  function screenToWorld(sx, sy) {
    var ndc = new THREE.Vector3(
      (sx / window.innerWidth) * 2 - 1,
      -(sy / window.innerHeight) * 2 + 1,
      0.5
    );
    ndc.unproject(ThreeDLyrics.camera);
    var dir = ndc.clone().sub(ThreeDLyrics.camera.position).normalize();
    var t = -ThreeDLyrics.camera.position.z / dir.z;
    var pt = ThreeDLyrics.camera.position.clone().add(dir.multiplyScalar(t));
    return new THREE.Vector2(pt.x, pt.y);
  }

  // ── Mouse / touch handlers ──
  var mouseWorld = new THREE.Vector2(-999, -999);
  var mouseOnCanvas = false;

  function isOverUIElement(e) {
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return false;
    var uiSelectors = [
      '.bubble-chamber', '#center-core', '#diy-overlay', '#user-overlay',
      '#mini-player', '#search-bar-container', '#search-results-overlay',
      '#loading-overlay', '.toast-container', '.edge-trigger', '.controller-btn',
      '#chamber-bottom', '#chamber-top', '#chamber-left', '#chamber-right',
      '#volume-tooltip'
    ];
    for (var i = 0; i < uiSelectors.length; i++) {
      if (el.closest(uiSelectors[i])) return true;
    }
    return false;
  }

  function handleMouseDown(e) {
    if (!ThreeDLyrics._active) return;
    if (isOverUIElement(e)) return;
    ThreeDLyrics.isDragging = true;
    ThreeDLyrics.prevMouse.x = e.clientX;
    ThreeDLyrics.prevMouse.y = e.clientY;
  }

  function handleMouseMove(e) {
    if (!ThreeDLyrics._active) return;
    mouseOnCanvas = true;
    if (ThreeDLyrics.isDragging && !isOverUIElement(e)) {
      var dx = e.clientX - ThreeDLyrics.prevMouse.x;
      var dy = e.clientY - ThreeDLyrics.prevMouse.y;
      ThreeDLyrics.orbitTheta -= dx * 0.005;
      ThreeDLyrics.orbitPhi += dy * 0.005;
      ThreeDLyrics.orbitPhi = Math.max(-Math.PI * 0.48, Math.min(Math.PI * 0.48, ThreeDLyrics.orbitPhi));
      ThreeDLyrics.prevMouse.x = e.clientX;
      ThreeDLyrics.prevMouse.y = e.clientY;
      updateCameraPosition();
    }
    var wp = screenToWorld(e.clientX, e.clientY);
    mouseWorld.x = wp.x; mouseWorld.y = wp.y;
  }

  function handleMouseUp() { ThreeDLyrics.isDragging = false; }

  function handleMouseLeave() { mouseOnCanvas = false; }
  function handleMouseEnter() { mouseOnCanvas = true; }

  function handleWheel(e) {
    if (!ThreeDLyrics._active) return;
    if (isOverUIElement(e)) return;
    e.preventDefault();
    ThreeDLyrics.orbitDistance += e.deltaY * 0.005;
    ThreeDLyrics.orbitDistance = Math.max(3.0, Math.min(20.0, ThreeDLyrics.orbitDistance));
    updateCameraPosition();
  }

  function handleClick(e) {
    if (!ThreeDLyrics._active) return;
    if (isOverUIElement(e)) return;
    if (!ThreeDLyrics.isDragging) {
      var wp = screenToWorld(e.clientX, e.clientY);
      triggerRipple(wp.x, wp.y, 0.9);
    }
  }

  function handleTouchStart(e) {
    if (!ThreeDLyrics._active) return;
    if (isOverUIElement(e)) return;
    if (e.touches.length === 1) {
      ThreeDLyrics.isDragging = true;
      ThreeDLyrics.prevMouse.x = e.touches[0].clientX;
      ThreeDLyrics.prevMouse.y = e.touches[0].clientY;
      mouseOnCanvas = true;
      var wp = screenToWorld(e.touches[0].clientX, e.touches[0].clientY);
      mouseWorld.x = wp.x; mouseWorld.y = wp.y;
    }
  }

  function handleTouchMove(e) {
    if (!ThreeDLyrics._active) return;
    if (isOverUIElement(e)) return;
    e.preventDefault();
    if (e.touches.length === 1 && ThreeDLyrics.isDragging) {
      var dx = e.touches[0].clientX - ThreeDLyrics.prevMouse.x;
      var dy = e.touches[0].clientY - ThreeDLyrics.prevMouse.y;
      ThreeDLyrics.orbitTheta -= dx * 0.005;
      ThreeDLyrics.orbitPhi += dy * 0.005;
      ThreeDLyrics.orbitPhi = Math.max(-Math.PI * 0.48, Math.min(Math.PI * 0.48, ThreeDLyrics.orbitPhi));
      ThreeDLyrics.prevMouse.x = e.touches[0].clientX;
      ThreeDLyrics.prevMouse.y = e.touches[0].clientY;
      updateCameraPosition();
      var wp2 = screenToWorld(e.touches[0].clientX, e.touches[0].clientY);
      mouseWorld.x = wp2.x; mouseWorld.y = wp2.y;
    }
  }

  var _mouseListenersAttached = false;
  function attachMouseListeners() {
    if (_mouseListenersAttached) return;
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('click', handleClick);
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleMouseUp);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);
    _mouseListenersAttached = true;
  }

  // ── Register with RendererManager ──
  function registerWithRenderer() {
    if (ThreeDLyrics._registered) return;
    if (typeof RendererManager !== 'undefined' && RendererManager.initialized) {
      RendererManager.registerLayer('threeDLyrics', ThreeDLyrics.scene, ThreeDLyrics.camera, {
        tick: tick,
        visible: ThreeDLyrics._active,
        onResize: function (w, h) {
          ThreeDLyrics.camera.aspect = w / Math.max(h, 1);
          ThreeDLyrics.camera.updateProjectionMatrix();
        }
      });
      ThreeDLyrics._registered = true;
      _TDL_DEBUG && console.log('[3d-lyrics] Registered with RendererManager');
    }
  }

  // ── Init ──
  function init() {
    if (ThreeDLyrics.initialized) return true;
    try {
      if (typeof RendererManager === 'undefined' || !RendererManager.initialized) {
        console.warn('[3d-lyrics] RendererManager not available');
        return false;
      }

      // Scene (transparent background — composited over fluidBg)
      ThreeDLyrics.scene = new THREE.Scene();

      // Camera
      ThreeDLyrics.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 60);
      ThreeDLyrics.camera.position.set(0, 0, 9.5);
      ThreeDLyrics.camera.lookAt(0, 0, 0);

      // Dot texture (shared)
      ThreeDLyrics._dotTexture = makeDotTexture();

      // Ripple system
      for (var ri = 0; ri < RIPPLE_MAX; ri++) {
        ThreeDLyrics.ripples.push({ x: 0, y: 0, age: -10, str: 0 });
      }
      initRippleRegions();
      var rippleData = new Float32Array(RIPPLE_MAX * 4);
      ThreeDLyrics.rippleTex = new THREE.DataTexture(rippleData, 1, RIPPLE_MAX, THREE.RGBAFormat, THREE.FloatType);
      ThreeDLyrics.rippleTex.magFilter = THREE.NearestFilter;
      ThreeDLyrics.rippleTex.minFilter = THREE.NearestFilter;

      // Default cover texture (placeholder)
      var initCv = document.createElement('canvas'); initCv.width = initCv.height = 64;
      initCv.getContext('2d').fillStyle = '#040408'; initCv.getContext('2d').fillRect(0, 0, 64, 64);
      ThreeDLyrics.coverTex = new THREE.CanvasTexture(initCv);
      ThreeDLyrics.coverTex.minFilter = THREE.LinearFilter;
      ThreeDLyrics.coverTex.magFilter = THREE.LinearFilter;
      ThreeDLyrics.coverTex.wrapS = THREE.ClampToEdgeWrapping;
      ThreeDLyrics.coverTex.wrapT = THREE.ClampToEdgeWrapping;
      if (THREE.LinearSRGBColorSpace) ThreeDLyrics.coverTex.colorSpace = THREE.LinearSRGBColorSpace;

      // Uniforms
      uniforms = {
        uTime: { value: 0 }, uBass: { value: 0 }, uMid: { value: 0 }, uTreble: { value: 0 },
        uBeat: { value: 0 }, uEnergy: { value: 0 }, uIntensity: { value: ThreeDLyrics.config.intensity },
        uPointScale: { value: ThreeDLyrics.config.pointScale }, uSpeed: { value: 1.0 },
        uTwist: { value: 0 }, uColorBoost: { value: 1.1 }, uScatter: { value: 0 },
        uDepth: { value: ThreeDLyrics.config.depth }, uCoverTex: { value: ThreeDLyrics.coverTex },
        uRippleTex: { value: ThreeDLyrics.rippleTex }, uRippleCount: { value: 0 },
        uDotTex: { value: ThreeDLyrics._dotTexture }, uHasCover: { value: 0 },
        uMouseXY: { value: new THREE.Vector2(-999, -999) }, uMouseActive: { value: 0 },
        uPixel: { value: Math.min(window.devicePixelRatio || 1, 2) }, uAlpha: { value: 0 },
      };
      ThreeDLyrics._uniforms = uniforms;

      // Build shared particle geometry
      ThreeDLyrics.particleGeo = buildParticleGeometry(GRID);

      // Cover particle material
      ThreeDLyrics.particleMat = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: vs,
        fragmentShader: fs,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.NormalBlending,
      });

      // Main cover particles (top layer)
      ThreeDLyrics.particleSystem = new THREE.Points(ThreeDLyrics.particleGeo, ThreeDLyrics.particleMat);
      ThreeDLyrics.particleSystem.renderOrder = 1;
      ThreeDLyrics.scene.add(ThreeDLyrics.particleSystem);

      // Back-facing mirror for cover particles (always visible for seamless rotation)
      var particlesBack = new THREE.Points(ThreeDLyrics.particleGeo, ThreeDLyrics.particleMat);
      ThreeDLyrics._particlesBack = particlesBack;
      particlesBack.scale.x = -1;
      particlesBack.renderOrder = 1;
      ThreeDLyrics.scene.add(particlesBack);

      // Lyrics group
      ThreeDLyrics.lyricsGroup = new THREE.Group();
      ThreeDLyrics.lyricsGroup.renderOrder = 10;
      ThreeDLyrics.lyricsGroup.position.set(0, 0, 1.5);
      ThreeDLyrics.scene.add(ThreeDLyrics.lyricsGroup);

      // Star river (deferred — ensure it's added)
      ensureStarRiver();

      // Mouse listeners
      attachMouseListeners();

      // Register with RendererManager
      registerWithRenderer();

      ThreeDLyrics.initialized = true;
      ThreeDLyrics._fadeStart = performance.now();
      console.log('[3D-TDL] Init SUCCESS: scene=' + !!ThreeDLyrics.scene +
        ' | camera=' + !!ThreeDLyrics.camera +
        ' | particleSystem=' + !!ThreeDLyrics.particleSystem +
        ' | lyricsGroup=' + !!ThreeDLyrics.lyricsGroup +
        ' | starRiver=' + !!ThreeDLyrics.starRiver +
        ' | _registered=' + ThreeDLyrics._registered +
        ' | _active=' + ThreeDLyrics._active +
        ' | renderOrder: particles=' + (ThreeDLyrics.particleSystem ? ThreeDLyrics.particleSystem.renderOrder : 'null') +
        ' lyrics=' + (ThreeDLyrics.lyricsGroup ? ThreeDLyrics.lyricsGroup.renderOrder : 'null'));
      // Dump scene children
      if (ThreeDLyrics.scene) {
        _TDL_DEBUG && console.log('[3D-TDL] Scene children count: ' + ThreeDLyrics.scene.children.length);
        for (var ci = 0; ci < ThreeDLyrics.scene.children.length; ci++) {
          var child = ThreeDLyrics.scene.children[ci];
          _TDL_DEBUG && console.log('[3D-TDL]   child[' + ci + ']: type=' + child.type + ' visible=' + child.visible + ' renderOrder=' + child.renderOrder);
        }
      }
      return true;
    } catch (e) {
      console.error('[3d-lyrics] Init failed:', e);
      return false;
    }
  }

  // ── Tick ──
  var elapsedTime = 0;
  var FADE_DURATION = 2000;

  function tick(dt) {
    if (!ThreeDLyrics.initialized || !ThreeDLyrics._active) {
      if (!ThreeDLyrics._tickSilent) {
        _TDL_DEBUG && console.log('[3D-TDL] tick BAILED: initialized=' + ThreeDLyrics.initialized + ' _active=' + ThreeDLyrics._active);
        ThreeDLyrics._tickSilent = true;
      }
      return;
    }
    ThreeDLyrics._tickSilent = false;
    if (dt === undefined) dt = 0.016;
    elapsedTime += dt;

    // Ensure valid uniforms
    if (!uniforms || !uniforms.uAlpha || uniforms.uAlpha.value === undefined) {
      console.warn('[3D-TDL] uniforms.uAlpha invalid, re-initializing. uniforms=' + !!uniforms + ' uAlpha=' + !!(uniforms && uniforms.uAlpha));
      // Re-init the uniforms if they were lost
      if (!uniforms) uniforms = {};
      uniforms.uTime = uniforms.uTime || { value: 0 };
      uniforms.uBass = uniforms.uBass || { value: 0 };
      uniforms.uMid = uniforms.uMid || { value: 0 };
      uniforms.uTreble = uniforms.uTreble || { value: 0 };
      uniforms.uBeat = uniforms.uBeat || { value: 0 };
      uniforms.uEnergy = uniforms.uEnergy || { value: 0 };
      uniforms.uAlpha = uniforms.uAlpha || { value: 0 };
      uniforms.uMouseActive = uniforms.uMouseActive || { value: 0 };
    }

    // Fade in — guard against unset _fadeStart
    if (!ThreeDLyrics._fadeStart) ThreeDLyrics._fadeStart = performance.now();
    var fadeT = Math.min(1, (performance.now() - ThreeDLyrics._fadeStart) / FADE_DURATION);
    if (isNaN(fadeT)) fadeT = 0;
    uniforms.uAlpha.value = fadeT * fadeT * (3 - 2 * fadeT);

    // ── Audio data (MUST read BEFORE debug log — var hoisting would leave them undefined otherwise) ──
    var bass = 0, mid = 0, treble = 0, energy = 0;
    if (typeof FluidAudio !== 'undefined' && FluidAudio.bands) {
      bass = FluidAudio.bands.bass || 0;
      mid = FluidAudio.bands.mid || 0;
      treble = FluidAudio.bands.treble || 0;
      energy = FluidAudio.bands.energy || 0;
    }

    // Log every ~60 frames (once per second)
    if (!ThreeDLyrics._debugFrameCount) ThreeDLyrics._debugFrameCount = 0;
    ThreeDLyrics._debugFrameCount++;
    if (ThreeDLyrics._debugFrameCount % 60 === 1) {
      var alphaVal = (uniforms && uniforms.uAlpha) ? uniforms.uAlpha.value : 'MISSING';
      _TDL_DEBUG && console.log('[3D-TDL] tick frame#' + ThreeDLyrics._debugFrameCount +
        ' | alpha=' + (typeof alphaVal === 'number' ? alphaVal.toFixed(3) : alphaVal) +
        ' | bass=' + (typeof bass === 'number' ? bass.toFixed(3) : bass) +
        ' | energy=' + (typeof energy === 'number' ? energy.toFixed(3) : energy) +
        ' | particles=' + (ThreeDLyrics.particleSystem ? ThreeDLyrics.particleSystem.visible : 'null') +
        ' | lyricSlots=' + ThreeDLyrics.lineSlots.length +
        ' | starRiver=' + !!ThreeDLyrics.starRiver +
        ' | fadeStart=' + ThreeDLyrics._fadeStart +
        ' | uAlphaObj=' + JSON.stringify(uniforms && uniforms.uAlpha));
    }

    // ── Lyrics sync: check right chamber visibility ──
    if (ThreeDLyrics._debugFrameCount % 30 === 0) {
      // Check right chamber DOM visibility directly
      var rightChamber = document.getElementById('chamber-right');
      var rightVisible = rightChamber && rightChamber.classList.contains('visible') &&
                         !rightChamber.classList.contains('hiding');

      // Track chamber state — toggle title-artist vs full lyrics
      if (ThreeDLyrics._lastRightVisible === undefined) ThreeDLyrics._lastRightVisible = null;
      if (rightVisible !== ThreeDLyrics._lastRightVisible) {
        ThreeDLyrics._lastRightVisible = rightVisible;

        if (rightVisible) {
          // Right chamber open → show title+artist as 3D text
          if (typeof FluidAudio !== 'undefined' && FluidAudio.currentTrack) {
            var t = FluidAudio.currentTrack;
            ThreeDLyrics.setLyrics([t.title || 'FluidMusic', t.artist || ''], 0);
          }
        } else {
          // Right chamber hidden → full lyrics
          if (typeof window.LyricChamber !== 'undefined') {
            var src = window.LyricChamber;
            if (src.lyricsLines && src.lyricsLines.length > 0) {
              ThreeDLyrics.setLyrics(src.lyricsLines, src._lastLyricIdx || 0);
            } else if (src.lyricTimes && src.lyricTimes.length > 0) {
              ThreeDLyrics.setLyrics(src.lyricTimes.map(function(lt) { return lt.text; }), src._lastLyricIdx || 0);
            }
          }
          if ((!ThreeDLyrics._lyricsLines || ThreeDLyrics._lyricsLines.length === 0) &&
              typeof FluidAudio !== 'undefined' && FluidAudio.currentTrack) {
            ThreeDLyrics.setLyrics([FluidAudio.currentTrack.title, FluidAudio.currentTrack.artist || ''], 0);
          }
        }
      }
    }

    // Beat detection (simple threshold)
    var beatValue = energy > 0.08 ? Math.min(1, (energy - 0.08) * 5) : 0;

    // Update uniforms
    uniforms.uTime.value = ThreeDLyrics.time || 0;
    ThreeDLyrics.time += dt;
    uniforms.uBass.value = bass;
    uniforms.uMid.value = mid;
    uniforms.uTreble.value = treble;
    uniforms.uEnergy.value = energy;
    uniforms.uBeat.value = beatValue;

    // Mouse
    if (mouseOnCanvas) {
      uniforms.uMouseXY.value.set(mouseWorld.x, mouseWorld.y);
      uniforms.uMouseActive.value += (1.0 - uniforms.uMouseActive.value) * 0.15;
    } else {
      uniforms.uMouseActive.value *= 0.9;
    }

    // Ripples
    var rippleCount = updateRipples(dt, bass, uniforms.uTime.value);
    uniforms.uRippleCount.value = rippleCount;

    // Lyrics group audio reactivity
    if (ThreeDLyrics.lyricsGroup) {
      var baseZ = 1.5;
      var targetZ = baseZ + bass * 0.3;
      ThreeDLyrics.lyricsGroup.position.z += (targetZ - ThreeDLyrics.lyricsGroup.position.z) * 0.12;
      var targetScale = 1.0 + energy * 0.08;
      ThreeDLyrics.lyricsGroup.scale.setScalar(
        ThreeDLyrics.lyricsGroup.scale.x + (targetScale - ThreeDLyrics.lyricsGroup.scale.x) * 0.15
      );
      var baseY = ThreeDLyrics._baseGroupY || 0;
      var yOsc = Math.sin(elapsedTime * 1.7) * mid * 0.03 + Math.sin(elapsedTime * 3.1) * energy * 0.02;
      ThreeDLyrics.lyricsGroup.position.y = baseY + yOsc;
    }

    // Individual line opacity
    for (var i = 0; i < ThreeDLyrics.lineSlots.length; i++) {
      var slot = ThreeDLyrics.lineSlots[i];
      if (!slot.group || !slot.group.visible) continue;
      var baseOp = slot.baseOpacity !== undefined ? slot.baseOpacity : 0.65;
      var targetOp = Math.min(1.0, baseOp);
      if (slot.mat) {
        var curOp = slot.mat.opacity;
        if (curOp !== undefined && !isNaN(curOp)) {
          slot.mat.opacity = curOp + (targetOp - curOp) * 0.2;
        } else {
          slot.mat.opacity = targetOp;
        }
      }
    }

    // Star river
    if (ThreeDLyrics.starRiver) {
      ThreeDLyrics.starRiver.rotation.y += ThreeDLyrics.config.starSpeed;
      ThreeDLyrics.starRiver.rotation.z = Math.sin(elapsedTime * 0.3) * 0.03;
      ThreeDLyrics.starRiver.material.opacity = ThreeDLyrics.config.starOpacity * (0.73 + bass * 0.55 + beatValue * 0.27);
    }

    // Smooth camera-facing rotation: rotate particle plane to always face camera
    // Uses continuous atan2 angle instead of binary sign — avoids stutter at side angles
    if (!ThreeDLyrics._camDir) ThreeDLyrics._camDir = new THREE.Vector3();
    ThreeDLyrics.camera.getWorldDirection(ThreeDLyrics._camDir);
    var camAngle = Math.atan2(ThreeDLyrics._camDir.x, ThreeDLyrics._camDir.z);
    // Normalize angle difference to [-PI, PI] for shortest rotation path
    var curRotY = ThreeDLyrics.particleSystem.rotation.y;
    var diff = camAngle - curRotY;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    var newRotY = curRotY + diff * 0.12;
    ThreeDLyrics.particleSystem.rotation.y = newRotY;
    // Sync back-facing particles (only known children, no full scene scan)
    if (ThreeDLyrics._particlesBack) ThreeDLyrics._particlesBack.rotation.y = newRotY;
  }

  // ── Public API ──

  ThreeDLyrics.init = init;
  ThreeDLyrics.tick = tick;

  ThreeDLyrics.setActive = function (active) {
    _TDL_DEBUG && console.log('[3D-TDL] setActive(' + active + ') _active=' + ThreeDLyrics._active + ' initialized=' + ThreeDLyrics.initialized + ' _registered=' + ThreeDLyrics._registered + ' _lyricsLines=' + (ThreeDLyrics._lyricsLines ? ThreeDLyrics._lyricsLines.length : 0));
    ThreeDLyrics._active = active;
    if (active && !ThreeDLyrics.initialized) {
      init();
    }
    if (ThreeDLyrics.initialized) {
      if (active) {
        ThreeDLyrics._fadeStart = performance.now();
        if (uniforms && uniforms.uAlpha) uniforms.uAlpha.value = 0;
        // Lyrics sync is handled by tick() — don't set here to avoid conflict
        ThreeDLyrics._lastRightVisible = null; // force re-check on first tick

        // Also sync cover if current track available; fallback to default
        if (!ThreeDLyrics.hasCover) {
          if (typeof FluidAudio !== 'undefined' && FluidAudio.currentTrack) {
            _TDL_DEBUG && console.log('[3D-TDL] auto-syncing cover from FluidAudio');
            ThreeDLyrics.setTrack(FluidAudio.currentTrack);
          } else {
            _TDL_DEBUG && console.log('[3D-TDL] no track yet, loading default cover');
            loadDefaultCover();
          }
        }

        // Ensure lyrics are updated
        updateLyricLines();
        _TDL_DEBUG && console.log('[3D-TDL] activated: scene=' + !!ThreeDLyrics.scene + ' camera=' + !!ThreeDLyrics.camera + ' particles=' + !!ThreeDLyrics.particleSystem + ' starRiver=' + !!ThreeDLyrics.starRiver + ' lyricSlots=' + ThreeDLyrics.lineSlots.length);
      }
      if (typeof RendererManager !== 'undefined') {
        RendererManager.setLayerVisible('threeDLyrics', active);
        _TDL_DEBUG && console.log('[3D-TDL] RendererManager.setLayerVisible threeDLyrics=' + active);
      }
    }
  };

  ThreeDLyrics.setTrack = function (track) {
    if (!track) return;
    var coverUrl = track.coverUrl || track.cover || '';
    if (coverUrl && String(coverUrl).startsWith('http')) {
      // Use cover proxy to avoid CORS
      var proxyUrl = window.location.origin + '/api/cover-proxy?url=' + encodeURIComponent(coverUrl);
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        loadCoverImage(img);
      };
      img.onerror = function () {
        console.warn('[3d-lyrics] Failed to load cover, using default');
        loadDefaultCover();
      };
      img.src = proxyUrl;
    } else {
      // No cover URL — use default FluidMusic cover
      loadDefaultCover();
    }
  };

  function loadDefaultCover() {
    var img = new Image();
    img.onload = function () {
      loadCoverImage(img);
    };
    img.onerror = function () {
      console.warn('[3d-lyrics] Failed to load default cover');
    };
    img.src = 'assets/FluidMusic.png';
  }

  ThreeDLyrics.setLyrics = function (lines, currentIndex) {
    ThreeDLyrics._lyricsLines = lines || [];
    ThreeDLyrics._currentLyricIdx = currentIndex || 0;
    _TDL_DEBUG && console.log('[3D-TDL] setLyrics called: ' + ThreeDLyrics._lyricsLines.length + ' lines, currentIdx=' + ThreeDLyrics._currentLyricIdx);
    if (ThreeDLyrics._lyricsLines.length > 0) {
      _TDL_DEBUG && console.log('[3D-TDL] First 3 lines: ' + JSON.stringify(ThreeDLyrics._lyricsLines.slice(0, 3)));
    }
    if (ThreeDLyrics.initialized) {
      updateLyricLines();
    }
  };

  ThreeDLyrics.setCurrentLyricIndex = function (idx) {
    ThreeDLyrics._currentLyricIdx = idx;
    if (ThreeDLyrics.initialized) {
      updateLyricLines();
    }
  };

  ThreeDLyrics.updateConfig = function (key, value) {
    if (ThreeDLyrics.config.hasOwnProperty(key)) {
      ThreeDLyrics.config[key] = value;
      // Apply immediately
      switch (key) {
        case 'titleColor':
        case 'titleFontSize':
        case 'artistColor':
        case 'artistFontSize':
        case 'titleEffect':
          // Title/artist mode changed — rebuild if showing 2-line mode
          if (ThreeDLyrics._lyricsLines && ThreeDLyrics._lyricsLines.length === 2) {
            updateLyricLines();
          }
          break;
        case 'intensity':
          if (uniforms.uIntensity) uniforms.uIntensity.value = value;
          break;
        case 'pointScale':
          if (uniforms.uPointScale) uniforms.uPointScale.value = value;
          break;
        case 'depth':
          if (uniforms.uDepth) uniforms.uDepth.value = value;
          break;
        case 'starSize':
          if (ThreeDLyrics.starRiver) ThreeDLyrics.starRiver.material.size = value;
          break;
        case 'starOpacity':
          if (ThreeDLyrics.starRiver) ThreeDLyrics.starRiver.material.opacity = value;
          break;
        case 'starColor':
          if (ThreeDLyrics.starRiver) ThreeDLyrics.starRiver.material.color.set(value);
          break;
        case 'starCount':
        case 'starCanvasSize':
          if (ThreeDLyrics.starRiver) rebuildStarRiver();
          break;
        case 'lineCount':
        case 'currentColor':
        case 'otherColor':
        case 'fontFamily':
        case 'fontSize':
        case 'lineSpacing':
        case 'highlightEffect':
          if (ThreeDLyrics.initialized) updateLyricLines();
          break;
      }
    }
  };

  ThreeDLyrics.resize = function () {
    if (typeof RendererManager !== 'undefined') {
      RendererManager.resize(window.innerWidth, window.innerHeight);
    }
  };

  // Register with module registry
  if (typeof __FM !== 'undefined') __FM.register('threeDLyrics', ['rendererManager'], function () { return ThreeDLyrics; }, { priority: 6 });
  window.ThreeDLyricsScene = ThreeDLyrics;
  console.log('FluidMusic 3D Lyrics Scene loaded');
})();
