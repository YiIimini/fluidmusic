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
      lyricsEffect: 'none',  // fade/glow/typewriter/none
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
      clickRipple: false,
      clickRippleSize: 120,
      clickRippleSpeed: 0.8,
      songTitleColor: '#f0c060',
      songTitleFontSize: 24,
      songArtistColor: '#e0b050',
      songArtistFontSize: 15,

      // Playlist
      playlistStyle: 'default',
      playlistFontSize: 13,
      playlistTransparency: 0.15,
      playlistTextColor: '#e0d8c0',
      activeLyricFontSize: 18,
      inlineLyricMode: 'auto',  // auto | show

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
          { type: 'section', label: '━━ 鼠标特效 ━━' },
          { key: 'clickRipple', label: '点击水波纹', type: 'toggle', help: '鼠标点击触发水波纹扩散效果' },
          { key: 'clickRippleSize', label: '波纹大小', type: 'range', min: 60, max: 300, step: 10, help: '水波纹扩散的最大直径(px)' },
          { key: 'clickRippleSpeed', label: '涟漪速度', type: 'range', min: 0.3, max: 2.0, step: 0.1, help: '水波纹扩散速度(秒)' },
          { type: 'section', label: '━━ 悬浮仓 ━━' },
          { key: 'chamberOpacity', label: '仓透明度', type: 'range', min: 0.05, max: 0.5, step: 0.01, help: '四个悬浮仓的背景透明度' },
        ],
      },
      particle: {
        title: '🎵 封面',
        fields: [
          { type: 'section', label: '━━ 粒子封面 ━━' },
          { key: 'enableParticleCover', label: '启用粒子封面', type: 'toggle', help: '3D粒子化专辑封面，关闭后显示静态缩略图' },
          { key: 'particleResolution', label: '粒子分辨率', type: 'range', min: 60, max: 200, step: 1, help: '粒子网格密度' },
          { key: 'particleScatterStrength', label: '散落强度', type: 'range', min: 0, max: 1, step: 0.05, help: '切歌时粒子散开的力度' },
          { key: 'particleSensitivity', label: '律动灵敏度', type: 'range', min: 0, max: 1, step: 0.05, help: '粒子对音频节奏的响应程度' },
          { key: 'particleRotationSpeed', label: '旋转速度', type: 'range', min: 0, max: 2, step: 0.1, help: '鼠标拖拽松手后的自动旋转速度' },
          { type: 'section', label: '━━ 歌曲信息 ━━' },
          { key: 'songTitleColor', label: '歌名颜色', type: 'color', help: '歌曲名称字体颜色' },
          { key: 'songTitleFontSize', label: '歌名字号', type: 'range', min: 16, max: 36, step: 1, help: '歌曲名称字体大小' },
          { key: 'songArtistColor', label: '歌手颜色', type: 'color', help: '歌手名称字体颜色' },
          { key: 'songArtistFontSize', label: '歌手字号', type: 'range', min: 11, max: 22, step: 1, help: '歌手名称字体大小' },
          { type: 'section', label: '━━ 进度条 ━━' },
          { key: 'progressColor', label: '进度条颜色', type: 'color', help: '进度条填充和拖拽圆点的颜色' },
          { key: 'progressHeight', label: '进度条高度', type: 'range', min: 2, max: 8, step: 1, help: '进度条粗细' },
          { key: 'progressRipple', label: '进度条水波纹', type: 'toggle', help: '进度条光泽流动动效' },
          { key: 'progressRippleIntensity', label: '波纹强度', type: 'range', min: 0.1, max: 1, step: 0.1, help: '水波纹明显程度' },
          { key: 'timeColor', label: '时间颜色', type: 'color', help: '播放时间字体颜色' },
          { key: 'timeFontSize', label: '时间字号', type: 'range', min: 8, max: 16, step: 1, help: '播放时间字体大小' },
          { type: 'section', label: '━━ 文字水波纹 ━━' },
          { key: 'textRipple', label: '文字水波纹', type: 'toggle', help: '歌名、作者、单行歌词的光泽流动效果' },
          { key: 'textRippleIntensity', label: '文字波纹强度', type: 'range', min: 0.1, max: 1, step: 0.1, help: '文字水波纹的明显程度' },
        ],
      },
      lyricsTab: {
        title: '🎵 歌词',
        fields: [
          { type: 'section', label: '━━ 歌词显示 ━━' },
          { key: 'lyricsVisibleLines', label: '显示行数', type: 'range', min: 0, max: 40, step: 1, help: '右侧歌词仓最大显示行数' },
          { key: 'lyricsFontSize', label: '歌词字号', type: 'range', min: 10, max: 24, step: 1, help: '未播放行歌词字体大小' },
          { key: 'activeLyricFontSize', label: '当前歌词字号', type: 'range', min: 12, max: 30, step: 1, help: '当前播放句独立字号，默认比普通歌词大' },
          { key: 'lyricsColor', label: '歌词颜色', type: 'color', help: '歌词文字颜色' },
          { key: 'lyricsHighlightColor', label: '高亮颜色', type: 'color', help: '当前播放句高亮色' },
          { key: 'lyricsFadeStrength', label: '歌词淡化', type: 'range', min: 0, max: 1, step: 0.05, help: '淡化强度' },
          { key: 'lyricsEffect', label: '动态效果', type: 'select', options: { fade: '渐隐渐显', glow: '发光脉冲', typewriter: '逐字显现', none: '无效果' }, help: '歌词行切换过渡动画' },
          { type: 'section', label: '━━ 行内歌词 ━━' },
          { key: 'inlineLyricMode', label: '显示模式', type: 'select', options: { auto: '自动（右仓关闭时显示）', show: '始终显示' }, help: '自动=右仓隐藏时显示行内歌词；始终=一直显示' },
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
          { type: 'section', label: '━━ 音频 ━━' },
          { key: 'volume', label: '音乐音量', type: 'range', min: 0, max: 1, step: 0.05, help: '应用全局音量' },
          { key: 'playMode', label: '播放模式', type: 'select', options: { sequential: '顺序播放', random: '随机播放', single: '单曲循环' }, help: '默认播放模式' },
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
          { key: 'wallpaperBlur', label: '背景模糊', type: 'range', min: 0, max: 40, step: 1, help: '背景图片/视频的高斯模糊程度（像素）。0=清晰原图' },
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
    const visKeys = ['enableFluidBg','enableParticleCover'];
    const visMap = { enableFluidBg:'fluidBg', enableParticleCover:'particleCover' };
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
    // Toggle fluid background layer visibility
    if (typeof s.enableFluidBg === 'boolean') {
      var lbg = document.getElementById('layer-bg');
      if (lbg) {
        if (s.enableFluidBg) lbg.classList.add('fluid-active');
        else lbg.classList.remove('fluid-active');
      }
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
    // Playlist text color — also set CSS variable for new elements
    if (s.playlistTextColor) {
      document.documentElement.style.setProperty('--playlist-text-color', s.playlistTextColor);
    }
    if (s.lyricsFontSize != null) {
      document.documentElement.style.setProperty('--lyric-font-size', s.lyricsFontSize + 'px');
      var lines = document.querySelectorAll('.lyric-line:not(.active)');
      lines.forEach(function(l) { l.style.fontSize = s.lyricsFontSize + 'px'; });
    }
    if (s.activeLyricFontSize != null) {
      document.documentElement.style.setProperty('--active-lyric-font-size', s.activeLyricFontSize + 'px');
    }
    // Inline lyric mode
    if (s.inlineLyricMode) {
      var il = document.getElementById('inline-lyric');
      if (il) {
        if (s.inlineLyricMode === 'show') {
          il.style.display = '';
          il.dataset.mode = 'show';
        } else {
          il.dataset.mode = 'auto';
          // Auto mode: shown/hidden by bubble chamber logic
        }
      }
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
      lc = document.getElementById('lyrics-container');
      if (lc) {
        lc.classList.remove('lyric-effect-fade','lyric-effect-glow','lyric-effect-typewriter','lyric-effect-none');
        if (s.lyricsEffect !== 'fade') lc.classList.add('lyric-effect-' + s.lyricsEffect);
      }
    }
    // Lyrics visible lines limit
    if (s.lyricsVisibleLines != null) {
      lc = document.getElementById('lyrics-container');
      if (lc) {
        lc.style.maxHeight = (s.lyricsVisibleLines > 0) ? (s.lyricsVisibleLines * 28 + 'px') : '';
      }
    }
    // Inline lyric customization
    if (s.inlineLyricColor) {
      document.documentElement.style.setProperty('--inline-lyric-color', s.inlineLyricColor);
      il = document.getElementById('inline-lyric');
      if (il) il.style.color = s.inlineLyricColor;
    }
    if (s.inlineLyricFontSize != null) {
      document.documentElement.style.setProperty('--inline-lyric-size', s.inlineLyricFontSize + 'px');
      il = document.getElementById('inline-lyric');
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
      pf = document.getElementById('progress-bar-fill');
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
      tc = document.getElementById('time-current');
      td = document.getElementById('time-duration');
      if (tc) tc.style.fontSize = s.timeFontSize + 'px';
      if (td) td.style.fontSize = s.timeFontSize + 'px';
    }
    // Song title/artist customization
    if (s.songTitleColor) {
      var st = document.getElementById('song-title');
      if (st) st.style.color = s.songTitleColor;
    }
    if (s.songTitleFontSize != null) {
      st = document.getElementById('song-title');
      if (st) st.style.fontSize = s.songTitleFontSize + 'px';
    }
    if (s.songArtistColor) {
      var sa = document.getElementById('song-artist');
      if (sa) sa.style.color = s.songArtistColor;
    }
    if (s.songArtistFontSize != null) {
      sa = document.getElementById('song-artist');
      if (sa) sa.style.fontSize = s.songArtistFontSize + 'px';
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
    // Click/Hover/Audio ripple
    if (typeof s.clickRipple === 'boolean') {
      if (typeof window._rippleSetEnabled === 'function') {
        window._rippleSetEnabled(s.clickRipple);
      } else if (s.clickRipple) {
        document.addEventListener('click', window._clickRippleHandler);
      } else {
        document.removeEventListener('click', window._clickRippleHandler);
      }
    }
    if (s.clickRippleSize != null) {
      document.documentElement.style.setProperty('--ripple-size', s.clickRippleSize + 'px');
    }
    if (s.clickRippleSpeed != null) {
      document.documentElement.style.setProperty('--ripple-speed', s.clickRippleSpeed + 's');
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
    lyricsLines: 0, lyricsFontSize: 13, lyricsColor: '#ffffff', lyricsHighlightColor: '#5588ee', lyricsFadeStrength: 0.5,
    lyricsVisibleLines: 0, lyricsEffect: 'none', inlineLyricColor: '#f0c060', inlineLyricFontSize: 15,
    playlistStyle: 'default', playlistFontSize: 13, playlistTransparency: 0.15, playlistTextColor: '#e0d8c0',
    controllerParticleDensity: 0.6, controllerSandStrength: 0.5, controllerStyle: 'default',
    bgIntensity: 0.8, bgSpeed: 1.0, bgColorScheme: 'dark', bgNoiseScale: 0.5,
    volume: 0.7, chamberTransparency: 0.15, chamberTriggerSensitivity: 0.5, chamberLeftPinned: false, chamberRightPinned: false, chamberTopPinned: true, chamberBottomPinned: true, queueDockMag: true,
    accountMultiLogin: true, language: 'zh-CN', wallpaperOpacity: 0.5, wallpaperRippleSpeed: 1.0, wallpaperBlur: 20,
    textRipple: false, textRippleIntensity: 0.3, progressColor: '#f0c060', progressHeight: 4,
    progressRipple: false, progressRippleIntensity: 0.5, timeColor: '#f0c060', timeFontSize: 10,
  };

  function renderTab(tabId) {
    if (typeof DIYSettings._renderTab === "function") {
      DIYSettings._renderTab(tabId, DIYSettings);
    }
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
  DIYSettings.applySettings = applySettings;
  DIYSettings.saveSettings = saveSettings;
  DIYSettings._defaults = DEFAULT_SETTINGS;

  if (typeof __FM !== 'undefined') __FM.register('diySettings', [], function () { return DIYSettings; }, { priority: 4 });
  window.DIYSettings = DIYSettings;
  console.log('FluidMusic DIY Settings loaded');
})();
