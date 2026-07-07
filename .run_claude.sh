#!/bin/bash
cd /Users/x/Documents/Codex/FluidMusic
export PATH="/Users/x/.local/bin:$PATH"
exec 1> .claude-cli.log 2>&1
echo "=== CLAUDE CLI START $(date) ==="

claude -p '严格按照 CLAUDE_CLI_SPEC.md 中的规格说明，为 FluidMusic 项目新增汽水音乐平台集成。按 S1→S7 顺序实施所有改动：

S1: 扩展类型系统 — src/types/track.ts (platform 联合类型新增 qishui), src/types/user.ts (platform 新增 qishui)
S2: server.js 新增汽水音乐 API 代理端点（搜索 /api/qishui/search、曲目详情+歌词LRC转换 /api/qishui/track/detail、播放URL /api/qishui/song/url、用户歌单 /api/qishui/user/playlist、用户详情 /api/qishui/user/detail）
S3: src/core/api-bridge.ts 扩展 Platform 类型、cookie store 新增 qishui、新增搜索/歌单/用户方法、searchSongs 合并 qishui 结果
S4: desktop/main.js 新增登录窗口(QISHUI_LOGIN_PARTITION=persist:fluidmusic-qishui-login, 登录URL=https://www.douyin.com/passport/web/login/)、Cookie 管理、IPC handlers case qishui, getLoginStatus 返回 qishui
S5: desktop/preload.js 确认兼容性（loginPlatform/logoutPlatform 已支持字符串参数，无需改动）
S6: desktop/cookie-store.js 确认兼容性（saveCookie/loadCookie/deleteCookie 已支持任意 platform 键，无需改动）
S7: public/js/ 用户面板和 i18n 更新（新增 login.qishui=汽水音乐 翻译键 + 登录按钮）

请完整实施所有改动，不要跳过任何步骤。实施后运行 npm run typecheck 确保无类型错误。所有端点使用 SPEC 中记录的已验证 API 端点和签名头。' --allow-dangerously-skip-permissions

echo "=== CLAUDE CLI END $(date) ==="
