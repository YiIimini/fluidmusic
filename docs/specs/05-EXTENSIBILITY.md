# 05 — 扩展设计 (Extensibility)

> 插件系统 · 主题引擎 · 可视化预设 API · 平台适配器

---

## 1. 现状分析

| 项目 | 状态 | 说明 |
|------|:---:|------|
| 模块系统 | ⚠️ | `module-registry.js` DI容器已创建，仅部分使用 |
| 可视化扩展 | ❌ | 5种 FoamEqualizer 预设硬编码在 `foam-equalizer.js` 中 |
| 主题系统 | ❌ | 颜色硬编码在 CSS 变量中，无导入导出 |
| 平台扩展 | ⚠️ | 网易+QQ 已实现，Kugou 已移除。架构上扩展新平台需改多处 |
| 插件系统 | ❌ | 完全不存在 |

---

## 2. 目标状态

### 2.1 可视化预设 API

定义标准接口，允许注册新的视觉效果预设：

```ts
// src/types/visualizer.ts
interface VisualizerPreset {
  id: string;
  name: string;                    // 显示名称
  description: string;             // 简介
  type: 'webgl' | 'canvas2d';     // 渲染类型
  init(canvas: HTMLCanvasElement): void;
  tick(dt: number, bands: AudioBands): void;
  render(): void;
  dispose(): void;
  settings?: PresetSetting[];      // 可配置参数
}

interface PresetSetting {
  key: string;
  label: string;
  type: 'slider' | 'color' | 'select' | 'toggle';
  default: any;
  min?: number;
  max?: number;
  options?: { label: string; value: any }[];
}

// 注册预设
VisualizerRegistry.register(VisualizerPreset);

// 获取已注册预设列表
VisualizerRegistry.list(): VisualizerPreset[];

// 激活预设
VisualizerRegistry.activate(presetId: string);
```

**内置预设清单**（FoamEqualizer → 抽象为通用可视化层）：
1. `thermal` — 热力图粒子
2. `pearl-iridescence` — 珍珠虹彩
3. `deep-sea-bubbles` — 深海气泡
4. `stardust-vortex` — 星尘漩涡
5. `aurora-fluid` — 极光流体
6. *(新增)* `minimal-bars` — 极简柱状
7. *(新增)* `waveform` — 波形图

### 2.2 主题引擎

```ts
// src/types/theme.ts
interface Theme {
  name: string;
  version: 1;
  colors: {
    bgBase: string;           // 背景基色
    bgFluid: string;          // 流体主色
    bgFluidAccent: string;    // 流体辅色
    textPrimary: string;      // 主文字
    textSecondary: string;    // 次文字
    accent: string;           // 强调色
    glassBg: string;          // 玻璃背景
    glassBorder: string;      // 玻璃边框
  };
  glass: {
    blur: number;             // 模糊强度 (px)
    opacity: number;          // 基础不透明度 (0-1)
    borderRadius: number;     // 圆角 (px)
  };
  animation: {
    springExpand: string;     // 展开贝塞尔
    springCollapse: string;   // 收起贝塞尔
    duration: number;         // 基础时长 (ms)
  };
  foam: {
    paletteId: number;        // 泡沫配色方案 (0-5)
    iridescence: number;      // 虹彩强度 (0-1)
  };
}

// 主题存储
ThemeManager.import(json: string): Theme;
ThemeManager.export(theme: Theme): string;  // → JSON 文件
ThemeManager.apply(theme: Theme): void;     // 应用到 CSS 变量
ThemeManager.getBuiltIn(): Theme[];         // 内置预设主题
```

**内置主题预设**：
- `默认深色` — 当前深色基底
- `清澈浅色` — 浅色模式变体
- `极简黑白` — 去色版本
- `霓虹暗夜` — 高饱和赛博风

### 2.3 平台适配器接口

```ts
// src/types/platform.ts
interface MusicPlatform {
  id: string;                          // 'netease' | 'qq' | 'kugou' | ...
  name: string;                        // 显示名称
  icon: string;                        // 图标 CSS class
  color: string;                       // 品牌色

  // 认证
  login(): Promise<UserProfile>;
  logout(): Promise<void>;
  getLoginStatus(): Promise<LoginState | null>;

  // 数据
  search(query: string, limit?: number, offset?: number): Promise<SearchResult>;
  getPlaylistDetail(id: string): Promise<Playlist>;
  getUserPlaylists(): Promise<Playlist[]>;
  getSongDetail(ids: string[]): Promise<Track[]>;
  getStreamUrl(id: string): Promise<string>;
  getLyrics(id: string): Promise<LyricData>;
}

// 注册新平台
PlatformRegistry.register(platform: MusicPlatform): void;
```

### 2.4 插件系统（长期目标 — Phase 5+）

```
插件类型:
├── visualizer-plugin  — 自定义可视化效果
├── theme-plugin       — 自定义主题
├── platform-plugin    — 新音乐平台
└── extension-plugin   — 通用扩展（如 Discord RPC）

插件打包: .fluidmusic-plugin 目录
  ├── manifest.json    — 名称/版本/类型/权限
  ├── index.js         — 入口
  └── assets/          — 资源
```

> **注意**：插件系统为 Phase 5+ 的长期目标，v0.3.0 版本仅实现可视化预设 API 和主题引擎，平台适配器接口作为内部重构使用。

---

## 3. 改造步骤

### Step 1: 可视化预设 API (Phase 5)
- 定义 `VisualizerPreset` 接口
- 将 `FoamEqualizer` 5 个预设改造为实现该接口
- 实现 `VisualizerRegistry`

### Step 2: 主题引擎 (Phase 5)
- 定义 `Theme` 类型
- 实现 `ThemeManager`（导入/导出/应用）
- CSS 变量系统对接 `ThemeManager.apply()`

### Step 3: 平台适配器 (Phase 4)
- 定义 `MusicPlatform` 接口
- 将网易和 QQ 的 api-bridge 代码重构为实现该接口
- `PlatformRegistry` 管理已注册平台

### Step 4: 插件系统框架 (Phase 6 / v0.4.0+)
- `manifest.json` 解析
- 隔离 context 中的插件加载
- 权限模型

---

## 4. 验收标准

- [ ] 新增可视化预设只需实现 `VisualizerPreset` 接口并注册
- [ ] 主题可导出为 `.json` 文件并重新导入
- [ ] 添加新音乐平台只需实现 `MusicPlatform` 接口
- [ ] `VisualizerRegistry.list()` 返回所有已注册预设
- [ ] 切换预设/主题无需刷新页面
