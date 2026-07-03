// ============================================================
// FluidMusic — Visual Contrast Manager
// Auto-detects background brightness and adjusts text contrast.
// Extracted from app.js (~80 lines).
// ============================================================
(function () {
  let _brightnessSampleCanvas = null;
  let contrastTimer = null;

  function detectBackgroundBrightness(element) {
    if (!element) return 0.5;
    const rect = element.getBoundingClientRect();
    // eslint-disable-next-line no-unused-vars
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    // Method 1: Sample wallpaper layer brightness (if wallpaper is loaded)
    const wpLayer = document.getElementById('wallpaper-layer');
    if (wpLayer && wpLayer.classList.contains('loaded')) {
      const wpOpacity = parseFloat(wpLayer.style.opacity || 0.5);
      if (wpOpacity > 0.2) {
        try {
          if (!_brightnessSampleCanvas) {
            _brightnessSampleCanvas = document.createElement('canvas');
            _brightnessSampleCanvas.width = 10;
            _brightnessSampleCanvas.height = 10;
          }
          // eslint-disable-next-line no-unused-vars
          const ctx = _brightnessSampleCanvas.getContext('2d');
          const bgImage = wpLayer.style.backgroundImage;
          if (bgImage && bgImage.startsWith('url(')) {
            return 0.45 + wpOpacity * 0.25;
          }
        } catch (_) {}
      }
    }

    const _sampleY = cy / window.innerHeight;
    if (_sampleY < 0.15) return 0.5;
    if (_sampleY > 0.85) return 0.3;
    return 0.25;
  }

  function applyTextContrast() {
    const areas = [
      { el: document.getElementById('chamber-left'), selector: '#chamber-left' },
      { el: document.getElementById('chamber-right'), selector: '#chamber-right' },
      { el: document.getElementById('chamber-top'), selector: '#chamber-top' },
      { el: document.getElementById('song-info'), selector: null },
    ];

    areas.forEach(({ el }) => {
      if (!el) return;
      const brightness = detectBackgroundBrightness(el);
      if (brightness < 0.45) {
        el.classList.add('text-adapt-light');
        el.classList.remove('text-adapt-dark');
      } else {
        el.classList.add('text-adapt-dark');
        el.classList.remove('text-adapt-light');
      }
    });
  }

  function startContrastPolling() {
    applyTextContrast();
    contrastTimer = setInterval(applyTextContrast, 5000);
    window.addEventListener('resize', () => {
      clearTimeout(contrastTimer);
      contrastTimer = setTimeout(applyTextContrast, 500);
    });
  }

  window.VisualContrast = {
    applyTextContrast: applyTextContrast,
    startContrastPolling: startContrastPolling,
  };

  if (typeof __FM !== 'undefined') __FM.register('visualContrast', [], function () { return window.VisualContrast; }, { priority: 3 });
  console.log('FluidMusic Visual Contrast loaded');
})();
