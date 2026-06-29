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
    resolution: 118,
    layers: 3,
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
    zoom: 3.5,
    coverUrl: null,
  };

  // ── Build particle geometry from image ──
  function buildCoverParticleGeometry(image, resolution) {
    const res = resolution || 118;
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

    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const idx = (y * res + x) * 4;
        const r = imageData.data[idx];
        const g = imageData.data[idx + 1];
        const b = imageData.data[idx + 2];
        const a = imageData.data[idx + 3];

        const brightness = (r + g + b) / 3 / 255;

        // Grid position centered
        const px = (x - halfRes) * spacing;
        const py = (y - halfRes) * spacing * -1; // Flip Y
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

  function createShaderMaterial() {
    const vertexShader = [
      'uniform float uTime; uniform float uBass; uniform float uMid; uniform float uTreble; uniform float uEnergy;',
      'uniform float uTransition; uniform float uLayerDepth;',
      'attribute float aRandom; attribute float aLayer;',
      'varying vec3 vColor; varying float vAlpha; varying float vHeight; varying vec2 vUv;',
      'float hash(float n){return fract(sin(n)*43758.5453123);}',
      'float noise(vec3 x){vec3 p=floor(x);vec3 f=fract(x);f=f*f*(3.0-2.0*f);float n=p.x+p.y*57.0+113.0*p.z;return mix(mix(mix(hash(n+0.0),hash(n+1.0),f.x),mix(hash(n+57.0),hash(n+58.0),f.x),f.y),mix(mix(hash(n+113.0),hash(n+114.0),f.x),mix(hash(n+170.0),hash(n+171.0),f.x),f.y),f.z);}',
      'void main(){',
      'vUv=uv;',
      'vec3 pos=position;',
      'float scatter=1.0-uTransition; float scatterStr=scatter*4.0;',
      'float bassLift=uBass*(1.0-aLayer)*2.5;',
      'float midLift=uMid*abs(aLayer-0.5)*2.0*2.5;',
      'float trebleLift=uTreble*aLayer*2.0; float audioLift=bassLift+midLift+trebleLift;',
      'float angle=aRandom*6.28318; float radius=hash(aRandom+uTime*0.05)*scatterStr;',
      'float scatterX=cos(angle)*radius; float scatterY=sin(angle)*radius;',
      'float scatterZ=(hash(aRandom*2.0)-0.5)*scatterStr*2.0;',
      'float easeTrans=uTransition*uTransition*(3.0-2.0*uTransition);',
      'pos.x+=scatterX*(1.0-easeTrans); pos.y+=scatterY*(1.0-easeTrans); pos.z+=scatterZ*(1.0-easeTrans);',
      'pos.z+=audioLift*(0.3+aLayer*0.7);',
      'float warmTint=mix(0.0,uBass*0.15,1.0-aLayer); float coolTint=mix(0.0,uTreble*0.15,aLayer);',
      'vColor=vec3(0.9+warmTint-coolTint*0.3,0.9-abs(aLayer-0.5)*0.2,0.9+coolTint-warmTint*0.3);',
      'vAlpha=easeTrans; vHeight=pos.z;',
      'vec4 mvPosition=modelViewMatrix*vec4(pos,1.0);',
      'gl_PointSize=mix(2.0,3.5,1.0-aLayer)*(280.0/-mvPosition.z);',
      'gl_Position=projectionMatrix*mvPosition;',
      '}',
    ].join('\n');

    const fragmentShader = [
      'varying vec3 vColor; varying float vAlpha; varying float vHeight; varying vec2 vUv;',
      'uniform float uTime; uniform float uEnergy;',
      'void main(){',
      'vec2 center=gl_PointCoord-vec2(0.5); float dist=length(center);',
      'float alpha=1.0-smoothstep(0.4,0.5,dist);',
      'float glow=exp(-dist*4.0)*0.3;',
      'vec3 color=vColor+glow*vec3(0.2,0.15,0.3)*uEnergy;',
      'float grain=1.0-dist*0.3;',
      'float finalAlpha=alpha*vAlpha*grain;',
      'if(finalAlpha<0.01)discard;',
      'gl_FragColor=vec4(color,finalAlpha);',
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
        uLayerDepth: { value: 0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
    });
  }

  function init(canvas, imageUrl) {
    if (ParticleCover.initialized) return true;
    try {
      const renderer = new THREE.WebGLRenderer({ canvas: canvas || document.getElementById('particle-canvas'), alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      const containerEl = canvas ? canvas.parentElement : document.getElementById('particle-cover-container');
      const cw = containerEl ? containerEl.clientWidth : 280;
      const ch = containerEl ? containerEl.clientHeight : 280;
      renderer.setSize(cw, ch);
      renderer.setClearColor(0x000000, 0);

      ParticleCover.renderer = renderer;
      ParticleCover.scene = new THREE.Scene();
      ParticleCover.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 20);
      ParticleCover.camera.position.z = ParticleCover.zoom;
      ParticleCover.material = createShaderMaterial();

      // Load demo image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        ParticleCover.geometry = buildCoverParticleGeometry(img, ParticleCover.resolution);
        ParticleCover.particleSystem = new THREE.Points(ParticleCover.geometry, ParticleCover.material);
        ParticleCover.scene.add(ParticleCover.particleSystem);

        // Entrance animation
        ParticleCover.targetTransition = 1;
        ParticleCover.transitionSpeed = 1.0 / 0.6; // 0.6s fast entrance (matches Mineradio)
      };
      img.src = imageUrl || 'assets/icon.png';

      // Mouse interaction on container
      const container = canvas.parentElement;
      if (container) {
        container.addEventListener('mousedown', (e) => {
          ParticleCover.mouseDown = true;
          ParticleCover.mouseX = e.clientX;
          ParticleCover.mouseY = e.clientY;
        });
        container.addEventListener('mousemove', (e) => {
          if (ParticleCover.mouseDown) {
            const dx = e.clientX - ParticleCover.mouseX;
            const dy = e.clientY - ParticleCover.mouseY;
            ParticleCover.targetRotY += dx * 0.005;
            ParticleCover.targetRotX += dy * 0.005;
            ParticleCover.targetRotX = Math.max(-1.2, Math.min(1.2, ParticleCover.targetRotX));
            ParticleCover.mouseX = e.clientX;
            ParticleCover.mouseY = e.clientY;
          }
        });
        window.addEventListener('mouseup', () => { ParticleCover.mouseDown = false; });
        container.addEventListener('wheel', (e) => {
          e.preventDefault();
          ParticleCover.zoom += e.deltaY * 0.005;
          ParticleCover.zoom = Math.max(2.0, Math.min(6.0, ParticleCover.zoom));
        });
      }

      ParticleCover.initialized = true;
      console.log('Particle Cover initialized');
      return true;
    } catch (e) {
      console.error('Particle Cover init failed:', e);
      return false;
    }
  }

  function tick(dt) {
    if (!ParticleCover.initialized) return;
    ParticleCover.time += dt || 0.016;

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
    }

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
    if (!ParticleCover.initialized || !ParticleCover.renderer) return;
    ParticleCover.renderer.render(ParticleCover.scene, ParticleCover.camera);
  }

  // ── Public API ──
  ParticleCover.init = init;
  ParticleCover.tick = tick;
  ParticleCover.render = render;

  ParticleCover.setResolution = function (r) {
    ParticleCover.resolution = r;
    // Rebuild would need image reload
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
    // Upgrade HTTP to HTTPS
    const url = String(imageUrl).replace(/^http:/, 'https:');
    console.log('[ParticleCover] Loading image:', url.substring(0, 80));
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
      try {
        if (ParticleCover.geometry) ParticleCover.geometry.dispose();
        ParticleCover.geometry = buildCoverParticleGeometry(img, ParticleCover.resolution);
        if (ParticleCover.particleSystem) {
          ParticleCover.particleSystem.geometry = ParticleCover.geometry;
        }
        console.log('[ParticleCover] Image loaded, particles rebuilt');
      } catch(e) {
        console.warn('[ParticleCover] Failed to rebuild geometry:', e.message);
      }
    };
    img.onerror = function () {
      console.warn('[ParticleCover] Failed to load image:', url.substring(0, 80));
    };
    img.src = url;
  };

  ParticleCover.setSensitivity = function (v) { /* future use */ };
  ParticleCover.setRotationSpeed = function (v) { /* future use */ };

  // Resize handler
  function onResize() {
    if (!ParticleCover.initialized) return;
    const containerEl = document.getElementById('particle-cover-container');
    if (!containerEl) return;
    const cw = containerEl.clientWidth;
    const ch = containerEl.clientHeight;
    ParticleCover.renderer.setSize(cw, ch);
    ParticleCover.camera.aspect = cw / Math.max(ch, 1);
    ParticleCover.camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);

  window.ParticleCover = ParticleCover;
  console.log('FluidMusic Particle Cover loaded');
})();
