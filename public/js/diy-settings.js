// ============================================================
// FluidMusic — DIY Settings Manager
// TAB-based overlay with all configuration categories
// Settings persistence to localStorage / Electron userData
// ============================================================
(function () {
  const DIYSettings = {
    open: false,
    activeTab: 'particle',
    settings: {
      // Particle Cover
      particleResolution: 160,
      particleScatterStrength: 0.8,
      particleSensitivity: 0.8,
      particleRotationSpeed: 0.5,
      particleColor: '#ffffff',

      // Lyrics
      lyricsLines: 0,
      lyricsFontSize: 13,
      lyricsColor: '#f0c060',
      lyricsHighlightColor: '#f0c060',
      lyricsFadeStrength: 0.5,
      lyricsEffect: 'fade',  // fade/glow/typewriter/none
      lyricsVisibleLines: 0,
      inlineLyricColor: '#f0c060',
      inlineLyricFontSize: 15,
      progressColor: '#f0c060',
      progressHeight: 4,
      progressRipple: false,
      progressRippleIntensity: 0.5,
      textRipple: false,
      textRippleIntensity: 0.3,
      timeColor: '#f0c060',
      timeFontSize: 10,

      // Playlist
      playlistStyle: 'default',
      playlistFontSize: 13,
      playlistTransparency: 0.15,
      playlistTextColor: '#e0d8c0',

      // Controller
      volume: 0.7,
      controllerParticleDensity: 0.6,
      controllerSandStrength: 0.5,
      controllerStyle: 'default',

      // Background
      bgIntensity: 0.8,
      bgSpeed: 1.0,
      bgColorScheme: 'dark',
      bgNoiseScale: 0.5,

      // Chambers
      chamberTransparency: 0.15,
      chamberTriggerSensitivity: 0.5,
      chamberTopPinned: true,
      chamberBottomPinned: true,
      chamberLeftPinned: false,
      chamberRightPinned: false,
      queueDockMag: true,

      // Account
      accountMultiLogin: true,

      // Visual effect toggles (matched to VISUAL_DEFAULTS in app.js)
      enableFluidBg: true,
      enableParticleCover: true,
      // Wallpaper
      wallpaperOpacity: 0.3,
      wallpaperRippleSpeed: 1.0,
      wallpaperBlur: 20,

      // Language & UI
      language: 'zh-CN',
      uiFontSize: 13,
      uiAccentColor: '#f0c060',
      uiFontWeight: 500,
      globalFontFamily: 'inherit',
      lyricsFontFamily: 'inherit',
      chamberOpacity: 0.12,
      controllerOrder: 'like,volume,prev,play,next,playmode',
    },

    tabConfigs: {
      visual: {
        title: '🎨 UI特效',
        fields: [
          { type: 'section', label: '━━ 文字水波纹 ━━' },
          { key: 'textRipple', label: '文字水波纹', type: 'toggle', help: '歌名、作者、单行歌词的光泽流动效果' },
          { key: 'textRippleIntensity', label: '文字波纹强度', type: 'range', min: 0.1, max: 1, step: 0.1, help: '文字水波纹的明显程度' },
          { type: 'section', label: '━━ 进度条 ━━' },
          { key: 'progressColor', label: '进度条颜色', type: 'color', help: '进度条填充和拖拽圆点的颜色' },
          { key: 'progressHeight', label: '进度条高度', type: 'range', min: 2, max: 8, step: 1, help: '进度条粗细。默认4px' },
          { key: 'progressRipple', label: '进度条水波纹', type: 'toggle', help: '进度条填充区域的光泽流动动效' },
          { key: 'progressRippleIntensity', label: '波纹强度', type: 'range', min: 0.1, max: 1, step: 0.1, help: '水波纹的明显程度' },
          { type: 'section', label: '━━ 时间显示 ━━' },
          { key: 'timeColor', label: '时间颜色', type: 'color', help: '播放时间的字体颜色' },
          { key: 'timeFontSize', label: '时间字号', type: 'range', min: 8, max: 16, step: 1, help: '播放时间的字体大小。默认10px' },
          { type: 'section', label: '━━ 悬浮仓 ━━' },
          { key: 'chamberOpacity', label: '仓透明度', type: 'range', min: 0.05, max: 0.5, step: 0.01, help: '四个悬浮仓的背景透明度' },
        ],
      },
      particle: {
        title: '🔮 粒子封面',
        fields: [
          { type: 'section', label: '━━ 粒子封面 ━━' },
          { key: 'enableParticleCover', label: '启用粒子封面', type: 'toggle', help: '3D粒子化专辑封面，关闭后显示静态缩略图' },
          { key: 'particleResolution', label: '粒子分辨率', type: 'range', min: 60, max: 200, step: 1, help: '粒子网格密度' },
          { key: 'particleScatterStrength', label: '散落强度', type: 'range', min: 0, max: 1, step: 0.05, help: '切歌时粒子散开的力度' },
          { key: 'particleSensitivity', label: '律动灵敏度', type: 'range', min: 0, max: 1, step: 0.05, help: '粒子对音频节奏的响应程度' },
          { key: 'particleRotationSpeed', label: '旋转速度', type: 'range', min: 0, max: 2, step: 0.1, help: '鼠标拖拽松手后的自动旋转速度' },
        ],
      },
      lyricsTab: {
        title: '🎵 歌词',
        fields: [
          { type: 'section', label: '━━ 歌词显示 ━━' },
          { key: 'lyricsVisibleLines', label: '显示行数', type: 'range', min: 0, max: 40, step: 1, help: '右侧歌词仓最大显示行数' },
          { key: 'lyricsFontSize', label: '歌词字号', type: 'range', min: 10, max: 24, step: 1, help: '歌词字体大小' },
          { key: 'lyricsColor', label: '歌词颜色', type: 'color', help: '歌词文字颜色' },
          { key: 'lyricsHighlightColor', label: '高亮颜色', type: 'color', help: '当前播放句高亮色' },
          { key: 'lyricsFadeStrength', label: '歌词淡化', type: 'range', min: 0, max: 1, step: 0.05, help: '淡化强度' },
          { key: 'lyricsEffect', label: '动态效果', type: 'select', options: { fade: '渐隐渐显', glow: '发光脉冲', typewriter: '逐字显现', none: '无效果' }, help: '歌词行切换过渡动画' },
          { type: 'section', label: '━━ 行内歌词 ━━' },
          { key: 'inlineLyricColor', label: '行内歌词颜色', type: 'color', help: '中心核心区单行歌词颜色' },
          { key: 'inlineLyricFontSize', label: '行内歌词字号', type: 'range', min: 12, max: 22, step: 1, help: '行内歌词字号' },
        ],
      },
      playlist: {
        title: '📋 歌单',
        fields: [
          { type: 'section', label: '━━ 歌单列表 ━━' },
          { key: 'playlistTextColor', label: '文字颜色', type: 'color', help: '左侧歌单列表文字颜色' },
          { key: 'playlistFontSize', label: '字号', type: 'range', min: 12, max: 18, step: 1, help: '列表字体大小' },
        ],
      },
      background: {
        title: '🖼 背景',
        fields: [
          { type: 'section', label: '━━ 背景流体 ━━' },
          { key: 'enableFluidBg', label: '启用流体背景', type: 'toggle', help: '全屏动态水波纹背景' },
          { key: 'bgIntensity', label: '背景强度', type: 'range', min: 0, max: 1, step: 0.05, help: '水波纹明显程度' },
          { key: 'bgSpeed', label: '背景速度', type: 'range', min: 0.1, max: 3, step: 0.1, help: '水波纹流速' },
          { key: 'bgNoiseScale', label: '噪声质量', type: 'range', min: 0.25, max: 1.0, step: 0.05, help: '噪声分辨率，低=省GPU' },
          { type: 'section', label: '━━ 背景图片/视频 ━━' },
          { key: 'wallpaperOpacity', label: '背景透明度', type: 'range', min: 0, max: 1, step: 0.05, help: '背景的显示透明度' },
          { key: 'wallpaperRippleSpeed', label: '水波纹速度', type: 'range', min: 0.2, max: 2, step: 0.1, help: '背景上叠加的水波纹速度' },
        ],
      },
      system: {
        title: '⚙️ 系统',
        fields: [
          { type: 'section', label: '━━ 界面 ━━' },
          { key: 'language', label: '界面语言', type: 'select', options: { 'zh-CN': '中文', 'en-US': 'English' }, help: '切换后刷新设置面板生效' },
          { key: 'chamberTopPinned', label: '上仓常驻', type: 'toggle', help: '播放列表+收藏列表 默认保持可见' },
          { key: 'chamberBottomPinned', label: '下仓常驻', type: 'toggle', help: '底部控制器默认保持可见' },
          { key: 'chamberLeftPinned', label: '左仓常驻', type: 'toggle', help: '歌单列表仓默认保持可见，而非hover触发' },
          { key: 'chamberRightPinned', label: '右仓常驻', type: 'toggle', help: '歌词仓默认保持可见' },
          { key: 'queueDockMag', label: 'Dock特效', type: 'toggle', help: '上仓队列中鼠标靠近时封面放大+旋转（macOS Dock风格）' },
          { type: 'section', label: '━━ UI自定义 ━━' },
          { key: 'uiFontSize', label: 'UI字号', type: 'range', min: 11, max: 18, step: 1, help: '全局界面字体基准大小。默认13px' },
          { key: 'uiAccentColor', label: '强调色', type: 'color', help: '点击色块打开调色盘，选择后实时生效' },
          { key: 'uiFontWeight', label: '字体粗细', type: 'range', min: 300, max: 700, step: 100, help: '300=细体 400=常规 500=中等 600=半粗 700=粗体' },
          { key: 'controllerOrder', label: '按钮排序', type: 'select', options: {
            'like,volume,prev,play,next,playmode': '默认布局',
            'prev,play,next,like,playmode,volume': '经典布局',
            'like,prev,play,next,playmode,volume': '简洁布局',
            'volume,like,prev,play,next,playmode': '音量前置',
          }, help: '控制器按钮从左到右的排列顺序' },
          { type: 'section', label: '━━ 字体 ━━' },
          { key: 'globalFontFamily', label: '全局字体', type: 'select', options: { 'inherit': '系统默认', 'PingFang SC': '苹方', 'SF Pro Text': 'SF Pro', 'Helvetica Neue': 'Helvetica', 'Microsoft YaHei': '微软雅黑' }, help: '除歌词外的全局字体' },
          { key: 'lyricsFontFamily', label: '歌词字体', type: 'select', options: { 'inherit': '系统默认', 'PingFang SC': '苹方', 'KaiTi': '楷体', 'Songti SC': '宋体', 'Heiti SC': '黑体' }, help: '歌词仓独立字体' },
          { type: 'section', label: '━━ 背景 ━━' },
          { key: 'wallpaperBlur', label: '背景模糊', type: 'range', min: 0, max: 40, step: 1, help: '背景图片/视频的高斯模糊程度（像素）。0=清晰原图' },
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
    const visKeys = ['enableFluidBg','enableParticleCover','enableFoamSystem','enableFoamEqualizer'];
    const visMap = { enableFluidBg:'fluidBg', enableParticleCover:'particleCover', enableFoamSystem:'foamSystem', enableFoamEqualizer:'foamEqualizer' };
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
    if (typeof FluidBackground !== 'undefined') {
      if (s.bgIntensity != null) FluidBackground.setIntensity(s.bgIntensity);
      if (s.bgSpeed != null) FluidBackground.setSpeed(s.bgSpeed);
    }
    // Background quality
    if (typeof FluidBackground !== 'undefined' && s.bgNoiseScale != null) {
      if (typeof FluidBackground.setNoiseScale === 'function') FluidBackground.setNoiseScale(s.bgNoiseScale);
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
    // UI font customization
    if (s.uiFontSize != null) {
      document.documentElement.style.setProperty('--font-size-base', s.uiFontSize + 'px');
    }
    if (s.uiAccentColor) {
      document.documentElement.style.setProperty('--accent', s.uiAccentColor);
      document.documentElement.style.setProperty('--color-accent', s.uiAccentColor);
    }
    if (s.uiFontWeight != null) {
      document.documentElement.style.setProperty('--font-weight-base', s.uiFontWeight);
    }
    // Controller button order
    if (s.controllerOrder) {
      var order = s.controllerOrder.split(',').map(function(x) { return x.trim(); });
      order.forEach(function(btnId, idx) {
        var el = document.querySelector('#controller-order span[data-btn="' + btnId + '"]');
        if (el) el.style.order = idx;
      });
    }
    // Apply lyrics settings
    // Playlist text color
    if (s.playlistTextColor) {
      document.documentElement.style.setProperty('--playlist-text-color', s.playlistTextColor);
      document.querySelectorAll('.playlist-item-row, .pli-title, .pli-artist').forEach(function(el) {
        el.style.color = s.playlistTextColor;
      });
    }
    if (s.lyricsFontSize != null) {
      document.documentElement.style.setProperty('--lyric-font-size', s.lyricsFontSize + 'px');
      var lines = document.querySelectorAll('.lyric-line');
      lines.forEach(function(l) { l.style.fontSize = s.lyricsFontSize + 'px'; });
    }
    if (s.lyricsFadeStrength != null) {
      document.documentElement.style.setProperty('--lyric-fade', s.lyricsFadeStrength);
      // Clear any mask/fade overlays — lyrics render natively clean
      var lc = document.getElementById('lyrics-container');
      if (lc) {
        lc.style.webkitMaskImage = '';
        lc.style.maskImage = '';
        lc.classList.remove('lyric-fade-edges');
      }
    }
    if (s.lyricsColor) {
      document.documentElement.style.setProperty('--lyric-color', s.lyricsColor);
      document.querySelectorAll('.lyric-line').forEach(function(l) { l.style.color = s.lyricsColor; });
    }
    if (s.lyricsHighlightColor) {
      document.documentElement.style.setProperty('--lyric-highlight', s.lyricsHighlightColor);
      document.querySelectorAll('.lyric-line.active').forEach(function(l) { l.style.color = s.lyricsHighlightColor; });
    }
    if (s.lyricsEffect) {
      document.documentElement.style.setProperty('--lyric-effect', s.lyricsEffect);
      var lc = document.getElementById('lyrics-container');
      if (lc) {
        lc.classList.remove('lyric-effect-fade','lyric-effect-glow','lyric-effect-typewriter','lyric-effect-none');
        if (s.lyricsEffect !== 'fade') lc.classList.add('lyric-effect-' + s.lyricsEffect);
      }
    }
    // Lyrics visible lines limit
    if (s.lyricsVisibleLines != null) {
      var lc = document.getElementById('lyrics-container');
      if (lc) {
        lc.style.maxHeight = (s.lyricsVisibleLines > 0) ? (s.lyricsVisibleLines * 28 + 'px') : '';
      }
    }
    // Inline lyric customization
    if (s.inlineLyricColor) {
      document.documentElement.style.setProperty('--inline-lyric-color', s.inlineLyricColor);
      var il = document.getElementById('inline-lyric');
      if (il) il.style.color = s.inlineLyricColor;
    }
    if (s.inlineLyricFontSize != null) {
      document.documentElement.style.setProperty('--inline-lyric-size', s.inlineLyricFontSize + 'px');
      var il = document.getElementById('inline-lyric');
      if (il) il.style.fontSize = s.inlineLyricFontSize + 'px';
    }
    // Progress bar customization
    if (s.progressColor) {
      document.documentElement.style.setProperty('--progress-color', s.progressColor);
      var pf = document.getElementById('progress-bar-fill');
      if (pf) pf.style.background = 'linear-gradient(90deg, ' + s.progressColor + ', ' + s.progressColor + ')';
    }
    if (s.progressHeight != null) {
      document.documentElement.style.setProperty('--progress-height', s.progressHeight + 'px');
      var pc = document.getElementById('progress-bar-container');
      if (pc) pc.style.height = s.progressHeight + 'px';
    }
    // Progress bar water ripple
    if (typeof s.progressRipple === 'boolean') {
      var pf = document.getElementById('progress-bar-fill');
      if (pf) {
        if (s.progressRipple) {
          pf.classList.add('ripple');
          var intensity = s.progressRippleIntensity != null ? s.progressRippleIntensity : 0.5;
          pf.style.setProperty('--ripple-opacity', intensity);
        } else {
          pf.classList.remove('ripple');
        }
      }
    }
    if (s.progressRippleIntensity != null) {
      document.documentElement.style.setProperty('--ripple-opacity', s.progressRippleIntensity);
    }
    // Time display
    if (s.timeColor) {
      document.documentElement.style.setProperty('--time-color', s.timeColor);
      var tc = document.getElementById('time-current');
      var td = document.getElementById('time-duration');
      if (tc) tc.style.color = s.timeColor;
      if (td) td.style.color = s.timeColor;
    }
    if (s.timeFontSize != null) {
      var tc = document.getElementById('time-current');
      var td = document.getElementById('time-duration');
      if (tc) tc.style.fontSize = s.timeFontSize + 'px';
      if (td) td.style.fontSize = s.timeFontSize + 'px';
    }
    // Text water ripple
    if (typeof s.textRipple === 'boolean') {
      document.documentElement.style.setProperty('--text-ripple-opacity', s.textRippleIntensity || 0.3);
      var textEls = document.querySelectorAll('#song-title, #song-artist, #inline-lyric');
      textEls.forEach(function(el) {
        if (s.textRipple) el.classList.add('text-ripple');
        else el.classList.remove('text-ripple');
      });
    }
    if (s.textRippleIntensity != null) {
      document.documentElement.style.setProperty('--text-ripple-opacity', s.textRippleIntensity);
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
      if (s.particleResolution != null && typeof ParticleCover.setResolution === 'function') ParticleCover.setResolution(s.particleResolution);
      if (s.particleRotationSpeed != null && typeof ParticleCover.setRotationSpeed === 'function') ParticleCover.setRotationSpeed(s.particleRotationSpeed);
      if (s.particleScatterStrength != null && typeof ParticleCover.setScatterStrength === 'function') ParticleCover.setScatterStrength(s.particleScatterStrength);
      if (s.particleSensitivity != null && typeof ParticleCover.setSensitivity === 'function') ParticleCover.setSensitivity(s.particleSensitivity);
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
    // Wallpaper blur
    if (s.wallpaperBlur != null) {
      document.documentElement.style.setProperty('--wallpaper-blur', s.wallpaperBlur + 'px');
    }
    // Chamber opacity — unified across all 4 chambers
    if (s.chamberOpacity != null) {
      document.documentElement.style.setProperty('--chamber-alpha', s.chamberOpacity);
      var bg = 'rgba(10,10,24,' + s.chamberOpacity + ')';
      document.querySelectorAll('#chamber-left, #chamber-right, #chamber-top, #chamber-bottom').forEach(function(el) {
        el.style.background = bg;
      });
      // Also set on the base class
      document.documentElement.style.setProperty('--chamber-bg', bg);
    }
    // Font families
    if (s.globalFontFamily && s.globalFontFamily !== 'inherit') {
      document.body.style.fontFamily = s.globalFontFamily + ', sans-serif';
    } else if (s.globalFontFamily === 'inherit') {
      document.body.style.fontFamily = '';
    }
    if (s.lyricsFontFamily && s.lyricsFontFamily !== 'inherit') {
      document.documentElement.style.setProperty('--lyric-font-family', s.lyricsFontFamily);
      document.querySelectorAll('.lyric-line').forEach(function(l) { l.style.fontFamily = s.lyricsFontFamily; });
    } else if (s.lyricsFontFamily === 'inherit') {
      document.documentElement.style.setProperty('--lyric-font-family', 'inherit');
      document.querySelectorAll('.lyric-line').forEach(function(l) { l.style.fontFamily = ''; });
    }
  }

  // Default settings snapshot for reset
  const DEFAULT_SETTINGS = {
    particleResolution: 160, particleScatterStrength: 0.8, particleSensitivity: 0.8,
    particleRotationSpeed: 0.5, particleColor: '#ffffff',
    enableParticleCover: true, enableFluidBg: true,
    foamCount: 80, foamSize: 1.5, foamIridescence: 0.6, foamFloatAmplitude: 0.7, foamColorScheme: 0,
    lyricsLines: 0, lyricsFontSize: 13, lyricsColor: '#ffffff', lyricsHighlightColor: '#5588ee', lyricsFadeStrength: 0.5,
    lyricsVisibleLines: 0, lyricsEffect: 'fade', inlineLyricColor: '#f0c060', inlineLyricFontSize: 15,
    playlistStyle: 'default', playlistFontSize: 13, playlistTransparency: 0.15, playlistTextColor: '#e0d8c0',
    foamPreset: 'pearl', foamDensity: 1.0, foamColorIntensity: 1.0,
    controllerParticleDensity: 0.6, controllerSandStrength: 0.5, controllerStyle: 'default',
    bgIntensity: 0.8, bgSpeed: 1.0, bgColorScheme: 'dark', bgNoiseScale: 0.5,
    volume: 0.7, chamberTransparency: 0.15, chamberTriggerSensitivity: 0.5, chamberLeftPinned: false, chamberRightPinned: false, chamberTopPinned: true, chamberBottomPinned: true, queueDockMag: true,
    accountMultiLogin: true, language: 'zh-CN', wallpaperOpacity: 0.5, wallpaperRippleSpeed: 1.0, wallpaperBlur: 20,
    textRipple: false, textRippleIntensity: 0.3, progressColor: '#f0c060', progressHeight: 4,
    progressRipple: false, progressRippleIntensity: 0.5, timeColor: '#f0c060', timeFontSize: 10,
  };

  function renderTab(tabId) {
    const container = document.getElementById('diy-content');
    const config = DIYSettings.tabConfigs[tabId];
    if (!container || !config) return;

    DIYSettings.activeTab = tabId;

    let html = '';
    config.fields.forEach((field) => {
      // Section header
      if (field.type === 'section') {
        html += '<div class="diy-section-header">' + field.label + '</div>';
        return;
      }
      const value = DIYSettings.settings[field.key] != null ? DIYSettings.settings[field.key] : DEFAULT_SETTINGS[field.key];
      // 3-column row: name | control | actions(↺+?)
      html += '<div class="diy-setting-row">';
      html += '<span class="diy-label" title="' + (field.help || '') + '">' + field.label + '</span>';

      // Center: parameter control
      html += '<div class="diy-control">';
      if (field.type === 'range') {
        html += '<input type="range" class="diy-slider" data-key="' + field.key + '" min="' + field.min + '" max="' + field.max + '" step="' + field.step + '" value="' + value + '">';
        html += '<span class="diy-val">' + value + '</span>';
      } else if (field.type === 'select') {
        html += '<select class="diy-select" data-key="' + field.key + '">';
        for (const [optVal, optLabel] of Object.entries(field.options)) {
          html += '<option value="' + optVal + '"' + (value === optVal ? ' selected' : '') + '>' + optLabel + '</option>';
        }
        html += '</select>';
      } else if (field.type === 'color') {
        html += '<label class="diy-color-wrap">';
        html += '<input type="color" class="diy-color-input" data-key="' + field.key + '" value="' + (value || '#f0c060') + '">';
        html += '<span class="diy-color-val">' + (value || '#f0c060') + '</span>';
        html += '</label>';
      } else if (field.type === 'toggle') {
        html += '<label class="diy-toggle-wrap">';
        html += '<input type="checkbox" data-key="' + field.key + '" ' + (value ? 'checked' : '') + '>';
        html += '<span class="diy-toggle-state">' + (value ? '开' : '关') + '</span>';
        html += '</label>';
      } else {
        html += '<input type="text" class="diy-input" data-key="' + field.key + '" value="' + value + '">';
      }
      html += '</div>';

      // Right: action buttons (reset + help)
      html += '<div class="diy-actions">';
      html += '<button class="diy-reset-btn" data-key="' + field.key + '" title="重置">↺</button>';
      html += '<button class="diy-help-btn" data-help="' + (field.help || '').replace(/"/g, '&quot;') + '" title="点击查看说明">?</button>';
      html += '</div>';

      html += '</div>';
    });

    container.innerHTML = html;

    // Background tab: Image/video picker + Restore Defaults + Clear Cache (also in system tab)
    if (tabId === 'background') {
      var wpRow = document.createElement('div');
      wpRow.className = 'diy-setting-row';
      wpRow.style.flexDirection = 'column';
      wpRow.style.alignItems = 'flex-start';
      wpRow.style.gap = '8px';
      wpRow.innerHTML = '<span class="diy-label">🖼 背景</span>'
        + '<div style="display:flex;gap:8px;align-items:center;">'
        + '<button class="user-panel-btn" id="btn-pick-wallpaper" style="font-size:11px;" onclick="window._pickWallpaper()">选择图片</button>'
        + '<button class="user-panel-btn" id="btn-pick-bg-video" style="font-size:11px;" onclick="window._pickBgVideo()">选择视频</button>'
        + '<button class="diy-reset-btn" id="btn-clear-wallpaper" title="清除背景" style="width:22px;height:22px;">✕</button>'
        + '</div>'
        + '<div id="wallpaper-thumb-preview"></div>'
        + '<video id="bg-video-preview" style="display:none;width:120px;height:68px;border-radius:6px;border:1px solid var(--glass-border);object-fit:cover;margin-top:4px;" muted loop></video>';
      container.appendChild(wpRow);

      // Show thumbnail preview
      var updateThumb = function() {
        var thumb = document.getElementById('wallpaper-thumb-preview');
        var vid = document.getElementById('bg-video-preview');
        if (!thumb) return;
        var savedImg = localStorage.getItem('fluidmusic-wallpaper');
        var savedVid = localStorage.getItem('fluidmusic-has-bg-video');
        if (savedVid) {
          var videoUrl = window.location.origin + '/bg-video?t=' + Date.now();
          if (vid) { vid.src = videoUrl; vid.style.display = 'block'; vid.play().catch(function(){}); }
          thumb.innerHTML = '<span style="font-size:10px;color:var(--text-dim);">已设置视频背景</span>';
          // Apply video to wallpaper layer, but don't overwrite an already-playing video
          var wpLayer = document.getElementById('wallpaper-layer');
          if (wpLayer && !wpLayer.querySelector('video')) {
            wpLayer.innerHTML = '<video src="' + videoUrl + '" autoplay muted loop playsinline style="width:100%;height:100%;object-fit:cover;background:#0a0a14;" onerror="this.parentElement.classList.remove(\'loaded\');this.parentElement.innerHTML=\'\';localStorage.removeItem(\'fluidmusic-has-bg-video\');"></video>';
            wpLayer.classList.add('loaded');
          }
        } else if (savedImg) {
          if (vid) vid.style.display = 'none';
          thumb.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-top:6px;">'
            + '<img src="' + savedImg + '" style="width:80px;height:80px;border-radius:8px;border:1px solid var(--glass-border);object-fit:cover;flex-shrink:0;">'
            + '<span style="font-size:10px;color:var(--text-dim);">已设置</span>'
            + '</div>';
        } else {
          if (vid) vid.style.display = 'none';
          thumb.innerHTML = '<span style="font-size:11px;color:var(--text-dim);">未设置</span>';
        }
      };
      updateThumb();

      // Image picker — exposed globally
      window._pickWallpaper = async function() {
        if (typeof fluidmusic !== 'undefined' && fluidmusic.pickWallpaper) {
          var result = await fluidmusic.pickWallpaper();
          if (result && result.ok && result.dataUrl) {
            localStorage.removeItem('fluidmusic-has-bg-video');
            localStorage.setItem('fluidmusic-wallpaper', result.dataUrl);
            applyWallpaper(result.dataUrl);
            if (typeof showToast !== 'undefined') showToast('🖼 背景已更新');
            updateThumb();
          }
        } else {
          if (typeof showToast !== 'undefined') showToast('⚠ 需要Electron环境');
        }
      };

      // Video picker — exposed globally so inline onclick works after re-render
      window._pickBgVideo = async function() {
        console.log('[BgVideo] _pickBgVideo called');
        if (typeof fluidmusic !== 'undefined' && typeof fluidmusic.pickBgVideo === 'function') {
          console.log('[BgVideo] IPC available, invoking...');
          try {
            var result = await fluidmusic.pickBgVideo();
            console.log('[BgVideo] pick result:', JSON.stringify(result));
            if (result && result.ok && result.dataUrl) {
              localStorage.removeItem('fluidmusic-wallpaper');
              localStorage.setItem('fluidmusic-has-bg-video', 'true');
              var wpLayer = document.getElementById('wallpaper-layer');
              var videoUrl = window.location.origin + '/bg-video?t=' + Date.now();
              console.log('[BgVideo] Creating video, URL:', videoUrl, 'wpLayer:', !!wpLayer);
              if (wpLayer) {
                wpLayer.innerHTML = '';
                var vid = document.createElement('video');
                vid.src = videoUrl;
                vid.autoplay = true;
                vid.muted = true;
                vid.loop = true;
                vid.playsInline = true;
                vid.style.cssText = 'width:100%;height:100%;object-fit:cover;background:#0a0a14;';
                vid.preload = 'auto';
                vid.onloadeddata = function() {
                  console.log('[BgVideo] loadeddata fired');
                  wpLayer.style.opacity = '0.5';
                  wpLayer.classList.add('loaded');
                };
                vid.oncanplay = function() {
                  console.log('[BgVideo] canplay fired');
                  vid.play().catch(function(e) { console.error('[BgVideo] play failed:', e); });
                };
                vid.onerror = function(e) {
                  var msg = vid.error ? (vid.error.message || '未知错误') : '解码失败';
                  console.error('[BgVideo] video load error:', msg);
                  if (typeof showToast !== 'undefined') showToast('⚠ 视频格式不兼容，请使用H.264编码的MP4文件');
                  wpLayer.innerHTML = '';
                  wpLayer.classList.remove('loaded');
                  localStorage.removeItem('fluidmusic-has-bg-video');
                };
                wpLayer.appendChild(vid);
                console.log('[BgVideo] video element appended');
              } else {
                console.error('[BgVideo] wallpaper-layer not found!');
              }
              if (typeof showToast !== 'undefined') showToast('🎬 视频背景已设置');
              updateThumb();
            } else {
              if (typeof showToast !== 'undefined') showToast('⚠ 未选择视频');
            }
          } catch(e) {
            console.error('[BgVideo] error:', e);
            if (typeof showToast !== 'undefined') showToast('⚠ 视频选择失败: ' + e.message);
          }
        } else {
          console.log('[BgVideo] fluidmusic.pickBgVideo not available. fluidmusic:', typeof fluidmusic, 'pickBgVideo:', typeof fluidmusic?.pickBgVideo);
          if (typeof showToast !== 'undefined') showToast('⚠ 需要Electron环境');
        }
      };

      document.getElementById('btn-clear-wallpaper').addEventListener('click', function() {
        localStorage.removeItem('fluidmusic-wallpaper');
        localStorage.removeItem('fluidmusic-has-bg-video');
        applyWallpaper(null);
        var wpLayer = document.getElementById('wallpaper-layer');
        if (wpLayer) { wpLayer.innerHTML = ''; wpLayer.classList.remove('loaded'); }
        if (typeof showToast !== 'undefined') showToast('🗑 背景已清除');
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
          const wrap = this.closest('.diy-toggle-wrap');
          if (wrap) {
            const state = wrap.querySelector('.diy-toggle-state');
            if (state) state.textContent = val ? '开' : '关';
          }
        } else if (this.type === 'range') {
          val = parseFloat(this.value);
          var row = this.closest('.diy-setting-row');
          if (row) { var d = row.querySelector('.diy-val'); if (d) d.textContent = val; }
        } else if (this.type === 'color') {
          val = this.value;
          var row = this.closest('.diy-setting-row');
          if (row) { var d = row.querySelector('.diy-color-val'); if (d) d.textContent = val; }
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

    // Wire help buttons
    container.querySelectorAll('.diy-help-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const helpText = btn.dataset.help || '暂无详细说明';
        // Remove any existing tooltip
        const existing = document.querySelector('.diy-help-tooltip');
        if (existing) existing.remove();
        // Create tooltip
        const tip = document.createElement('div');
        tip.className = 'diy-help-tooltip';
        tip.textContent = helpText;
        btn.appendChild(tip);
        // Auto-remove after 3s
        setTimeout(() => { if (tip.parentNode) tip.remove(); }, 3000);
        tip.addEventListener('click', (ev) => { ev.stopPropagation(); if (tip.parentNode) tip.remove(); });
      });
    });

    // Click outside closes any help tooltip
    container.addEventListener('click', () => {
      const tip = document.querySelector('.diy-help-tooltip');
      if (tip) tip.remove();
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
