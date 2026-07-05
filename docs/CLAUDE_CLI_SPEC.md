# FluidMusic — 全平台音源接入规格 v2

## 目标
将 FluidMusic 从「网易云 + QQ音乐」扩展为全平台音乐播放器。自己实现 6 个核心平台 adapter + 对接 lx-music-api-server 兜底长尾平台。

## 项目路径
- 根目录: `/Users/x/Documents/Codex/FluidMusic`
- TypeScript 源码: `src/`
- Legacy JS: `public/js/`
- Electron 主进程: `desktop/`
- Express 代理: `server.js`

## 接入平台清单

| 平台 | 标识符 | 优先级 | 登录 | API 模式 |
|------|--------|--------|------|----------|
| 网易云音乐 | netease | P0 ✅ | OAuth | 非官方 API（已有，迁移到 adapter） |
| QQ音乐 | qq | P0 ✅ | 扫码 | 非官方 API（已有，迁移到 adapter） |
| 酷狗音乐 | kugou | P1 🆕 | Cookie | 非官方 mobile API |
| 酷我音乐 | kuwo | P1 🆕 | CSRF+Cookie | 非官方 API |
| 咪咕音乐 | migu | P1 🆕 | 无需 | 公开 API |
| 汽水音乐 | qishui | P1 🆕 | 无需 | Luna PC API (X-Helios/X-Medusa 签名) |
| Spotify | spotify | P2 🆕 | OAuth2 PKCE | 官方 REST API |
| Apple Music | applemusic | P2 🆕 | MusicKit JWT | 官方 API |
| LX 兜底 | lx | P2 🆕 | - | 转发到 lx-music-api-server |

## 架构设计

### 1. Adapter 接口 (`src/platform/adapters/adapter-interface.ts`)

```ts
export type MusicPlatform = 'netease' | 'qq' | 'kugou' | 'kuwo' | 'migu' | 'qishui' | 'spotify' | 'applemusic' | 'lx';

export interface MusicSourceAdapter {
  platform: MusicPlatform;
  name: string;
  search(query: string, limit?: number): Promise<SearchResult>;
  getSongUrl(id: string): Promise<string>;
  getLyric(id: string): Promise<string>;
  getPlaylistDetail(id: string): Promise<Playlist>;
  getUserPlaylists(): Promise<Playlist[]>;
  isLoggedIn(): boolean;
  login(): Promise<boolean>;
  logout(): Promise<void>;
  getUserProfile(): UserProfile | null;
  init(): Promise<void>;
  destroy(): void;
}
```

### 2. 类型扩展
- `src/types/track.ts`: `platform` 类型从 `'netease' | 'qq' | 'local'` → `MusicPlatform | 'local'`
- `src/types/user.ts`: `UserProfile.platform` 同理扩展

### 3. Adapter Registry (`src/platform/adapters/adapter-registry.ts`)
- 注册/查找 adapter
- `searchAll(query)` — Promise.allSettled 并发全平台，某平台挂了不影响

### 4. LX Adapter 特殊设计
`lx-adapter.ts` 不直接调用第三方 API，而是转发到本地的 `lx-music-api-server`:
```ts
// 所有 API 调用格式: POST http://127.0.0.1:9763/api/{platform}/{action}
// 例如搜索酷狗: POST /api/kw/search { keyword: "xxx", page: 1, limit: 20 }
```

## API 端点参考

### 酷狗音乐
```
搜索: GET mobilecdn.kugou.com/api/v3/search/song
  ?format=json&keyword=KEYWORD&page=1&pagesize=20&showtype=1
  Headers: { User-Agent: 'Mozilla/5.0...' }

歌曲详情+播放URL: GET m.kugou.com/app/i/getSongInfo.php
  ?hash=HASH&cmd=playInfo

歌词: GET kugou.com/yy/index.php?r=play/getdata&hash=HASH
```

### 酷我音乐
```
搜索: GET kuwo.cn/api/www/search/searchMusicBykeyWord
  ?key=KEYWORD&pn=1&rn=20
  Headers: { Referer: 'http://kuwo.cn/', csrf: CSRF_TOKEN, cookie: 'kw_token=XXX' }
  注意: 需先 GET kuwo.cn 获取 CSRF token，再带 token 搜索

歌曲URL: GET kuwo.cn/url?format=mp3&rid=MUSICRID&response=url&type=convert_url3
歌词: GET m.kuwo.cn/newh5/singles/songinfoandlrc?musicId=MUSICRID
```

### 咪咕音乐
```
搜索: GET music.migu.cn/v3/api/music/audioPlayer/getSongDetail?songId=SONG_ID
播放: GET music.migu.cn/v3/api/music/audioPlayer/getPlayInfo?dataType=2&data=SONG_ID
歌词: GET music.migu.cn/v3/api/music/audioPlayer/getLyric?copyrightId=XXX
```

### 汽水音乐 (ByteDance Luna PC)
```
搜索: GET api.qishui.com/luna/pc/search/track
  ?aid=386088&app_name=luna_pc&q=KEYWORD&cursor=0&...
  Headers: {
    'Host': 'api.qishui.com',
    'X-Helios': 'ZH4AADUIdsFOZKI+I/R9GFEfafOXE16cupq5lr2RdaL/+Ozc',
    'X-Medusa': 'lThnaWHQOJNB77tSQBKvGcH3BnEaPgMB/rdRF2BAASQzmXknPjtHC6qU31dVz6//...',
    'user-agent': 'LunaPC/3.0.0(290101097)',
    'x-luna-background-type': 'foreground',
  }

歌曲详情+播放URL: GET api.qishui.com/luna/h5/track?track_id=ID
  返回 track_player.url_player_info → JSON.parse → video_list[0].main_url
  歌词: lyric.content 字段 (KRC 格式，需转 LRC)
  
注意: X-Helios/X-Medusa 是客户端签名 token，可能定期过期，需要维护
```

### Spotify
```
Token: POST accounts.spotify.com/api/token
  Body: grant_type=client_credentials
  Headers: { Authorization: 'Basic BASE64(CLIENT_ID:CLIENT_SECRET)' }

搜索: GET api.spotify.com/v1/search?q=QUERY&type=track&limit=20
  Headers: { Authorization: 'Bearer TOKEN' }

播放URL: track 对象的 preview_url 字段 (30秒预览)
完整播放需要 Premium + OAuth2 PKCE
```

### Apple Music
```
搜索: GET api.music.apple.com/v1/catalog/cn/search?term=QUERY&types=songs&limit=20
  Headers: { Authorization: 'Bearer DEVELOPER_TOKEN',
             'Music-User-Token': USER_TOKEN }
  注意: Developer Token 需要 Apple Developer Program ($99/年)
```

## 实现步骤 (15 步)

### Step 1: 扩展类型定义
- `src/types/track.ts` — MusicPlatform 联合类型
- `src/types/user.ts` — platform 字段扩展

### Step 2: 创建 Adapter 接口
- `src/platform/adapters/adapter-interface.ts`

### Step 3: 创建 Adapter Registry
- `src/platform/adapters/adapter-registry.ts`

### Step 4: 迁移 netease-adapter.ts
- 从 `src/core/api-bridge.ts` + `public/js/api-bridge.js` 提取网易云逻辑

### Step 5: 迁移 qq-adapter.ts
- 同上

### Step 6: 创建 kugou-adapter.ts (酷狗)
- server.js 端: 代理到 mobilecdn.kugou.com / m.kugou.com / kugou.com
- 前端: search / getSongUrl / getLyric 方法

### Step 7: 创建 kuwo-adapter.ts (酷我)
- server.js 端: CSRF token 获取 + 代理到 kuwo.cn / m.kuwo.cn
- 注意 CSRF 流程: 先 GET 主页 → 解析 token → 带 token 搜索

### Step 8: 创建 migu-adapter.ts (咪咕)
- server.js 端: 代理到 music.migu.cn

### Step 9: 创建 qishui-adapter.ts (汽水音乐)
- server.js 端: 代理到 api.qishui.com（带 X-Helios/X-Medusa 签名）
- KRC 歌词转 LRC 工具函数

### Step 10: 创建 spotify-adapter.ts (Spotify)
- server.js 端: client_credentials OAuth2 → token 缓存
- 代理到 api.spotify.com

### Step 11: 创建 applemusic-adapter.ts (Apple Music)
- 基础架构（完整可用性取决于 Developer Token）

### Step 12: 创建 lx-adapter.ts (LX 兜底)
- 转发到 lx-music-api-server (默认端口 9763)
- 覆盖长尾平台: 5sing、千千、猫耳FM 等

### Step 13: 扩展 server.js
- 通用代理工厂函数 createProxyHandler(platform)
- 为每个平台注册路由: search / songUrl / lyric / playlist
- Spotify token 管理

### Step 14: 扩展 Electron 主进程
- `desktop/main.js`: 酷狗/酷我/Spotify 的登录 BrowserWindow
- `desktop/cookie-store.js`: 扩展 cookie 存储键
- `desktop/preload.js`: 扩展 IPC 通道

### Step 15: 重构前端
- 更新 `public/js/api-bridge.js` → 使用 AdapterRegistry
- 更新 `public/js/search.js` → 多平台聚合展示
- 更新 `public/js/diy-settings.js` → 平台筛选 UI

## 通用代理工厂 (server.js)

减少样板代码：
```js
const PLATFORM_CONFIG = {
  kugou: {
    search: { url: 'http://mobilecdn.kugou.com/api/v3/search/song', params: { format: 'json', showtype: '1' } },
    songUrl: { url: 'http://m.kugou.com/app/i/getSongInfo.php', params: { cmd: 'playInfo' } },
    lyric: { url: 'http://kugou.com/yy/index.php', params: { r: 'play/getdata' } },
  },
  // ... 其他平台
};

function createApiRoute(app, platform, action) {
  const cfg = PLATFORM_CONFIG[platform][action];
  app.get(`/api/${platform}/${action}`, (req, res) => {
    const cookie = req.headers['x-cookie'] || persistentCookies[platform] || '';
    proxyRequest(res, cfg.url, {
      cookie, platform,
      params: { ...cfg.params, ...req.query },
      referer: cfg.referer,
      ua: cfg.ua,
    });
  });
}
```

## 搜索聚合

```ts
// adapter-registry.ts
async searchAll(query: string, limit = 20): Promise<SearchResult> {
  const enabled = this.getEnabledAdapters(); // 只搜已登录/可用的平台
  const results = await Promise.allSettled(
    enabled.map(a => a.search(query, limit))
  );
  const tracks: Track[] = [];
  let total = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      tracks.push(...r.value.tracks);
      total += r.value.total;
    }
  }
  return { tracks, total, hasMore: tracks.length >= limit * enabled.length };
}
```

## 注意事项

1. **酷狗** — 可能被 WAF 挡，需尝试不同 User-Agent
2. **酷我** — 必须先获取 CSRF token
3. **汽水** — X-Helios/X-Medusa 会过期，需要维护
4. **Spotify** — client_credentials 拿到的 token 有效期 1 小时
5. **Apple Music** — 不付费不完整，先搭架子
6. **LX 兜底** — 依赖用户安装 lx-music-api-server
7. **Cookie 加密** — 所有 cookie 通过 Electron safeStorage 存储

## 存档规则
每步完成后 git commit: `platform: <步骤描述>`

## 执行指令
按步骤顺序执行。每完成一步输出 `✅ STEP N 完成: <描述>`。
全部完成后输出 `✅ ALL DONE`。
