// ============================================================
// FluidMusic — DIY Settings Manager
// TAB-based overlay with all configuration categories
// Settings persistence to localStorage / Electron userData
// ============================================================
(function () {
  const DIYSettings = {
    open: false,
    activeTab: 'visual',
    settings: {
      // Particle Cover
      particleResolution: 160,
      particleScatterStrength: 0.8,
      particleSensitivity: 0.8,
      particleRotationSpeed: 0.5,
      particleColor: '#ffffff',

      // Foam (center)
      foamCount: 80,
      foamSize: 1.5,
      foamIridescence: 0.6,
      foamFloatAmplitude: 0.7,
      foamColorScheme: 0,

      // Lyrics
      lyricsLines: 0,
      lyricsFontSize: 13,
      lyricsColor: '#ffffff',
      lyricsHighlightColor: '#5588ee',
      lyricsFadeStrength: 0.5,

      // Playlist
      playlistStyle: 'default',
      playlistFontSize: 13,
      playlistTransparency: 0.15,

      // Foam Equalizer (merged with Foam preset above)
      foamPreset: 'thermal',
      foamDensity: 1.0,
      foamColorIntensity: 1.0,

      // Controller
      volume: 0.7,
      controllerParticleDensity: 0.6,
      controllerSandStrength: 0.5,
      controllerStyle: 'default',

      // Background
      bgIntensity: 0.8,
      bgSpeed: 1.0,
      bgColorScheme: 'dark',

      // Chambers
      chamberTransparency: 0.15,
      chamberTriggerSensitivity: 0.5,
      chamberLeftPinned: false,
      chamberRightPinned: false,
      chamberTopPinned: true,
      chamberBottomPinned: true,
      queueDockMag: true,

      // Account
      accountMultiLogin: true,

      // Visual effect toggles (matched to VISUAL_DEFAULTS in app.js)
      enableFluidBg: true,
      enableParticleCover: false,
      enableFoamSystem: false,
      enableFoamEqualizer: true,
      enableSpectrum3D: true,

      // Wallpaper
      wallpaperOpacity: 0.3,
      wallpaperRippleSpeed: 1.0,

      // Language
      language: 'zh-CN',
    },

    tabConfigs: {
      visual: {
        title: '🎨 UI特效',
        fields: [
          { key: 'enableFluidBg', label: '流体背景', type: 'toggle' },
          { key: 'enableParticleCover', label: '粒子封面 (GPU密集)', type: 'toggle' },
          { key: 'enableFoamSystem', label: '泡沫特效', type: 'toggle' },
          { key: 'enableFoamEqualizer', label: '均衡器可视化', type: 'toggle' },
          { key: 'enableSpectrum3D', label: '3D频谱环', type: 'toggle' },
          { key: 'particleResolution', label: '粒子分辨率', type: 'range', min: 60, max: 200, step: 1 },
          { key: 'particleRotationSpeed', label: '粒子旋转速度', type: 'range', min: 0, max: 2, step: 0.1 },
          { key: 'foamPreset', label: '泡沫/均衡器预设', type: 'select', options: { thermal: '热力沙粒', pearl: '珍珠虹彩', deepsea: '深海气泡', stardust: '星尘漩涡', aurora: '极光流体' } },
          { key: 'bgIntensity', label: '背景强度', type: 'range', min: 0, max: 1, step: 0.05 },
          { key: 'bgSpeed', label: '背景速度', type: 'range', min: 0.1, max: 3, step: 0.1 },
          { key: 'lyricsFontSize', label: '歌词字体大小', type: 'range', min: 10, max: 24, step: 1 },
          { key: 'lyricsFadeStrength', label: '歌词淡化强度', type: 'range', min: 0, max: 1, step: 0.05 },
          { key: 'wallpaperOpacity', label: '壁纸透明度', type: 'range', min: 0, max: 1, step: 0.05 },
          { key: 'wallpaperRippleSpeed', label: '水波纹速度', type: 'range', min: 0.2, max: 2, step: 0.1 },
          { key: 'particleScatterStrength', label: '粒子散落强度', type: 'range', min: 0, max: 1, step: 0.05 },
          { key: 'particleSensitivity', label: '粒子律动灵敏度', type: 'range', min: 0, max: 1, step: 0.05 },
          { key: 'foamCount', label: '泡沫数量', type: 'range', min: 20, max: 150, step: 5 },
          { key: 'foamSize', label: '泡沫大小', type: 'range', min: 0.5, max: 3, step: 0.1 },
          { key: 'foamIridescence', label: '虹彩强度', type: 'range', min: 0, max: 1, step: 0.05 },
          { key: 'foamFloatAmplitude', label: '浮沉幅度', type: 'range', min: 0, max: 1, step: 0.05 },
          { key: 'foamDensity', label: '均衡器密度', type: 'range', min: 0.3, max: 2, step: 0.1 },
          { key: 'foamColorIntensity', label: '均衡器色彩强度', type: 'range', min: 0.5, max: 1.5, step: 0.1 },
        ],
      },
      system: {
        title: '⚙️ 系统',
        fields: [
          { key: 'volume', label: '默认音量', type: 'range', min: 0, max: 1, step: 0.05 },
          { key: 'playMode', label: '默认播放模式', type: 'select', options: { sequential: '顺序播放', random: '随机播放', single: '单曲循环' } },
          { key: 'language', label: '界面语言', type: 'select', options: { 'zh-CN': '中文', 'en-US': 'English' } },
          { key: 'chamberLeftPinned', label: '左仓常驻', type: 'toggle' },
          { key: 'chamberRightPinned', label: '右仓常驻', type: 'toggle' },
          { key: 'chamberTopPinned', label: '上仓常驻', type: 'toggle' },
          { key: 'chamberBottomPinned', label: '下仓常驻', type: 'toggle' },
          { key: 'queueDockMag', label: '封面Dock放大', type: 'toggle' },
        ],
      },
    },

    // Active tab
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem('fluidmusic-settings');
      if (raw) {
        const saved = JSON.parse(raw);
        Object.assign(DIYSettings.settings, saved);
      }
    } catch (e) { /* ignore */ }
  }

  function saveSettings() {
    if (_saveTimeout) clearTimeout(_saveTimeout);
    _saveTimeout = setTimeout(() => {
      try {
        localStorage.setItem('fluidmusic-settings', JSON.stringify(DIYSettings.settings));
      } catch (e) { /* ignore */ }
    }, 300);
  }

  let _saveTimeout = null;

  function applySettings() {
    const s = DIYSettings.settings;
    // ── Visual effect toggles ──
    const visKeys = ['enableFluidBg','enableParticleCover','enableFoamSystem','enableFoamEqualizer','enableSpectrum3D'];
    const visMap = { enableFluidBg:'fluidBg', enableParticleCover:'particleCover', enableFoamSystem:'foamSystem', enableFoamEqualizer:'foamEqualizer', enableSpectrum3D:'spectrum3D' };
    let visChanged = false;
    visKeys.forEach(k => {
      if (s[k] != null && window._fluidVisualEnabled) {
        const shortKey = visMap[k];
        if (window._fluidVisualEnabled[shortKey] !== s[k]) {
          window._fluidVisualEnabled[shortKey] = s[k];
          visChanged = true;
          console.log('[VisualToggle]', shortKey, '→', s[k]);
        }
      }
    });
    if (visChanged && typeof window._fluidVisualSave === 'function') {
      window._fluidVisualSave();
    }
    // ── End visual toggles ──
    if (typeof FoamEqualizer !== 'undefined') {
      if (s.foamPreset) FoamEqualizer.setPreset(s.foamPreset);
      if (s.foamDensity != null) FoamEqualizer.setDensity(s.foamDensity);
      if (s.foamSpeed != null) FoamEqualizer.setSpeed(s.foamSpeed);
      if (s.foamColorIntensity != null) FoamEqualizer.setColorIntensity(s.foamColorIntensity);
    }
    if (typeof FluidBackground !== 'undefined') {
      if (s.bgIntensity != null) FluidBackground.setIntensity(s.bgIntensity);
      if (s.bgSpeed != null) FluidBackground.setSpeed(s.bgSpeed);
    }
    if (typeof FluidAudio !== 'undefined') {
      if (s.volume != null) FluidAudio.setVolume(s.volume);
      if (s.playMode) {
        FluidAudio.playMode = s.playMode;
        // Also sync the playmode icon in controller
        const modeMap = { sequential: 0, random: 1, single: 2 };
        if (typeof setPlaymodeIcon === 'function') setPlaymodeIcon(modeMap[s.playMode] || 0);
      }
    }
    if (typeof I18N !== 'undefined' && s.language) {
      I18N.setLocale(s.language);
    }
    // Apply lyrics settings
    if (s.lyricsFontSize != null) {
      document.documentElement.style.setProperty('--lyric-font-size', s.lyricsFontSize + 'px');
      const lines = document.querySelectorAll('.lyric-line');
      lines.forEach(l => { l.style.fontSize = s.lyricsFontSize + 'px'; });
    }
    if (s.lyricsFadeStrength != null) {
      document.documentElement.style.setProperty('--lyric-fade', s.lyricsFadeStrength);
    }
    // Apply chamber pin state
    if (typeof BubbleChamber !== 'undefined') {
      if (s.chamberLeftPinned != null) BubbleChamber.pinned.left = s.chamberLeftPinned;
      if (s.chamberRightPinned != null) BubbleChamber.pinned.right = s.chamberRightPinned;
      if (s.chamberTopPinned != null) BubbleChamber.pinned.top = s.chamberTopPinned;
      if (s.chamberBottomPinned != null) BubbleChamber.pinned.bottom = s.chamberBottomPinned;
      // Apply pinned chamber visibility
      ['left','right','top','bottom'].forEach((side) => {
        const el = document.getElementById('chamber-' + side);
        if (el && BubbleChamber.pinned[side]) {
          el.classList.add('visible', 'pinned');
        }
      });
    }
    // Apply chamber transparency
    if (s.chamberTransparency != null) {
      document.documentElement.style.setProperty('--chamber-alpha', s.chamberTransparency);
    }
    if (s.queueDockMag != null && typeof window._dockMagEnabled === 'function') {
      window._dockMagEnabled(s.queueDockMag);
    }
    if (typeof ParticleCover !== 'undefined') {
      if (s.particleResolution != null) ParticleCover.setResolution(s.particleResolution);
      if (s.particleRotationSpeed != null) ParticleCover.setRotationSpeed(s.particleRotationSpeed);
      if (s.particleScatterStrength != null) ParticleCover.setScatterStrength(s.particleScatterStrength);
      if (s.particleSensitivity != null) ParticleCover.setSensitivity(s.particleSensitivity);
    }
    // Foam system params
    if (typeof FoamSystem !== 'undefined') {
      if (s.foamCount != null) FoamSystem.setCount(s.foamCount);
      if (s.foamSize != null) FoamSystem.setSize(s.foamSize);
      if (s.foamIridescence != null) FoamSystem.setIridescence(s.foamIridescence);
      if (s.foamFloatAmplitude != null) FoamSystem.setFloatAmplitude(s.foamFloatAmplitude);
    }
    // Apply wallpaper settings
    const wpLayer = document.getElementById('wallpaper-layer');
    if (wpLayer && wpLayer.classList.contains('loaded')) {
      if (s.wallpaperOpacity != null) wpLayer.style.opacity = s.wallpaperOpacity;
    }
    if (s.wallpaperOpacity != null) {
      document.documentElement.style.setProperty('--wallpaper-opacity', s.wallpaperOpacity);
    }
    if (s.wallpaperRippleSpeed != null) {
      // Update SVG filter animation duration
      const animEl = document.querySelector('#glass-refract animate');
      if (animEl) animEl.setAttribute('dur', (8 / s.wallpaperRippleSpeed).toFixed(1) + 's');
    }
  }

  // Default settings snapshot for reset
  const DEFAULT_SETTINGS = {
    particleResolution: 160, particleScatterStrength: 0.8, particleSensitivity: 0.8,
    particleRotationSpeed: 0.5, particleColor: '#ffffff',
    foamCount: 80, foamSize: 1.5, foamIridescence: 0.6, foamFloatAmplitude: 0.7, foamColorScheme: 0,
    lyricsLines: 0, lyricsFontSize: 13, lyricsColor: '#ffffff', lyricsHighlightColor: '#5588ee', lyricsFadeStrength: 0.5,
    playlistStyle: 'default', playlistFontSize: 13, playlistTransparency: 0.15,
    foamPreset: 'pearl', foamDensity: 1.0, foamColorIntensity: 1.0,
    controllerParticleDensity: 0.6, controllerSandStrength: 0.5, controllerStyle: 'default',
    bgIntensity: 0.8, bgSpeed: 1.0, bgColorScheme: 'dark',
    volume: 0.7, chamberTransparency: 0.15, chamberTriggerSensitivity: 0.5, chamberLeftPinned: false, chamberRightPinned: false, chamberTopPinned: true, chamberBottomPinned: true, queueDockMag: true,
    accountMultiLogin: true, language: 'zh-CN', wallpaperOpacity: 0.5, wallpaperRippleSpeed: 1.0,
  };

  function renderTab(tabId) {
    const container = document.getElementById('diy-content');
    const config = DIYSettings.tabConfigs[tabId];
    if (!container || !config) return;

    DIYSettings.activeTab = tabId;

    let html = '';
    config.fields.forEach((field) => {
      const value = DIYSettings.settings[field.key] != null ? DIYSettings.settings[field.key] : DEFAULT_SETTINGS[field.key];
      html += '<div class="diy-setting-row">';
      html += '<span class="diy-label">' + field.label + '</span>';

      if (field.type === 'range') {
        html += '<div style="display:flex;align-items:center;gap:8px;">';
        html += '<input type="range" class="diy-slider" data-key="' + field.key + '" min="' + field.min + '" max="' + field.max + '" step="' + field.step + '" value="' + value + '">';
        html += '<span class="diy-label" style="min-width:36px;text-align:right;">' + value + '</span>';
        html += '</div>';
      } else if (field.type === 'select') {
        html += '<select class="diy-select" data-key="' + field.key + '">';
        for (const [optVal, optLabel] of Object.entries(field.options)) {
          html += '<option value="' + optVal + '"' + (value === optVal ? ' selected' : '') + '>' + optLabel + '</option>';
        }
        html += '</select>';
      } else if (field.type === 'toggle') {
        html += '<label class="diy-label" style="cursor:pointer;">';
        html += '<input type="checkbox" data-key="' + field.key + '" ' + (value ? 'checked' : '') + ' style="margin-right:4px;">';
        html += value ? '已开启' : '已关闭';
        html += '</label>';
      } else {
        html += '<input type="text" class="diy-input" data-key="' + field.key + '" value="' + value + '">';
      }
      html += '<button class="diy-reset-btn" data-key="' + field.key + '" title="重置此选项">↺</button>';
      html += '</div>';
    });

    container.innerHTML = html;

    // System tab: Wallpaper + Restore Defaults + Clear Cache
    if (tabId === 'system') {
      const wpRow = document.createElement('div');
      wpRow.className = 'diy-setting-row';
      wpRow.style.flexDirection = 'column';
      wpRow.style.alignItems = 'flex-start';
      wpRow.style.gap = '8px';
      wpRow.innerHTML = '<span class="diy-label">🖼 背景壁纸</span>'
        + '<div style="display:flex;gap:8px;align-items:center;">'
        + '<button class="user-panel-btn" id="btn-pick-wallpaper" style="font-size:11px;">选择图片</button>'
        + '<button class="diy-reset-btn" id="btn-clear-wallpaper" title="清除壁纸" style="width:22px;height:22px;">✕</button>'
        + '</div>'
        + '<div id="wallpaper-thumb-preview"></div>';
      container.appendChild(wpRow);

      // Show thumbnail if wallpaper exists
      const updateThumb = function() {
        const thumb = document.getElementById('wallpaper-thumb-preview');
        if (!thumb) return;
        const saved = localStorage.getItem('fluidmusic-wallpaper');
        if (saved) {
          thumb.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-top:6px;">'
            + '<img src="' + saved + '" style="width:80px;height:80px;border-radius:8px;border:1px solid var(--glass-border);object-fit:cover;flex-shrink:0;">'
            + '<span style="font-size:10px;color:var(--text-dim);">已设置壁纸</span>'
            + '</div>';
        } else {
          thumb.innerHTML = '<span style="font-size:11px;color:var(--text-dim);">未设置壁纸</span>';
        }
      };
      updateThumb();

      document.getElementById('btn-pick-wallpaper').addEventListener('click', async () => {
        if (typeof fluidmusic !== 'undefined' && fluidmusic.pickWallpaper) {
          const result = await fluidmusic.pickWallpaper();
          if (result && result.ok && result.dataUrl) {
            try {
              localStorage.setItem('fluidmusic-wallpaper', result.dataUrl);
              applyWallpaper(result.dataUrl);
              if (typeof showToast !== 'undefined') showToast('🖼 壁纸已更新');
              updateThumb();
            } catch(e) {
              // Data too large for localStorage, store compressed
              if (typeof showToast !== 'undefined') showToast('⚠ 图片过大，请使用较小的图片');
            }
          }
        } else {
          if (typeof showToast !== 'undefined') showToast('⚠ 壁纸功能需要Electron环境');
        }
      });

      document.getElementById('btn-clear-wallpaper').addEventListener('click', () => {
        localStorage.removeItem('fluidmusic-wallpaper');
        applyWallpaper(null);
        if (typeof showToast !== 'undefined') showToast('🗑 壁纸已清除');
        updateThumb();
      });

      const sysRow = document.createElement('div');
      sysRow.className = 'diy-setting-row';
      sysRow.style.borderBottom = 'none';
      sysRow.style.gap = '8px';
      sysRow.style.justifyContent = 'flex-end';

      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'user-panel-btn';
      restoreBtn.textContent = '↺ 恢复默认';
      restoreBtn.title = '将所有设置恢复为默认值';
      restoreBtn.addEventListener('click', () => {
        showCustomDialog('恢复默认设置', '确定将所有设置恢复为默认值？此操作不可撤销。', [
          { text: '取消', style: 'secondary' },
          { text: '恢复默认', style: 'danger', action: () => {
            Object.assign(DIYSettings.settings, JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
            saveSettings();
            applySettings();
            renderTab('system');
            showToast('✅ 已恢复默认设置');
          }}
        ]);
      });

      const cacheBtn = document.createElement('button');
      cacheBtn.className = 'user-panel-btn logout';
      cacheBtn.textContent = '🗑 清理缓存';
      cacheBtn.title = '清除登录状态和所有本地数据';
      cacheBtn.addEventListener('click', () => {
        if (confirm('确定清理所有缓存？将清除登录状态和本地设置。')) {
          if (typeof Favorites !== 'undefined') Favorites.clear();
          localStorage.clear();
          if (typeof fluidmusic !== 'undefined') {
            fluidmusic.logoutPlatform('netease').catch(() => {});
            fluidmusic.logoutPlatform('qq').catch(() => {});

          }
          alert('缓存已清理，请重启应用。');
        }
      });

      sysRow.appendChild(restoreBtn);
      // Cache button hidden per user request
      // sysRow.appendChild(cacheBtn);
      container.appendChild(sysRow);
    }

    // Attach listeners
    container.querySelectorAll('input, select').forEach((input) => {
      input.addEventListener('input', function () {
        const key = this.dataset.key;
        let val;
        if (this.type === 'checkbox') {
          val = this.checked;
          const label = this.closest('label');
          if (label) {
            const nodes = label.childNodes;
            const lastText = nodes[nodes.length - 1];
            if (lastText && lastText.nodeType === 3) lastText.textContent = val ? '已开启' : '已关闭';
          }
        } else if (this.type === 'range') {
          val = parseFloat(this.value);
          const display = this.nextElementSibling;
          if (display) display.textContent = val;
        } else if (this.tagName === 'SELECT') {
          val = this.value;
        } else {
          val = this.value;
        }
        DIYSettings.settings[key] = val;
        saveSettings();
        applySettings();
      });
      if (input.tagName === 'SELECT') {
        input.addEventListener('change', function () {
          DIYSettings.settings[this.dataset.key] = this.value;
          saveSettings();
          applySettings();
        });
      }
    });

    // Wire reset buttons
    container.querySelectorAll('.diy-reset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        const defVal = DEFAULT_SETTINGS[key];
        if (defVal === undefined) return;
        DIYSettings.settings[key] = defVal;
        saveSettings();
        applySettings();
        renderTab(tabId); // re-render to reflect changes
      });
    });

    // Update tab active state
    document.querySelectorAll('.diy-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === tabId);
    });
  }

  function toggle() {
    const overlay = document.getElementById('diy-overlay');
    if (!overlay) return;
    if (overlay.classList.contains('open')) {
      overlay.classList.remove('open');
      if (typeof fluidmusic !== 'undefined' && fluidmusic.setOverlayOpen) {
        fluidmusic.setOverlayOpen(false);
      }
    } else {
      overlay.classList.add('open');
      renderTab(DIYSettings.activeTab);
      if (typeof fluidmusic !== 'undefined' && fluidmusic.setOverlayOpen) {
        fluidmusic.setOverlayOpen(true);
      }
    }
  }

  function init() {
    console.log('[DIYSettings] init START');
    try {
    loadSettings();
    applySettings();

    // Close on overlay click
    const overlay = document.getElementById('diy-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) toggle();
      });
    }

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const o = document.getElementById('diy-overlay');
        if (o && o.classList.contains('open')) toggle();
      }
    });

    // Tab switching
    document.querySelectorAll('.diy-tab').forEach((tab) => {
      tab.addEventListener('click', function () {
        renderTab(this.dataset.tab);
      });
    });

    document.getElementById('diy-close').addEventListener('click', () => toggle());

    console.log('DIY Settings initialized');
    } catch(e) { console.error('[DIYSettings] init ERROR:', e); }
  }

  DIYSettings.init = init;
  DIYSettings.toggle = toggle;

  if (typeof __FM !== 'undefined') __FM.register('diySettings', [], function () { return DIYSettings; }, { priority: 4 });
  window.DIYSettings = DIYSettings;
  console.log('FluidMusic DIY Settings loaded');
})();
