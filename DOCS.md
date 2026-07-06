# FluidMusic — 文档索引

> 版本：v1.1.1 | 更新：2026-07-06

## 项目文档

| 文件 | 用途 |
|---|---|
| [PRD.md](PRD.md) | 产品需求文档 — 功能规划、目标用户、产品路线图 |
| [REQUIREMENTS.md](REQUIREMENTS.md) | 技术需求规格 — 架构约束、技术选型、集成方案 |
| [CHANGELOG.md](CHANGELOG.md) | 版本变更记录 — v0.1.0 → v1.1.1 |
| [README.md](README.md) | 项目介绍 — 特性概览、快速启动、截图 |

## 设计分析文档 (docs/)

| 文件 | 用途 |
|---|---|
| [ANALYSIS.md](docs/ANALYSIS.md) | macOS 综合分析 — 性能、UI/UX、安全、兼容性审计 |
| [SOLUTION.md](docs/SOLUTION.md) | 优化实施方案 — 基于 ANALYSIS 的具体改造计划 |
| [CLAUDE_CLI_SPEC.md](docs/CLAUDE_CLI_SPEC.md) | Claude CLI 协作规范 — 代码风格、分支策略、自动化流程 |

## 开发需求方案 (docs/specs/)

| 文件 | 用途 |
|---|---|
| [00-OVERVIEW.md](docs/specs/00-OVERVIEW.md) | 总览 — 全面开发需求方案 |
| [01-STRUCTURE.md](docs/specs/01-STRUCTURE.md) | 项目结构 — 目录组织、模块划分 |
| [02-PERFORMANCE.md](docs/specs/02-PERFORMANCE.md) | 性能方案 — 帧率、内存、GPU 优化 |
| [03-DATA.md](docs/specs/03-DATA.md) | 数据方案 — 状态管理、缓存、持久化 |
| [04-LOGIC.md](docs/specs/04-LOGIC.md) | 业务逻辑 — 播放控制、平台集成、搜索 |
| [05-EXTENSIBILITY.md](docs/specs/05-EXTENSIBILITY.md) | 可扩展性 — 插件、主题、API 设计 |
| [06-PERSONALIZATION.md](docs/specs/06-PERSONALIZATION.md) | 个性化 — 设置面板、自定义系统 |
| [07-USABILITY.md](docs/specs/07-USABILITY.md) | 可用性 — 交互、键盘、无障碍 |

## 专项审计 (docs/specs/)

| 文件 | 用途 |
|---|---|
| [GPU-AUDIT-v1.1.0.md](docs/specs/GPU-AUDIT-v1.1.0.md) | GPU 性能审计 v1.1.0 |
| [GPU-OPTIMIZATION.md](docs/specs/GPU-OPTIMIZATION.md) | GPU 优化方案 — 共享上下文、帧率策略 |
| [MULTI-PLATFORM-AUDIT.md](docs/specs/MULTI-PLATFORM-AUDIT.md) | 多平台集成审计 — 网易云/QQ/Kugou |
| [PARAMETER-AUDIT.md](docs/specs/PARAMETER-AUDIT.md) | 参数审计 — 可调参数清单与默认值 |

## 架构关键文件

| 文件 | 职责 |
|---|---|
| `desktop/main.js` | Electron 主进程 — 窗口管理、IPC、登录、生命周期 |
| `server.js` | Express API 代理 — 静态服务、cover proxy、cookie 管理 |
| `public/js/app.js` | 渲染器入口 — 模块初始化、主循环、状态编排 |
| `public/js/renderer-manager.js` | 共享 WebGL 上下文 — 多场景单画布合成 |
| `public/js/audio-engine.js` | 音频引擎 — Web Audio API、频谱分析、均衡器 |
| `public/js/particle-cover.js` | 3D 粒子封面 — 专辑图→粒子云、音频反应 |
| `public/js/fluid-bg.js` | 流体背景着色器 — GPU 噪声、光线折射 |
| `public/js/audio-particles.js` | 音频响应粒子 — Canvas 2D 粒子、bass/mid 驱动 |

## 视觉层架构

```
DOM 层级 (底→顶):
  #wallpaper-layer        — 壁纸/视频背景
  #layer-bg > #bg-canvas  — 共享 WebGL (RendererManager)
    ├─ bg (fluid-bg)      — 流体着色器
    ├─ particle           — 3D 粒子封面
    ├─ threeDLyrics       — 3D 歌词
    └─ lyricChamber3D     — 3D 歌词浮仓
  #audio-particles-canvas   — 音频响应粒子 (Canvas 2D)
  #layer-passthrough        — 穿透层
  #center-core              — 播放器核心 UI
  .bubble-chamber × 4       — 歌单/歌词/队列/控制
  #diy-overlay / #search    — 设置/搜索浮层
```
