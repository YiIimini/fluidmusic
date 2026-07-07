# CLAUDE_CLI_SPEC — 汽水音乐平台集成

## 任务概述
在 FluidMusic 中新增「汽水音乐」作为第三个在线音乐平台，支持搜索、播放、歌词、登录和歌单同步。

## 已知 API 端点（已验证）

### 搜索（需要 X-Helios/X-Medusa 签名头）
```
GET https://api.qishui.com/luna/pc/search/track
Headers:
  Host: api.qishui.com
  X-Helios: ZH4AADUIdsFOZKI+I/R9GFEfafOXE16cupq5lr2RdaL/+Ozc
  X-Medusa: lThnaWHQOJNB77tSQBKvGcH3BnEaPgMB/rdRF2BAASQzmXknPjtHC6qU31dVz6//UYTj6HthKEE8kz89+eKtBL0eYfyk2aNNseLQp+GPKWv75libC4u/pwbJlX1iy+iCM/7+cwUuyzmAiOVotYq2bu1ynlUachONh848M3BcYSA6RFiNLGTRyypqDXojtsw/Vk0O95NHyRF6/RXP6era0ChXVh6KZKh41HJfsqz721CuoXatRf818erCcV4+OJAxlDNiNQ5W28gRwWLcziR7Z/IJRN+pfg5SJU9bUcmSZSAvlms4ciyV6WjHxZrHo0Jy/CeEmvvMv6lnfm5pdZYU6rmYLt9N6jfnEjqNDBgbS+g3y1kslRofNmjRrs+I3g6H9a2v8my9XnzSjoSAcSaJ0Uen0fuGPRxg/zWgmIOmDyEYNYkGF8CyjoVYzKQHxxVQ0Z+V3ueasYwYxioCfbeR37VtgFHN9dI2sXJFwVrgYEv8GvCAH53fzwH/Zs4LECgyYNUkiyfvXNrPQ2Exc6i4tla6uL2Xui2C4GKgGZkOVUCQFzoI91kZUaFc5IOGkwDyU51YMz306tdtkGHO2t4EUWl9dbmgtyHTzZeJbAJUGTJwaBvYMALnUU+1PHuAEBPhP3XwzOdb5vEOD5GWrIXLYALowVjG+yf5mkN1vi0JoUe9959YV/MJ2rSCiGxA0/FmbNom++4yAJ/rbfhv8PU8JaYiZMToypUhLZS/C9kXnDCwqxF0qCJjYhPu69MJ74GLL2lPrT/r11OvLW/Nv83lZQl/yB4+7q+eP52Y1renj64eZSfXH4kXFLmdjd5x59kP517Qum9nZQnkI5xoldAHKB5l+////+///v8AAA==
  user-agent: LunaPC/3.0.0(290101097)
  x-luna-background-type: foreground
  x-luna-is-background-req: 0
  x-luna-is-local-user: 1
Params: aid=386088, app_name=luna_pc, region=cn, device_platform=windows, device_type=Windows,
        os_version=Windows+11+Home+China, fp=1088932190113307, q=<keyword>, cursor=0,
        search_id=<uuid>, search_method=input, version_name=3.0.0, version_code=30000000,
        channel=official, ac=wifi, tz_name=Asia/Shanghai

Response: { result_groups: [{ data: [{ entity: { track: { id, name, artists[{name}], album{name, url_cover{uri,urls}}, duration } } }] }] }
  - duration 是毫秒，需要 /1000 转秒
  - cover: urls[0] + uri + "~tplv-b829550vbb-c5_375x375.webp"
```

### 曲目详情 + 歌词 + 播放链接（无需认证）
```
GET https://beta-luna.douyin.com/luna/h5/seo_track?track_id={id}&device_platform=web
Headers:
  User-Agent: Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36

Response keys: status_info, lyric, seo_track, track_player, comments, related_tracks, chart_tracks
  - seo_track.track.name → 歌名
  - seo_track.track.artists[].name → 歌手名
  - seo_track.track.album.name → 专辑名
  - seo_track.track.duration → 时长(ms)
  - track_player.video_model (JSON string) → 解析后 .video_list[0].main_url 或 .backup_url
  - track_player.url_player_info → 备用播放链接获取URL
  - lyric.content → KRC 格式歌词（需要转换为 LRC）
```

### 歌词 KRC→LRC 转换
KRC 格式: `[start_time,duration]<0,370,0>文<440,370,0>字...`
需要转换为标准 LRC: `[mm:ss.cc]文字...`

### 登录
使用抖音通行证 OAuth，登录 URL: `https://www.douyin.com/passport/web/login/`
- Cookie 关键字段: `sessionid`, `passport_csrf_token`, `sid_guard`
- Session partition: `persist:fluidmusic-qishui-login`

### 用户歌单 API（需要登录 Cookie，待后续验证）
```
GET https://api.qishui.com/luna/pc/user/playlist?...
Headers: 同上搜索 API + Cookie
```

---

## 改动文件清单（按顺序）

### S1: 类型系统扩展 (3 files)

**src/types/track.ts**
- `Track.platform` 联合类型: `'netease' | 'qq' | 'qishui' | 'local'`
- `Playlist.platform` 同上

**src/types/user.ts**
- `UserProfile.platform` 同上
- `LoginState.platform` 同上

**src/types/index.ts**
- 无需改动（barrel export）

### S2: server.js — Express 代理层

新增端点（约 120 行），放在 NetEase/QQ 端点之后、cover-proxy 之前：

1. `GET /api/qishui/search` — 转发搜索请求到 `api.qishui.com/luna/pc/search/track`，自动注入 X-Helios/X-Medusa 等固定签名头
2. `GET /api/qishui/track/detail` — 转发到 `beta-luna.douyin.com/luna/h5/seo_track`，解析 video_model 返回直接播放 URL
3. `GET /api/qishui/lyric` — 转发到 seo_track 端点，提取 lyric.content 并转换为 LRC 格式
4. `GET /api/qishui/song/url` — 从 seo_track 的 video_model 提取播放 URL
5. `GET /api/qishui/user/playlist` — 转发到汽水音乐用户歌单 API（需要 Cookie）
6. `GET /api/qishui/user/detail` — 用户信息 API（需要 Cookie）

LRC 转换函数写在 server.js 中：
```js
function krcToLrc(krcContent) {
  if (!krcContent) return '';
  const lines = krcContent.split('\n');
  const result = [];
  for (const line of lines) {
    const match = line.match(/^\[(\d+),(\d+)\](.*)/);
    if (!match) continue;
    const startTime = parseInt(match[1]);
    const minutes = Math.floor(startTime / 60000);
    const seconds = Math.floor((startTime % 60000) / 1000);
    const centiseconds = Math.floor((startTime % 1000) / 10);
    const text = match[3].replace(/<[^>]*>/g, '');
    result.push(`[${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(centiseconds).padStart(2,'0')}]${text}`);
  }
  return result.join('\n');
}
```

Cookie 管理: `persistentCookies` 对象新增 `qishui` 键。

### S3: src/core/api-bridge.ts — 前端桥接层

所有改动与现有的 `netease`/`qq` 模式一致：

1. `Platform` 类型扩展为 `'netease' | 'qq' | 'qishui'`
2. `PlaylistMap` 新增 `qishui: Playlist[]`
3. `FluidMusicIPC` 接口无需改动（loginPlatform/logoutPlatform 已通过字符串参数支持）
4. Cookie store 新增 `qishui` 条目
5. 新增 getter: `isQishuiLoggedIn`
6. `init()` 方法中新增 qishui 登录状态恢复逻辑
7. `fetchUserPlaylists()` 新增 qishui 分支
8. 新增方法:
   - `searchQishui(keywords, limit)` — 调用 `/api/qishui/search`
   - `getQishuiTrackDetail(id)` — 调用 `/api/qishui/track/detail`
   - `getQishuiLyric(id)` — 调用 `/api/qishui/lyric`
   - `getQishuiSongUrl(id)` — 调用 `/api/qishui/song/url`
   - `fetchQishuiUserDetail()` — 调用 `/api/qishui/user/detail`
9. `searchSongs()` 方法新增 qishui 结果合并
10. `searchQQAsResult()` → 同样模式新增 `searchQishuiAsResult()`
11. `getLoginStatus()` 新增 qishui 平台

### S4: desktop/main.js — Electron 主进程

1. **Session partition**: `const QISHUI_LOGIN_PARTITION = 'persist:fluidmusic-qishui-login';`
2. **登录 URL**: `const QISHUI_LOGIN_URL = 'https://www.douyin.com/passport/web/login/';`
3. **Cookie 域名检查**: `isQishuiCookieDomain()` — 匹配 `.douyin.com`、`.qishui.com` 等
4. **Cookie 优先级列表**: `QISHUI_LOGIN_COOKIE_PRIORITY` — `['sessionid', 'passport_csrf_token', 'sid_guard', ...]`
5. **Cookie 验证**: `qishuiCookieHasLogin()` — 检查 sessionid + passport_csrf_token 是否存在
6. **登录窗口**: `openQishuiLoginWindow()` — 参照 `openQQMusicLoginWindow` 模式
7. **登出**: `clearQishuiLoginSession()` — 清除 session + 加密存储
8. **IPC handlers**:
   - `case 'qishui'` in `fluidmusic-login-platform`
   - `case 'qishui'` in `fluidmusic-logout-platform`
9. **getLoginStatus** 返回新增 `qishui: { loggedIn, cookie }`
10. **Cookie 注入**: `server.setCookies()` 调用新增 qishui 参数
11. **Cookie store**: `cookieStore` 新增 `qishui: ''`
12. **Cookie 持久化**: 启动时从 `secureLoadCookie('qishui')` 恢复

### S5: desktop/preload.js

无需结构性改动。现有的 `loginPlatform('qishui')` 和 `logoutPlatform('qishui')` 已通过 IPC 字符串参数支持。

### S6: desktop/cookie-store.js

已有文件支持任意 platform 键名 — `saveCookie('qishui', ...)`, `loadCookie('qishui')`, `deleteCookie('qishui')`。无需改动。

### S7: UI 前端层 (public/js/)

**public/js/api-bridge.js** (如果没有 TypeScript 版本则需要同步)
- 与 api-bridge.ts 同等的改动

**public/js/user-panel.js** 或对应的用户面板文件
- 账号管理区新增「汽水音乐」登录按钮
- 调用 `apiBridge.loginPlatform('qishui')`
- 显示登录状态和头像

**public/js/i18n.js**
- 新增翻译键:
  - `login.qishui` = `'汽水音乐'`
  - `platform.qishui` = `'汽水音乐'`

---

## 实施约束

1. 所有新增代码遵循现有项目的代码风格（TypeScript 类 + Express 路由 + Electron IPC）
2. X-Helios/X-Medusa 值硬编码在 server.js 中（作为常量），因为这些是设备指纹签名头
3. KRC→LRC 转换在 server.js 端完成，前端接收标准 LRC 格式
4. 汽水音乐的 search_id 每次请求动态生成 UUID
5. Cookie 持久化使用现有的 `cookie-store.js`（macOS Keychain 加密）
6. 登录窗口大小和 QQ音乐/网易云保持一致（940×760）

## 测试验证

开发完成后执行：
1. `npm run typecheck` — TypeScript 类型检查通过
2. `npm test` — 现有测试全部通过
3. `curl http://127.0.0.1:3000/api/qishui/search?keywords=告白气球` — 返回搜索结果
4. `curl http://127.0.0.1:3000/api/qishui/track/detail?id=7096147956177078286` — 返回曲目详情+播放URL+歌词

## 关键参考文件
- src/core/api-bridge.ts (ApiBridge 类结构)
- src/types/track.ts (Track/Playlist 类型)
- src/types/user.ts (UserProfile/LoginState 类型)
- server.js (Express 代理模式)
- desktop/main.js (Electron 登录窗口 + IPC 模式)
- desktop/preload.js (IPC 桥接)
