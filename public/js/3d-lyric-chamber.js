// ============================================================
// FluidMusic — 3D Lyric Chamber
// Replaces the right chamber's HTML lyrics with 3D text planes
// Uses RendererManager sub-viewport for isolated rendering
// ============================================================
(function () {
  'use strict';

  if (typeof THREE === 'undefined') {
    console.warn('ThreeDLyricChamber: THREE not loaded');
    window.ThreeDLyricChamber = { init: function(){return false;} };
    return;
  }

  var CHAMBER_ID = 'chamber-right';
  var CANVAS_W = 2048;
  var CANVAS_H = 256;
  var FONT_WEIGHT = 700;

  var Chamber3D = {
    scene: null,
    camera: null,
    group: null,
    slots: [],
    initialized: false,
    _registered: false,
    _lastLyricIdx: -1,
    _lastLineCount: 0,
  };

  // ── Canvas text rendering (same approach as 3d-lyrics-scene.js) ──

  function lightenColor(hex, factor) {
    var c = new THREE.Color(hex);
    c.r = Math.min(1, c.r * factor);
    c.g = Math.min(1, c.g * factor);
    c.b = Math.min(1, c.b * factor);
    return '#' + c.getHexString();
  }

  function renderTextToCanvas(ctx, w, h, text, fontSize, colorHex, effect, fontFamily) {
    ctx.clearRect(0, 0, w, h);
    // DEBUG: fill yellow — if no yellow strips show, planes don't render at all
    ctx.fillStyle = '#ff0';
    ctx.fillRect(0, 0, w, h);
    if (!text || !text.trim()) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var ff = (fontFamily || 'PingFang SC,sans-serif').replace(/'/g, '').replace(/"/g, '');
    ctx.font = FONT_WEIGHT + ' ' + fontSize + 'px ' + ff;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    switch (effect) {
      case '发光':
        ctx.shadowColor = colorHex;
        ctx.shadowBlur = fontSize * 0.22;
        ctx.fillStyle = colorHex;
        ctx.fillText(text, w / 2, h / 2);
        ctx.fillText(text, w / 2, h / 2);
        ctx.shadowBlur = fontSize * 0.10;
        ctx.fillStyle = lightenColor(colorHex, 1.25);
        ctx.fillText(text, w / 2, h / 2);
        break;
      case '描边':
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = fontSize * 0.05;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(text, w / 2, h / 2);
        ctx.fillStyle = colorHex;
        ctx.fillText(text, w / 2, h / 2);
        break;
      case '渐变':
        var grad = ctx.createLinearGradient(0, h * 0.05, 0, h * 0.95);
        grad.addColorStop(0, lightenColor(colorHex, 1.4));
        grad.addColorStop(0.45, colorHex);
        grad.addColorStop(1, lightenColor(colorHex, 0.6));
        ctx.fillStyle = grad;
        ctx.fillText(text, w / 2, h / 2);
        break;
      default:
        ctx.fillStyle = colorHex;
        ctx.fillText(text, w / 2, h / 2);
    }
  }

  function disposeSlot(slot) {
    if (!slot) return;
    if (slot.group) {
      if (slot.group.parent) slot.group.parent.remove(slot.group);
      if (slot.mesh) {
        if (slot.mesh.material) {
          if (slot.mesh.material.map) slot.mesh.material.map.dispose();
          slot.mesh.material.dispose();
        }
        if (slot.mesh.geometry) slot.mesh.geometry.dispose();
      }
    }
    if (slot.texture) slot.texture.dispose();
    slot.group = null; slot.mesh = null;
    slot.texture = null; slot.canvas = null; slot.ctx = null; slot.mat = null;
  }

  function ensureSlots(count, planeW) {
    while (Chamber3D.slots.length > count) {
      disposeSlot(Chamber3D.slots.pop());
    }
    while (Chamber3D.slots.length < count) {
      var canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      var ctx = canvas.getContext('2d');
      var texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;

      var aspect = CANVAS_H / CANVAS_W;
      var planeH = planeW * aspect;
      var geo = new THREE.PlaneGeometry(planeW, planeH, 1, 1);
      var mat = new THREE.MeshBasicMaterial({
        map: texture, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 10;

      var group = new THREE.Group();
      group.add(mesh);
      Chamber3D.group.add(group);

      Chamber3D.slots.push({
        canvas: canvas, ctx: ctx, texture: texture,
        group: group, mesh: mesh, mat: mat,
        baseOpacity: 1.0, isCurrent: false,
      });
    }
  }

  // ── Read settings from localStorage / DIY config ──
  function getLyricSettings() {
    var s = {
      currentColor: '#ffd700',
      otherColor: '#cccccc',
      fontSize: 90,
      lineSpacing: 1.0,
      highlightEffect: '无',
      fontFamily: 'PingFang SC,Noto Sans SC,Microsoft YaHei,Arial,sans-serif',
      visibleLines: 12
    };
    try {
      var raw = localStorage.getItem('fluidmusic-settings');
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved.chamberLyricCurrentColor) s.currentColor = saved.chamberLyricCurrentColor;
        if (saved.chamberLyricOtherColor) s.otherColor = saved.chamberLyricOtherColor;
        if (saved.chamberLyricFontSize) s.fontSize = saved.chamberLyricFontSize;
        if (saved.chamberLyricLineSpacing) s.lineSpacing = saved.chamberLyricLineSpacing;
        if (saved.chamberLyricEffect) s.highlightEffect = saved.chamberLyricEffect;
        if (saved.chamberLyricFontFamily) s.fontFamily = saved.chamberLyricFontFamily;
        if (saved.chamberLyricVisibleLines != null) s.visibleLines = saved.chamberLyricVisibleLines;
      }
    } catch(_) {}
    return s;
  }

  function rebuildLyrics() {
    var src = window.LyricChamber;
    if (!src || !src.lyricTimes || src.lyricTimes.length === 0) {
      // No lyrics — hide all slots
      for (var i = 0; i < Chamber3D.slots.length; i++) {
        Chamber3D.slots[i].group.visible = false;
      }
      Chamber3D._lastLineCount = 0;
      return;
    }

    var settings = getLyricSettings();
    var maxLines = settings.visibleLines || 0;
    var allTimes = src.lyricTimes;
    var lineCount = (maxLines > 0) ? Math.min(maxLines, allTimes.length) : allTimes.length;
    if (lineCount < 3) lineCount = Math.min(3, allTimes.length);

    var currentIdx = src._lastLyricIdx >= 0 ? src._lastLyricIdx : 0;
    if (currentIdx >= allTimes.length) currentIdx = allTimes.length - 1;

    // Center the current line: show lines around it
    var halfN = Math.floor(lineCount / 2);
    var startIdx = currentIdx - halfN;
    if (startIdx < 0) startIdx = 0;
    if (startIdx + lineCount > allTimes.length) {
      startIdx = Math.max(0, allTimes.length - lineCount);
    }

    // Get chamber width for plane sizing
    // Fit N lines in ortho view [-0.9, 0.9]
    var lineSpacing = 1.8 / Math.max(lineCount, 1);
    var planeH = lineSpacing * 0.88;
    var planeW = planeH / (CANVAS_H / CANVAS_W); // maintain aspect ratio
    ensureSlots(lineCount, planeW);

    // Font size: large enough to be clearly visible
    var fontSize = 130;

    // Center entire block vertically around y=0
    Chamber3D.group.position.y = ((lineCount - 1) * 0.5 - (currentIdx - startIdx)) * lineSpacing;
    var surroundRatio = 0.8;

    for (var i = 0; i < lineCount; i++) {
      var lineIdx = startIdx + i;
      var slot = Chamber3D.slots[i];
      var distance = Math.abs(lineIdx - currentIdx);
      var isCurrent = (distance === 0);

      if (lineIdx < allTimes.length) {
        var color = isCurrent ? settings.currentColor : settings.otherColor;
        var effect = isCurrent ? settings.highlightEffect : 'none';
        var fs = isCurrent ? fontSize : Math.max(30, Math.round(fontSize * Math.pow(surroundRatio, distance)));
        var baseOpacity = isCurrent ? 1.0 : Math.max(0.10, 1.0 - distance * 0.22);

        renderTextToCanvas(slot.ctx, CANVAS_W, CANVAS_H, allTimes[lineIdx].text, fs, color, effect, settings.fontFamily);
        slot.texture.needsUpdate = true;
        slot.group.visible = true;
        slot.baseOpacity = baseOpacity;
        slot.isCurrent = isCurrent;

        var relOffset = lineIdx - currentIdx;
        slot.group.position.y = -relOffset * lineSpacing;
        slot.group.position.z = -Math.abs(relOffset) * lineSpacing * 0.3;
        slot.group.scale.setScalar(1.0);
      } else {
        slot.group.visible = false;
      }
    }

    Chamber3D._lastLineCount = lineCount;
    Chamber3D._lastLyricIdx = currentIdx;
  }

  // ── Viewport tracking ──
  function updateViewport() {
    if (!Chamber3D._registered) return;
    var el = document.getElementById(CHAMBER_ID);
    if (!el) return;
    var rect = el.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (typeof RendererManager !== 'undefined') {
      RendererManager.setLayerViewport('lyricChamber3D',
        Math.round(rect.left * dpr),
        Math.round((window.innerHeight - rect.bottom) * dpr),
        Math.round(rect.width * dpr),
        Math.round(rect.height * dpr)
      );
    }
  }

  // ── Init ──
  function init() {
    if (Chamber3D.initialized) return true;
    console.log('[3D-LC] init() CALLED. RendererManager=' + (typeof RendererManager !== 'undefined' && RendererManager.initialized));
    if (typeof RendererManager === 'undefined' || !RendererManager.initialized) {
      console.warn('[3D-LyricChamber] RendererManager not available');
      return false;
    }

    Chamber3D.scene = new THREE.Scene();
    Chamber3D.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    Chamber3D.camera.position.z = 5;

    Chamber3D.group = new THREE.Group();
    Chamber3D.group.renderOrder = 10;
    Chamber3D.scene.add(Chamber3D.group);

    RendererManager.registerLayer('lyricChamber3D', Chamber3D.scene, Chamber3D.camera, {
      tick: null,
      visible: true,
      onResize: updateViewport,
    });
    Chamber3D._registered = true;

    // Initial build
    rebuildLyrics();
    updateViewport();

    // Hook into the existing lyric chamber
    window.addEventListener('resize', updateViewport);

    Chamber3D.initialized = true;
    console.log('[3D-LyricChamber] Initialized');
    return true;
  }

  // ── Tick: check for lyric changes and rebuild if needed ──
  function tick() {
    if (!Chamber3D.initialized) return;
    if (!Chamber3D._tickCount) { Chamber3D._tickCount = 0; console.log('[3D-LC] tick() FIRST CALL'); }
    Chamber3D._tickCount++;
    if (Chamber3D._tickCount % 120 === 1) {
      var el = document.getElementById(CHAMBER_ID);
      console.log('[3D-LC] tick#' + Chamber3D._tickCount + ' | initialized=' + Chamber3D.initialized +
        ' | chamberVisible=' + (el ? (el.classList.contains('visible') && !el.classList.contains('hiding')) : 'no-el') +
        ' | lyricTimes=' + (window.LyricChamber ? window.LyricChamber.lyricTimes.length : 'no-src') +
        ' | slots=' + Chamber3D.slots.length +
        ' | layerRegistered=' + Chamber3D._registered);
    }

    var src = window.LyricChamber;
    var lineCount = src && src.lyricTimes ? src.lyricTimes.length : 0;
    var currentIdx = src && src._lastLyricIdx >= 0 ? src._lastLyricIdx : 0;

    // Rebuild whenever data or index changes
    if (lineCount !== Chamber3D._lastLineCount || currentIdx !== Chamber3D._lastLyricIdx) {
      Chamber3D._lastLineCount = lineCount;
      Chamber3D._lastLyricIdx = currentIdx;
      rebuildLyrics();
    }

    // Sync with chamber DOM visibility — always update layer
    var chamberVisible = false;
    var chamberEl = document.getElementById(CHAMBER_ID);
    if (chamberEl) {
      chamberVisible = chamberEl.classList.contains('visible') && !chamberEl.classList.contains('hiding');
    }
    if (typeof RendererManager !== 'undefined') {
      RendererManager.setLayerVisible('lyricChamber3D', chamberVisible);
    }
    if (!chamberVisible) return;

    // Rebuild every frame when visible (ensures fresh state)
    if (Chamber3D._debugCount === undefined) Chamber3D._debugCount = 0;
    Chamber3D._debugCount++;
    if (Chamber3D._debugCount % 10 === 0) {
      rebuildLyrics();
    }

    // Animate slot opacity

    // Update viewport each frame (chamber may move/resize)
    updateViewport();

    // Animate: smooth opacity toward target
    for (var i = 0; i < Chamber3D.slots.length; i++) {
      var slot = Chamber3D.slots[i];
      if (!slot.group || !slot.group.visible) continue;
      if (slot.mat) {
        var curOp = slot.mat.opacity;
        var targetOp = slot.baseOpacity;
        if (curOp !== undefined && !isNaN(curOp)) {
          slot.mat.opacity = curOp + (targetOp - curOp) * 0.15;
        } else {
          slot.mat.opacity = targetOp;
        }
      }
    }
  }

  // ── Hide the HTML lyrics container ──
  function setHtmlLyricsVisible(visible) {
    var container = document.getElementById('lyrics-container');
    var chamber = document.getElementById(CHAMBER_ID);
    if (container) {
      container.style.display = visible ? '' : 'none';
    }
    if (chamber) {
      chamber.style.background = visible ? '' : 'transparent';
      chamber.style.backdropFilter = visible ? '' : 'none';
      chamber.style.webkitBackdropFilter = visible ? '' : 'none';
    }
  }

  function apply3DLyricLogic() {
    var src = window.LyricChamber;
    if (!src || !src.lyricTimes || src.lyricTimes.length === 0) return;
    var s = getLyricSettings();
    var currentIdx = src._lastLyricIdx >= 0 ? src._lastLyricIdx : 0;
    var lines = document.querySelectorAll('#chamber-right .lyric-line');
    if (!lines.length) return;

    var lineCount = s.visibleLines || 12;
    var halfN = Math.floor(lineCount / 2);
    var surroundRatio = 0.75; // progressive shrink factor
    var activeFontSize = 20;   // current line font size (px)
    var baseFontSize = 14;     // furthest line font size

    // Find start index so current line is centered
    var startIdx = currentIdx - halfN;
    if (startIdx < 0) startIdx = 0;
    if (startIdx + lineCount > src.lyricTimes.length) {
      startIdx = Math.max(0, src.lyricTimes.length - lineCount);
    }
    var endIdx = startIdx + lineCount;

    for (var i = 0; i < lines.length; i++) {
      var li = lines[i];
      var dist = Math.abs(i - currentIdx);
      var isCurrent = (dist === 0);
      var inRange = (i >= startIdx && i < endIdx);

      if (!inRange) {
        // Out of visible range: keep in DOM for scroll height, just fade out
        li.style.fontSize = '10px';
        li.style.opacity = '0.05';
        li.classList.remove('active');
        li.style.fontWeight = '400';
        continue;
      }

      // Progressive font size
      var fs = isCurrent ? activeFontSize : Math.max(10, Math.round(activeFontSize * Math.pow(surroundRatio, dist)));
      li.style.fontSize = fs + 'px';

      // Progressive opacity
      var op = isCurrent ? 1.0 : Math.max(0.2, 1.0 - dist * 0.18);
      li.style.opacity = op;

      // Current line highlight
      if (isCurrent) {
        li.classList.add('active');
        li.style.fontWeight = '700';
      } else {
        li.classList.remove('active');
        li.style.fontWeight = '400';
      }
    }

    // Auto-scroll to keep current line centered in view
    var container = document.getElementById('lyrics-container');
    if (container && lines[currentIdx]) {
      var lineH = lines[currentIdx].offsetHeight;
      var containerH = container.clientHeight;
      var targetScroll = lines[currentIdx].offsetTop - containerH / 2 + lineH / 2;
      container.scrollTop += (targetScroll - container.scrollTop) * 0.3;
    }
  }

  function applyChamberCSS() {
    var s = getLyricSettings();
    var chamber = document.getElementById(CHAMBER_ID);
    if (!chamber) return;
    chamber.style.setProperty('--chamber-lyric-current-color', s.currentColor);
    chamber.style.setProperty('--chamber-lyric-other-color', s.otherColor);
    chamber.style.setProperty('--chamber-lyric-font-size', s.fontSize + 'px');
    chamber.style.setProperty('--chamber-lyric-font-family', s.fontFamily.replace(/'/g, '').replace(/"/g, ''));
    chamber.style.setProperty('--chamber-lyric-spacing', s.lineSpacing);
    chamber.style.setProperty('--chamber-lyric-effect', s.highlightEffect);
    chamber.style.setProperty('--chamber-lyric-visible-lines', s.visibleLines);
  }

  Chamber3D.init = function() {
    // Keep HTML lyrics, just apply 3D styling via CSS
    setHtmlLyricsVisible(true);
    // Apply chamber lyric CSS custom properties
    applyChamberCSS();
    return true;
  };
  Chamber3D.tick = function() {
    if (!Chamber3D._tickCount) Chamber3D._tickCount = 0;
    Chamber3D._tickCount++;
    if (Chamber3D._tickCount % 10 === 0) {
      applyChamberCSS();
      apply3DLyricLogic();
    }
  };
  Chamber3D.rebuild = function() {};

  window.ThreeDLyricChamber = Chamber3D;
  console.log('FluidMusic 3D Lyric Chamber loaded');
})();
