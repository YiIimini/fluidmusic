# FluidMusic 全面开发需求方案 — 总览

> 版本：v0.2.0-target | 日期：2026-07-03 | 基于 PRD v1.0 + ANALYSIS + SOLUTION

---

## 1. 项目现状摘要

| 维度 | 当前状态 | 评分 |
|------|---------|:----:|
| 结构 | IIFE + `window.X` 全局，18 文件平铺，最大文件 1647 行 | ⭐⭐ |
| 性能 | 共享 WebGL 上下文已实现，暂停低功耗已加，启动 ~3s | ⭐⭐⭐ |
| 数据 | localStorage JSON，无去重，URL 缓存策略粗放 | ⭐⭐ |
| 逻辑 | 全局变量散落，try/catch 吞错，回调嵌套 | ⭐⭐ |
| 扩展 | `module-registry.js` 半成品，无插件/主题体系 | ⭐ |
| 个性化 | DIY 仅 2 Tab，预设系统无 | ⭐⭐ |
| 实用性 | 桌面歌词/Now Playing 缺失，无障碍无 | ⭐⭐ |

## 2. 目标状态（v0.3.0）

| 维度 | 目标 | 评分 |
|------|------|:----:|
| 结构 | TypeScript + ES Modules，分层目录，每文件 ≤500 行 | ⭐⭐⭐⭐⭐ |
| 性能 | 启动 ≤1.5s，60fps 稳定，内存 ≤150MB，GPU ≤100MB | ⭐⭐⭐⭐⭐ |
| 数据 | IndexedDB，请求去重+并发控制，差异化 TTL | ⭐⭐⭐⭐ |
| 逻辑 | AppStore + EventBus，统一 ErrorHandler，async/await 流 | ⭐⭐⭐⭐⭐ |
| 扩展 | 可视化预设 API，主题引擎，平台适配器接口 | ⭐⭐⭐⭐ |
| 个性化 | 9 Tab 完整 DIY，预设系统，主题导入导出 | ⭐⭐⭐⭐⭐ |
| 实用性 | 桌面歌词，迷你播放器，Now Playing，无障碍，键盘导航 | ⭐⭐⭐⭐⭐ |

## 3. 核心架构决策

1. **TypeScript 渐进迁移** — `.js` 与 `.ts` 长期共存，新代码必须 TS
2. **ES Modules + DI** — `import`/`export` + `ModuleRegistry` 编排
3. **统一渲染时钟** — 单次频谱采样 → 广播所有渲染层
4. **集中状态管理** — `AppStore` + `EventBus` 解耦模块

## 4. 实施路线图

```
Phase 1 (Week 1-2)   ■■  基础加固
  ├── 修复剩余 Bug + lint errors
  ├── 补齐测试（核心模块覆盖率 >60%）
  └── 清理技术债务（大文件拆分准备）

Phase 2 (Week 3-4)   ■■■  TypeScript 核心迁移
  ├── types/ 类型定义层
  ├── 数据层迁移（data-cache, favorites, i18n）
  └── 引擎层迁移（audio-engine, api-bridge）

Phase 3 (Week 5-6)   ■■■  ES Modules + 渲染层
  ├── Vite 接管完整开发流程
  ├── 渲染层迁移（renderer-manager, fluid-bg, particle-cover...）
  └── 大文件拆分（app.js, bubble-chamber.js, index.html）

Phase 4 (Week 7-8)   ■■■■  UI层 + 功能补全
  ├── UI层迁移（bubble-chamber, search, user-panel, diy-settings...）
  ├── AppStore + EventBus 实现
  ├── 桌面歌词窗口 + 迷你播放器
  └── Now Playing + 无障碍基础

Phase 5 (Week 9-10)  ■■■  扩展体系 + 个性完善
  ├── 9 Tab DIY 完整实现
  ├── 预设系统 + 主题导入导出
  ├── 可视化预设 API + 主题引擎
  └── 性能终优 + 文档

Phase 6 (Week 11-12) ■■  打磨发布
  ├── E2E 测试补齐
  ├── 公证 + 签名完整流程
  └── v0.3.0 发布
```

## 5. 文档索引

| 文档 | 内容 | 优先级 |
|------|------|:----:|
| [01-STRUCTURE.md](./01-STRUCTURE.md) | 目录组织、模块边界、TypeScript 迁移路径 | P0 |
| [02-PERFORMANCE.md](./02-PERFORMANCE.md) | 渲染管线、内存、启动、GPU 优化 | P0 |
| [03-DATA.md](./03-DATA.md) | 数据流、缓存策略、持久化、API 层 | P1 |
| [04-LOGIC.md](./04-LOGIC.md) | 状态管理、事件总线、错误处理、业务流 | P0 |
| [05-EXTENSIBILITY.md](./05-EXTENSIBILITY.md) | 插件系统、主题引擎、可视化 API | P2 |
| [06-PERSONALIZATION.md](./06-PERSONALIZATION.md) | DIY 设置体系、预设系统、配置迁移 | P1 |
| [07-USABILITY.md](./07-USABILITY.md) | 交互规范、无障碍、桌面歌词、迷你播放器 | P1 |

## 6. 并行开发策略

每个 Phase 内的独立任务可并行分发给 subagent（最多 4-6 个并行）：

```
并行规则：
✓ 不同文件且无依赖 → 并行
✓ 同文件不同函数 → 审查后合并
✗ 同文件同区域 → 串行
✗ 类型定义层未完成 → 上层模块不能开始
```

典型并行模式（以 Phase 2 为例）：
```
并行组 A: types/ 类型定义（1 agent）
并行组 B: data-cache.ts + favorites.ts + i18n.ts（3 agents 并行）
并行组 C: audio-engine.ts + api-bridge.ts（2 agents 并行，依赖组 A 完成）
```
