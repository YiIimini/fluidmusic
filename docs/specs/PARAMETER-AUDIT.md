# FluidMusic 用户可配置参数全面审计

> 扫描全模块后整理的所有可配置参数，标注默认值、范围、当前面板覆盖情况

---

## 参数清单

### 🎨 UI特效 Tab

| 参数 | 模块 | 类型 | 默认值 | 范围 | 面板 | GPU影响 |
|------|------|------|--------|------|:--:|:--:|
| `enableFluidBg` | fluid-bg | toggle | **true** | on/off | ✅ 刚加 | 低 |
| `enableParticleCover` | particle-cover | toggle | **false** | on/off | ✅ 刚加 | 🔴 高 |
| `enableFoamSystem` | foam-system | toggle | **false** | on/off | ✅ 刚加 | 🟡 中 |
| `enableFoamEqualizer` | foam-equalizer | toggle | **true** | on/off | ✅ 刚加 | 🟡 中 |
| `enableSpectrum3D` | spectrum-3d | toggle | **true** | on/off | ✅ 刚加 | 🟢 低 |

### 🔮 粒子封面 Tab

| 参数 | 默认值 | 范围 | 面板 | 说明 |
|------|--------|------|:--:|------|
| `particleResolution` | 160 | 60-200 | ✅ | 粒子网格密度 |
| `particleScatterStrength` | 0.8 | 0-1 | ❌ | 散落/聚合强度 |
| `particleSensitivity` | 0.8 | 0-1 | ❌ | 音频律动灵敏度 |
| `particleRotationSpeed` | 0.5 | 0-2 | ✅ | 3D旋转速度 |
| `particleColorScheme` | 'original' | warm/cool/original/custom | ❌ | 粒子色调 |
| `particleSize` | 2 | 1-4 px | ❌ | 粒子点大小 |

### 🫧 泡沫特效 Tab

| 参数 | 默认值 | 范围 | 面板 | 说明 |
|------|--------|------|:--:|------|
| `foamCount` | 80 | 20-150 | ❌ | 泡沫数量 |
| `foamSize` | 1.5 | 0.5-3 | ❌ | 泡沫大小 |
| `foamIridescence` | 0.6 | 0-1 | ❌ | 虹彩/珍珠光泽 |
| `foamFloatAmplitude` | 0.7 | 0-1 | ❌ | 浮沉幅度 |
| `foamPaletteId` | 0 | 0-5 | ❌ | 配色方案 (珍珠白/虹彩/粉蓝/...) |
| `foamAutoSwitchInterval` | 30s | 0-120s | ❌ | 配色自动切换间隔 |

### 📊 频谱可视化 Tab

| 参数 | 默认值 | 范围 | 面板 | 说明 |
|------|--------|------|:--:|------|
| `foamPreset` | 'thermal' | thermal/pearl/deepsea/stardust/aurora | ✅ | 均衡器预设 |
| `foamDensity` | 1.0 | 0.3-2 | ❌ | 粒子密度 |
| `foamSpeed` | 1.0 | 0.5-2 | ❌ | 动效速度 |
| `foamColorIntensity` | 1.0 | 0.5-1.5 | ❌ | 颜色强度 |
| `foamSizeScale` | 1.0 | 0.5-2 | ❌ | 粒子大小缩放 |

### 🌊 背景流体 Tab

| 参数 | 默认值 | 范围 | 面板 | 说明 |
|------|--------|------|:--:|------|
| `bgIntensity` | 0.8 | 0-1 | ✅ | 水波纹强度 |
| `bgSpeed` | 1.0 | 0.1-3 | ✅ | 流体速度 |
| `bgColorScheme` | 'dark' | dark/light/neon/custom | ❌ | 配色方案 |
| `bgNoiseScale` | 0.5 | 0.25-1.0 | ❌ | 噪声分辨率(低=省GPU) |
| `bgSmoothing` | 0.04 | 0.01-0.2 | ❌ | 音频平滑系数 |

### 🎵 歌词设置 Tab

| 参数 | 默认值 | 范围 | 面板 | 说明 |
|------|--------|------|:--:|------|
| `lyricsVisibleLines` | 0 (全部) | 0-40 | ❌ | 显示行数 |
| `lyricsFontSize` | 13px | 10-24 | ✅ | 字体大小 |
| `lyricsTextColor` | '#ffffff' | color | ❌ | 主文字颜色 |
| `lyricsHighlightColor` | '#5588ee' | color | ❌ | 高亮颜色 |
| `lyricsFadeStrength` | 0.5 | 0-1 | ✅ | 淡化强度 |

### 📋 歌单设置 Tab

| 参数 | 默认值 | 范围 | 面板 | 说明 |
|------|--------|------|:--:|------|
| `playlistStyle` | 'default' | compact/standard/comfortable | ❌ | 列表密度 |
| `playlistFontSize` | 13px | 12-18 | ❌ | 列表字号 |
| `playlistTransparency` | 0.15 | 0.05-0.3 | ❌ | 仓透明度 |

### 🎛️ 频谱3D Tab

| 参数 | 默认值 | 范围 | 面板 | 说明 |
|------|--------|------|:--:|------|
| `spectrumRingCount` | 3 | 2-5 | ❌ | 频谱环层数 |
| `spectrumRingSize` | 1.0 | 0.5-2 | ❌ | 环大小 |
| `spectrumRotationAuto` | true | on/off | ❌ | 自动旋转 |

### 🫧 气泡仓 Tab

| 参数 | 默认值 | 范围 | 面板 | 说明 |
|------|--------|------|:--:|------|
| `chamberTransparency` | 0.12 | 0.05-0.3 | ❌ | 仓透明底 |
| `chamberTriggerSensitivity` | 0.5 | 0-1 | ❌ | 边缘触发灵敏度 |
| `chamberLeftPinned` | false | toggle | ✅ | 左仓常驻 |
| `chamberRightPinned` | false | toggle | ✅ | 右仓常驻 |
| `chamberTopPinned` | true | toggle | ✅ | 上仓常驻 |
| `chamberBottomPinned` | true | toggle | ✅ | 下仓常驻 |
| `queueDockMag` | true | toggle | ✅ | 队列Dock放大 |

### 🖼️ 壁纸 Tab

| 参数 | 默认值 | 范围 | 面板 | 说明 |
|------|--------|------|:--:|------|
| `wallpaperOpacity` | 0.3 | 0-1 | ✅ | 壁纸透明度 |
| `wallpaperRippleSpeed` | 1.0 | 0.2-2 | ✅ | 水波纹速度 |
| `wallpaperBlur` | 20px | 0-40px | ❌ | 壁纸模糊度 |
| `wallpaperImage` | null | file | ❌ | 壁纸文件 |

### ⚙️ 系统 Tab

| 参数 | 默认值 | 范围 | 面板 | 说明 |
|------|--------|------|:--:|------|
| `volume` | 0.8 | 0-1 | ✅ | 默认音量 |
| `playMode` | 'sequential' | sequential/random/single | ✅ | 播放模式 |
| `language` | 'auto' | zh-CN/en-US | ✅ | 界面语言 |
| `lastfmApiKey` | '' | text | ❌ | Last.fm API Key |
| `lastfmSecret` | '' | text | ❌ | Last.fm Secret |
| `playbackQuality` | 'high' | standard/high/lossless | ❌ | 播放音质 |
| `sleepTimerMinutes` | 0 | 0/15/30/45/60 | ❌ | 睡眠定时 |
| `themeId` | 'default-dark' | default-dark/light/neon | ❌ | 主题选择 |
| `autoUpdate` | true | toggle | ❌ | 自动更新 |
| `cacheClear` | — | button | ❌ | 清除缓存 |

---

## 汇总

| 类别 | 参数总数 | 已放入面板 | 待添加 |
|------|:--:|:--:|:--:|
| UI特效开关 | 5 | 5 | 0 |
| 粒子封面 | 6 | 2 | **4** |
| 泡沫特效 | 6 | 0 | **6** |
| 频谱可视化 | 5 | 1 | **4** |
| 背景流体 | 5 | 2 | **3** |
| 歌词设置 | 5 | 2 | **3** |
| 歌单设置 | 3 | 0 | **3** |
| 频谱3D | 3 | 0 | **3** |
| 气泡仓 | 7 | 5 | **2** |
| 壁纸 | 4 | 2 | **2** |
| 系统 | 9 | 3 | **6** |
| **总计** | **58** | **22** | **36** |

## 建议优先级

**立即添加 (P0)** — 高GPU影响、用户最可能调节:
- [ ] `particleScatterStrength` (散落强度)
- [ ] `particleSensitivity` (律动灵敏度)
- [ ] `foamCount` (泡沫数量)
- [ ] `foamDensity` (均衡器密度)
- [ ] `foamColorIntensity` (颜色强度)
- [ ] `bgColorScheme` (背景配色)
- [ ] `bgNoiseScale` (噪声质量→GPU省电档位)
- [ ] `lyricsVisibleLines` (歌词行数)

**后续添加 (P1)** — 完善体验:
- [ ] 剩余 28 个参数逐一加入对应 Tab
