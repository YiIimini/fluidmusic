# Mineradio 特效独立页面

从 [Mineradio](https://github.com/nicepkg/laosu) MacOS 桌面应用中提取的四个视觉特效，
每个都是可独立运行的单文件 HTML 页面。

## 运行方式

由于使用 Three.js CDN 模块加载 (ES import map)，需要通过 HTTP 服务器运行：

```bash
cd tests/tl
npx serve .          # 访问 http://localhost:3000/
# 或
python3 -m http.server 8080
```

然后浏览器访问对应特效页面。

> **注意：** 直接 `file://` 协议打开会因 CORS 无法加载 CDN 模块。

## 特效列表

### 🎨 封面粒子 (`cover-particles/`)
- **来源：** `app.js` SILK preset（预设0）
- **效果：** 封面图片驱动的 13,924 个 3D 粒子，音频节奏驱动 Z 轴位移和涟漪
- **交互：** 鼠标拖拽旋转 | 滚轮缩放 | R 重置 | 1/2 散射 | 3/4 扭曲 | ↑↓ 强度
- **特性：** 支持自定义封面图片 URL，点击画布生成涟漪

### 🎤 3D歌词 (`3d-lyrics/`)
- **来源：** `app.js` 舞台歌词系统 v9 + 星河粒子
- **效果：** Canvas 渲染文字 → 3D 纹理平面 + 420 个星河粒子流
- **交互：** 输入任意文字即时显示 | 可调星河配色
- **特性：** 自适应字号（128→42px），音频驱动粒子颜色和密度

### 🫧 泡沫 (`foam/`)
- **来源：** `mineradio-terrain.js` foam 系统
- **效果：** 128×128 网格 GLSL ShaderMaterial 珍珠虹彩平面
- **特性：** 8 频段音频驱动波形起伏 | 雨滴涟漪 | 冷暖色渐变区域 | 自动旋转相机
- **主题：** 固定 foam_bubble 配色 (#080e28 / #3377ff / #ee5533)

### 🔷 不规则 (`irregular/`)
- **来源：** `mineradio-terrain.js` irregular 系统
- **效果：** 80×80 网格柱状间隙风格音频可视化
- **特性：** cell-based 间隙 (GAP=0.10) | 动态绕行光源 | 高光反射 | 大气雾
- **主题：** 固定 nocturnal 配色 (#03050a / #004dff / #ff331a)

## 音频输入

每个页面支持两种音频输入方式：

| 方式 | 操作 | 说明 |
|------|------|------|
| 🎤 麦克风 | 点击 Mic 按钮 | 使用系统麦克风实时采集 |
| 📁 音频文件 | 点击 File 或拖放 | 支持 MP3/FLAC/WAV 等常见格式 |

## 共享模块

`shared/audio-analyzer.js` — 8 频段 RMS 音频分析器：
- subBass (20-60Hz) · bass (60-150Hz) · lowMid (150-300Hz)
- mid (300-1200Hz) · highMid (1200-3000Hz) · presence (3000-6000Hz)
- brilliance (6000-12000Hz) · air (12000-20000Hz) · energy (总能量)
- 指数平滑 + 音频活动检测

## 技术栈

| 技术 | 版本 | 加载方式 |
|------|------|---------|
| Three.js | r160 | CDN (unpkg) |
| Web Audio API | - | 浏览器原生 |
| GLSL | ES 1.0 | ShaderMaterial inline |
| CSS | - | inline |

## 文件结构

```
tests/tl/
├── shared/
│   └── audio-analyzer.js        # 共享音频分析模块
├── cover-particles/
│   └── index.html               # 封面粒子 (913行)
├── 3d-lyrics/
│   └── index.html               # 3D歌词 (916行)
├── foam/
│   └── index.html               # 泡沫 (704行)
├── irregular/
│   └── index.html               # 不规则 (636行)
└── README.md
```

## 提取原则

- **完整保留：** 所有 GLSL 着色器从原项目逐行复制，`sprintf()` 动态值替换为字面量
- **精简去除：** 主题系统、多预设切换、外部依赖（GSAP、Electron、后端API）
- **自包含：** AudioAnalyzer 类内联在各 HTML 中，无外部 JS 依赖（除 Three.js CDN）
- **像素一致：** 着色器参数与原始效果完全一致
