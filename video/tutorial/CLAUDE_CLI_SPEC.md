# FluidMusic 使用教程视频 — Claude CLI 任务规格

## 项目路径
- 视频项目目录: `/Users/x/Documents/Codex/FluidMusic/video/tutorial/`
- 输出视频目录: `/Users/x/Documents/Codex/FluidMusic/video/`
- md-to-video 技能目录: `/Users/x/.codex/skills/md-to-video/`
- 教程 Markdown: `/Users/x/Documents/Codex/FluidMusic/video/tutorial/TUTORIAL.md`
- 旁白脚本: `/Users/x/Documents/Codex/FluidMusic/video/tutorial/narration.txt`

## 任务概述
为 FluidMusic 制作使用教程视频，输出 16:9 和 9:16 双比例。

## 配色方案
使用 **aurora-night**（暗夜紫金，默认）:
- --bg: #08081A
- --text: #F5F0FF
- --accent: #A78BFA
- --gold: #E0B84C

## 布局模板
使用 **standard** 模板（图文分区，均衡布局）

## 截图资源（已就位）
所有截图在 `/Users/x/Documents/Codex/FluidMusic/video/` 下：
- startShow.png — 应用主界面展示（1700×980）
- 001.png — 3D 粒子封面（1700×980）
- 002.png — 背景特效（1700×980）
- 003.png — DIY 设置面板（1700×980）
- 004.png — 悬浮仓布局（1700×980）

场景图片映射：
- S1: 无图，纯标题
- S2: startShow.png
- S3: 001.png
- S4: 002.png
- S5: 003.png
- S6: 004.png
- S7: 无图，纯文字
- S8: 无图，纯文字
- S9: 无图，纯结尾

## 旁白脚本（9 场景）

已在 `/Users/x/Documents/Codex/FluidMusic/video/tutorial/narration.txt`:
```
S1|FluidMusic 使用教程，三分钟快速上手
S2|启动后你会看到深色流体背景的主窗口，中心是 3D 粒子封面，四周环绕悬浮仓
S3|专辑封面化作数千动态粒子，用鼠标拖拽可以旋转三维视角，切歌时粒子如沙般散开再聚合
S4|在设置面板的背景标签页，三种视觉模式自由切换，九套配色方案点击即换
S5|七个标签页覆盖全部自定义项，从粒子封面到歌词显示，所有参数实时预览
S6|上下左右四个悬浮仓：上方歌曲队列、左侧歌单浏览、右侧实时歌词、下方播放控制，鼠标悬停即显
S7|空格播放暂停，方向键切歌调音量，完整集成 macOS 媒体键，锁屏也能控制
S8|桌面歌词独立窗口始终置顶，迷你播放器节省空间，在右键菜单中即可打开
S9|打开 FluidMusic，导入歌单，调好配色，沉浸式享受音乐与视觉的双重盛宴。感谢观看
```

## Edge TTS 配音参数
- 语音: zh-CN-XiaoxiaoNeural
- 速率: **+35%**（不是 +18% 也不是 +100%）
- 逐句生成 S1-S9 wav，然后用 ffmpeg concat 拼接为 narration.wav
- 拼接后用 ffmpeg silencedetect 检测每句实际时间边界

```bash
# 逐句生成示例
edge-tts --voice zh-CN-XiaoxiaoNeural --rate=+35% --text "FluidMusic 使用教程，三分钟快速上手" --write-media /tmp/s1.wav
# ... 重复 S2-S9
# 拼接
ffmpeg -f concat -safe 0 -i <(for f in s1 s2 s3 s4 s5 s6 s7 s8 s9; do echo "file '/tmp/$f.wav'"; done) -c copy /tmp/narration_combined.wav
# 检测静音边界
ffmpeg -i /tmp/narration_combined.wav -af "silencedetect=noise=-30dB:d=0.3" -f null - 2>&1 | grep silence
```

## 场景设计

### S1: 开场（标题粒子爆发）
- 标题 "FluidMusic" 大字 96px
- 副标题 "使用教程" 
- 标签 "FLUID MUSIC"
- 入场动画: particle burst + scale 弹入（back.out 缓动）
- 光扫标题效果
- 金色装饰线

### S2: 界面概览（startShow.png）
- 左侧: startShow.png（contain，max-width 680px）
- 右侧: 毛玻璃面板
  - 标签 "界面概览"
  - 标题 "macOS 桌面音乐"
  - 描述文字
  - 标签: 3D粒子封面 / 悬浮仓 / 流体背景
- 入场: slide-in 左右分入

### S3: 3D 粒子封面（001.png）
- 左侧: 001.png
- 右侧: 毛玻璃面板
  - 标签 "3D 粒子封面"
  - 标题 "动态粒子云"
  - 描述: 鼠标拖拽旋转 / 频谱律动 / 沙画切歌
  - 标签: 软光点 / 多层粒子 / 环绕光晕
- 入场: rotateX 翻转

### S4: 背景特效（002.png）
- 左侧: 002.png
- 右侧: 毛玻璃面板
  - 标签 "背景特效"
  - 标题 "三种视觉模式"
  - 描述: 流体水波纹 / 不规则几何 / 纯色静态 / 九套配色
- 入场: clip-path reveal

### S5: DIY 设置（003.png）
- 左侧: 003.png
- 右侧: 毛玻璃面板
  - 标签 "DIY 设置"
  - 标题 "七标签页控制面板"
  - 7 个标签行（stagger 入场）: 特效 封面 歌词 歌单 背景 悬浮仓 系统
  - 描述: 实时预览 / 配置备份
- 入场: scale + stagger tags

### S6: 悬浮仓（004.png）
- 左侧: 004.png
- 右侧: 毛玻璃面板
  - 标签 "悬浮仓"
  - 标题 "四分区毛玻璃"
  - 2×2 网格: 上队列 / 左歌单 / 右歌词 / 下控制
  - 描述: hover 触发 / 常驻模式
- 入场: 四宫格依次弹出

### S7: 快捷键
- 居中毛玻璃面板
  - 标签 "操作体验"
  - 标题 "完整快捷键"
  - 列表: 空格播放 / 方向键切歌 / M静音 / L收藏
  - 标签: macOS 媒体键 / Media Session
- 入场: stagger x slide

### S8: 桌面歌词
- 居中毛玻璃面板
  - 标签 "辅助窗口"
  - 标题 "桌面歌词 & 迷你播放器"
  - 描述: 独立窗口置顶 / 精简控制界面
- 入场: clip-path 横向展开

### S9: 结尾
- 居中毛玻璃面板
  - 标签 "FLUID MUSIC"
  - 标题 "开始体验"
  - 金色感谢文字
  - 1.5s fade-out + 0.5s 黑场

## GSAP 时间轴规则
- 全局 `gsap.timeline({ paused: true })`
- 每场景入场动画不同（禁止重复动画类型）
- 字幕 #cap 用紫色-金色-红色渐变
- 全局 28 个浮动粒子，持续运动
- 场景切换: opacity 渐变 + translateY 微移，0.6s
- 每场景至少 2 种动画

## 图片规则（强制）
```css
object-fit: contain;  /* 绝不 cover */
max-width: 85%;
max-height: 68vh;
border-radius: 16px;
box-shadow: 0 20px 60px rgba(139, 92, 246, 0.15);
```
- 图片路径相对于 index.html: `../../001.png` 等
- 渲染前 `grep "object-fit.*cover" index.html` 必须返回 0

## 双比例渲染

### 16:9 版本
- 目录: `/Users/x/Documents/Codex/FluidMusic/video/tutorial/`
- 尺寸: 1920×1080
- 输出: `/Users/x/Documents/Codex/FluidMusic/video/tutorial-output-169.mp4`

### 9:16 版本
- 创建子目录: `/Users/x/Documents/Codex/FluidMusic/video/tutorial/render-916/`
- 尺寸: 1080×1920
- 独立 index.html，竖向排版，图片路径改为 `../../../video/xxx.png`
- 字体缩放: 16:9 → 9:16 约 0.7x
- 输出: `/Users/x/Documents/Codex/FluidMusic/video/tutorial-output-916.mp4`

## 全局层
```html
<audio id="narration" src="narration.wav" data-start="0" data-duration="N" preload="auto"></audio>
<div id="vignette">暗角 z-index:90</div>
<div id="grain">噪点 z-index:91 opacity:0.03</div>
<div id="particles">浮动点 z-index:89</div>
<div id="cap">字幕区 z-index:95</div>
```

## 禁止事项
- ❌ 纯白 #FFFFFF 文字
- ❌ 暗色文字 (R+G+B < 400)
- ❌ object-fit:cover
- ❌ 外部链接
- ❌ 渐变球体/bokeh 装饰
- ❌ 场景动画重复
- ❌ 静态画面无动画
- ❌ 开场慢速 fade-in（前 3 秒必须有冲击力）
- ❌ 结尾生硬无收尾句
- ❌ 场景切换硬切无过渡
- ❌ 第三方平台名称（网易云/QQ音乐/酷狗等全部替换为通用描述）
- ❌ 下载推荐

## 内容合规检查
渲染前运行:
```bash
grep -n -iE '网易云|QQ音乐|酷狗|酷我|虾米|千千|下载|http://|https://' index.html narration.txt 2>/dev/null
```
必须返回空（无匹配行）。

## 执行步骤（按顺序）
1. 阅读 TUTORIAL.md 和 narration.txt
2. 逐句生成 Edge TTS 配音 S1-S9 wav，速率 +35%
3. ffmpeg 拼接全部 wav → narration.wav
4. ffmpeg silencedetect 检测静音边界，记录每句 start_time
5. 创建 16:9 index.html（基于 standard 模板 + aurora-night 配色）
6. 填充9个场景 HTML + GSAP 时间轴
7. Lint 检查: `npx hyperframes lint`
8. 内容合规终检
9. 渲染 16:9: `npx hyperframes render --quality high --output ../tutorial-output-169.mp4`
10. 创建 9:16 子项目，独立 index.html 竖向排版
11. Lint 9:16
12. 渲染 9:16: `cd render-916 && npx hyperframes render --quality high --output ../../tutorial-output-916.mp4`
13. 验证两个 MP4 文件存在且非空

## 存档规则
每完成一个步骤后 git commit:
```bash
cd /Users/x/Documents/Codex/FluidMusic && git add video/tutorial/ && git commit -m "video(tutorial): <步骤描述>"
```

## 技术规格参考
- 现有 16:9 index.html 参考: `/Users/x/Documents/Codex/FluidMusic/video/my-video/index.html`
- md-to-video 16:9 standard 模板: `/Users/x/.codex/skills/md-to-video/templates/169/standard.html`
- md-to-video 9:16 standard 模板: `/Users/x/.codex/skills/md-to-video/templates/916/standard.html`
- 配色方案 CSS: `/Users/x/.codex/skills/md-to-video/schemes/aurora-night.css`
- HyperFrames 配置参考: `/Users/x/Documents/Codex/FluidMusic/video/my-video/package.json`
