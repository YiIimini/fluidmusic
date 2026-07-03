# FluidMusic 多平台多终端方案审计

> 2026-07-03

---

## 一、当前架构评估

```
                    ┌──────────────────────┐
                    │   Electron Main       │
                    │   desktop/main.js     │
                    └──────────┬───────────┘
                               │ IPC + OAuth
                    ┌──────────▼───────────┐
                    │   Express Server      │
                    │   server.js :3000     │
                    │   API Proxy + Static  │
                    └──────────┬───────────┘
                               │ HTTP
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
     ┌────────────┐    ┌────────────┐    ┌────────────┐
     │  Renderer   │    │  Browser    │    │   Mobile    │
     │  Electron   │    │  localhost  │    │   (none)    │
     │  WebView    │    │  访问       │    │             │
     └────────────┘    └────────────┘    └────────────┘
```

### 当前能力

| 平台 | 状态 | 说明 |
|------|:--:|------|
| macOS Electron | ✅ 完整 | 主目标，全功能 |
| 浏览器访问 | ⚠️ 部分 | 可加载UI，但依赖Electron IPC的功能不可用 |
| Windows | ❌ 未测试 | electron-builder 可构建但未验证 |
| Linux | ❌ 未测试 | 同上 |
| iOS/Android | ❌ 无 | 无移动端方案 |
| Web PWA | ❌ 无 | 无离线/安装方案 |

### 浏览器模式缺失功能

| 功能 | 原因 |
|------|------|
| 登录 | 需要 Electron Session Partition |
| 本地文件导入 | 需要 `dialog.showOpenDialog` |
| 壁纸/视频上传 | 需要文件对话框 |
| 系统设置持久化 | 仅 localStorage，无文件系统备份 |
| 媒体键 | 需要 `globalShortcut` |
| 窗口控制 | 需要 BrowserWindow API |
| Cookie 加密 | 需要 `safeStorage` (Keychain) |

---

## 二、多平台方案

### 方案 A: Electron + Web 双模式 (推荐)

```
同仓代码，双构建目标：

electron/          ← Electron 专属 (main process, IPC, native)
  main.js
  preload.js
  ...

src/               ← 共享渲染层 (TypeScript + Three.js)
  core/            业务逻辑
  renderer/        WebGL 渲染
  ui/              UI 组件
  platform/        平台适配层 ← 关键
    electron.ts    Electron 实现
    browser.ts     浏览器 polyfill

shared/            ← 两端共享
  types/
  ...
```

**平台适配层接口：**
```ts
interface PlatformAdapter {
  // Auth
  login(platform: string): Promise<LoginResult>;
  logout(platform: string): Promise<void>;
  getLoginStatus(): Promise<Record<string, boolean>>;

  // File system
  pickImage(): Promise<FileResult>;
  pickVideo(): Promise<FileResult>;
  importAudio(): Promise<FileResult[]>;

  // Persistence
  saveSecure(key: string, data: string): Promise<void>;
  loadSecure(key: string): Promise<string | null>;

  // System
  getPlatform(): 'electron' | 'browser' | 'mobile';
  getLocale(): string;
  registerMediaKeys?(handlers: MediaKeyHandlers): void;
}
```

### 方案 B: PWA + Tauri 轻量版

如果考虑跨平台部署和包体积：
- 核心用 Web 技术 + PWA (Service Worker 离线缓存)
- 桌面端用 Tauri 替代 Electron (包体积 ~5MB vs ~200MB)
- 需要 Rust 开发能力

### 方案 C: Electron + Capacitor 移动端

如果需要 iOS/Android：
- Capacitor 封装 WebView → 移动端
- 保留 Electron → 桌面端
- 共享 90% 代码

---

## 三、多终端数据同步方案

| 方案 | 复杂度 | 隐私 | 说明 |
|------|:--:|:--:|------|
| iCloud Drive | 低 | 高 | macOS 原生，同步 localStorage JSON |
| 自定义服务器 | 高 | 可控 | WebSocket + 自建后端 |
| 第三方 (Firebase) | 中 | 低 | 快速实现但数据经第三方 |
| 手动导入导出 | 低 | 高 | JSON 文件导入导出 |

**推荐**：iCloud Drive + 手动导入导出作为起步方案。

---

## 四、浏览器模式快速修复清单

让 `http://localhost:3000` 在浏览器中基本可用：

- [ ] 添加 `PlatformAdapter` 接口，浏览器模式用 localStorage polyfill
- [ ] 登录：浏览器模式显示"请在桌面端登录"提示，或跳转OAuth回调
- [ ] 气泡仓显示：排查 CSS `opacity`/`visible` 类是否正常
- [ ] 音频播放：Web Audio API 浏览器原生支持 → 无需改动
- [ ] Three.js 渲染：浏览器原生支持 → 无需改动
- [ ] 歌单数据：Express API 浏览器可直接调用 → 无需改动

---

## 五、优先级建议

| 优先级 | 项目 | 工作量 |
|:--:|------|:--:|
| P0 | 浏览器模式 Chambers 显示修复 | 1h |
| P0 | PlatformAdapter 接口 + Electron 实现 | 3h |
| P1 | 浏览器模式 polyfill (登录/文件/持久化) | 4h |
| P1 | 配置导入导出 | 2h |
| P2 | PWA 离线支持 | 4h |
| P2 | Windows 构建验证 | 2h |
| P3 | iCloud 同步 | 6h |
| P3 | Tauri 迁移评估 | 8h |
