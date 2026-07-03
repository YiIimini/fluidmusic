# 07 — 实用性设计 (Usability)

> 交互规范 · 无障碍 · 桌面歌词 · 迷你播放器 · Now Playing

---

## 1. 现状分析

### 1.1 已实现

| 功能 | 状态 | 说明 |
|------|:---:|------|
| 边缘触发热区 | ✅ | 4个Chamber hover触发 |
| 弹簧动画 | ✅ | CSS自定义贝塞尔 |
| 键盘快捷键 | ✅ | Space/Cmd+Arrow/上下/F |
| Toast 通知 | ✅ | `showToast()` 函数 |
| 睡眠定时器 | ✅ | 15/30/45/60分钟 |
| macOS 红绿灯按钮 | ✅ | 自定义CSS替代原生 |

### 1.2 缺失

| 功能 | PRD引用 | 严重度 |
|------|---------|:---:|
| 桌面歌词独立窗口 | PRD §2.4, §6.3 | 🟡 |
| 迷你播放器模式 | PRD §6.2 | 🟡 |
| Now Playing (控制中心) | — | 🟡 |
| ARIA 无障碍 | — | 🟡 |
| 键盘焦点环 (Tab导航) | — | 🟢 |
| 通知中心集成 | — | 🟢 |

---

## 2. 目标状态

### 2.1 桌面歌词窗口

```ts
// desktop/lyric-window.ts（新建）
// 独立的 frameless, transparent BrowserWindow
interface LyricWindowConfig {
  width: number;         // 默认 800
  height: number;        // 默认 120
  fontSize: number;      // 默认 24px
  alwaysOnTop: boolean;  // 默认 true
  position: { x: number; y: number };
}

// 特性:
// · 独立窗口，可拖拽移动
// · 底部边缘可拖拽调整高度
// · frameless + transparent 背景
// · 双行显示（当前行 + 下一行）
// · CSS mask-image 淡化
// · 右键菜单: 切换置顶/调整字号/关闭
```

### 2.2 迷你播放器

```ts
// 切换方式: Cmd+Shift+M 或 菜单栏 → 窗口 → 迷你播放器
// 迷你窗口: 300x300, frameless, 始终置顶

// 内容:
// · 粒子封面（缩小版）
// · 歌曲名+作者（单行滚动）
// · 播放/暂停/下一曲 三个按钮
// · 进度环（圆形进度条）
// · 拖拽移动窗口
```

### 2.3 Now Playing 集成

```ts
// 使用 Web 标准 Media Session API
// 在渲染进程中，每次曲目切换时更新:

function updateNowPlaying(track: Track): void {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.name,
    artist: track.artist,
    album: track.album || '',
    artwork: track.coverUrl
      ? [{ src: track.coverUrl, sizes: '300x300', type: 'image/jpeg' }]
      : [],
  });

  // 控制中心操作回调
  navigator.mediaSession.setActionHandler('play', () => audioEngine.play());
  navigator.mediaSession.setActionHandler('pause', () => audioEngine.pause());
  navigator.mediaSession.setActionHandler('previoustrack', () => playPrevious());
  navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
}
```

### 2.4 完整键盘体系

```
全局快捷键:
  Space           播放/暂停
  Cmd+Left        上一曲
  Cmd+Right       下一曲
  Cmd+Up          音量+
  Cmd+Down        音量-
  Cmd+K           搜索
  Cmd+,           DIY设置
  Cmd+Shift+M     迷你播放器
  Cmd+Shift+L     桌面歌词
  F / Cmd+Ctrl+F  全屏
  Escape          关闭弹窗/退出全屏

Tab 焦点环:
  Tab             下一个可聚焦元素
  Shift+Tab       上一个可聚焦元素
  Enter/Space     激活
  ← → ↑ ↓        滑块/列表导航
```

### 2.5 无障碍 (A11y)

| 措施 | 说明 |
|------|------|
| ARIA 标签 | 所有按钮 `aria-label`，图标按钮 `aria-hidden` |
| 语义 HTML | `<button>` 不用 `<div onclick>`，`<nav>` 包裹导航 |
| 焦点管理 | 弹窗打开时焦点移入，关闭时焦点恢复 |
| 对比度 | 默认主题满足 WCAG AA (4.5:1) |
| 屏幕阅读器 | `aria-live` 区域播报切歌、播放状态变化 |
| 键盘可见 | `:focus-visible` 焦点环明确可见 |

### 2.6 Toast 通知系统

```ts
// 统一通知接口
interface ToastOptions {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;    // 默认 3000ms
  action?: {
    label: string;
    onClick: () => void;
  };
}

function showToast(opts: ToastOptions): void;
```

---

## 3. 改造步骤

### Step 1: Media Session API (Phase 4)
- 在 `playTrack()` 中调用 `updateNowPlaying()`
- 5 个 action handler

### Step 2: 桌面歌词窗口 (Phase 4)
- 新建 `desktop/lyric-window.ts`
- 新建 `public/lyric.html`（独立窗口HTML）
- `main.js` 中管理窗口生命周期

### Step 3: 迷你播放器 (Phase 4)
- 新建 `public/mini-player.html`
- `main.js` 中切换逻辑
- 双向状态同步（迷你↔主窗口）

### Step 4: 键盘体系完善 (Phase 5)
- 全局快捷键注册表
- Tab 焦点环 CSS + JS
- Focus trap 在弹窗中

### Step 5: 无障碍 (Phase 5)
- 逐组件添加 ARIA 标签
- 语义化 HTML 审查
- 屏幕阅读器测试

---

## 4. 验收标准

- [ ] 桌面歌词窗口独立显示，可拖拽、调大小、置顶
- [ ] Cmd+Shift+M 切换迷你播放器
- [ ] macOS 控制中心显示当前播放歌曲（封面+歌名+歌手）
- [ ] 键盘可完成所有主要操作（不依赖鼠标）
- [ ] Tab 焦点环在所有交互元素上可见
- [ ] VoiceOver 可正确朗读当前播放状态
- [ ] Toast 通知统一风格，带图标和操作按钮
- [ ] 弹窗打开/关闭时焦点正确管理
