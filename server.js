const express = require('express');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');

// ── Persistent cookie store (survives server restarts) ──
// Cookies are injected by the Electron main process via setCookies()
// Falls back to legacy plaintext files if running standalone
let persistentCookies = { netease: '', qq: '' };

// Legacy fallback: read plaintext files (only used when running without Electron)
const COOKIE_FILE = path.join(__dirname, '.cookie');
const QQ_COOKIE_FILE = path.join(__dirname, '.qq-cookie');
try { if (fs.existsSync(COOKIE_FILE) && !persistentCookies.netease) persistentCookies.netease = fs.readFileSync(COOKIE_FILE, 'utf8').trim(); }
catch (e) { /* ignore */ }
try { if (fs.existsSync(QQ_COOKIE_FILE) && !persistentCookies.qq) persistentCookies.qq = fs.readFileSync(QQ_COOKIE_FILE, 'utf8').trim(); }
catch (e) { /* ignore */ }

// Called by main.js to inject decrypted cookies at startup
function setCookies(netease, qq) {
  if (netease) persistentCookies.netease = netease;
  if (qq) persistentCookies.qq = qq;
  console.log('[CookieStore] Cookies injected from main process | netease:', !!netease, '| qq:', !!qq);
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
          console.log('[ProxyAsync] Non-JSON response (' + data.length + ' bytes):', JSON.stringify(data.substring(0, 200)));
          resolve(null);
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

app.get('/api/qq/playlist/detail', async (req, res) => {
  const { id } = req.query;
  const cookie = req.headers['x-cookie'] || '';
  const uin = extractUinFromCookies(cookie);
  console.log('[QQ PlaylistDetail] id:', id, '| uin:', uin, '| hasCookie:', !!cookie);

  // Try primary QQ Music playlist detail API (v8) first — more reliable song data
  try {
    const primaryUrl = `https://c.y.qq.com/v8/fcg-bin/fcg_v8_playlist_cp.fcg?id=${id}&uin=${uin || 0}&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=h5&needNewCode=1&tpl=3&page=1&limit=500`;
    const data = await proxyRequestAsync(primaryUrl, { cookie, referer: 'https://y.qq.com/n/yqq/playlist/' + id });
    console.log('[QQ PlaylistDetail] v8 response keys:', data ? Object.keys(data).join(', ') : 'null');
    if (data && data.code === 0 && data.data && data.data.cdlist) {
      console.log('[QQ PlaylistDetail] v8 cdlist length:', data.data.cdlist.length);
      return res.json({ cdlist: data.data.cdlist });
    }
    // Try alternate v8 format
    if (data && data.code === 0 && data.cdlist) {
      console.log('[QQ PlaylistDetail] v8 direct cdlist length:', data.cdlist.length);
      return res.json(data);
    }
    console.log('[QQ PlaylistDetail] v8 returned unexpected format, trying fallback...');
  } catch (e) {
    console.warn('[QQ PlaylistDetail] v8 failed:', e.message);
  }

  // Fallback: QZone playlist detail API
  const fallbackUrl = `https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&utf8=1&disstid=${id}&loginUin=${uin || 0}&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq.json&needNewCode=0`;
  proxyRequest(fallbackUrl, res, { cookie, referer: 'https://y.qq.com/n/yqq/playlist' });
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


// ── Cover image proxy (avoids CORS tainting for particle cover pixel reading) ──
app.get('/api/cover-proxy', (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || !/^https?:\/\//.test(targetUrl)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const parsed = new URL(targetUrl);
  const transport = parsed.protocol === 'https:' ? https : http;

  const proxyReq = transport.request({
    hostname: parsed.hostname,
    port: parsed.port,
    path: parsed.pathname + parsed.search,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Referer': parsed.protocol + '//' + parsed.hostname + '/',
    },
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
