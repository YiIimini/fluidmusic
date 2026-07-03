// ============================================================
// FluidMusic — Ripple System Module
// Click + hover + audio-reactive water ripple effects
// Extracted from app.js v1.1.0
// ============================================================
(function () {
  'use strict';

  // ── Ripple system: click + hover + audio-reactive with 3D depth ──
  var _rippleEnabled = false;
  var _lastRippleTime = 0;
  var _hoverRippleInterval = null;
  var _audioRippleInterval = null;
  var _mouseX = 0, _mouseY = 0;

  function spawnRipple(x, y, isAudio) {
    var ring = document.createElement('div');
    ring.className = isAudio ? 'audio-ripple' : 'ripple-ring';
    ring.style.left = x + 'px';
    ring.style.top = y + 'px';
    var size = getComputedStyle(document.documentElement).getPropertyValue('--ripple-size').trim() || '120px';
    var speed = getComputedStyle(document.documentElement).getPropertyValue('--ripple-speed').trim() || '0.8s';
    ring.style.setProperty('--ripple-size', isAudio ? '200px' : size);
    ring.style.setProperty('--ripple-duration', speed);
    document.body.appendChild(ring);
    setTimeout(function() { ring.remove(); }, parseFloat(speed) * 2000 + 200);
  }

  function spawnMultiRipple(x, y) {
    // Spawn 3 overlapping rings with different speeds for interference pattern
    for (var i = 0; i < 3; i++) {
      setTimeout(function() { spawnRipple(x, y, false); }, i * 60);
    }
  }

  window._clickRippleHandler = function(e) {
    if (!_rippleEnabled) return;
    spawnMultiRipple(e.clientX, e.clientY);
  };

  // Track mouse for hover ripples
  document.addEventListener('mousemove', function(e) {
    _mouseX = e.clientX; _mouseY = e.clientY;
    // Mouse click-through: check if over passthrough area
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (el) {
      var isPassthrough = (el.id === 'layer-passthrough' || el.id === 'layer-bg' ||
        el.id === 'bg-canvas' || el.id === 'wallpaper-layer');
      if (isPassthrough && window.fluidmusic && window.fluidmusic.setMouseIgnore) {
        window.fluidmusic.setMouseIgnore();
      } else if (!isPassthrough && window.fluidmusic && window.fluidmusic.setMouseCapture) {
        window.fluidmusic.setMouseCapture();
      }
    }
  }, { passive: true });

  function isAudioPlaying() {
    return typeof FluidAudio !== 'undefined' && FluidAudio.audio && !FluidAudio.audio.paused;
  }

  function startHoverRipple() {
    if (_hoverRippleInterval) return;
    _hoverRippleInterval = setInterval(function() {
      if (!_rippleEnabled || !isAudioPlaying()) return;
      var now = Date.now();
      if (now - _lastRippleTime > 400) {
        _lastRippleTime = now;
        spawnRipple(_mouseX, _mouseY, false);
      }
    }, 500);
  }

  // ── Audio-reactive ripple: random positions across window, spectrum-driven ──
  var _audioRippleRAF = null;
  var _rippleCooldown = 0;

  function randomRippleColor() {
    var hue = Math.random() * 360; // 0-360 full color wheel
    var sat = 50 + Math.random() * 50; // 50-100%
    var light = 45 + Math.random() * 35; // 45-80%
    var alpha = 0.2 + Math.random() * 0.35; // 0.2-0.55
    return 'hsla(' + hue + ',' + sat + '%,' + light + '%,' + alpha + ')';
  }

  function spawnRipple(x, y, isAudio) {
    var ring = document.createElement('div');
    ring.className = isAudio ? 'audio-ripple' : 'ripple-ring';
    ring.style.left = x + 'px';
    ring.style.top = y + 'px';
    var size = getComputedStyle(document.documentElement).getPropertyValue('--ripple-size').trim() || '120px';
    var speed = getComputedStyle(document.documentElement).getPropertyValue('--ripple-speed').trim() || '0.8s';
    ring.style.setProperty('--ripple-size', isAudio ? '200px' : size);
    ring.style.setProperty('--ripple-duration', speed);
    // Random color for every ripple
    var color = randomRippleColor();
    ring.style.borderColor = color;
    ring.style.boxShadow = '0 0 12px ' + color + ', inset 0 0 8px ' + color;
    document.body.appendChild(ring);
    setTimeout(function() { ring.remove(); }, parseFloat(speed) * 2000 + 200);
  }

  function spawnAudioRipple(x, y, band) {
    var ring = document.createElement('div');
    ring.className = 'audio-ripple';
    ring.style.left = x + 'px';
    ring.style.top = y + 'px';
    var sizeMap = { bass: 180, mid: 120, treble: 60 };
    var speedMap = { bass: 2.0, mid: 1.2, treble: 0.6 };
    var size = sizeMap[band] || 120;
    var speed = speedMap[band] || 1.0;
    ring.style.setProperty('--ripple-size', size + 'px');
    ring.style.setProperty('--ripple-duration', speed + 's');
    // Random color
    var color = randomRippleColor();
    ring.style.borderColor = color;
    ring.style.boxShadow = '0 0 ' + (size/6) + 'px ' + color;
    document.body.appendChild(ring);
    setTimeout(function() { ring.remove(); }, parseFloat(speed) * 2000 + 200);
  }

  function tickAudioRipples() {
    _audioRippleRAF = requestAnimationFrame(tickAudioRipples);
    // Audio ripples always on when music plays (independent of click ripple toggle)
    if (!isAudioPlaying()) return;
    if (typeof FluidAudio === 'undefined' || !FluidAudio.bands) return;

    var bands = FluidAudio.bands;
    _rippleCooldown -= 16; // ~60fps tick

    // Bass triggers big slow ripples — threshold 0.3
    if (bands.bass > 0.3 && _rippleCooldown <= 0) {
      var count = Math.floor(bands.bass * 4);
      for (var i = 0; i < count; i++) {
        spawnAudioRipple(
          Math.random() * window.innerWidth,
          Math.random() * window.innerHeight,
          'bass'
        );
      }
      _rippleCooldown = 200; // cooldown between bass bursts
    }

    // Mid triggers medium ripples — continuous at lower threshold
    if (bands.mid > 0.15) {
      var mcount = Math.floor(bands.mid * 2);
      for (var j = 0; j < mcount; j++) {
        if (Math.random() < 0.3) {
          spawnAudioRipple(
            Math.random() * window.innerWidth,
            Math.random() * window.innerHeight,
            'mid'
          );
        }
      }
    }

    // Treble triggers small fast ripples — sparkly, frequent
    if (bands.treble > 0.1) {
      if (Math.random() < bands.treble * 0.5) {
        spawnAudioRipple(
          Math.random() * window.innerWidth,
          Math.random() * window.innerHeight,
          'treble'
        );
      }
    }

    // Energy burst: on strong beats, spawn a cluster
    if (bands.energy > 0.6 && Math.random() < 0.4) {
      var cx = window.innerWidth * (0.2 + Math.random() * 0.6);
      var cy = window.innerHeight * (0.2 + Math.random() * 0.6);
      for (var k = 0; k < 3; k++) {
        spawnAudioRipple(cx + (Math.random()-0.5)*80, cy + (Math.random()-0.5)*80, 'bass');
      }
    }
  }

  function startAudioRipple() {
    if (_audioRippleRAF) return;
    _audioRippleRAF = requestAnimationFrame(tickAudioRipples);
  }

  function stopAudioRipple() {
    if (_audioRippleRAF) { cancelAnimationFrame(_audioRippleRAF); _audioRippleRAF = null; }
  }

  // Audio ripples always start — independent of click ripple toggle
  startAudioRipple();

  window._rippleSetEnabled = function(on) {
    _rippleEnabled = on;
    if (on) {
      document.addEventListener('click', window._clickRippleHandler);
      startHoverRipple();
    } else {
      document.removeEventListener('click', window._clickRippleHandler);
      if (_hoverRippleInterval) { clearInterval(_hoverRippleInterval); _hoverRippleInterval = null; }
    }
  };

  console.log('FluidMusic App Controller loaded');

  // ── Audio ripples always active when music plays ──
  startAudioRipple();

  if (typeof __FM !== 'undefined') __FM.register('rippleSystem', ['audioEngine'], function () {
    return { setEnabled: window._rippleSetEnabled };
  }, { priority: 6 });
  console.log('FluidMusic Ripple System loaded');
})();
