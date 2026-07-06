# FluidMusic — 文档

> v1.1.1 | 2026-07-06

## 项目文档

| 文件 | 说明 |
|---|---|
| [README.md](README.md) | 项目介绍、特性、快速启动 |
| [CHANGELOG.md](CHANGELOG.md) | 版本变更记录 |

## 开发相关

| 文件 | 说明 |
|---|---|
| [docs/CLAUDE_CLI_SPEC.md](docs/CLAUDE_CLI_SPEC.md) | Claude CLI 协作规范 |

## 关键源码

| 文件 | 职责 |
|---|---|
| `desktop/main.js` | Electron 主进程 — 窗口、IPC、生命周期 |
| `server.js` | API 代理 — 静态服务、cover proxy |
| `public/js/app.js` | 渲染器入口 — 模块初始化、主循环 |
| `public/js/renderer-manager.js` | 共享 WebGL — 多场景单画布合成 |
| `public/js/audio-engine.js` | 音频引擎 — Web Audio、频谱分析 |
| `public/js/particle-cover.js` | 3D 粒子封面 |
| `public/js/audio-particles.js` | Canvas 音频响应粒子 |

## 视觉层

```
DOM 层级 (底→顶):
  #wallpaper-layer          — 壁纸/视频背景
  #layer-bg > #bg-canvas    — 共享 WebGL (流体/粒子封面/3D歌词)
  #audio-particles-canvas   — Canvas 2D 音频粒子
  #center-core              — 播放器核心 UI
  .bubble-chamber × 4       — 歌单/歌词/队列/控制
```
