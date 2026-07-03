const { app, BrowserWindow, ipcMain, shell, screen, session, globalShortcut, systemPreferences, nativeTheme, Menu } = require('electron');
const net = require('net');
const path = require('path');
const fs = require('fs');
// Disable Chromium disk cache — desktop app doesn't need web caching
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-cache');

const { createApplicationMenu } = require('./menu');
const { saveCookie: secureSaveCookie, loadCookie: secureLoadCookie, deleteCookie: secureDeleteCookie } = require('./cookie-store');
const { initAutoUpdater, stopAutoUpdater } = require('./updater');

let mainWindow = null;
let localServer = null;
let mainServerPort = 0;
let activeLoginWindows = [];

// In-memory cookie store for API proxy — survives across IPC calls
const cookieStore = { netease: '', qq: '' };

const APP_NAME = 'FluidMusic';
const APP_USER_MODEL_ID = 'com.fluidmusic.desktop';
if (process.platform === 'win32') app.setAppUserModelId(APP_USER_MODEL_ID);
const APP_ICON = path.join(__dirname, '..', 'build', 'icon.png');
const ICNS_ICON = path.join(__dirname, '..', 'build', 'icon.icns');
const NETEASE_LOGIN_PARTITION = 'persist:fluidmusic-netease-login';
const NETEASE_LOGIN_URL = 'https://music.163.com/#/login';
const QQ_LOGIN_PARTITION = 'persist:fluidmusic-qqmusic-login';
const QQ_LOGIN_URL = 'https://y.qq.com/n/ryqq/profile';  // music-specific domain triggers qqmusic_key cookie
const WINDOW_WIDTH = 1700;
const WINDOW_HEIGHT = 980;

// Chromium performance switches — applied at startup
[
  ['autoplay-policy', 'no-user-gesture-required'],
  ['disable-background-timer-throttling'],
  ['disable-renderer-backgrounding'],
  ['disable-backgrounding-occluded-windows'],
].forEach(function(sw) {
  if (sw.length === 2) app.commandLine.appendSwitch(sw[0], sw[1]);
  else app.commandLine.appendSwitch(sw[0]);
});

if (process.platform === 'darwin') {
  app.commandLine.appendSwitch('disable-features', 'MacWebContentsOcclusion,RendererCodeIntegrity,AudioServiceOutOfProcess');
}
const gotSingleInstanceLock = app.requestSingleInstanceLock();

const QQ_LOGIN_COOKIE_PRIORITY = [
  'uin', 'qqmusic_uin', 'wxuin', 'login_type', 'qm_keyst', 'qqmusic_key',
  'p_skey', 'skey', 'psrf_qqopenid', 'psrf_qqunionid', 'psrf_qqaccess_token',
  'psrf_qqrefresh_token', 'wxopenid', 'wxunionid', 'wxrefresh_token',
  'wxskey', 'p_uin', 'ptcz', 'RK',
  'superuin', 'supertoken', 'superkey', 'pt4_token', 'pt_oauth_token',
  'pt_local_token', 'pt_login_type',
];

const NETEASE_LOGIN_COOKIE_PRIORITY = [
  'MUSIC_U', '__csrf', 'NMTID', 'MUSIC_A', '__remember_me',
  '_ntes_nuid', '_ntes_nnid', 'WEVNSM', 'WNMCID', 'JSESSIONID-WYYY',
];

// ── Port discovery ──
function findOpenPort(startPort) {
  return new Promise((resolve, reject) => {
    function tryPort(port) {
      const tester = net.createServer();
      tester.once('error', (err) => {
        if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
          tryPort(port + 1);
          return;
        }
        reject(err);
      });
      tester.once('listening', () => {
        tester.close(() => resolve(port));
      });
      tester.listen(port, '127.0.0.1');
    }
    tryPort(startPort);
  });
}

function waitForServer(server) {
  if (!server || server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
}

// ── Cookie helpers ──
function parseCookieHeader(cookieText) {
  const out = {};
  String(cookieText || '').split(';').forEach((part) => {
    const raw = String(part || '').trim();
    if (!raw) return;
    const idx = raw.indexOf('=');
    if (idx <= 0) return;
    out[raw.slice(0, idx).trim()] = raw.slice(idx + 1).trim();
  });
  return out;
}

function isQQCookieDomain(domain) {
  const normalized = String(domain || '').replace(/^\./, '').toLowerCase();
  return normalized === 'qq.com' || normalized.endsWith('.qq.com') || normalized.endsWith('qqmusic.qq.com');
}

function isNeteaseCookieDomain(domain) {
  const normalized = String(domain || '').replace(/^\./, '').toLowerCase();
  return normalized === '163.com' || normalized.endsWith('.163.com') ||
    normalized === 'music.163.com' || normalized.endsWith('.music.163.com') ||
    normalized === 'netease.com' || normalized.endsWith('.netease.com');
}

function buildCookieHeaderFor(cookies, isAllowedDomain, priority) {
  const picked = new Map();
  (cookies || []).forEach((cookie) => {
    if (!cookie || !cookie.name || !isAllowedDomain(cookie.domain)) return;
    picked.set(cookie.name, cookie.value || '');
  });
  const ordered = [];
  (priority || []).forEach((name) => {
    if (picked.has(name)) {
      ordered.push([name, picked.get(name)]);
      picked.delete(name);
    }
  });
  picked.forEach((value, name) => ordered.push([name, value]));
  return ordered
    .filter(([name, value]) => name && value != null && String(value) !== '')
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

async function readQQLoginCookieHeader(cookieSession) {
  const cookies = await cookieSession.cookies.get({});
  return buildCookieHeaderFor(cookies, isQQCookieDomain, QQ_LOGIN_COOKIE_PRIORITY);
}

async function readNeteaseLoginCookieHeader(cookieSession) {
  const cookies = await cookieSession.cookies.get({});
  return buildCookieHeaderFor(cookies, isNeteaseCookieDomain, NETEASE_LOGIN_COOKIE_PRIORITY);
}

function qqCookieHasLogin(cookieText) {
  const obj = parseCookieHeader(cookieText);
  const rawUin = Number(obj.login_type) === 2
    ? (obj.wxuin || obj.uin || obj.p_uin || '')
    : (obj.uin || obj.qqmusic_uin || obj.wxuin || obj.p_uin || '');
  const uin = String(rawUin).replace(/\D/g, '');
  // Accept multiple auth token types: qm_keyst, qqmusic_key, p_skey, supertoken, etc.
  const musicKey = obj.qm_keyst || obj.qqmusic_key || obj.music_key ||
    obj.p_skey || obj.skey || obj.supertoken || obj.superkey ||
    obj.psrf_qqaccess_token || obj.pt4_token || obj.pt_oauth_token ||
    obj.psrf_qqrefresh_token || obj.wxrefresh_token || obj.wxskey || '';
  return !!(uin && musicKey);
}

// Check if QQ has playback-level login (qm_keyst or qqmusic_key) — stricter check for API access
// Mirrors Mineradio-MacOS qqCookieHasPlaybackLogin
function qqCookieHasPlaybackLogin(cookieText) {
  const obj = parseCookieHeader(cookieText);
  const rawUin = Number(obj.login_type) === 2
    ? (obj.wxuin || obj.uin || obj.p_uin || '')
    : (obj.uin || obj.qqmusic_uin || obj.wxuin || obj.p_uin || '');
  const uin = String(rawUin).replace(/\D/g, '');
  // Playback key is stricter: qm_keyst, qqmusic_key, music_key, or wxskey
  const playbackKey = obj.qm_keyst || obj.qqmusic_key || obj.music_key || obj.wxskey || '';
  if (uin && playbackKey) return true;
  // Also accept p_skey/skey for basic playlist API access
  if (uin && (obj.p_skey || obj.skey)) return true;
  return false;
}

function neteaseCookieHasLogin(cookieText) {
  if (!cookieText) return false;
  const obj = parseCookieHeader(cookieText);
  return !!(obj.MUSIC_U && obj.__csrf);
}

// Verify Kugou login by making a lightweight API call (cookie presence alone is unreliable)

// ── Login windows ──
async function openNeteaseMusicLoginWindow(owner) {
  const cookieSession = session.fromPartition(NETEASE_LOGIN_PARTITION);
  const initialCookie = await readNeteaseLoginCookieHeader(cookieSession);
  if (neteaseCookieHasLogin(initialCookie)) return { ok: true, cookie: initialCookie, reused: true };

  return createLoginWindow(owner, NETEASE_LOGIN_PARTITION, NETEASE_LOGIN_URL, '网易云音乐登录',
    readNeteaseLoginCookieHeader, neteaseCookieHasLogin);
}

async function openQQMusicLoginWindow(owner) {
  const cookieSession = session.fromPartition(QQ_LOGIN_PARTITION);
  const initialCookie = await readQQLoginCookieHeader(cookieSession);
  if (qqCookieHasPlaybackLogin(initialCookie)) return { ok: true, cookie: initialCookie, reused: true };

  return createLoginWindow(owner, QQ_LOGIN_PARTITION, QQ_LOGIN_URL, 'QQ 音乐登录',
    readQQLoginCookieHeader, qqCookieHasLogin, qqCookieHasPlaybackLogin, 'https://y.qq.com/n/ryqq/player');
}

// ── Kugou Internal API Sniffer ──
// After login, navigate the window to Kugou user pages and capture
// internal XHR/fetch requests to discover real playlist/user endpoints.

  const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes max for login window

function createLoginWindow(owner, partition, loginUrl, title, readCookieFn, hasLoginFn, isPlaybackLoginFn, warmupUrl) {
  return new Promise((resolve) => {
    let settled = false;
    let pollTimer = null;
    let timeoutTimer = null;
    let kugouPageTimer = null;
    let warmupStarted = false;
    let pageCheckTriggered = false;

    const loginWindow = new BrowserWindow({
      width: 940, height: 760, minWidth: 780, minHeight: 580,
      parent: owner && !owner.isDestroyed() ? owner : undefined,
      modal: false, show: false, fullscreenable: false,
      autoHideMenuBar: true, title,
      backgroundColor: '#111111', icon: ICNS_ICON || APP_ICON,
      webPreferences: {
        partition: partition,
        contextIsolation: true, nodeIntegration: false, sandbox: true,
      },
    });

    const cookieSession = session.fromPartition(partition);

    let finish = async (result) => {
      if (settled) return;
      settled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (kugouPageTimer) clearInterval(kugouPageTimer);
      if (loginWindow && !loginWindow.isDestroyed()) loginWindow.close();
      resolve(result);
    };

    const checkCookies = async () => {
      if (settled) return;
      try {
        const cookie = await readCookieFn(cookieSession);
        const obj = parseCookieHeader(cookie);
        console.log('[LoginPoll] ' + title + ' cookies (' + Object.keys(obj).length + ' keys):',
          Object.keys(obj).join(', '));
        if (isPlaybackLoginFn && isPlaybackLoginFn(cookie)) {
          console.log('[LoginPoll] ' + title + ' PLAYBACK LOGIN DETECTED');
          finish({ ok: true, cookie });
        } else if (hasLoginFn(cookie) && warmupUrl && !warmupStarted) {
          warmupStarted = true;
          console.log('[LoginPoll] ' + title + ' basic login detected, warming up...');
          setTimeout(() => {
            if (!settled && loginWindow && !loginWindow.isDestroyed()) {
              loginWindow.loadURL(warmupUrl).catch((e) => console.warn(title + ' warmup navigation failed:', e.message));
            }
          }, 900);
        } else if (hasLoginFn(cookie) && !warmupUrl) {
          console.log('[LoginPoll] ' + title + ' LOGIN DETECTED via cookies');
          if (kugouPageTimer) clearInterval(kugouPageTimer);
          if (pollTimer) clearInterval(pollTimer);
          finish({ ok: true, cookie });
        }
      } catch (e) { console.warn('[LoginPoll] error:', e.message); }
    };

    // For Kugou: page-level login check (safer, wrapped in try/catch with timeout)
    const pageCheckLogin = async () => {
      if (!loginUrl.includes('kugou.com')) return;
      if (!loginWindow || loginWindow.isDestroyed()) return;
      if (pageCheckTriggered) return;
      try {
        const currentUrl = loginWindow.webContents.getURL();
        if (currentUrl && !currentUrl.includes('login') && !currentUrl.includes('passport') && !currentUrl.includes('reg')) {
          pageCheckTriggered = true;
          console.log('[LoginPoll] Kugou page redirected to:', currentUrl);
          // Give it a moment to set cookies after redirect
          await new Promise(r => setTimeout(r, 1500));
          const cookie = await readCookieFn(cookieSession);
          // eslint-disable-next-line no-undef
          if (typeof kugouCookieHasLogin === 'function' && kugouCookieHasLogin(cookie)) {
            console.log('[LoginPoll] Kugou login detected via redirect + cookies');
            if (kugouPageTimer) clearInterval(kugouPageTimer);
            if (pollTimer) clearInterval(pollTimer);
            finish({ ok: true, cookie });
          }
        }
      } catch (e) { /* ignore */ }
    };

    // Run page-level check alongside cookie check for Kugou
    if (loginUrl.includes('kugou.com')) {
      kugouPageTimer = setInterval(pageCheckLogin, 2000);
    }

    loginWindow.webContents.setWindowOpenHandler((details) => {
      try {
        const url = details && details.url ? details.url : String(details || '');
        if (/^https?:\/\//i.test(url)) {
          // For Kugou: external OAuth providers should open in system browser
          // to avoid crashing the login window with unsupported auth flows
          if (loginUrl.includes('kugou.com') && /(weixin|wechat|qq\.com|weibo|alipay|open\.)/i.test(url)) {
            console.log('[LoginWindow] External OAuth URL, opening in system browser:', url.substring(0, 80));
            shell.openExternal(url).catch(() => {});
          } else {
            loginWindow.loadURL(url).catch((e) => console.warn('Login popup navigation failed:', e.message));
          }
        } else {
          shell.openExternal(url).catch(() => {});
        }
      } catch (e) {
        console.warn('setWindowOpenHandler error:', e.message);
      }
      return { action: 'deny' };
    });

    // Crash protection: prevent login window crash from killing main app
    loginWindow.webContents.on('render-process-gone', (event, details) => {
      console.warn('Login renderer gone:', details.reason);
      console.warn('[LoginWindow] Renderer crashed (' + details.reason + '), reloading...'); if (!loginWindow.isDestroyed()) { try { loginWindow.loadURL(loginUrl).catch(() => {}); } catch(e) {} }
    });

    loginWindow.webContents.on('did-navigate', (_event, _url) => {
      // Check cookies after navigation (post-login redirect)
      setTimeout(checkCookies, 800);
    });
    loginWindow.webContents.on('did-finish-load', () => {
      console.log('[LoginWindow] did-finish-load for ' + title + ' | current URL:', loginWindow.webContents.getURL());
      checkCookies();
      // 网易云登录页自动点击"立即登录"按钮（参考 Mineradio-MacOS）
      if (loginUrl.includes('music.163.com')) {
        loginWindow.webContents.executeJavaScript(`
          setTimeout(() => {
            var docs = [document];
            document.querySelectorAll('iframe').forEach(function(frame) {
              try { if (frame.contentDocument) docs.push(frame.contentDocument); } catch (_) {}
            });
            for (var d = 0; d < docs.length; d++) {
              var nodes = Array.from(docs[d].querySelectorAll('a, button, span, div'));
              var loginNode = nodes.find(function(node) {
                var text = (node.textContent || '').trim();
                if (!/登录|立即登录/.test(text)) return false;
                var rect = node.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
              });
              if (loginNode) { loginNode.click(); return true; }
            }
            return false;
          }, 900);
        `, true).catch(function(){});
      }
    });

    activeLoginWindows.push(loginWindow);
    loginWindow.on('ready-to-show', () => loginWindow.show());
    loginWindow.on('closed', async () => {
      activeLoginWindows = activeLoginWindows.filter(w => w !== loginWindow);
      // Clean up all listeners to prevent leaks
      if (kugouPageTimer) clearInterval(kugouPageTimer);
      if (pollTimer) clearInterval(pollTimer);
      try { loginWindow.webContents.removeAllListeners(); } catch (_) {}
      try { loginWindow.removeAllListeners(); } catch (_) {}
      if (settled) return;
      try {
        const cookie = await readCookieFn(cookieSession);
        resolve(hasLoginFn(cookie)
          ? { ok: true, cookie }
          : { ok: false, cancelled: true, message: title + '窗口已关闭' });
      } catch (e) {
        resolve({ ok: false, error: e.message || '登录窗口已关闭' });
      }
    });

    pollTimer = setInterval(checkCookies, 1200);
    timeoutTimer = setTimeout(() => {
      console.log('[LoginWindow] Timeout after ' + (LOGIN_TIMEOUT_MS / 1000) + 's — closing window');
      finish({ ok: false, cancelled: true, message: title + '登录超时，请重试' });
    }, LOGIN_TIMEOUT_MS);
    loginWindow.loadURL(loginUrl).catch((e) => finish({ ok: false, error: e.message }));
  });
}

async function clearQQMusicLoginSession() {
  const cookieSession = session.fromPartition(QQ_LOGIN_PARTITION);
  await cookieSession.clearStorageData({
    storages: ['cookies', 'localstorage', 'indexdb', 'cachestorage'],
  });
  // Clear in-memory store + encrypted file
  cookieStore.qq = '';
  secureDeleteCookie('qq');
  // Notify renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('login-state-changed', { platform: 'qq', loggedIn: false, cookie: '' });
  }
  return { ok: true };
}

async function clearNeteaseMusicLoginSession() {
  const cookieSession = session.fromPartition(NETEASE_LOGIN_PARTITION);
  await cookieSession.clearStorageData({
    storages: ['cookies', 'localstorage', 'indexdb', 'cachestorage'],
  });
  // Clear in-memory store + encrypted file
  cookieStore.netease = '';
  secureDeleteCookie('netease');
  // Notify renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('login-state-changed', { platform: 'netease', loggedIn: false, cookie: '' });
  }
  return { ok: true };
}

// ── Window creation ──
function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
  return true;
}

async function createWindow() {
  // Suppress MaxListeners warning for login windows
  require('events').EventEmitter.defaultMaxListeners = 50;
  process.setMaxListeners(50);
  const port = await findOpenPort(3000);
  mainServerPort = port;
  process.env.HOST = '127.0.0.1';
  process.env.PORT = String(port);

  // Restore video background path so Express can serve it
  try {
    const bgDir = path.join(app.getPath('userData'), 'backgrounds');
    if (fs.existsSync(bgDir)) {
      const files = fs.readdirSync(bgDir).filter(f => f.startsWith('bg-video'));
      if (files.length > 0) {
        process.env.BG_VIDEO_PATH = bgDir;
        console.log('[startup] BG_VIDEO_PATH set to', bgDir, '(found', files[0] + ')');
      }
    }
  } catch (_) {}

  localServer = require(path.join(__dirname, '..', 'server.js'));
  await waitForServer(localServer);

  // Inject securely stored cookies into the API proxy server
  try {
    const neteaseCookie = secureLoadCookie('netease');
    const qqCookie = secureLoadCookie('qq');
    if (localServer.setCookies) {
      localServer.setCookies(neteaseCookie, qqCookie);
    }
    // Also populate in-memory store
    if (neteaseCookie) cookieStore.netease = neteaseCookie;
    if (qqCookie) cookieStore.qq = qqCookie;
  } catch (e) {
    console.warn('[startup] Failed to load encrypted cookies:', e.message);
  }

  // Inject loaded cookies into Chromium session partitions (so they persist across restarts)
  try {
    if (cookieStore.qq) {
      const qqSession = session.fromPartition(QQ_LOGIN_PARTITION);
      const parsed = parseCookieHeader(cookieStore.qq);
      for (const [name, value] of Object.entries(parsed)) {
        await qqSession.cookies.set({
          url: 'https://y.qq.com',
          name, value,
          domain: '.qq.com',
          path: '/',
          secure: true,
          httpOnly: false,
          expirationDate: Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
        });
      }
      console.log('[startup] QQ cookies restored to session partition (' + Object.keys(parsed).length + ' keys)');
    }
    if (cookieStore.netease) {
      const neSession = session.fromPartition(NETEASE_LOGIN_PARTITION);
      const parsed = parseCookieHeader(cookieStore.netease);
      for (const [name, value] of Object.entries(parsed)) {
        await neSession.cookies.set({
          url: 'https://music.163.com',
          name, value,
          domain: '.163.com',
          path: '/',
          secure: true,
          httpOnly: false,
          expirationDate: Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
        });
      }
      console.log('[startup] Netease cookies restored to session partition (' + Object.keys(parsed).length + ' keys)');
    }
  } catch (e) {
    console.warn('[startup] Cookie session restore failed:', e.message);
  }

  const screenBounds = screen.getPrimaryDisplay().workArea;
  const x = Math.round(screenBounds.x + (screenBounds.width - WINDOW_WIDTH) / 2);
  const y = Math.round(screenBounds.y + (screenBounds.height - WINDOW_HEIGHT) / 2);

  console.log('[createWindow] Screen bounds:', screenBounds.width, 'x', screenBounds.height, '| window at:', x, ',', y);
  mainWindow = new BrowserWindow({
    x, y,
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: 1200,
    minHeight: 760,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: true,
    fullscreenable: true,
    resizable: true,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: -100, y: -100 },
    title: APP_NAME,
    icon: ICNS_ICON || APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  // Track whether Escape should be intercepted for fullscreen exit
  // (skip when an overlay is open — renderer handles Escape there)
  let overlayOpen = false;
  ipcMain.handle('fluidmusic-overlay-state', (_event, open) => {
    overlayOpen = open;
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && (input.key === 'Escape' || input.code === 'Escape') && mainWindow.isFullScreen()) {
      // Don't exit fullscreen if an overlay is open (DIY settings / user panel)
      if (overlayOpen) return;
      event.preventDefault();
      mainWindow.setFullScreen(false);
    }
  });

  mainWindow.once('ready-to-show', () => {
    console.log('[createWindow] ready-to-show fired — showing window');
    mainWindow.show();
    mainWindow.focus();
  });
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[createWindow] did-finish-load — page loaded');
  });
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[createWindow] did-fail-load:', errorCode, errorDescription);
  });

  // Renderer crash recovery — reload the page if the renderer process dies
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[MainWindow] Renderer crashed:', details.reason, 'exitCode:', details.exitCode);
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('[MainWindow] Attempting to reload...');
      mainWindow.loadURL(`http://127.0.0.1:${mainServerPort}`).catch((e) => {
        console.error('[MainWindow] Reload after crash failed:', e.message);
      });
    }
  });

  // Detect unresponsive renderer (e.g. infinite loop in shader)
  mainWindow.webContents.on('unresponsive', () => {
    console.warn('[MainWindow] Renderer became unresponsive');
  });

  // macOS: close = quit app, Dock click = relaunch
  mainWindow.on('close', () => {
    if (typeof FluidAudio !== 'undefined') {
      mainWindow.webContents.send('media-control', 'pause');
    }
  });

  mainWindow.on('closed', () => {
    for (const lw of activeLoginWindows) {
      if (lw && !lw.isDestroyed()) lw.close();
    }
    activeLoginWindows = [];
    mainWindow = null;
  });

  mainWindow.on('enter-full-screen', () => {
    mainWindow.webContents.send('fluidmusic-window-state', { isFullScreen: true });
  });

  mainWindow.on('leave-full-screen', () => {
    mainWindow.webContents.send('fluidmusic-window-state', { isFullScreen: false });
  });

  // Mouse click-through: forward events on empty/passthrough areas to desktop
  // The renderer sends IPC when mouse is over interactive vs passthrough elements
  ipcMain.on('fluidmusic-set-ignore-mouse', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
    }
  });
  ipcMain.on('fluidmusic-set-capture-mouse', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setIgnoreMouseEvents(false);
    }
  });

  // Clear renderer cache to prevent stale JS
  try {
    await mainWindow.webContents.session.clearCache();
    await mainWindow.webContents.session.clearStorageData({ storages: ['caches', 'serviceworkers'] });
    console.log('[createWindow] Renderer cache cleared');
  } catch(e) {}

  // Enable DevTools in development
  mainWindow.webContents.openDevTools({ mode: 'detach' });

  console.log('[createWindow] Loading URL: http://127.0.0.1:' + port);
  try {
    await mainWindow.loadURL(`http://127.0.0.1:${port}`);
    console.log('[createWindow] loadURL succeeded');
  } catch (e) {
    console.error('[createWindow] loadURL failed:', e.message);
  }

  // ── Auto-update (checks every 4 hours) ──
  try {
    initAutoUpdater(mainWindow);
  } catch (e) {
    console.warn('[createWindow] Auto-updater init failed:', e.message);
  }

  // ── macOS native integrations ──
  if (process.platform === 'darwin') {
    // Application menu bar
    createApplicationMenu(mainWindow);

    // Dock right-click menu
    const dockMenu = Menu.buildFromTemplate([
      {
        label: '播放 / 暂停',
        click: () => mainWindow.webContents.send('media-control', 'toggle')
      },
      {
        label: '下一曲',
        click: () => mainWindow.webContents.send('media-control', 'next')
      },
      {
        label: '上一曲',
        click: () => mainWindow.webContents.send('media-control', 'prev')
      },
      { type: 'separator' },
      {
        label: '显示窗口',
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
    ]);
    app.dock.setMenu(dockMenu);

    // Dark mode awareness — push theme changes to renderer
    nativeTheme.on('updated', () => {
      const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('theme-changed', theme);
      }
    });

    // Media keys via globalShortcut (works when app is in focus)
    try {
      globalShortcut.register('MediaPlayPause', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('media-control', 'toggle');
        }
      });
      globalShortcut.register('MediaNextTrack', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('media-control', 'next');
        }
      });
      globalShortcut.register('MediaPreviousTrack', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('media-control', 'prev');
        }
      });
      console.log('[createWindow] Media keys registered');
    } catch (e) {
      console.warn('[createWindow] Failed to register media keys:', e.message);
    }
  }
}

// ── IPC Handlers ──
ipcMain.handle('fluidmusic-window-minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.handle('fluidmusic-window-toggle-fullscreen', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  win.setFullScreen(!win.isFullScreen());
});

ipcMain.handle('fluidmusic-window-close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.handle('fluidmusic-window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

ipcMain.handle('fluidmusic-window-is-maximized', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return false;
  return win.isMaximized();
});

ipcMain.handle('fluidmusic-window-get-state', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return { isFullScreen: false };
  return { isFullScreen: win.isFullScreen() };
});

// ── Platform login IPC handlers ──
ipcMain.handle('netease-music-open-login', async (event) => {
  return openNeteaseMusicLoginWindow(BrowserWindow.fromWebContents(event.sender));
});

ipcMain.handle('netease-music-clear-login', async () => {
  return clearNeteaseMusicLoginSession();
});

ipcMain.handle('qq-music-open-login', async (event) => {
  return openQQMusicLoginWindow(BrowserWindow.fromWebContents(event.sender));
});

ipcMain.handle('qq-music-clear-login', async () => {
  return clearQQMusicLoginSession();
});

// ── Unified login platform IPC (used by api-bridge.js) ──
ipcMain.handle('fluidmusic-login-platform', async (event, platform) => {
  try {
  const win = BrowserWindow.fromWebContents(event.sender);
  let result;
  switch (platform) {
    case 'netease': result = await openNeteaseMusicLoginWindow(win); break;
    case 'qq': result = await openQQMusicLoginWindow(win); break;
    default: return { ok: false, error: 'Unknown platform: ' + platform };
  }

  // Update in-memory store, encrypt and persist, push to renderer
  if (result && result.ok && result.cookie) {
    cookieStore[platform] = result.cookie;
    secureSaveCookie(platform, result.cookie);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('login-state-changed', {
        platform,
        loggedIn: true,
        cookie: result.cookie,
      });
    }
  }

  return result;
  } catch (e) {
    console.error('Login platform error:', e);
    return { ok: false, error: e.message || 'Login failed' };
  }
});

ipcMain.handle('fluidmusic-get-login-status', async () => {
  const neteaseSession = session.fromPartition(NETEASE_LOGIN_PARTITION);
  const qqSession = session.fromPartition(QQ_LOGIN_PARTITION);
  const neteaseCookie = await readNeteaseLoginCookieHeader(neteaseSession);
  const qqCookie = await readQQLoginCookieHeader(qqSession);

  const neteaseLoggedIn = neteaseCookieHasLogin(neteaseCookie);
  const qqLoggedIn = qqCookieHasLogin(qqCookie);

  // Update in-memory store
  cookieStore.netease = neteaseCookie;
  cookieStore.qq = qqCookie;

  console.log('[getLoginStatus] netease:', neteaseLoggedIn, '| qq:', qqLoggedIn);

  return {
    netease: { loggedIn: neteaseLoggedIn, cookie: neteaseCookie },
    qq: { loggedIn: qqLoggedIn, cookie: qqCookie },
    kugou: { loggedIn: false, cookie: '' },
  };
});

// Dedicated cookie-only getter — lighter than get-login-status
ipcMain.handle('fluidmusic-get-cookies', async () => {
  const neteaseSession = session.fromPartition(NETEASE_LOGIN_PARTITION);
  const qqSession = session.fromPartition(QQ_LOGIN_PARTITION);
  cookieStore.netease = await readNeteaseLoginCookieHeader(neteaseSession);
  cookieStore.qq = await readQQLoginCookieHeader(qqSession);

  return { netease: cookieStore.netease, qq: cookieStore.qq };
});

ipcMain.handle('fluidmusic-logout-platform', async (_event, platform) => {
  let result;
  switch (platform) {
    case 'netease': result = await clearNeteaseMusicLoginSession(); break;
    case 'qq': result = await clearQQMusicLoginSession(); break;
    default: return { ok: false, error: 'Unknown platform' };
  }

  // Clear in-memory cookie, delete encrypted file, push to renderer
  cookieStore[platform] = '';
  secureDeleteCookie(platform);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('login-state-changed', {
      platform,
      loggedIn: false,
      cookie: '',
    });
  }

  return result;
});

ipcMain.handle('fluidmusic-save-settings', async (_event, settings) => {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'fluidmusic-settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('fluidmusic-load-settings', async () => {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'fluidmusic-settings.json');
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      return { ok: true, settings: JSON.parse(data) };
    }
    return { ok: true, settings: null };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});


// ── Settings Export / Import ──
ipcMain.handle('fluidmusic-export-settings', async () => {
  const { dialog } = require('electron');
  const fs = require('fs');
  const path = require('path');

  const result = await dialog.showSaveDialog({
    title: '导出 FluidMusic 配置',
    defaultPath: 'FluidMusic-settings-' + new Date().toISOString().slice(0, 10) + '.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });

  if (result.canceled || !result.filePath) return { ok: false, cancelled: true };

  try {
    // Gather all settings from localStorage-style data
    const config = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      settings: {},
      wallpaper: null,
      favorites: [],
      customPlaylists: [],
      syncedPlaylists: {},
    };

    // The renderer will send the actual data — this just creates the file
    // For now, we return the path so the renderer can write to it
    return { ok: true, filePath: result.filePath, write: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('fluidmusic-import-settings', async () => {
  const { dialog } = require('electron');
  const fs = require('fs');

  const result = await dialog.showOpenDialog({
    title: '导入 FluidMusic 配置',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });

  if (result.canceled || !result.filePaths.length) return { ok: false, cancelled: true };

  try {
    const data = fs.readFileSync(result.filePaths[0], 'utf8');
    const config = JSON.parse(data);
    if (!config || !config.settings) {
      return { ok: false, error: '无效的配置文件格式' };
    }
    return { ok: true, config };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('fluidmusic-write-file', async (_event, filePath, content) => {
  const fs = require('fs');
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Renderer-to-terminal logging (debug)
ipcMain.on('fluidmusic-renderer-log', (_event, msg) => {
  console.log('[Renderer]', msg);
});

// ── App lifecycle ──
app.setName(APP_NAME);

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!focusMainWindow()) {
      app.whenReady().then(() => createWindow()).catch((e) => console.error('Second instance failed:', e));
    }
  });

  app.whenReady().then(async () => {
    if (process.platform === 'darwin') {
      try {
        systemPreferences.setUserDefault('NSAppSleepDisabled', 'boolean', true);
      } catch (_) {}
    }

    // Clear V8 code cache — prevents stale compiled JS
    try {
      const codeCacheDir = path.join(app.getPath('userData'), 'Code Cache');
      if (fs.existsSync(codeCacheDir)) {
        fs.rmSync(codeCacheDir, { recursive: true, force: true });
        fs.mkdirSync(codeCacheDir);
      }
      console.log('[startup] V8 Code Cache cleared');
    } catch(_) {}

    await createWindow();
  });

  app.on('activate', () => {
    if (!focusMainWindow()) createWindow();
  });

  app.on('window-all-closed', () => {
    app.quit();
  });

  app.on('before-quit', () => {
    app.isQuitting = true;
    stopAutoUpdater();
    globalShortcut.unregisterAll();
    if (localServer && localServer.close) localServer.close();
  });
}

// ── Local music file import ──
ipcMain.handle('fluidmusic-import-local-files', async () => {
  const { dialog } = require('electron');
  const fs = require('fs');
  const path = require('path');

  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '音频文件', extensions: ['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg', 'wma', 'aiff'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePaths.length) return { ok: false, cancelled: true };

  const tracks = [];
  for (const filePath of result.filePaths) {
    try {
      const stat = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase().replace('.', '');
      const fileName = path.basename(filePath, path.extname(filePath));

      // Try to parse artist - title from filename
      let title = fileName;
      let artist = '本地文件';
      const dashIdx = fileName.indexOf(' - ');
      if (dashIdx > 0) {
        artist = fileName.substring(0, dashIdx).trim();
        title = fileName.substring(dashIdx + 3).trim();
      }

      // Read file as data URL for local playback
      const buffer = fs.readFileSync(filePath);
      const mimeMap = { mp3: 'audio/mpeg', flac: 'audio/flac', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', wma: 'audio/x-ms-wma', aiff: 'audio/aiff' };
      const mime = mimeMap[ext] || 'audio/mpeg';
      const dataUrl = 'data:' + mime + ';base64,' + buffer.toString('base64');

      tracks.push({
        id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8),
        title: title,
        artist: artist,
        url: dataUrl,
        coverUrl: '',
        platform: 'local',
        duration: 0,
        filePath: filePath,
        fileSize: stat.size,
      });
    } catch (e) {
      console.warn('[Import] Failed to read:', filePath, e.message);
    }
  }

  return { ok: true, tracks };
});

// ── Wallpaper file picker ──
ipcMain.handle('fluidmusic-pick-wallpaper', async () => {
  const { dialog } = require('electron');
  const fs = require('fs');
  const path = require('path');
  
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'] }],
  });
  
  if (result.canceled || !result.filePaths.length) return { ok: false, cancelled: true };
  
  try {
    const filePath = result.filePaths[0];
    console.log('[Wallpaper] Source:', filePath);
    if (!fs.existsSync(filePath)) {
      return { ok: false, error: '文件不存在' };
    }
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp' };
    const mime = mimeMap[ext] || 'image/png';
    const data = fs.readFileSync(filePath);
    const base64 = data.toString('base64');
    return { ok: true, dataUrl: `data:${mime};base64,${base64}` };
  } catch (e) {
    console.error('[Wallpaper] Failed:', e.message);
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('fluidmusic-pick-bg-video', async () => {
  const { dialog } = require('electron');
  const fs = require('fs');
  const path = require('path');

  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi'] }],
  });

  if (result.canceled || !result.filePaths.length) return { ok: false, cancelled: true };

  try {
    const srcPath = result.filePaths[0];
    console.log('[BgVideo] Source:', srcPath);
    const destDir = path.join(app.getPath('userData'), 'backgrounds');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const ext = path.extname(srcPath).toLowerCase();
    const destName = 'bg-video' + ext;
    const destPath = path.join(destDir, destName);
    // Clean old video files, then copy new one
    try { fs.readdirSync(destDir).forEach(f => { if (f.startsWith('bg-video')) fs.unlinkSync(path.join(destDir, f)); }); } catch(_) {}
    fs.copyFileSync(srcPath, destPath);
    // Tell Express server where the video is
    process.env.BG_VIDEO_PATH = destDir;
    const videoUrl = `http://127.0.0.1:${mainServerPort}/bg-video?t=${Date.now()}`;
    console.log('[BgVideo] Ready | URL:', videoUrl);
    return { ok: true, dataUrl: videoUrl, fileName: path.basename(srcPath) };
  } catch (e) {
    console.error('[BgVideo] Failed:', e.message);
    return { ok: false, error: e.message };
  }
});



// ── Desktop lyric window ──
const { createLyricWindow, sendLyricUpdate, closeLyricWindow } = require('./lyric-window');

ipcMain.handle('fluidmusic-toggle-lyrics', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  createLyricWindow(win);
});

ipcMain.handle('fluidmusic-send-lyrics', (_event, text, nextText) => {
  sendLyricUpdate(text, nextText);
});

ipcMain.handle('fluidmusic-close-lyrics', () => {
  closeLyricWindow();
});
ipcMain.handle('fluidmusic-clear-bg-video', async () => {
  try {
    const destDir = path.join(app.getPath('userData'), 'backgrounds');
    if (fs.existsSync(destDir)) {
      fs.readdirSync(destDir).forEach(f => {
        if (f.startsWith('bg-video')) fs.unlinkSync(path.join(destDir, f));
      });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
