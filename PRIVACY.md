# FluidMusic 隐私说明

> 最后更新：2026-07-07

## 概述

FluidMusic 是本地运行的桌面音乐播放器，**不收集、不上传任何用户数据**。

## 数据存储

所有用户数据保存在本地，不上传至任何服务器：

| 数据类型 | 存储位置 | 说明 |
|---|---|---|
| 播放设置（音量、播放模式、EQ 等） | 本地 `localStorage` | 仅本设备使用 |
| 收藏歌曲列表 | 本地 `localStorage` | 不关联任何账号 |
| 自定义歌单 | 本地 `localStorage` | 不关联任何账号 |
| 主题偏好与 UI 设置 | 本地 `localStorage` | 仅本设备使用 |

## 网络请求

FluidMusic 仅在以下场景发起网络请求：

- **音乐搜索与播放** — 通过本地代理向网易云音乐 / QQ 音乐 API 请求歌曲信息与播放地址
- **歌词获取** — 请求歌曲对应的歌词数据（含翻译）
- **封面图片** — 加载专辑封面和歌单封面
- **Last.fm（可选）** — 仅在用户主动开启并配置 API Key 后，发送听歌记录（Scrobbling）
- **更新检查** — 使用 GitHub Releases API 检查版本更新（Electron 内置 `electron-updater`）

无任何遥测、分析、崩溃报告或用户行为追踪。

## 第三方服务

FluidMusic **不集成**以下内容：

- 无第三方广告 SDK
- 无第三方统计 / 埋点 SDK
- 无社交账号登录
- 无云同步服务

## 本地代理

应用内置 Express 代理服务器（`127.0.0.1`），仅用于转发音乐搜索与播放请求，不记录请求日志。

## 开源声明

FluidMusic 基于 Apache 2.0 协议开源，代码可审计：[github.com/YiIimini/fluidmusic](https://github.com/YiIimini/fluidmusic)

## 联系方式

如有隐私相关问题，请通过 GitHub Issues 联系。
