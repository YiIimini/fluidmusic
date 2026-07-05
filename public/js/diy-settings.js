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
      // Lyrics
      lyricsLines: 0,
      lyricsFontSize: 13,
      lyricsColor: '#f0c060',
      lyricsHighlightColor: '#f0c060',
      lyricsFadeStrength: 0.5,
      lyricsEffect: 'none',  // fade/glow/typewriter/none
      lyricsVisibleLines: 12,
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
      rainDrop: true,
      rainDropIntensity: 1.0,
      rainDropMaxSize: 200,
      rainDropColorful: true,
      songTitleColor: '#f0c060',
      songTitleFontSize: 24,
      songArtistColor: '#e0b050',
      songArtistFontSize: 15,
      lyric3DTitleColor: '#ffd700',
      lyric3DTitleFontSize: 52,
      lyric3DArtistColor: '#c0c0c0',
      lyric3DArtistFontSize: 24,

      // Playlist
      playlistStyle: 'default',
      playlistFontSize: 13,
      playlistTransparency: 0.15,
      playMode: 'sequential',
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
      chamberTopPinned: false,
      chamberBottomPinned: true,
      chamberLeftPinned: false,
      chamberRightPinned: false,
      chamberLeftTheme: 'default',
      chamberRightTheme: 'default',
      queueDockMag: true,

      // Account
      accountMultiLogin: true,

      // Visual effect toggles (matched to VISUAL_DEFAULTS in app.js)
      enableFluidBg: false,
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
      chamberLyricCurrentColor: '#ffd700',
      chamberLyricOtherColor: '#cccccc',
      chamberLyricVisibleLines: 12,
      chamberLyricFontSize: 90,
      chamberLyricLineSpacing: 1.0,
      chamberLyricEffect: '无',
      chamberLyricFontFamily: "'PingFang SC','Noto Sans SC','Microsoft YaHei',Arial,sans-serif",
      lyricsFontFamily: 'inherit',
      chamberOpacity: 0.12,
      controllerOrder: 'like,volume,prev,play,next,playmode',

      // Display mode (default vs 3D lyrics)
      displayMode: 'default',
    bgType: 'image_video', foamTheme: 'foam_bubble', foamHeightScale: 1.0, foamBandGain: 1.0,
    irregularTheme: 'foam_bubble', irregularHeightScale: 1.0, irregularBandGain: 1.0,

      // 3D Lyrics scene parameters
      lyric3DLineCount: 5,
      lyric3DCurrentColor: '#ffd700',
      lyric3DOtherColor: '#cccccc',
      lyric3DFontFamily: "'PingFang SC','Noto Sans SC','Microsoft YaHei',Arial,sans-serif",
      lyric3DFontSize: 120,
      lyric3DLineSpacing: 1.2,
      lyric3DHighlightEffect: '无',
      lyric3DPointScale: 1.6,
      lyric3DIntensity: 1.8,
      lyric3DDepth: 1.6,
      lyric3DStarCount: 800,
      lyric3DStarSize: 0.07,
      lyric3DStarOpacity: 1.0,
      lyric3DStarSpeed: 0.0025,
      lyric3DStarColor: '#88ccff',
      lyric3DStarCanvasSize: 12.0,
    },

    tabConfigs: {
      visual: {
        title: '🎨 UI特效',
        fields: [
          { type: 'section', label: '━━ 鼠标特效 ━━' },
          { key: 'clickRipple', label: '点击水波纹', type: 'toggle', help: '鼠标点击触发水波纹扩散效果' },
          { key: 'clickRippleSize', label: '波纹大小', type: 'range', min: 60, max: 300, step: 10, help: '水波纹扩散的最大直径(px)' },
          { key: 'clickRippleSpeed', label: '涟漪速度', type: 'range', min: 0.3, max: 2.0, step: 0.1, help: '水波纹扩散速度(秒)' },
          { type: 'section', label: '━━ 雨滴特效 ━━' },
          { key: 'rainDrop', label: '雨滴特效', type: 'toggle', help: '随音频节奏在界面随机位置显示水波纹（独立于点击波纹）' },
          { key: 'rainDropIntensity', label: '雨滴密度', type: 'range', min: 0.1, max: 3.0, step: 0.1, help: '雨滴出现的频率倍数，越高越密集' },
          { key: 'rainDropMaxSize', label: '最大尺寸', type: 'range', min: 60, max: 400, step: 10, help: '低音雨滴的最大直径(px)' },
          { key: 'rainDropColorful', label: '多彩雨滴', type: 'toggle', help: '开启后雨滴随机彩色，关闭为统一色调' },
        ],
      },
      particle: {
        title: '🎵 封面',
        fields: [
          { type: 'section', label: '━━ 展示模式 ━━' },
          { key: 'displayMode', label: '展示', type: 'select', options: { 'default': '默认', '3d-lyrics': '3D封面' }, help: '默认=标准UI界面；3D封面=全屏3D粒子特效，隐藏中央核心区' },

          // --- 默认模式 ---
          { type: 'section', label: '━━ 歌曲信息 ━━', condition: 'default' },
          { key: 'songTitleColor', label: '歌名颜色', type: 'color', help: '歌曲名称字体颜色', condition: 'default' },
          { key: 'songTitleFontSize', label: '歌名字号', type: 'range', min: 16, max: 36, step: 1, help: '歌曲名称字体大小', condition: 'default' },
          { key: 'songArtistColor', label: '歌手颜色', type: 'color', help: '歌手名称字体颜色', condition: 'default' },
          { key: 'songArtistFontSize', label: '歌手字号', type: 'range', min: 11, max: 22, step: 1, help: '歌手名称字体大小', condition: 'default' },
          { type: 'section', label: '━━ 进度条 ━━', condition: 'default' },
          { key: 'progressColor', label: '进度条颜色', type: 'color', help: '进度条填充和拖拽圆点的颜色', condition: 'default' },
          { key: 'progressHeight', label: '进度条高度', type: 'range', min: 2, max: 8, step: 1, help: '进度条粗细', condition: 'default' },
          { key: 'progressRipple', label: '进度条水波纹', type: 'toggle', help: '进度条光泽流动动效', condition: 'default' },
          { key: 'progressRippleIntensity', label: '波纹强度', type: 'range', min: 0.1, max: 1, step: 0.1, help: '水波纹明显程度', condition: 'default' },
          { key: 'timeColor', label: '时间颜色', type: 'color', help: '播放时间字体颜色', condition: 'default' },
          { key: 'timeFontSize', label: '时间字号', type: 'range', min: 8, max: 16, step: 1, help: '播放时间字体大小', condition: 'default' },
          { type: 'section', label: '━━ 文字水波纹 ━━', condition: 'default' },
          { key: 'textRipple', label: '文字水波纹', type: 'toggle', help: '歌名、作者、单行歌词的光泽流动效果', condition: 'default' },
          { key: 'textRippleIntensity', label: '文字波纹强度', type: 'range', min: 0.1, max: 1, step: 0.1, help: '文字水波纹的明显程度', condition: 'default' },
          { type: 'section', label: '━━ 行内歌词 ━━', condition: 'default' },
          { key: 'inlineLyricMode', label: '显示模式', type: 'select', options: { auto: '自动（右仓关闭时显示）', show: '始终显示' }, help: '自动=右仓隐藏时显示行内歌词；始终=一直显示', condition: 'default' },
          { key: 'inlineLyricColor', label: '行内歌词颜色', type: 'color', help: '中心核心区单行歌词颜色', condition: 'default' },
          { key: 'inlineLyricFontSize', label: '行内歌词字号', type: 'range', min: 12, max: 22, step: 1, help: '行内歌词字号', condition: 'default' },

          // --- 3D歌词模式 ---
          { type: 'section', label: '━━ 歌名/作者 ━━', condition: '3d-lyrics' },
          { key: 'lyric3DTitleColor', label: '歌名颜色', type: 'color', help: '3D歌词模式下歌名的DOM颜色', condition: '3d-lyrics' },
          { key: 'lyric3DTitleFontSize', label: '歌名字号', type: 'range', min: 30, max: 80, step: 2, help: '3D歌词模式下歌名的字体大小(px)', condition: '3d-lyrics' },
          { key: 'lyric3DArtistColor', label: '作者颜色', type: 'color', help: '3D歌词模式下作者的颜色', condition: '3d-lyrics' },
          { key: 'lyric3DArtistFontSize', label: '作者字号', type: 'range', min: 14, max: 40, step: 1, help: '3D歌词模式下作者的字体大小(px)', condition: '3d-lyrics' },
          { type: 'section', label: '━━ 歌词设置 ━━', condition: '3d-lyrics' },
          { key: 'lyric3DLineCount', label: '显示行数(奇数)', type: 'range', min: 1, max: 19, step: 2, help: '3D歌词可见行数，固定为奇数（自动调整）', condition: '3d-lyrics' },
          { key: 'lyric3DCurrentColor', label: '当前行颜色', type: 'color', help: '当前播放句3D文字颜色', condition: '3d-lyrics' },
          { key: 'lyric3DOtherColor', label: '其他行颜色', type: 'color', help: '非当前行3D文字颜色', condition: '3d-lyrics' },
          { key: 'lyric3DFontFamily', label: '歌词字体', type: 'select', options: {
            "'PingFang SC','Noto Sans SC','Microsoft YaHei',Arial,sans-serif": 'PingFang SC (默认)',
            "'Noto Sans SC',sans-serif": 'Noto Sans SC',
            "'Microsoft YaHei',sans-serif": 'Microsoft YaHei',
            "'STSong','Songti SC',serif": '宋体',
            "'STKaiti','Kaiti SC',serif": '楷体',
            "'Inter',sans-serif": 'Inter (英文)'
          }, help: '3D歌词渲染字体', condition: '3d-lyrics' },
          { key: 'lyric3DFontSize', label: '字体大小', type: 'range', min: 60, max: 180, step: 2, help: '当前行3D文字的字号（canvas像素）', condition: '3d-lyrics' },
          { key: 'lyric3DLineSpacing', label: '行间距', type: 'range', min: 0.8, max: 2.5, step: 0.05, help: '3D歌词行与行之间的间距倍数', condition: '3d-lyrics' },
          { key: 'lyric3DHighlightEffect', label: '高亮特效', type: 'select', options: { '无': '无', '发光': '发光', '描边': '描边', '渐变': '渐变' }, help: '当前行3D文字的视觉效果', condition: '3d-lyrics' },
          { type: 'section', label: '━━ 封面粒子 ━━', condition: '3d-lyrics' },
          { key: 'lyric3DPointScale', label: '粒子大小', type: 'range', min: 0.3, max: 2.5, step: 0.05, help: '封面粒子点的大小', condition: '3d-lyrics' },
          { key: 'lyric3DIntensity', label: '律动强度', type: 'range', min: 0.2, max: 2.0, step: 0.05, help: '音频驱动的粒子位移强度', condition: '3d-lyrics' },
          { key: 'lyric3DDepth', label: '深度', type: 'range', min: 0.1, max: 2.5, step: 0.05, help: '粒子Z轴位移幅度', condition: '3d-lyrics' },
          { type: 'section', label: '━━ 星空粒子 ━━', condition: '3d-lyrics' },
          { key: 'lyric3DStarCount', label: '星空数量', type: 'range', min: 100, max: 800, step: 20, help: '背景星空粒子总数', condition: '3d-lyrics' },
          { key: 'lyric3DStarSize', label: '星星大小', type: 'range', min: 0.02, max: 0.20, step: 0.01, help: '单个星星粒子的大小', condition: '3d-lyrics' },
          { key: 'lyric3DStarOpacity', label: '星星不透明度', type: 'range', min: 0.1, max: 1.0, step: 0.05, help: '星星粒子的透明度', condition: '3d-lyrics' },
          { key: 'lyric3DStarSpeed', label: '旋转速度', type: 'range', min: 0, max: 0.01, step: 0.0005, help: '星空绕Y轴旋转的速度', condition: '3d-lyrics' },
          { key: 'lyric3DStarColor', label: '星星颜色', type: 'color', help: '星空粒子的颜色', condition: '3d-lyrics' },
          { key: 'lyric3DStarCanvasSize', label: '星空范围', type: 'range', min: 2.0, max: 14.0, step: 0.5, help: '星空粒子的分布范围', condition: '3d-lyrics' },
        ],
      },
      lyricsTab: {
        title: '🎵 歌词',
        fields: [
          { type: 'section', label: '━━ 右仓歌词 ━━' },
          { key: 'chamberLyricVisibleLines', label: '显示行数', type: 'range', min: 3, max: 24, step: 1, help: '右仓3D歌词可见行数' },
          { key: 'chamberLyricCurrentColor', label: '当前行颜色', type: 'color', help: '当前播放句颜色' },
          { key: 'chamberLyricOtherColor', label: '其他行颜色', type: 'color', help: '非当前行颜色' },
          { key: 'chamberLyricFontSize', label: '字号', type: 'range', min: 30, max: 200, step: 5, help: 'Canvas渲染字号(px)' },
          { key: 'chamberLyricLineSpacing', label: '行间距', type: 'range', min: 0.3, max: 2.5, step: 0.05, help: '行间距倍数，越大越松散' },
          { key: 'chamberLyricEffect', label: '高亮特效', type: 'select', options: { '无': '无', '发光': '发光', '描边': '描边', '渐变': '渐变' }, help: '当前行高亮效果' },
          { key: 'chamberLyricFontFamily', label: '字体', type: 'select', options: { "'PingFang SC','Noto Sans SC','Microsoft YaHei',Arial,sans-serif": 'PingFang SC', "'Noto Sans SC',sans-serif": 'Noto Sans SC', "'Microsoft YaHei',sans-serif": 'Microsoft YaHei', "'STSong','Songti SC',serif": '宋体', "'STKaiti','Kaiti SC',serif": '楷体' }, help: '右仓歌词字体' },
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
          { type: 'section', label: '━━ 背景类型 ━━' },
          { key: 'bgType', label: '类型', type: 'select', options: { 'image_video': '图片/视频', 'foam': '泡沫', 'irregular': '不规则' }, help: '选择背景渲染类型' },

          // --- 图片/视频 背景 ---
          { type: 'section', label: '━━ 背景流体 ━━', condition: 'image_video' },
          { key: 'enableFluidBg', label: '启用流体背景', type: 'toggle', help: '全屏动态水波纹背景', condition: 'image_video' },
          { key: 'bgIntensity', label: '背景强度', type: 'range', min: 0, max: 1, step: 0.05, help: '水波纹明显程度', condition: 'image_video', require: 'enableFluidBg' },
          { key: 'bgSpeed', label: '背景速度', type: 'range', min: 0.1, max: 3, step: 0.1, help: '水波纹流速', condition: 'image_video', require: 'enableFluidBg' },
          { key: 'bgNoiseScale', label: '噪声质量', type: 'range', min: 0.25, max: 1.0, step: 0.05, help: '噪声分辨率，低=省GPU', condition: 'image_video', require: 'enableFluidBg' },
          { type: 'section', label: '━━ 背景图片/视频 ━━', condition: 'image_video' },
          { key: 'wallpaperOpacity', label: '背景透明度', type: 'range', min: 0, max: 1, step: 0.05, help: '背景的显示透明度', condition: 'image_video' },
          { key: 'wallpaperRippleSpeed', label: '水波纹速度', type: 'range', min: 0.2, max: 2, step: 0.1, help: '背景上叠加的水波纹速度', condition: 'image_video' },
          { key: 'wallpaperBlur', label: '背景模糊', type: 'range', min: 0, max: 40, step: 1, help: '背景图片/视频的高斯模糊程度（像素）。0=清晰原图', condition: 'image_video' },

          // --- 泡沫 特效 ---
          { type: 'section', label: '━━ 泡沫参数 ━━', condition: 'foam' },
          { key: 'foamTheme', label: '泡沫主题', type: 'select', options: {
            'foam_bubble': '泡沫气泡', 'nocturnal': '暗夜', 'neon_tokyo': '霓虹东京',
            'cyber_forest': '赛博森林', 'minimal_mono': '极简黑白', 'ink_wash': '水墨',
            'royal': '皇家', 'ocean_reef': '海洋珊瑚', 'aurora': '极光'
          }, help: '泡沫配色主题', condition: 'foam' },
          { key: 'foamHeightScale', label: '高度缩放', type: 'range', min: 0.1, max: 3.0, step: 0.05, help: '地形起伏高度', condition: 'foam' },
          { key: 'foamBandGain', label: '频段增益', type: 'range', min: 0.0, max: 3.0, step: 0.05, help: '音频频段响应强度', condition: 'foam' },

          // --- 不规则 特效 ---
          { type: 'section', label: '━━ 不规则参数 ━━', condition: 'irregular' },
          { key: 'irregularTheme', label: '不规则主题', type: 'select', options: {
            'foam_bubble': '泡沫气泡', 'nocturnal': '暗夜', 'neon_tokyo': '霓虹东京',
            'cyber_forest': '赛博森林', 'minimal_mono': '极简黑白', 'ink_wash': '水墨',
            'royal': '皇家', 'ocean_reef': '海洋珊瑚', 'aurora': '极光'
          }, help: '不规则配色主题', condition: 'irregular' },
          { key: 'irregularHeightScale', label: '高度缩放', type: 'range', min: 0.1, max: 3.0, step: 0.05, help: '地形起伏高度', condition: 'irregular' },
          { key: 'irregularBandGain', label: '频段增益', type: 'range', min: 0.0, max: 3.0, step: 0.05, help: '音频频段响应强度', condition: 'irregular' },
        ],
      },
      system: {
        title: '⚙️ 系统',
        fields: [
          { type: 'section', label: '━━ 字体 ━━' },
          { key: 'globalFontFamily', label: '全局字体', type: 'select', options: { 'inherit': '系统默认', 'PingFang SC': '苹方', 'SF Pro Text': 'SF Pro', 'Helvetica Neue': 'Helvetica', 'Microsoft YaHei': '微软雅黑' }, help: '除歌词外的全局字体' },
        ],
      },
      chamber: {
        title: '🫧 悬浮仓',
        fields: [
          { type: 'section', label: '━━ 仓体外观 ━━' },
          { key: 'chamberOpacity', label: '仓透明度', type: 'range', min: 0.05, max: 0.5, step: 0.01, help: '四个悬浮仓的背景透明度' },
          { type: 'section', label: '━━ 上仓（队列+收藏）━━' },
          { key: 'chamberTopPinned', label: '上仓常驻', type: 'toggle', help: '默认保持可见，关闭后hover触发' },
          { key: 'queueDockMag', label: 'Dock特效', type: 'toggle', help: '队列中鼠标靠近时封面放大+旋转（macOS Dock风格）' },
          { type: 'section', label: '━━ 下仓（播放控制）━━' },
          { key: 'chamberBottomPinned', label: '下仓常驻', type: 'toggle', help: '底部控制器默认保持可见' },
          { type: 'section', label: '━━ 左仓（歌单列表）━━' },
          { key: 'chamberLeftPinned', label: '左仓常驻', type: 'toggle', help: '歌单列表仓默认保持可见，而非hover触发' },
          { type: 'section', label: '━━ 右仓（歌词）━━' },
          { key: 'chamberRightPinned', label: '右仓常驻', type: 'toggle', help: '歌词仓默认保持可见' },
          { type: 'section', label: '━━ 控制器 ━━' },
          { key: 'controllerOrder', label: '按钮排序', type: 'select', options: {
            'like,volume,prev,play,next,playmode': '默认布局',
            'prev,play,next,like,playmode,volume': '经典布局',
            'like,prev,play,next,playmode,volume': '简洁布局',
            'volume,like,prev,play,next,playmode': '音量前置',
          }, help: '控制器按钮从左到右的排列顺序' },
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

  function saveSettings(immediate) {
    if (_saveTimeout) clearTimeout(_saveTimeout);
    if (immediate) {
      try {
        localStorage.setItem('fluidmusic-settings', JSON.stringify(DIYSettings.settings));
      } catch (e) { /* ignore */ }
      return;
    }
    _saveTimeout = setTimeout(() => {
      try {
        localStorage.setItem('fluidmusic-settings', JSON.stringify(DIYSettings.settings));
      } catch (e) { /* ignore */ }
    }, 300);
  }

  let _saveTimeout = null;

  // Flush pending settings save on page unload
  window.addEventListener('beforeunload', () => saveSettings(true));

  function applySettings() {
    const s = DIYSettings.settings;
    // ── Visual effect toggles ──
    // ── Input validation: clamp values to safe ranges ──
    if (typeof s.bgIntensity === 'number') s.bgIntensity = Math.max(0, Math.min(1, s.bgIntensity));
    if (typeof s.bgSpeed === 'number') s.bgSpeed = Math.max(0.1, Math.min(3, s.bgSpeed));
    if (typeof s.bgNoiseScale === 'number') s.bgNoiseScale = Math.max(0.25, Math.min(1, s.bgNoiseScale));
    if (typeof s.volume === 'number') s.volume = Math.max(0, Math.min(1, s.volume));
    if (typeof s.wallpaperOpacity === 'number') s.wallpaperOpacity = Math.max(0, Math.min(1, s.wallpaperOpacity));
    if (typeof s.wallpaperBlur === 'number') s.wallpaperBlur = Math.max(0, Math.min(40, s.wallpaperBlur));
    if (typeof s.chamberOpacity === 'number') s.chamberOpacity = Math.max(0.05, Math.min(0.5, s.chamberOpacity));
    if (typeof s.chamberTransparency === 'number') s.chamberTransparency = Math.max(0, Math.min(1, s.chamberTransparency));
    if (typeof s.foamHeightScale === 'number') s.foamHeightScale = Math.max(0.1, Math.min(3, s.foamHeightScale));
    if (typeof s.foamBandGain === 'number') s.foamBandGain = Math.max(0, Math.min(3, s.foamBandGain));
    if (typeof s.irregularHeightScale === 'number') s.irregularHeightScale = Math.max(0.1, Math.min(3, s.irregularHeightScale));
    if (typeof s.irregularBandGain === 'number') s.irregularBandGain = Math.max(0, Math.min(3, s.irregularBandGain));
    if (typeof s.rainDropIntensity === 'number') s.rainDropIntensity = Math.max(0.1, Math.min(3, s.rainDropIntensity));
    if (typeof s.rainDropMaxSize === 'number') s.rainDropMaxSize = Math.max(60, Math.min(400, s.rainDropMaxSize));
    if (typeof s.lyric3DPointScale === 'number') s.lyric3DPointScale = Math.max(0.5, Math.min(5, s.lyric3DPointScale));
    if (typeof s.lyric3DIntensity === 'number') s.lyric3DIntensity = Math.max(0.5, Math.min(5, s.lyric3DIntensity));
    if (typeof s.lyric3DDepth === 'number') s.lyric3DDepth = Math.max(0.5, Math.min(5, s.lyric3DDepth));
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
    // ── Display mode (3D lyrics vs default) ──
    if (s.displayMode) {
      const is3D = (s.displayMode === '3d-lyrics');
      if (window._fluidVisualEnabled && window._fluidVisualEnabled.threeDLyrics !== is3D) {
        window._fluidVisualEnabled.threeDLyrics = is3D;
        visChanged = true;
        if (typeof window._fluidVisualSave === 'function') {
          window._fluidVisualSave();
        }
      }
      // Activate/deactivate 3D lyrics scene and sync center core
      if (typeof ThreeDLyricsScene !== 'undefined' && ThreeDLyricsScene.setActive) {
        ThreeDLyricsScene.setActive(is3D);
      }
      if (typeof window._fluidSyncCenterCore === 'function') {
        window._fluidSyncCenterCore();
      }
      // Sync cover fallback visibility based on display mode
      if (typeof window._fluidSyncCoverFallback === 'function') {
        window._fluidSyncCoverFallback();
      }
    }
    // ── 3D Lyrics scene parameters ──
    if (typeof ThreeDLyricsScene !== 'undefined' && ThreeDLyricsScene.initialized) {
      var lyric3DKeys = [
        'lyric3DLineCount','lyric3DCurrentColor','lyric3DOtherColor','lyric3DFontFamily',
        'lyric3DFontSize','lyric3DLineSpacing','lyric3DHighlightEffect',
        'lyric3DPointScale','lyric3DIntensity','lyric3DDepth',
        'lyric3DStarCount','lyric3DStarSize','lyric3DStarOpacity',
        'lyric3DStarSpeed','lyric3DStarColor','lyric3DStarCanvasSize',
        'lyric3DTitleColor','lyric3DTitleFontSize','lyric3DArtistColor','lyric3DArtistFontSize'
      ];
      var configMap = {
        lyric3DLineCount: 'lineCount', lyric3DCurrentColor: 'currentColor', lyric3DOtherColor: 'otherColor',
        lyric3DFontFamily: 'fontFamily', lyric3DFontSize: 'fontSize', lyric3DLineSpacing: 'lineSpacing',
        lyric3DHighlightEffect: 'highlightEffect', lyric3DPointScale: 'pointScale',
        lyric3DIntensity: 'intensity', lyric3DDepth: 'depth', lyric3DStarCount: 'starCount',
        lyric3DStarSize: 'starSize', lyric3DStarOpacity: 'starOpacity', lyric3DStarSpeed: 'starSpeed',
        lyric3DStarColor: 'starColor', lyric3DStarCanvasSize: 'starCanvasSize',
        lyric3DTitleColor: 'titleColor', lyric3DTitleFontSize: 'titleFontSize',
        lyric3DArtistColor: 'artistColor', lyric3DArtistFontSize: 'artistFontSize'
      };
      lyric3DKeys.forEach(function(key) {
        if (s[key] !== undefined) {
          ThreeDLyricsScene.updateConfig(configMap[key], s[key]);
        }
      });
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
    // lyricsVisibleLines controls 3D chamber visible line count — does NOT clamp container height
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
    // Chamber themes
    if (s.chamberLeftTheme != null) {
      document.documentElement.style.setProperty('--chamber-left-theme', s.chamberLeftTheme);
    }
    if (s.chamberRightTheme != null) {
      document.documentElement.style.setProperty('--chamber-right-theme', s.chamberRightTheme);
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
    // ── Rain drop audio ripples ──
    if (typeof s.rainDrop === 'boolean') {
      if (window._rainDropSetEnabled) {
        window._rainDropSetEnabled(s.rainDrop);
      }
    }
    if (s.rainDropIntensity != null) {
      if (window._rainDropSetIntensity) window._rainDropSetIntensity(s.rainDropIntensity);
      document.documentElement.style.setProperty('--raindrop-intensity', s.rainDropIntensity);
    }
    if (s.rainDropMaxSize != null) {
      if (window._rainDropSetMaxSize) window._rainDropSetMaxSize(s.rainDropMaxSize);
      document.documentElement.style.setProperty('--raindrop-max-size', s.rainDropMaxSize + 'px');
    }
    if (typeof s.rainDropColorful === 'boolean') {
      if (window._rainDropSetColorful) window._rainDropSetColorful(s.rainDropColorful);
      document.documentElement.style.setProperty('--raindrop-colorful', s.rainDropColorful ? '1' : '0');
    }
    if (s.lyricsFontFamily && s.lyricsFontFamily !== 'inherit') {
      document.documentElement.style.setProperty('--lyric-font-family', s.lyricsFontFamily);
      document.querySelectorAll('.lyric-line').forEach(function(l) { l.style.fontFamily = s.lyricsFontFamily; });
    } else if (s.lyricsFontFamily === 'inherit') {
      document.documentElement.style.setProperty('--lyric-font-family', 'inherit');
      document.querySelectorAll('.lyric-line').forEach(function(l) { l.style.fontFamily = ''; });
    }

    // ── Foam/Irregular Background (now uses shared RendererManager context) ──
    if (typeof FoamBG !== 'undefined') {
      if (s.bgType === 'foam' || s.bgType === 'irregular') {
        // Foam renders on shared bg-canvas via RendererManager — keep canvas visible
        const lbg = document.getElementById('layer-bg');
        if (lbg) {
          lbg.classList.remove('fluid-active');
          const cvs = lbg.querySelector('canvas');
          if (cvs) cvs.style.opacity = '1';
        }
        // Hide fluid-bg shader layer (foam replaces it visually)
        if (typeof RendererManager !== 'undefined') RendererManager.setLayerVisible('bg', false);
        if (!FoamBG.isActive) FoamBG.init();
        FoamBG.setMode(s.bgType);
        if (s.bgType === 'foam') {
          if (s.foamTheme) FoamBG.setTheme(s.foamTheme);
          FoamBG.setParams({ heightScale: s.foamHeightScale != null ? s.foamHeightScale : 1.0, bandGain: s.foamBandGain != null ? s.foamBandGain : 1.0 });
        } else {
          if (s.irregularTheme) FoamBG.setTheme(s.irregularTheme);
          FoamBG.setParams({ heightScale: s.irregularHeightScale != null ? s.irregularHeightScale : 1.0, bandGain: s.irregularBandGain != null ? s.irregularBandGain : 1.0 });
        }
      } else {
        if (FoamBG.isActive) FoamBG.destroy();
        // Restore fluid-bg WebGL layer visibility
        if (typeof RendererManager !== 'undefined') RendererManager.setLayerVisible('bg', s.enableFluidBg !== false);
        // Restore default canvas opacity and fluid-active class
        // Skip opacity override in 3D lyrics mode — canvas must stay fully visible for the 3D scene
        const lbg2 = document.getElementById('layer-bg');
        if (lbg2) {
          const cvs2 = lbg2.querySelector('canvas');
          const is3DMode = !!(window._fluidVisualEnabled && window._fluidVisualEnabled.threeDLyrics);
          if (!is3DMode) {
            if (cvs2) cvs2.style.opacity = '';
            if (s.enableFluidBg) lbg2.classList.add('fluid-active');
          } else {
            // 3D lyrics mode — keep canvas at full opacity
            if (cvs2) cvs2.style.opacity = '1';
          }
        }
      }
    }
  }

  // Default settings snapshot for reset
  const DEFAULT_SETTINGS = {
    enableParticleCover: true, enableFluidBg: false,
    lyricsLines: 0, lyricsFontSize: 13, lyricsColor: '#f0c060', lyricsHighlightColor: '#f0c060', lyricsFadeStrength: 0.5,
    lyricsVisibleLines: 12, lyricsEffect: 'none', inlineLyricColor: '#f0c060', inlineLyricFontSize: 15,
    chamberLyricCurrentColor: '#ffd700', chamberLyricOtherColor: '#cccccc',
    chamberLyricVisibleLines: 12, chamberLyricFontSize: 90,
    chamberLyricLineSpacing: 1.0, chamberLyricEffect: '无',
    chamberLyricFontFamily: "'PingFang SC','Noto Sans SC','Microsoft YaHei',Arial,sans-serif",
    lyric3DTitleColor: '#ffd700', lyric3DTitleFontSize: 52,
    lyric3DArtistColor: '#c0c0c0', lyric3DArtistFontSize: 24,
    playlistStyle: 'default', playlistFontSize: 13, playlistTransparency: 0.15, playMode: 'sequential', playlistTextColor: '#e0d8c0',
    activeLyricFontSize: 18, inlineLyricMode: 'auto',
    controllerParticleDensity: 0.6, controllerSandStrength: 0.5, controllerStyle: 'default',
    bgIntensity: 0.8, bgSpeed: 1.0, bgColorScheme: 'dark', bgNoiseScale: 0.5,
    volume: 0.7, chamberTransparency: 0.15, chamberTriggerSensitivity: 0.5,
    chamberLeftPinned: false, chamberRightPinned: false, chamberTopPinned: false, chamberBottomPinned: true,
    chamberLeftTheme: 'default', chamberRightTheme: 'default', queueDockMag: true,
    accountMultiLogin: true, language: 'zh-CN', wallpaperOpacity: 0.3, wallpaperRippleSpeed: 1.0, wallpaperBlur: 20,
    clickRipple: false, clickRippleSize: 120, clickRippleSpeed: 0.8,
    rainDrop: true, rainDropIntensity: 1.0, rainDropMaxSize: 200, rainDropColorful: true,
    textRipple: false, textRippleIntensity: 0.3, progressColor: '#f0c060', progressHeight: 4,
    progressRipple: false, progressRippleIntensity: 0.5, timeColor: '#f0c060', timeFontSize: 10,
    songTitleColor: '#f0c060', songTitleFontSize: 24, songArtistColor: '#e0b050', songArtistFontSize: 15,
    uiFontSize: 13, uiAccentColor: '#f0c060', uiFontWeight: 500,
    globalFontFamily: 'inherit', lyricsFontFamily: 'inherit',
    chamberOpacity: 0.12, controllerOrder: 'like,volume,prev,play,next,playmode',
    displayMode: 'default',
    bgType: 'image_video', foamTheme: 'foam_bubble', foamHeightScale: 1.0, foamBandGain: 1.0,
    irregularTheme: 'foam_bubble', irregularHeightScale: 1.0, irregularBandGain: 1.0,
    lyric3DLineCount: 5, lyric3DCurrentColor: '#ffd700', lyric3DOtherColor: '#cccccc',
    lyric3DFontFamily: "'PingFang SC','Noto Sans SC','Microsoft YaHei',Arial,sans-serif",
    lyric3DFontSize: 120, lyric3DLineSpacing: 1.2, lyric3DHighlightEffect: '无',
    lyric3DPointScale: 1.6, lyric3DIntensity: 1.8, lyric3DDepth: 1.6,
    lyric3DStarCount: 800, lyric3DStarSize: 0.07, lyric3DStarOpacity: 1.0,
    lyric3DStarSpeed: 0.0025, lyric3DStarColor: '#88ccff', lyric3DStarCanvasSize: 12.0,
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
