# FluidMusic — Claude CLI 协作规范 v1.0

## 项目定位
Electron 桌面音乐播放器，macOS 优先，透明无边框窗口，Three.js 粒子封面+流体背景。

## 技术栈
- 桌面框架: Electron 33+，主进程 `desktop/main.js`
- 3D渲染: Three.js (WebGL2)，通过 `window.THREE` 全局引入 (`public/vendor/three.min.js`)
- 后端: Express 代理 `server.js`，端口自动发现
- 构建: Vite (渲染进程) + electron-builder (macOS DMG)
- 测试: Vitest，`npm test` 运行
- Lint: ESLint，`npm run lint`

## 架构
```
TypeScript 层 (src/)           Legacy JS 层 (public/js/)
types/     — 类型定义          app.js              — 主控制器 1900行
core/      — EventBus,         audio-engine.js     — FluidAudio 全局对象
             AppStore,         api-bridge.js       — API 桥接
             DataCache(TS)     data-cache.js       — localStorage 缓存
             ErrorHandler      particle-cover.js   — 粒子封面 549行
platform/  — 适配器            fluid-bg.js         — 流体背景 213行
renderer/  — 渲染模块          renderer-manager.js — 共享WebGL 185行
                               bubble-chamber/*    — 5子模块
                               diy-settings.js     — DIY配置 920行
```

## 关键设计约束
1. ModuleRegistry (`window.__FM`) 是 DI 容器，通过 `register(name, deps[], factory)` 注册模块
2. 渲染层共用单个 WebGL 上下文 (`RendererManager`)，各层注册为 layer
3. `public/index.html` 的 `<script>` 加载顺序决定了 JS 文件加载顺序
4. 音频引擎 `FluidAudio` 是全局对象，`FluidAudio.bands = { bass, mid, treble, energy }`
5. CSS 变量定义在 `public/styles/variables.css`，组件样式在 `components.css`
6. 所有 UI 状态变化必须用 CSS transition/animation，禁止硬切
7. 贝塞尔预设: `--spring-expand: cubic-bezier(0.1, 1.1, 0.1, 1.1)` `--spring-collapse: cubic-bezier(0.3, -0.3, 0, 1)`
8. 不要修改 tsconfig.json、package.json、vite.config.js、vitest.config.js
9. 不要修改 desktop/ 目录下的文件
10. 不要修改 server.js
11. 每次修改后运行 `npm test` 和 `npm run lint` 确认无回归
12. 文件编码必须为 UTF-8
