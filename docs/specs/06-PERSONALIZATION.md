# 06 — 个性化设计 (Personalization)

> DIY 设置体系 · 预设系统 · 配置持久化 · 配置迁移

---

## 1. 现状分析

### 1.1 当前 DIY 设置

仅 2 个 Tab（`diy-settings.js`，464行）：

| Tab | 内容 |
|-----|------|
| 视觉 | 粒子分辨率、散落强度、灵敏度、旋转速度、颜色；泡沫数量/大小/虹彩/浮沉幅度/配色；歌词字号/颜色/高亮/淡化；歌单样式/字号/透明度；均衡器预设；背景强度/速度/配色；壁纸/透明度；语言 |
| 系统 | Last.fm 凭证、播放音质、缓存管理 |

### 1.2 问题

| 问题 | 严重度 |
|------|:---:|
| PRD 定义 9 个 Tab，实现仅 2 个 | 🔴 |
| 视觉 Tab 内容过于拥挤（混合了 7 个子系统的设置） | 🟡 |
| 无预设系统 —— 用户只能逐项调整 | 🟡 |
| 无配置导入导出 | 🟢 |
| 设置变更无预览，需关闭弹窗才看到效果 | 🟡 |

---

## 2. 目标状态

### 2.1 完整 9 Tab DIY 体系

```ts
// src/types/settings.ts
interface DIYSettings {
  particle: ParticleSettings;
  foam: FoamSettings;
  lyrics: LyricsSettings;
  playlist: PlaylistSettings;
  spectrum: SpectrumSettings;
  controller: ControllerSettings;
  fluidBg: FluidBgSettings;
  chambers: ChamberSettings;
  system: SystemSettings;
}
```

**Tab 1: 粒子封面**
| 配置项 | 类型 | 范围 | 默认 |
|--------|------|------|------|
| 分辨率 | slider | 60-200 | 118 |
| 散落强度 | slider | 0-1 | 0.7 |
| 律动灵敏度 | slider | 0-1 | 0.8 |
| 旋转速度 | slider | 0-2 | 1.0 |
| 配色方案 | select | 暖色/冷色/原色/自定义 | 原色 |
| 粒子大小 | slider | 1-4px | 2px |

**Tab 2: 泡沫特效**
| 配置项 | 类型 | 范围 | 默认 |
|--------|------|------|------|
| 泡沫数量 | slider | 20-150 | 80 |
| 泡沫大小 | slider | 0.5-3 | 1.5 |
| 虹彩强度 | slider | 0-1 | 0.6 |
| 浮沉幅度 | slider | 0-1 | 0.7 |
| 配色方案 | select | 珍珠白/虹彩/粉蓝/薄荷/薰衣草/蜜桃 | 珍珠白 |

**Tab 3: 歌词设置**
| 配置项 | 类型 | 范围 | 默认 |
|--------|------|------|------|
| 显示行数 | slider | 0-40 | 全部 |
| 字体大小 | slider | 12-24px | 16px |
| 主文字颜色 | color | — | #ffffff |
| 高亮颜色 | color | — | 平台色 |
| 淡化强度 | slider | 0-1 | 0.5 |

**Tab 4: 歌单设置**
| 配置项 | 类型 | 范围 | 默认 |
|--------|------|------|------|
| 列表样式 | select | 紧凑/标准/舒适 | 标准 |
| 字体大小 | slider | 12-18px | 14px |
| 透明度 | slider | 0.05-0.3 | 0.12 |

**Tab 5: 频谱设置**
| 配置项 | 类型 | 范围 | 默认 |
|--------|------|------|------|
| 可视化预设 | select | 热力图/珍珠虹彩/深海/星尘/极光/极简柱状/波形 | 热力图 |
| 粒子密度 | slider | 0.3-2 | 1.0 |
| 速度 | slider | 0.5-2 | 1.0 |
| 颜色强度 | slider | 0.5-1.5 | 1.0 |

**Tab 6: 控制器**
| 配置项 | 类型 | 范围 | 默认 |
|--------|------|------|------|
| 控制器样式 | select | 默认/极简/大按钮 | 默认 |
| 按钮大小 | slider | 0.8-1.5 | 1.0 |

**Tab 7: 背景流体**
| 配置项 | 类型 | 范围 | 默认 |
|--------|------|------|------|
| 水波纹强度 | slider | 0-1 | 0.8 |
| 流体速度 | slider | 0.5-2 | 1.0 |
| 配色方案 | select | 深蓝/暗紫/墨绿/暖橙/自定义 | 深蓝 |
| 壁纸 | image | — | 无 |

**Tab 8: 气泡仓**
| 配置项 | 类型 | 范围 | 默认 |
|--------|------|------|------|
| 透明度 | slider | 0.05-0.3 | 0.12 |
| 触发灵敏度 | slider | 0-1 | 0.5 |
| 左侧默认 | toggle | 常驻/隐藏 | 隐藏 |
| 右侧默认 | toggle | 常驻/隐藏 | 隐藏 |
| 顶部默认 | toggle | 常驻/隐藏 | 显示 |

**Tab 9: 系统**
| 配置项 | 类型 | 范围 | 默认 |
|--------|------|------|------|
| Last.fm 凭证 | text | — | — |
| 播放音质 | select | 标准/高/无损 | 高 |
| 缓存管理 | button | 清除缓存 | — |
| 语言 | select | zh-CN/en-US | 自动检测 |
| 主题 | select | 内置主题列表 | 默认深色 |
| 配置 | button | 导入/导出/重置 | — |

### 2.2 预设系统

```ts
// 预设组合 —— 一键应用整套设置
interface SettingsPreset {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;  // 预设预览图
  settings: Partial<DIYSettings>;
}

// 内置预设
const BUILTIN_PRESETS: SettingsPreset[] = [
  {
    id: 'immersive',
    name: '沉浸',
    description: '最大化视觉冲击，高粒子密度、强泡沫律动',
    settings: {
      particle: { resolution: 160, scatterStrength: 0.8, sensitivity: 0.9 },
      foam: { count: 120, iridescence: 0.8, floatAmplitude: 0.9 },
      fluidBg: { intensity: 0.9, speed: 1.2 },
    },
  },
  {
    id: 'minimal',
    name: '极简',
    description: '克制视觉，低GPU占用，适合工作背景',
    settings: {
      particle: { resolution: 80, scatterStrength: 0.3, sensitivity: 0.5 },
      foam: { count: 40, iridescence: 0.3, floatAmplitude: 0.4 },
      fluidBg: { intensity: 0.3, speed: 0.5 },
      spectrum: { preset: 'minimal-bars', density: 0.5 },
    },
  },
  {
    id: 'crystalline',
    name: '清澈',
    description: '珍珠白+冰蓝配色，高透明度玻璃质感',
    settings: {
      foam: { palette: 'pearl-white', iridescence: 0.9 },
      fluidBg: { colorScheme: 'deep-blue', intensity: 0.6 },
      chambers: { opacity: 0.08 },
    },
  },
];
```

### 2.3 配置持久化

```ts
// 存储策略
// 1. 设置 → IndexedDB 'settings' store + 文件系统备份
// 2. 壁纸 → 文件系统 (userData/wallpaper)
// 3. 配置导出 → JSON 文件下载
// 4. 配置导入 → JSON 文件读取 + 验证 + 合并

// 版本化配置 —— 升级时自动迁移
interface VersionedSettings {
  version: number;     // 当前: 2
  settings: DIYSettings;
  migrated?: boolean;  // 是否从旧版本迁移过
}
```

---

## 3. 改造步骤

### Step 1: DIYSettings 类型定义 (Phase 2)
- 完整定义 9 个 Tab 的配置类型

### Step 2: 拆分 diy-settings UI (Phase 4)
- 每个 Tab 独立组件文件
- 父组件管理 Tab 切换和全局状态

### Step 3: 实时预览 (Phase 4)
- 滑块/颜色变更即时反映到 UI
- 无需关闭弹窗

### Step 4: 预设系统 (Phase 5)
- `SettingsPreset` 类型 + 内置预设
- 一键应用 + 重置为默认

### Step 5: 配置导入导出 (Phase 5)
- 导出为 `.json` 下载
- 导入验证 + 合并

---

## 4. 验收标准

- [ ] 9 个 Tab 全部实现且独立可用
- [ ] 设置变更实时预览
- [ ] 3 个以上内置预设可用
- [ ] 配置可导出 `.json` 并重新导入
- [ ] 设置持久化到 IndexedDB + 文件系统
- [ ] 旧版本配置自动迁移到新格式
