# FluidMusic — 流体动态音乐播放器

> macOS 桌面音乐播放器，Three.js 3D粒子视觉 + 流体物理特效
>
> ⚠️ **GPU性能测试怪，请谨慎使用** — 本应用重度依赖GPU渲染，低配设备可能出现风扇狂转、掉帧或发烫。

📖 [完整文档索引 →](DOCS.md)

## 截图

![FluidMusic 截图](/public/show.png)

## 特性

- 🎵 网易云音乐 + QQ音乐双平台支持
- ✨ 3D粒子封面（Mineradio风格：[XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio)），随播放状态溶解/成型
- 🌊 全色相音频涟漪特效（频谱驱动，全屏随机位置）
- 🎚 Canvas音频响应粒子（bass跳/mid摆，无音乐即隐）
- 🎨 7 Tab DIY设置面板（三段式布局+调色盘+帮助系统）
- 🖼 图片/视频背景支持
- 📝 桌面歌词独立窗口 + 迷你播放器
- 🎧 Now Playing (Media Session API)
- ⌨️ 完整键盘快捷键 + macOS媒体键

## 技术栈

- **桌面框架**: Electron 33
- **3D渲染**: Three.js WebGL2
- **构建**: Vite + electron-builder
- **语言**: TypeScript + JavaScript
- **测试**: Vitest (125 tests)
- **API**: Express 代理服务器

## 快速开始

```bash
npm install
npm start        # 启动Electron应用
# 或浏览器访问 http://localhost:3000
```

## 开发

```bash
npm run dev           # Vite开发服务器
npm test              # 运行测试
npm run lint          # ESLint检查
npm run build:renderer # 构建前端
npm run build         # 打包macOS DMG
```

## 项目结构

```
src/
├── types/       # TypeScript类型定义
├── core/        # 核心引擎（EventBus/AppStore/DataCache/AudioEngine/ApiBridge）
├── renderer/    # WebGL渲染（RendererManager/FluidBg/ParticleCover）
└── platform/    # 平台模块（I18N/Favorites/LastFM/CustomPlaylists）
desktop/         # Electron主进程
public/          # 前端静态资源
```

## 作者

抖音 · 开发者动态 & 更新预告

<div align="center">
  <a href="https://www.douyin.com/user/yiilimini" target="_blank">
    <img src="/public/xc/dy.png" width="180" alt="抖音">
  </a>
  <br><sub>抖音 · 开发者动态 & 更新预告</sub>
</div>

## 打赏

欢迎请作者喝杯咖啡 ☕

| 微信支付 | 支付宝 |
|---|---|
| ![微信支付](/public/ds/wechat-pay.jpg) | ![支付宝](/public/ds/alipay.png) |

## 许可

Apache 2.0 — 详见 [LICENSE](LICENSE)

