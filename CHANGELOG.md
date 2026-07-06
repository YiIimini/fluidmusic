# Changelog

## v1.1.1 (2026-07-06)

### 修复
- **窗口不显示**: electron-updater 在 devDependencies → 打包后 ASAR 缺模块 → main.js 加载崩溃 → 仅 Dock 图标无窗口。修复: 移入 dependencies + require 容错降级
- **窗口显示安全网**: ready-to-show 超时兜底(6s) + did-finish-load/did-fail-load 次级保险
- **打包版 DevTools**: openDevTools 仅 app.isPackaged=false 时打开
- **Vite 构建**: layout.css 多余括号 + index.html aria-label 语法错误

### 新增
- **音频响应粒子**: Canvas 100粒子随音乐跳动(bass跳/mid摆)，无音乐渐隐，弹簧物理回弹
- **粒子封面播放联动**: ParticleCover 随 FluidAudio.playing 平滑溶解/成型


## v1.1.0 (2026-07-03)

### 新增
- 全色相音频涟漪特效（Bass/Mid/Treble频谱驱动，全屏随机位置）
- 雨滴撞击中心亮点效果
- 鼠标点击涟漪 + 悬停涟漪
- 涟漪大小/速度自定义
- 进度条水波纹 + 文字水波纹
- 粒子封面 Mineradio-MacOS 风格重构
- 7 Tab DIY设置面板（粒子/特效/歌单/歌词/背景/系统）
- 三段式布局 + 调色盘 + ?帮助系统
- 四仓统一透明度控制
- 歌词独立字体 + 当前歌词独立字号
- 行内歌词显示模式（自动/始终）
- 按钮排序自定义 + UI字号/颜色自定义
- 全部播放 + 实时歌曲搜索（sticky固定）
- 队列边缘滑动 + 悬停暂停
- 歌词居中滚动
- Toast提示移至顶部
- macOS红绿灯X退出→Dock重启

### 移除
- 泡沫特效系统
- 均衡器可视化
- 3D频谱环

### 优化
- BubbleChamber拆分为5子模块
- TS EventBus + DataCache桥接运行时
- GPU自适应帧率 + 噪声降采样 + RenderTarget复用
- 左右仓统一高度 + 滚动条左侧显示

## v1.0.0 (2026-07-03)

### 新增
- TypeScript核心层（types/core/renderer/platform 25模块）
- EventBus + AppStore 集中状态管理
- IndexedDB DataCache
- 桌面歌词窗口 + 迷你播放器
- Media Session API (Now Playing)
- 视频背景支持
- 9节DIY设置面板
- QQ/网易 cookie session持久化
- 自动切歌 + 播放模式同步

### 优化
- 125单元测试
- Vite构建
- ESLint配置
- GPU优化

## v0.1.0 (2026-06-29)

- 初始版本
- Electron桌面框架
- Three.js流体背景 + 粒子封面
- 网易云 + QQ音乐API代理
- 气泡仓UI系统
