// ============================================================
// FluidMusic — Test Setup
// Mocks for browser APIs not available in jsdom
// ============================================================

// Mock localStorage
const store = {};
global.localStorage = {
  getItem: (key) => store[key] || null,
  setItem: (key, value) => { store[key] = String(value); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { for (const k in store) delete store[k]; },
  get length() { return Object.keys(store).length; },
  key: (i) => Object.keys(store)[i] || null,
};

// Mock AudioContext / Web Audio API
global.AudioContext = class {
  constructor() {
    this.state = 'running';
    this.sampleRate = 44100;
  }
  createAnalyser() {
    return {
      fftSize: 2048,
      smoothingTimeConstant: 0.8,
      frequencyBinCount: 1024,
      connect: () => {},
      getByteFrequencyData: (arr) => { for (let i = 0; i < arr.length; i++) arr[i] = 0; },
      getByteTimeDomainData: (arr) => { for (let i = 0; i < arr.length; i++) arr[i] = 128; },
    };
  }
  createGain() {
    return { gain: { value: 1 }, connect: () => {} };
  }
  createMediaElementSource() {
    return { connect: () => {}, disconnect: () => {} };
  }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
};

global.webkitAudioContext = global.AudioContext;

// Mock Audio element
global.Audio = class {
  constructor() {
    this.src = '';
    this.volume = 1;
    this.currentTime = 0;
    this.duration = 0;
    this.crossOrigin = '';
    this.preload = 'auto';
    this.paused = true;
  }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  load() {}
  addEventListener() {}
  removeAttribute() {}
};

// Mock Image
global.Image = class {
  constructor() {
    this.src = '';
    this.width = 100;
    this.height = 100;
    this.crossOrigin = '';
    this.onload = null;
    this.onerror = null;
  }
};

// Mock HTMLCanvasElement.getContext
const origCreateElement = global.document.createElement.bind(global.document);
global.document.createElement = function (tagName) {
  const el = origCreateElement(tagName);
  if (tagName === 'canvas' || tagName === 'CANVAS') {
    el.getContext = () => ({
      drawImage: () => {},
      getImageData: () => ({
        data: new Uint8ClampedArray(118 * 118 * 4),
        width: 118,
        height: 118,
      }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      fillRect: () => {},
    });
    el.toDataURL = () => 'data:image/png;base64,';
  }
  return el;
};

// Mock requestAnimationFrame
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.requestIdleCallback = (cb) => setTimeout(cb, 0);

// Mock window.matchMedia (used by some CSS operations)
global.matchMedia = () => ({ matches: false, addEventListener: () => {} });

// Clear localStorage before each test
beforeEach(() => {
  global.localStorage.clear();
});
