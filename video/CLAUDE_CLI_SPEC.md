# FluidMusic 视频重渲染规格

## 项目路径
- 视频项目目录: `/Users/x/Documents/Codex/FluidMusic/video/my-video/`
- 输出视频存放目录: `/Users/x/Documents/Codex/FluidMusic/video/`
- 应用展示图: `/Users/x/Documents/Codex/FluidMusic/video/startShow.png`

## 问题描述
1. 现有视频 `output-169.mp4` 旁白与画面内容时间不同步
2. 缺少 6:19 比例竖屏视频
3. 缺少 `startShow.png` 应用展示图片
4. 需要重新生成配音 + 重新渲染

## 任务步骤

### Step 1: 重新生成 Edge TTS 配音

使用 Edge TTS 按以下脚本生成配音，需要逐句生成以便精确控制时间轴：

```bash
# 安装 edge-tts
pip3 install edge-tts 2>/dev/null || true

# 逐句生成（共9段），保存到 /Users/x/Documents/Codex/FluidMusic/video/my-video/
# 命令格式: edge-tts --voice zh-CN-XiaoxiaoNeural --rate=+18% --text "文本" --write-media narration_s1.wav

# 9段旁白:
S1: "FluidMusic，流体动态音乐播放器"
S2: "一款为 macOS 打造的桌面音乐应用，融合 3D 粒子视觉与流体物理特效"
S3: "专辑封面化为数千动态粒子，随音频频谱实时律动，鼠标拖拽自由旋转"
S4: "三种背景特效自由切换：流体水波纹、泡沫地形、不规则几何粒子，九套配色方案可换"
S5: "七标签页 DIY 设置面板，覆盖特效、封面、歌词、歌单、背景、悬浮仓、系统七大模块"
S6: "上下左右四个悬浮仓分区管理，毛玻璃质感，hover 触发显隐"
S7: "完整键盘快捷键覆盖，深度集成 macOS 媒体键，锁屏界面可控"
S8: "基于 Electron 加 Three.js 技术架构，共享 WebGL 上下文，模块化设计"
S9: "开源项目，克隆即用，支持浏览器开发与桌面打包。感谢观看"
```

生成后使用 ffmpeg 拼接所有 S1-S9 wav 为 `narration_final.wav`，并用 ffmpeg silencedetect 检测每段静音边界，记录每句实际 start_time/end_time。

### Step 2: 根据实际时间轴重建 index.html

基于实际旁白时间，重新设计 10 场景（9段旁白 + 1个 startShow 展示场景）：

| 场景 | 内容 | 说明 |
|------|------|------|
| S1 | FluidMusic 标题 | 开场 |
| S2 | macOS 桌面音乐 | 核心特性 |
| S3 | 3D 粒子封面 | startShow.png 展示 |
| S4 | 三种视觉模式 | 背景特效 |
| S5 | DIY 设置面板 | 七标签页 |
| S6 | 悬浮仓交互 | 四分区 |
| S7 | 快捷键 | 操作体验 |
| S8 | 技术架构 | Electron+Three.js |
| S9 | 开源项目 | 结尾 |

**startShow.png 使用规则**：
- 在 S3 场景中作为图片展示，使用 `<img>` 标签
- 图片样式: `max-width: 70%; max-height: 70%; object-fit: contain; border-radius: 16px; box-shadow: 0 20px 60px rgba(139, 92, 246, 0.15);`
- 图片路径: `../startShow.png`（相对 index.html 路径）
- 配合标题"3D 粒子封面 / 动态粒子云"展示

### Step 3: 颜色方案
保持现有 Aurora Night 配色方案不变：
- `--bg: #08081A`
- `--text: #F5F0FF`
- `--accent: #A78BFA`
- `--gold: #E0B84C`

### Step 4: 关键 Timing 规则
- 旁白与内容的同步规则：
  - 每段旁白开始后 0.3s 内触发场景入场动画
  - 旁白结束时才触发场景转场
  - 句间静音 >= 0.4s 时认为该句结束
  - 底部字幕（#cap）与旁白文本同步切换
  - 字幕使用紫色-金色-红色渐变

### Step 5: 双比例渲染

#### 16:9 版本
- 尺寸: 1920×1080
- 输出: `/Users/x/Documents/Codex/FluidMusic/video/output-169.mp4`
- 在当前 `my-video/` 目录渲染

#### 6:19 竖屏版本
- 尺寸: 606×1920 (宽:606, 高:1920)
- 输出: `/Users/x/Documents/Codex/FluidMusic/video/output-619.mp4`
- 需要创建新的 composition 子目录或修改 index.html 添加竖屏 composition
- **方案**: 创建 `my-video-619/` 子项目，复制 my-video/ 的 assets，修改 index.html 为 606×1920 布局
  - 字体缩放: 16:9 → 6:19 约 0.4x（标题 38px，正文 16px，标签 12px）
  - 布局: 文字居中，垂直排列
  - startShow.png 宽度适应窄屏

### Step 6: 渲染命令
```bash
# 16:9
cd /Users/x/Documents/Codex/FluidMusic/video/my-video
npx hyperframes render --output /Users/x/Documents/Codex/FluidMusic/video/output-169.mp4 --fps 30 --quality high

# 6:19 (如果用了子目录方案)
cd /Users/x/Documents/Codex/FluidMusic/video/my-video-619
npx hyperframes render --output /Users/x/Documents/Codex/FluidMusic/video/output-619.mp4 --fps 30 --quality high
```

### Step 7: 验证
- 确认 `/Users/x/Documents/Codex/FluidMusic/video/output-169.mp4` 存在且可播放
- 确认 `/Users/x/Documents/Codex/FluidMusic/video/output-619.mp4` 存在且可播放
- 验证旁白与画面同步
- 验证 startShow.png 图片在视频中可见

## 禁止事项
- ❌ 纯白文字
- ❌ 图片 object-fit:cover（必须用 contain）
- ❌ 渐变球体/bokeh 装饰
- ❌ 外部链接（用 "GitHub 搜索 FluidMusic" 代替）
- ❌ 场景动画重复（每场景入场动画需不同）
- ❌ 重命名 video/ 目录下的 narration.txt（保持原有引用）

## 存档规则
- 每完成一个步骤后 git commit（在 FluidMusic 仓库）
- commit message: `video: <步骤描述>`

## 参考文件
- 现有 index.html: `/Users/x/Documents/Codex/FluidMusic/video/my-video/index.html`
- 项目规格: `/Users/x/Documents/Codex/FluidMusic/video/summary.md`
- startShow.png: `/Users/x/Documents/Codex/FluidMusic/video/startShow.png`
- 现有配音: `/Users/x/Documents/Codex/FluidMusic/video/narration.wav` (46.44s, mp3 编码, 24kHz mono)

## 执行顺序
1. 生成 Edge TTS 配音 (逐句 S1-S9)
2. 拼接 → 检测静音边界 → 计算时间轴
3. 重建 index.html（10 场景含 startShow.png）
4. Lint + 渲染 16:9
5. 创建竖屏子项目 + 渲染 6:19
6. 验证输出
