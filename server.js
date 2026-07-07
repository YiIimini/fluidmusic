const express = require('express');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');

// ── Persistent cookie store (survives server restarts) ──
// Cookies are injected by the Electron main process via setCookies()
// Falls back to legacy plaintext files if running standalone
let persistentCookies = { netease: '', qq: '', qishui: '' };

// Legacy fallback: read plaintext files (only used when running without Electron)
const COOKIE_FILE = path.join(__dirname, '.cookie');
const QQ_COOKIE_FILE = path.join(__dirname, '.qq-cookie');
try { if (fs.existsSync(COOKIE_FILE) && !persistentCookies.netease) persistentCookies.netease = fs.readFileSync(COOKIE_FILE, 'utf8').trim(); }
catch (e) { /* ignore */ }
try { if (fs.existsSync(QQ_COOKIE_FILE) && !persistentCookies.qq) persistentCookies.qq = fs.readFileSync(QQ_COOKIE_FILE, 'utf8').trim(); }
catch (e) { /* ignore */ }

// Called by main.js to inject decrypted cookies at startup
function setCookies(netease, qq, qishui) {
  if (netease) persistentCookies.netease = netease;
  if (qq) persistentCookies.qq = qq;
  if (qishui) persistentCookies.qishui = qishui;
  console.log('[CookieStore] Cookies injected from main process | netease:', !!netease, '| qq:', !!qq, '| qishui:', !!qishui);
}

function savePersistentCookie(platform, cookie) {
  if (!cookie) return;
  persistentCookies[platform] = cookie;
  // Main process handles encrypted persistence via cookie-store.js
  // Legacy fallback: write to plaintext file
  try {
    const file = platform === 'qq' ? QQ_COOKIE_FILE : COOKIE_FILE;
    fs.writeFileSync(file, cookie);
  } catch (e) { /* ignore */ }
  console.log('[CookieStore] Saved ' + platform + ' cookie (' + cookie.length + ' bytes)');
}


const app = express();
app.disable('etag');
const PORT = process.env.PORT || 3000;

// Serve static files from public/
app.use(express.static(path.join(__dirname, 'public'), { setHeaders: (res) => { res.set('Cache-Control', 'no-store'); }}));

// ── Security headers ──
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'no-referrer',
    'X-DNS-Prefetch-Control': 'off',
  });
  next();
});
app.use(express.json());

// ── Background video serving ──
app.get('/bg-video', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const videoDir = process.env.BG_VIDEO_PATH;
    if (!videoDir) return res.status(404).end();
    // Find the bg-video file in the directory
    const files = fs.readdirSync(videoDir).filter(f => f.startsWith('bg-video'));
    if (files.length === 0) return res.status(404).end();
    const videoPath = path.join(videoDir, files[0]);
    if (!fs.existsSync(videoPath)) return res.status(404).end();
    const ext = path.extname(videoPath).toLowerCase();
    const mimeMap = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo' };
    res.setHeader('Content-Type', mimeMap[ext] || 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache');
    fs.createReadStream(videoPath).pipe(res);
  } catch (e) {
    res.status(500).end();
  }
});

// ── API Proxy Helper ──
function proxyRequest(targetUrl, res, options = {}) {
  const parsed = new URL(targetUrl);
  const transport = parsed.protocol === 'https:' ? https : http;

  const reqOptions = {
    hostname: parsed.hostname,
    port: parsed.port,
    path: parsed.pathname + parsed.search,
    method: options.method || 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Referer': options.referer || `${parsed.protocol}//${parsed.hostname}/`,
      ...(options.headers || {}),
    },
  };

  // Merge frontend cookies with persistent fallback
  let effectiveCookie = options.cookie || '';
  if (!effectiveCookie && options.platform) {
    effectiveCookie = persistentCookies[options.platform] || '';
    if (effectiveCookie) {
      console.log('[Proxy] Using persistent cookie for', options.platform, '(' + effectiveCookie.length + ' bytes)');
    }
  }
  // Save cookie for persistence when coming from frontend
  if (options.cookie && options.platform && options.cookie !== persistentCookies[options.platform]) {
    savePersistentCookie(options.platform, options.cookie);
  }

  if (effectiveCookie) {
    reqOptions.headers['Cookie'] = effectiveCookie;
    const cookieKeys = effectiveCookie.split(';').map(c => c.trim().split('=')[0]).filter(Boolean);
    console.log('[Proxy] Cookie present, length:', effectiveCookie.length, 'keys:', cookieKeys.join(','));
  } else {
    console.log('[Proxy] No cookie in request');
  }

  console.log('[Proxy] →', reqOptions.method, targetUrl.substring(0, 120));

  const proxyReq = transport.request(reqOptions, (proxyRes) => {
    let data = '';
    proxyRes.on('data', (chunk) => data += chunk);
    proxyRes.on('end', () => {
      const summary = data.length > 200
        ? data.substring(0, 200).replace(/\n\n/g, ' ') + '...'
        : data.replace(/\n/g, ' ');
      console.log('[Proxy] ←', proxyRes.statusCode, '|', data.length, 'bytes |', summary);

      try {
        const json = JSON.parse(data);
        res.json(json);
      } catch (e) {
        res.type('text/plain').send(data);
      }
    });
  });

  proxyReq.on('error', (err) => {
    console.error('[Proxy] ✗ Error:', err.message);
    res.status(502).json({ error: 'Proxy error', message: err.message });
  });

  if (options.body) {
    proxyReq.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
  }
  proxyReq.end();
}

// ── Async proxy helper — returns parsed JSON for chained requests ──
function proxyRequestAsync(targetUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const transport = parsed.protocol === 'https:' ? https : http;

    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': options.referer || `${parsed.protocol}//${parsed.hostname}/`,
        ...(options.headers || {}),
      },
    };

    if (options.cookie) {
      reqOptions.headers['Cookie'] = options.cookie;
    }

    console.log('[ProxyAsync] →', reqOptions.method, targetUrl.substring(0, 120));

    const proxyReq = transport.request(reqOptions, (proxyRes) => {
      let data = '';
      proxyRes.on('data', (chunk) => data += chunk);
      proxyRes.on('end', () => {
        console.log('[ProxyAsync] ←', proxyRes.statusCode, '|', data.length, 'bytes');
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          // Return raw string for HTML/text responses (needed by 5sing, b23.tv, etc.)
          console.log('[ProxyAsync] Non-JSON response (' + data.length + ' bytes), returning as string');
          resolve(data);
        }
      });
    });

    proxyReq.on('error', (err) => {
      console.error('[ProxyAsync] ✗ Error:', err.message);
      reject(err);
    });
    proxyReq.end();
  });
}


// Parse cookie string into key-value map
function parseCookieString(cookieText) {
  const out = {};
  String(cookieText || '').split(';').forEach(part => {
    const raw = String(part || '').trim();
    if (!raw) return;
    const idx = raw.indexOf('=');
    if (idx <= 0) return;
    const key = raw.slice(0, idx).trim();
    const value = raw.slice(idx + 1).trim();
    if (key) out[key] = value;
  });
  return out;
}
// Normalize QQ UIN: strip non-digits (QQ's p_uin is "o" + decimal UIN, not hex)
function normalizeQQUin(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.replace(/^0+/, '') || digits;
}
// Extract real QQ UIN from cookies — matches Mineradio logic
function extractUinFromCookies(cookieHeader) {
  if (!cookieHeader) return '';
  const obj = parseCookieString(cookieHeader);
  // login_type=2 means WeChat login, check wxuin first
  const raw = Number(obj.login_type) === 2
    ? (obj.wxuin || obj.uin || obj.p_uin)
    : (obj.uin || obj.qqmusic_uin || obj.wxuin || obj.p_uin);
  return normalizeQQUin(raw);
}
// Extract QQ music playback key from cookies
function qqCookiePlaybackKey(cookieHeader) {
  if (!cookieHeader) return '';
  const obj = parseCookieString(cookieHeader);
  return obj.qm_keyst || obj.qqmusic_key || obj.music_key || obj.p_skey || obj.skey || '';
}

function proxyRequestPost(targetUrl, res, options = {}) {
  const parsed = new URL(targetUrl);
  const transport = parsed.protocol === "https:" ? https : http;
  let bodyData = options.body || {};
  
  // If target is QQ music API, inject decoded UIN into request body
  if (targetUrl.includes('musicu.fcg') && options.cookie) {
    const uin = extractUinFromCookies(options.cookie);
    if (uin && bodyData.comm) {
      bodyData.comm.uin = String(uin);
      console.log('[QQ API] Injected UIN:', uin, 'into request comm');
    }
  }
  
  const body = typeof options.body === "string" ? (() => {
    // If original body was string, parse, inject uin, re-stringify
    try {
      const parsed = JSON.parse(options.body);
      if (targetUrl.includes('musicu.fcg') && options.cookie) {
        const uin = extractUinFromCookies(options.cookie);
        if (uin && parsed.comm) { parsed.comm.uin = String(uin); }
      }
      return JSON.stringify(parsed);
    } catch(e) { return options.body; }
  })() : JSON.stringify(bodyData);
  
  const reqOptions = {
    hostname: parsed.hostname, port: parsed.port,
    path: parsed.pathname + parsed.search, method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Referer": options.referer || `${parsed.protocol}//${parsed.hostname}/`,
      "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body),
      ...(options.headers || {}),
    },
  };
  if (options.cookie) reqOptions.headers["Cookie"] = options.cookie;
    if (options.cookie) {
    const cKeys = options.cookie.split(';').map(c => c.trim().split('=')[0]).filter(Boolean);
    console.log("[ProxyPost] Cookie keys:", cKeys.join(', '));
  }
  console.log("[ProxyPost] →", targetUrl.substring(0, 100));
  const proxyReq = transport.request(reqOptions, (proxyRes) => {
    let data = "";
    proxyRes.on("data", (chunk) => data += chunk);
    proxyRes.on("end", () => {
      console.log("[ProxyPost] ←", proxyRes.statusCode, "|", data.length, "bytes |", (data.length < 300 ? data : data.substring(0, 200) + "..."));
      try { res.json(JSON.parse(data)); }
      catch (e) { res.type("text/plain").send(data); }
    });
  });
  proxyReq.on("error", (err) => {
    res.status(502).json({ error: "Proxy error", message: err.message });
  });
  proxyReq.write(body);
  proxyReq.end();
}


// ── Netease API Proxy ──
app.get('/api/netease/search', (req, res) => {
  const { keywords, limit = 30, offset = 0 } = req.query;
  const url = `https://music.163.com/api/search/get?s=${encodeURIComponent(keywords)}&type=1&limit=${limit}&offset=${offset}`;
  proxyRequest(url, res, { cookie: req.headers['x-cookie'] || '' });
});

app.get('/api/netease/playlist/detail', (req, res) => {
  const { id } = req.query;
  const ts = Date.now();
  const url = `https://music.163.com/api/playlist/detail?id=${id}&timestamp=${ts}`;
  proxyRequest(url, res, { cookie: req.headers['x-cookie'] || '', referer: 'https://music.163.com/' });
});

// Account endpoint — identifies user from cookie, no uid needed
app.get('/api/netease/account', (req, res) => {
  const url = 'https://music.163.com/api/nuser/account/get';
  proxyRequest(url, res, { cookie: req.headers['x-cookie'] || '' });
});

app.get('/api/netease/user/detail', (req, res) => {
  const { uid } = req.query;
  if (!uid) {
    // Fallback: use account endpoint which identifies user from cookie
    const url = 'https://music.163.com/api/nuser/account/get';
    proxyRequest(url, res, { cookie: req.headers['x-cookie'] || '' });
  } else {
    const url = `https://music.163.com/api/user/detail?uid=${uid}`;
    proxyRequest(url, res, { cookie: req.headers['x-cookie'] || '' });
  }
});

app.get('/api/netease/user/playlist', async (req, res) => {
  let { uid } = req.query;
  const cookie = req.headers['x-cookie'] || '';
  console.log('[Playlist] Netease playlist request — uid param:', uid, '| cookie present:', !!cookie, '| cookie length:', cookie.length);

  if (!uid) {
    // Two-step: first get account → extract uid → then fetch playlists
    try {
      console.log('[Playlist] No uid provided, resolving from account endpoint...');
      const accountData = await proxyRequestAsync(
        'https://music.163.com/api/nuser/account/get',
        { cookie }
      );
      console.log('[Playlist] Account response:', JSON.stringify(accountData).substring(0, 300));
      if (accountData && accountData.profile && accountData.profile.userId) {
        uid = accountData.profile.userId;
        console.log('[Playlist] Resolved Netease uid from account:', uid);
      } else {
        console.log('[Playlist] Failed to extract userId from account response. accountData:', !!accountData, 'profile:', !!(accountData && accountData.profile));
      }
    } catch (e) {
      console.error('[Playlist] Failed to resolve Netease uid:', e.message);
    }
  }

  const timestamp = Date.now();
  const url = `https://music.163.com/api/user/playlist?uid=${uid || ''}&limit=30&offset=0&timestamp=${timestamp}`;
  console.log('[Playlist] Fetching:', url);
  proxyRequest(url, res, { cookie });
});

app.get('/api/netease/song/detail', (req, res) => {
  const { ids } = req.query;
  const url = `https://music.163.com/api/song/detail?ids=%5B${ids}%5D`;
  proxyRequest(url, res, { cookie: req.headers['x-cookie'] || '' });
});

app.get('/api/netease/song/url', (req, res) => {
  const { id } = req.query;
  const url = `https://music.163.com/api/song/enhance/player/url?id=${id}&ids=%5B${id}%5D&br=320000`;
  proxyRequest(url, res, { cookie: req.headers['x-cookie'] || '' });
});

app.get('/api/netease/lyric', (req, res) => {
  const { id } = req.query;
  const url = `https://music.163.com/api/song/lyric?id=${id}&lv=-1&kv=-1&tv=-1`;
  proxyRequest(url, res, { cookie: req.headers['x-cookie'] || '' });
});

// ── QQ Music API Proxy ──
app.get('/api/qq/search', (req, res) => {
  const { keywords, limit = 30, offset = 0 } = req.query;
  const url = `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?format=json&n=${limit}&p=${Math.floor(offset / limit) + 1}&w=${encodeURIComponent(keywords)}&cr=1`;
  proxyRequest(url, res, { cookie: req.headers['x-cookie'] || '', referer: 'https://y.qq.com' });
});

// ── QQ 歌单详情（优化：fcg_ucc_getcdinfo_byids_cp 为主端点，来自 Superheroff/musicapi 验证）──
app.get('/api/qq/playlist/detail', async (req, res) => {
  const { id } = req.query;
  const cookie = req.headers['x-cookie'] || persistentCookies.qq || '';
  const uin = extractUinFromCookies(cookie) || '0';
  const skey = parseCookieString(cookie).p_skey || '';
  const gtk = getGTK(skey);
  console.log('[QQ PlaylistDetail] id:', id, '| uin:', uin, '| hasCookie:', !!cookie);

  // Primary: fcg_ucc_getcdinfo_byids_cp (proven stable, returns full song list in one call)
  try {
    const uccUrl = `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&utf8=1&onlysong=0&disstid=${id}&format=json&g_tk=${gtk}&loginUin=${uin}&hostUin=0&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0`;
    const data = await proxyRequestAsync(uccUrl, {
      cookie,
      referer: 'https://y.qq.com/n/yqq/playlist/' + id,
      headers: { 'Referer': 'https://y.qq.com/n/yqq/playlist/' + id }
    });
    console.log('[QQ PlaylistDetail] ucc response keys:', data ? Object.keys(data).join(', ') : 'null');
    if (data && data.cdlist && data.cdlist.length > 0) {
      console.log('[QQ PlaylistDetail] ucc cdlist[0].songlist length:', data.cdlist[0].songlist?.length);
      return res.json({ cdlist: data.cdlist });
    }
    console.log('[QQ PlaylistDetail] ucc returned no cdlist, trying v8...');
  } catch (e) {
    console.warn('[QQ PlaylistDetail] ucc failed:', e.message);
  }

  // Fallback: v8 playlist detail API
  try {
    const v8Url = `https://c.y.qq.com/v8/fcg-bin/fcg_v8_playlist_cp.fcg?id=${id}&uin=${uin}&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=h5&needNewCode=1&tpl=3&page=1&limit=500`;
    const data = await proxyRequestAsync(v8Url, {
      cookie,
      referer: 'https://y.qq.com/n/yqq/playlist/' + id,
      headers: { 'Referer': 'https://y.qq.com/n/yqq/playlist/' + id }
    });
    if (data && data.code === 0) {
      if (data.data && data.data.cdlist) return res.json({ cdlist: data.data.cdlist });
      if (data.cdlist) return res.json(data);
    }
  } catch (e) {
    console.warn('[QQ PlaylistDetail] v8 failed:', e.message);
  }

  res.json({ cdlist: [] });
});


app.get('/api/qq/song/url', (req, res) => {
  const { songmid } = req.query;
  const cookie = req.headers['x-cookie'] || '';
  const uin = extractUinFromCookies(cookie) || '0';
  // Generate a stable QQ Music GUID (16-char hex, same format as QQ client)
  const guid = Array.from({length: 4}, () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0')).join('').substring(0, 16);
  const data = JSON.stringify({
    req_0: {
      module: 'vkey.GetVkeyServer',
      method: 'CgiGetVkey',
      param: {
        guid: guid,
        songmid: [songmid],
        songtype: [0],
        uin: String(uin || '0'),
        loginflag: 1,
        platform: '20',
      },
    },
  });
  const url = `https://u.y.qq.com/cgi-bin/musicu.fcg?data=${encodeURIComponent(data)}`;
  console.log('[QQ SongURL] mid:', songmid, 'uin:', uin, 'guid:', guid);
  proxyRequest(url, res, { cookie, referer: 'https://y.qq.com' });
});

// Compute QQ Music g_tk from p_skey
function getGTK(skey) {
  let hash = 5381;
  for (let i = 0; i < (skey || '').length; i++) {
    hash += (hash << 5) + skey.charCodeAt(i);
  }
  return hash & 0x7fffffff;
}

app.get("/api/qq/user/detail", (req, res) => {
  let cookie = req.headers["x-cookie"] || "";
  if (!cookie) cookie = persistentCookies.qq || "";
  const uin = extractUinFromCookies(cookie);
  const skey = parseCookieString(cookie).p_skey || '';
  const gtk = getGTK(skey);
  console.log('[QQ UserDetail] UIN:', uin, '| skey:', !!skey, '| gtk:', gtk);
  if (!uin) {
    return res.json({ code: -1, error: 'No UIN in cookies' });
  }
  const url = `https://c.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg?cid=205360838&userid=${uin}&reqfrom=1&g_tk=${gtk}&loginUin=${uin}&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0`;
  proxyRequest(url, res, { cookie, referer: 'https://y.qq.com/' });
});

app.get("/api/qq/user/playlist", async (req, res) => {
  let cookie = req.headers["x-cookie"] || "";
  if (!cookie) cookie = persistentCookies.qq || "";
  const uin = extractUinFromCookies(cookie);
  const skey = parseCookieString(cookie).p_skey || '';
  const gtk = getGTK(skey);
  console.log('[QQ Playlist] UIN:', uin, '| skey:', !!skey, '| gtk:', gtk);
  if (!uin) {
    return res.json({ code: -1, error: 'No UIN in cookies' });
  }
  try {
    const createdUrl = `https://c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss?hostUin=0&hostuin=${uin}&sin=0&size=200&g_tk=${gtk}&loginUin=${uin}&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0`;
    const collectUrl = `https://c.y.qq.com/fav/fcgi-bin/fcg_get_profile_order_asset.fcg?ct=20&cid=205360956&userid=${uin}&reqtype=3&sin=0&ein=80`;

    const [createdData, collectData] = await Promise.allSettled([
      proxyRequestAsync(createdUrl, { cookie, referer: 'https://y.qq.com/portal/profile.html' }),
      proxyRequestAsync(collectUrl, { cookie, referer: 'https://y.qq.com/portal/profile.html' }),
    ]);

    const createdList = createdData.status === 'fulfilled' && createdData.value && createdData.value.data && Array.isArray(createdData.value.data.disslist)
      ? createdData.value.data.disslist : [];
    const collectList = collectData.status === 'fulfilled' && collectData.value && collectData.value.data && Array.isArray(collectData.value.data.cdlist)
      ? collectData.value.data.cdlist : [];

    // Merge, dedupe by dissid
    const seen = new Set();
    const merged = [...createdList, ...collectList].filter(pl => {
      const id = pl.dissid || pl.tid || String(pl.id || '');
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    console.log('[QQ Playlist] created:', createdList.length, 'collected:', collectList.length, 'merged:', merged.length);
    res.json({ code: 0, data: { disslist: merged } });
  } catch (e) {
    console.error('[QQ Playlist] Error:', e.message);
    res.json({ code: -1, error: e.message });
  }
});
app.get("/api/qq/liked/songs", (req, res) => {
  let cookie = req.headers["x-cookie"] || "";
  if (!cookie) cookie = persistentCookies.qq || "";
  const uin = extractUinFromCookies(cookie);
  if (!uin) {
    return res.json({ code: -1, error: 'No UIN in cookies' });
  }
  const url = `https://c.y.qq.com/fav/fcgi-bin/fcg_get_profile_order_asset.fcg?ct=20&cid=205360956&userid=${uin}&reqtype=3&sin=0&ein=80`;
  proxyRequest(url, res, { cookie, referer: 'https://y.qq.com/portal/profile.html' });
});


app.get('/api/qq/lyric', (req, res) => {
  const { songmid } = req.query;
  const url = `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${songmid}&format=json&nobase64=1`;
  proxyRequest(url, res, { cookie: req.headers['x-cookie'] || '', referer: 'https://y.qq.com' });
});


// ── Qishui 歌单详情（SEO，无需登录）──
app.get('/api/qishui/playlist/detail', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.json({ code: -1, error: 'Missing id' });
  try {
    const url = `https://beta-luna.douyin.com/luna/h5/seo_playlist?playlist_id=${encodeURIComponent(id)}&device_platform=web`;
    const data = await proxyRequestAsync(kgUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36' },
    });
    if (data && data.seo_playlist && data.seo_playlist.playlist) {
      const pl = data.seo_playlist.playlist;
      res.json({ code: 0, data: { id, name: pl.name || '汽水歌单', coverUrl: (pl.cover_url || '').replace(/^http:/, 'https:'), trackCount: pl.track_count || 0 } });
    } else {
      res.json({ code: -1, error: 'Failed to fetch qishui playlist' });
    }
  } catch (e) {
    console.error('[Qishui Playlist] Error:', e.message);
    res.json({ code: -1, error: e.message });
  }
});


// ── Kugou t.kugou.com 短链解析 ──
app.get('/api/kugou/resolve-short', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.json({ code: -1, error: 'Missing code' });
  try {
    const shortUrl = `https://t.kugou.com/${encodeURIComponent(code)}`;
    const result = await proxyRequestAsync(shortUrl, {
      referer: 'https://www.kugou.com/',
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' }
    });
    const resultStr = String(result || '');
    // Extract ID from redirected HTML or meta
    const specialMatch = resultStr.match(/specialid=(\d+)/) || resultStr.match(/special\/single\/(\d+)/);
    const songlistMatch = resultStr.match(/songlistid=([A-Za-z0-9_]+)/) || resultStr.match(/songlist\/([A-Za-z0-9_]+)/);
    const id = specialMatch ? specialMatch[1] : (songlistMatch ? songlistMatch[1] : null);
    if (id) {
      return res.json({ code: 0, data: { id, name: '酷狗歌单', coverUrl: '', trackCount: 0 } });
    }
    res.json({ code: -1, error: 'Could not resolve kugou short link' });
  } catch (e) {
    res.json({ code: -1, error: e.message });
  }
});

// ── Kugou 歌单详情 ──
app.get('/api/kugou/playlist/detail', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.json({ code: -1, error: 'Missing id' });
  try {
    // Kugou: gcid_ IDs use songlist API, numeric IDs use special API
    const isGcid = String(id).startsWith('gcid_');
    const kgUrl = isGcid
      ? `https://www.kugou.com/api/v3/songlist/info?songlistid=${encodeURIComponent(id)}`
      : `https://www.kugou.com/api/v3/special/songList?specialid=${encodeURIComponent(id)}`;
    const data = await proxyRequestAsync(url, {
      referer: 'https://www.kugou.com/',
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' }
    });
    if (data && data.status === 1 && data.data && data.data.info) {
      res.json({
        code: 0,
        data: {
          id,
          name: data.data.info.specialname || data.data.info.name || data.data.info.listname || '酷狗歌单',
          coverUrl: (data.data.info.imgurl || data.data.info.img || data.data.info.pic || '').replace(/^http:/, 'https:'),
          trackCount: data.data.info.songcount || data.data.info.count || data.data.info.song_count || 0,
        }
      });
    } else {
      // Fallback: try mobile API
      const mUrl = `https://m.kugou.com/api/v3/special/songList?specialid=${encodeURIComponent(id)}`;
      const mData = await proxyRequestAsync(mUrl, {
        referer: 'https://m.kugou.com/',
        headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' }
      });
      if (mData && mData.status === 1 && mData.data && mData.data.info) {
        res.json({
          code: 0,
          data: {
            id,
            name: mData.data.info.specialname || mData.data.info.name || '酷狗歌单',
            coverUrl: (mData.data.info.imgurl || mData.data.info.img || '').replace(/^http:/, 'https:'),
            trackCount: mData.data.info.songcount || mData.data.info.count || 0,
          }
        });
      } else {
        res.json({ code: -1, error: 'Failed to fetch kugou playlist' });
      }
    }
  } catch (e) {
    console.error('[Kugou Playlist] Error:', e.message);
    res.json({ code: -1, error: e.message });
  }
});

// ── Kuwo 歌单详情 ──
app.get('/api/kuwo/playlist/detail', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.json({ code: -1, error: 'Missing id' });
  try {
    const url = `http://www.kuwo.cn/api/www/playlist/playListInfo?pid=${encodeURIComponent(id)}&pn=1&rn=1&httpsStatus=1`;
    const data = await proxyRequestAsync(url, {
      referer: 'http://www.kuwo.cn/',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'csrf': '0',
        'Cookie': 'kw_token=0',
      }
    });
    if (data && data.code === 200 && data.data) {
      res.json({
        code: 0,
        data: {
          id,
          name: data.data.name || data.data.title || '酷我歌单',
          coverUrl: (data.data.img || data.data.pic || '').replace(/^http:/, 'https:'),
          trackCount: data.data.total || data.data.musicListCount || 0,
        }
      });
    } else {
      res.json({ code: -1, error: 'Failed to fetch kuwo playlist' });
    }
  } catch (e) {
    console.error('[Kuwo Playlist] Error:', e.message);
    res.json({ code: -1, error: e.message });
  }
});

// ── Migu 歌单详情 ──
app.get('/api/migu/playlist/detail', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.json({ code: -1, error: 'Missing id' });
  try {
    const url = `https://music.migu.cn/v3/api/music/audio/playlist?playlistId=${encodeURIComponent(id)}`;
    const data = await proxyRequestAsync(url, {
      referer: 'https://music.migu.cn/',
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' }
    });
    if (data && data.code === '000000' && data.data) {
      res.json({
        code: 0,
        data: {
          id,
          name: data.data.playlistName || data.data.name || '咪咕歌单',
          coverUrl: (data.data.coverUrl || data.data.imageUrl || data.data.pic || '').replace(/^http:/, 'https:'),
          trackCount: data.data.musicNum || data.data.trackCount || 0,
        }
      });
    } else {
      res.json({ code: -1, error: 'Failed to fetch migu playlist' });
    }
  } catch (e) {
    console.error('[Migu Playlist] Error:', e.message);
    res.json({ code: -1, error: e.message });
  }
});



// ── Bilibili b23.tv 短链解析 ──
app.get('/api/bilibili/resolve-short', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.json({ code: -1, error: 'Missing code' });
  try {
    const shortUrl = `https://b23.tv/${encodeURIComponent(code)}`;
    const result = await proxyRequestAsync(shortUrl, {
      referer: 'https://www.bilibili.com/',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },

    });
    // Try to extract BV from redirected URL or response
    // result is now a string (HTML) thanks to proxyRequestAsync fix
    const resultStr = String(result || '');
    const bvMatch = resultStr.match(/(BV[A-Za-z0-9]+)/);
    if (bvMatch) {
      return res.json({ code: 0, data: { id: bvMatch[1], name: 'B站合集', coverUrl: '', trackCount: 0 } });
    }
    res.json({ code: -1, error: 'Could not resolve b23.tv link' });
  } catch (e) {
    res.json({ code: -1, error: e.message });
  }
});

// ── Bilibili 合集详情 ──
app.get('/api/bilibili/playlist/detail', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.json({ code: -1, error: 'Missing id' });
  try {
    // BV号格式: BVxxxxx, bangumi: ss/ep + 数字
    const url = `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(id)}`;
    const data = await proxyRequestAsync(url, {
      referer: 'https://www.bilibili.com/',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (data && data.code === 0 && data.data) {
      const v = data.data;
      res.json({
        code: 0,
        data: {
          id,
          name: (v.ugc_season && v.ugc_season.title) || v.title || 'B站合集',
          coverUrl: (v.pic || '').replace(/^http:/, 'https:'),
          trackCount: v.videos || 1,
        }
      });
    } else {
      res.json({ code: -1, error: 'Failed to fetch bilibili video' });
    }
  } catch (e) {
    console.error('[Bilibili Playlist] Error:', e.message);
    res.json({ code: -1, error: e.message });
  }
});

// ── 5Sing 歌单详情 ──
app.get('/api/fivesing/playlist/detail', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.json({ code: -1, error: 'Missing id' });
  try {
    const url = `https://5sing.kugou.com/subject/dj/${encodeURIComponent(id)}`;
    const data = await proxyRequestAsync(url, {
      referer: 'https://5sing.kugou.com/',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    // 5Sing returns HTML page — try to extract title from meta tags
    const titleMatch = (typeof data === 'string' ? data : JSON.stringify(data)).match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/);
    const name = titleMatch ? titleMatch[1].split('，')[0] : '5Sing歌单';
    res.json({
      code: 0,
      data: {
        id,
        name,
        coverUrl: '',
        trackCount: 0,
      }
    });
  } catch (e) {
    // Fallback with basic info
    res.json({ code: 0, data: { id, name: '5Sing歌单', coverUrl: '', trackCount: 0 } });
  }
});

// ── 千千音乐 歌单详情 ──
app.get('/api/qianqian/playlist/detail', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.json({ code: -1, error: 'Missing id' });
  try {
    const url = `https://music.91q.com/v1/songlist/info?songlistId=${encodeURIComponent(id)}`;
    const data = await proxyRequestAsync(url, {
      referer: 'https://music.91q.com/',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (data && data.data) {
      res.json({
        code: 0,
        data: {
          id,
          name: data.data.title || data.data.name || '千千歌单',
          coverUrl: (data.data.pic || data.data.cover || '').replace(/^http:/, 'https:'),
          trackCount: data.data.songCount || data.data.trackCount || 0,
        }
      });
    } else {
      res.json({ code: 0, data: { id, name: '千千歌单', coverUrl: '', trackCount: 0 } });
    }
  } catch (e) {
    console.error('[Qianqian Playlist] Error:', e.message);
    res.json({ code: 0, data: { id, name: '千千歌单', coverUrl: '', trackCount: 0 } });
  }
});

// ── JOOX 歌单详情 ──
app.get('/api/joox/playlist/detail', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.json({ code: -1, error: 'Missing id' });
  try {
    const url = `https://api-jooxtt.sanook.com/openjoox/v3/playlist/get_item?playlistid=${encodeURIComponent(id)}`;
    const data = await proxyRequestAsync(url, {
      referer: 'https://www.joox.com/',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (data && data.items) {
      res.json({
        code: 0,
        data: {
          id,
          name: data.title || data.name || 'JOOX歌单',
          coverUrl: (data.image || data.cover || '').replace(/^http:/, 'https:'),
          trackCount: (data.items && data.items.length) || 0,
        }
      });
    } else {
      res.json({ code: 0, data: { id, name: 'JOOX歌单', coverUrl: '', trackCount: 0 } });
    }
  } catch (e) {
    res.json({ code: 0, data: { id, name: 'JOOX歌单', coverUrl: '', trackCount: 0 } });
  }
});

// ── Jamendo 歌单详情 ──
app.get('/api/jamendo/playlist/detail', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.json({ code: -1, error: 'Missing id' });
  try {
    const url = `https://api.jamendo.com/v3.0/playlists/tracks/?client_id=560bba20&format=json&id=${encodeURIComponent(id)}`;
    const data = await proxyRequestAsync(url, {
      referer: 'https://www.jamendo.com/',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (data && data.results && data.results.length > 0) {
      const pl = data.results[0];
      res.json({
        code: 0,
        data: {
          id,
          name: pl.name || 'Jamendo歌单',
          coverUrl: (pl.image || '').replace(/^http:/, 'https:'),
          trackCount: pl.tracks_count || 0,
        }
      });
    } else {
      res.json({ code: 0, data: { id, name: 'Jamendo歌单', coverUrl: '', trackCount: 0 } });
    }
  } catch (e) {
    res.json({ code: 0, data: { id, name: 'Jamendo歌单', coverUrl: '', trackCount: 0 } });
  }
});

// ── Apple Music 歌单详情 ──
app.get('/api/apple/playlist/detail', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.json({ code: -1, error: 'Missing id' });
  try {
    const url = `https://api.music.apple.com/v1/catalog/cn/playlists/${encodeURIComponent(id)}`;
    const data = await proxyRequestAsync(url, {
      referer: 'https://music.apple.com/',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://music.apple.com',
        // Note: Apple Music requires a valid developer JWT token for full API access
      }
    });
    if (data && data.data && data.data.length > 0) {
      const pl = data.data[0];
      res.json({
        code: 0,
        data: {
          id,
          name: pl.attributes && pl.attributes.name || 'Apple Music歌单',
          coverUrl: (pl.attributes && pl.attributes.artwork ? pl.attributes.artwork.url.replace('{w}', '300').replace('{h}', '300') : '').replace(/^http:/, 'https:'),
          trackCount: 0,
        }
      });
    } else {
      res.json({ code: 0, data: { id, name: 'Apple Music歌单', coverUrl: '', trackCount: 0 } });
    }
  } catch (e) {
    res.json({ code: 0, data: { id, name: 'Apple Music歌单', coverUrl: '', trackCount: 0 } });
  }
});

// ── Cover image proxy (avoids CORS tainting for particle cover pixel reading) ──
const coverAgent = new (require('https').Agent)({ keepAlive: true, maxSockets: 10, timeout: 10000 });
const coverHttpAgent = new (require('http').Agent)({ keepAlive: true, maxSockets: 10, timeout: 10000 });

app.get('/api/cover-proxy', (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || !/^https?:\/\//.test(targetUrl)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const parsed = new URL(targetUrl);
  const transport = parsed.protocol === 'https:' ? https : http;
  const agent = parsed.protocol === 'https:' ? coverAgent : coverHttpAgent;

  const proxyReq = transport.request({
    hostname: parsed.hostname,
    port: parsed.port,
    path: parsed.pathname + parsed.search,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Referer': parsed.protocol + '//' + parsed.hostname + '/',
    },
    agent,
  }, (proxyRes) => {
    // Forward CORS headers so canvas can read pixel data
    res.set({
      'Access-Control-Allow-Origin': '*',
      'Content-Type': proxyRes.headers['content-type'] || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
    });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('[CoverProxy] Error:', err.message);
    res.status(502).json({ error: 'Cover proxy error' });
  });
  proxyReq.end();
});

// ── Serve index.html for root ──
app.get('/', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`FluidMusic server running on http://127.0.0.1:${PORT}`);
});

module.exports = server;
server.setCookies = setCookies;
server._cookieStore = persistentCookies;
