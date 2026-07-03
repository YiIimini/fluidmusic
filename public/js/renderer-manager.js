// ============================================================
// FluidMusic — Shared WebGL Renderer Manager
// Consolidates 4 independent WebGL contexts into 1 shared context
// Reduces GPU memory from ~400MB to ~100MB
// ============================================================
(function () {
  'use strict';

  if (typeof THREE === 'undefined') {
    console.warn('RendererManager: THREE not loaded');
    window.RendererManager = { init: function(){return false;} };
    return;
  }

  const RendererManager = {
    renderer: null,
    canvas: null,
    layers: [],       // { key, scene, camera, visible, tick }
    initialized: false,
  };

  // Shader material cache — avoid recompilation
  RendererManager._shaderCache = {};

  RendererManager.getCachedMaterial = function(key, createFn) {
    if (RendererManager._shaderCache[key]) {
      return RendererManager._shaderCache[key];
    }
    var mat = createFn();
    RendererManager._shaderCache[key] = mat;
    return mat;
  };

  function init() {
    if (RendererManager.initialized) return true;
    try {
      // Use a single full-screen transparent canvas
      const canvas = document.getElementById('bg-canvas');
      if (!canvas) {
        console.error('[RendererManager] Canvas #bg-canvas not found');
        return false;
      }

      const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.autoClear = true;

      // Ensure canvas fills viewport
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '0';

      RendererManager.renderer = renderer;
      RendererManager.canvas = canvas;
      RendererManager.initialized = true;
      console.log('[RendererManager] Shared WebGL renderer initialized');
      return true;
    } catch (e) {
      console.error('[RendererManager] Init failed:', e);
      return false;
    }
  }

  // Register a visual layer — returns { scene, camera } for the module to use
  // Layers are rendered in registration order (last = on top)
  function registerLayer(key, scene, camera, opts) {
    opts = opts || {};
    // Remove existing layer with same key
    RendererManager.layers = RendererManager.layers.filter(l => l.key !== key);
    RendererManager.layers.push({
      key: key,
      scene: scene,
      camera: camera,
      tickFn: opts.tick || null,
      visible: opts.visible !== false,
    });
    console.log('[RendererManager] Registered layer:', key, '| total layers:', RendererManager.layers.length);
  }

  // Run tick() for all registered layers
  function tickAll(dt) {
    for (const layer of RendererManager.layers) {
      if (layer.tickFn && layer.visible) {
        try { layer.tickFn(dt); } catch(e) { /* ignore */ }
      }
    }
  }

  // Render all visible layers to the shared canvas in Z-order
  function render() {
    if (!RendererManager.initialized) return;
    const r = RendererManager.renderer;

    r.autoClear = true;
    let first = true;

    for (const layer of RendererManager.layers) {
      if (!layer.visible) continue;
      if (!layer.scene || !layer.camera) continue;

      // Reset viewport to full canvas for each layer
      r.setViewport(0, 0, r.domElement.width, r.domElement.height);
      r.setScissor(0, 0, r.domElement.width, r.domElement.height);

      // For sub-region layers (particle cover, spectrum), use scissor/viewport
      if (layer.viewport) {
        const vp = layer.viewport; // { x, y, w, h }
        r.setViewport(vp.x, vp.y, vp.w, vp.h);
        r.setScissor(vp.x, vp.y, vp.w, vp.h);
        r.setScissorTest(true);
      }

      r.render(layer.scene, layer.camera);

      if (layer.viewport) {
        r.setScissorTest(false);
      }

      // After first layer, don't clear — subsequent layers composite on top
      if (first) {
        r.autoClear = false;
        first = false;
      }
    }
  }

  // Resize the shared canvas and update all camera aspects
  function resize(w, h) {
    if (!RendererManager.initialized) return;
    w = w || window.innerWidth;
    h = h || window.innerHeight;
    RendererManager.renderer.setSize(w, h);
    for (const layer of RendererManager.layers) {
      if (layer.camera && layer.camera.aspect !== undefined) {
        // Only PerspectiveCamera has aspect
        if (layer.camera.isPerspectiveCamera) {
          layer.camera.aspect = w / Math.max(h, 1);
          layer.camera.updateProjectionMatrix();
        }
      }
      // Notify layer of resize if it has a handler
      if (layer.onResize) {
        try { layer.onResize(w, h); } catch(e) {}
      }
    }
  }

  // Set viewport for a specific layer (for sub-region rendering)
  function setLayerViewport(key, x, y, w, h) {
    const layer = RendererManager.layers.find(l => l.key === key);
    if (layer) {
      layer.viewport = { x, y, w, h };
    }
  }

  // Set layer visibility
  function setLayerVisible(key, visible) {
    const layer = RendererManager.layers.find(l => l.key === key);
    if (layer) layer.visible = visible;
  }

  RendererManager.init = init;
  RendererManager.registerLayer = registerLayer;
  RendererManager.tickAll = tickAll;
  RendererManager.render = render;
  RendererManager.resize = resize;
  RendererManager.setLayerViewport = setLayerViewport;
  RendererManager.setLayerVisible = setLayerVisible;

  if (typeof __FM !== 'undefined') __FM.register('rendererManager', [], function () { return RendererManager; }, { priority: 8 });
  window.RendererManager = RendererManager;
  console.log('FluidMusic Renderer Manager loaded');
})();
