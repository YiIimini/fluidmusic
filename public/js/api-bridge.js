// ============================================================
// Debug flag — set to true for verbose API logging during development
const _API_DEBUG = false;
const _apilog = (...a) => { if (_API_DEBUG) console.log(...a); };
const _apiwarn = (...a) => { if (_API_DEBUG) console.warn(...a); };
// FluidMusic — Platform API Bridge
// QQ Music + Netease Cloud Music + Kugou Music OAuth login via Electron IPC
// ============================================================
(function () {
  const ApiBridge = {
    neteaseLoggedIn: false,
    qqLoggedIn: false,
    kugouLoggedIn: false,
    qishuiLoggedIn: false,
    neteaseUser: null,
    qqUser: null,
    kugouUser: null,
    qishuiUser: null,
  };

  // ── Cookie store — populated on init and kept in sync via IPC events ──
  const cookieStore = { netease: '', qq: '', qishui: '' };

  // ── DataCache bridge: TS IndexedDB cache → legacy localStorage fallback ──
  // When the TS bridge is loaded, API responses are cached in IndexedDB via
  // __FM_TS.dataCache.  Otherwise we fall back to the synchronous localStorage
  // DataCache (data-cache.js).  The TS cache uses a store+key namespace so we
  // route everything through the "api" store.
  const _tsCache = window.__FM_TS ? window.__FM_TS.dataCache : null;

  const _cacheGet = async (key) => {
    if (_tsCache) {
      try { return await _tsCache.get('api', key); } catch (e) { /* fall through */ }
    }
    if (typeof DataCache !== 'undefined') return DataCache.get(key);
    return null;
  };

  const _cacheSet = async (key, value, ttlMs) => {
    if (_tsCache) {
      try { await _tsCache.set('api', key, value, ttlMs); return; } catch (e) { /* fall through */ }
    }
    if (typeof DataCache !== 'undefined') DataCache.set(key, value);
  };

  // ── Unified API fetcher — passes x-cookie & x-platform to the local server proxy ──
  async function fetchApi(endpoint, params = {}, platform, method = "GET") {
    const base = 'http://127.0.0.1:' + (window.location.port || 3000);
    const query = new URLSearchParams(params).toString();
    const url = base + endpoint + (query ? '?' + query : '');

    // ── Cache-aside for GET requests (skip for user detail — always fresh) ──
    const isUserEndpoint = endpoint.includes('/user/detail') || endpoint.includes('/account');
    const cacheKey = (method === 'GET' && !isUserEndpoint) ? ('api:' + endpoint + ':' + JSON.stringify(params)) : null;
    if (cacheKey) {
      try {
        const cached = await _cacheGet(cacheKey);
        if (cached !== null && cached !== undefined) {
          _apilog('[fetchApi] ' + platform + ' ← cache ' + endpoint);
          return cached;
        }
      } catch (e) { /* cache miss, proceed to network */ }
    }

    const headers = {};
    // Always send platform — server falls back to persistent cookies
    if (platform) {
      headers['x-cookie'] = cookieStore[platform] || '';
      headers['x-platform'] = platform;
    }

    _apilog('[fetchApi] ' + platform + ' → ' + endpoint + ' | cookie:', !!cookieStore[platform], '| len:', (cookieStore[platform] || '').length);
    const res = await fetch(url, { method, headers });
    const json = await res.json();
    _apilog('[fetchApi] ' + platform + ' ← ' + endpoint + ' | status:', res.status, '| hasData:', !!json);

    // ── Store successful GET responses in cache ──
    if (cacheKey && res.ok && json) {
      try {
        let ttl = 5 * 60 * 1000; // default 5 min
        if (endpoint.includes('/account') || endpoint.includes('/user/detail')) ttl = 30 * 60 * 1000;
        else if (endpoint.includes('/playlist/detail') || endpoint.includes('/song/url')) ttl = 10 * 60 * 1000;
        else if (endpoint.includes('/search')) ttl = 5 * 60 * 1000;
        else if (endpoint.includes('/lyric')) ttl = 60 * 60 * 1000;
        await _cacheSet(cacheKey, json, ttl);
      } catch (e) { /* ignore cache write errors */ }
    }

    return json;
  }

  async function init() {
    // Check login status from main process — now returns { loggedIn, cookie } per platform
    try {
      if (typeof fluidmusic !== 'undefined' && fluidmusic.getLoginStatus) {
        const status = await fluidmusic.getLoginStatus();

        if (status.netease) {
          ApiBridge.neteaseLoggedIn = status.netease.loggedIn || false;
          cookieStore.netease = status.netease.cookie || '';
        }
        if (status.qq) {
          ApiBridge.qqLoggedIn = status.qq.loggedIn || false;
          cookieStore.qq = status.qq.cookie || '';
          if (!cookieStore.qq && typeof fluidmusic !== 'undefined' && fluidmusic.getCookies) {
            try {
              const cookies = await fluidmusic.getCookies();
              if (cookies && cookies.qq) cookieStore.qq = cookies.qq;
            } catch(e) {}
          }
          if (ApiBridge.qqLoggedIn) {
            ApiBridge.qqUser = { avatarUrl: '', nickname: 'QQ用户', vipLevel: 0, followers: 0, followings: 0, playlistCount: 0 };
          }
        }

        _apilog('Login status loaded — netease:', ApiBridge.neteaseLoggedIn, 'qq:', ApiBridge.qqLoggedIn, 'qishui:', ApiBridge.qishuiLoggedIn);

        if (ApiBridge.neteaseLoggedIn) await fetchNeteaseUserDetail();
        if (ApiBridge.qqLoggedIn) fetchQQUserDetail();
        if (status.qishui && status.qishui.loggedIn) {
          ApiBridge.qishuiLoggedIn = true;
          cookieStore.qishui = status.qishui.cookie || '';
          fetchQishuiUserDetail();
        }
              }
    } catch (e) {
      _apiwarn('Failed to get login status:', e);
    }

    // Listen for login-state-changed events (pushed by main process after login/logout)
    if (typeof fluidmusic !== 'undefined' && fluidmusic.onLoginStateChanged) {
      fluidmusic.onLoginStateChanged((state) => {
        const { platform, loggedIn, cookie } = state;
        _apilog('Login state changed:', platform, 'loggedIn:', loggedIn);

        ApiBridge[platform + 'LoggedIn'] = loggedIn;
        cookieStore[platform] = cookie || '';

        if (loggedIn) {
          // Set default user immediately so UserPanel shows login state
          if (!ApiBridge[platform + 'User']) {
            ApiBridge[platform + 'User'] = { avatarUrl: '', nickname: (platform === 'qq' ? 'QQ用户' : (platform === 'qishui' ? '汽水用户' : '网易云用户')), vipLevel: 0, followers: 0, followings: 0, playlistCount: 0 };
          }
          if (platform === 'netease') fetchNeteaseUserDetail();
          else if (platform === 'qq') fetchQQUserDetail();
          else if (platform === 'qishui') fetchQishuiUserDetail();
                    // Trigger playlist re-sync
          window.dispatchEvent(new CustomEvent('fluidmusic:login', { detail: { platform } }));
        } else {
          ApiBridge[platform + 'User'] = null;
        }
      });
    }

    // Login buttons now handled through UserPanel overlay

    _apilog('API Bridge initialized — cookies ready');
  }

  async function loginPlatform(platform) {
    if (typeof fluidmusic === 'undefined') {
      _apiwarn(platform + ' login not available (not in Electron)');
      return;
    }

    const btn = document.getElementById('btn-' + platform + '-login');

    try {
      if (btn) {
        const iconMap = { netease: '🎧', qq: '🎵', };
        btn.innerHTML = iconMap[platform] + ' ' + (typeof I18N !== 'undefined' ? I18N.t('login.logging') : '登录中...');
      }

      const result = await fluidmusic.loginPlatform(platform);

      if (result && result.ok) {
        ApiBridge[platform + 'LoggedIn'] = true;

        // 1. Store cookie from login result immediately
        if (result.cookie) {
          cookieStore[platform] = result.cookie;
          _apilog('[loginPlatform] Stored cookie for', platform, 'length:', result.cookie.length);
        }

        // 2. Fetch user profile after login
        let profile = null;
        try {
          if (platform === 'netease') profile = await fetchNeteaseUserDetail();
          else if (platform === 'qq') profile = await fetchQQUserDetail();
          else if (platform === 'qishui') profile = await fetchQishuiUserDetail();
                  } catch (e) {
          _apiwarn('[loginPlatform] Profile fetch failed for', platform, ':', e.message);
        }

        _apilog('[loginPlatform] Fetched profile for', platform, ':', profile ? profile.nickname : 'null');

        // 3. Profile fetched for UserPanel display

        // 4. Auto-check all playlists after login
        try {
          const playlists = await fetchUserPlaylists();
          // Set all playlists as synced by default
          try {
            let synced = JSON.parse(localStorage.getItem('fluidmusic_synced_playlists') || '{}');
            if (!synced[platform]) synced[platform] = {};
            const allPl = [...(playlists.netease || []), ...(playlists.qq || []), ...(playlists.qishui || [])];
            allPl.forEach(pl => {
              if (pl.platform === platform) synced[platform][pl.id] = true;
            });
            localStorage.setItem('fluidmusic_synced_playlists', JSON.stringify(synced));
            _apilog('[loginPlatform] Auto-checked ' + allPl.length + ' playlists for ' + platform);
          } catch(e) { _apiwarn('Auto-check failed:', e); }
          _apilog('[loginPlatform] Fetched playlists after login:',
            'netease=' + (playlists.netease || []).length,
            'qq=' + (playlists.qq || []).length,
            'qishui=' + (playlists.qishui || []).length);

          // Trigger playlist refresh in left chamber
          window.dispatchEvent(new CustomEvent('playlists-updated', { detail: { playlists, platform } }));

          // Also update BubbleChamber directly
          if (typeof BubbleChamber !== 'undefined' && BubbleChamber.setUserPlaylists) {
            BubbleChamber.setUserPlaylists(playlists);
          }
        } catch (e) {
          _apiwarn('[loginPlatform] Failed to fetch playlists:', e);
        }

        // Notify app of login (legacy event)
        window.dispatchEvent(new CustomEvent('fluidmusic:login', { detail: { platform } }));
      }
    } catch (e) {
      _apiwarn(platform + ' login failed:', e);
    } finally {
      if (btn && !ApiBridge[platform + 'LoggedIn']) {
        const platformNames = { netease: '网易云音乐', qq: 'QQ音乐', qishui: '汽水音乐' };
        const platformIcons = { netease: '🎧', qq: '🎵', qishui: '🎼' };
        const i18nKey = { netease: 'login.netease', qq: 'login.qq', qishui: 'login.qishui' }[platform];
        btn.innerHTML = (platformIcons[platform] || '') + ' ' +
          (typeof I18N !== 'undefined' ? I18N.t(i18nKey) : platformNames[platform]);
      }
    }
  }

  // Legacy compatibility
  async function openNeteaseLogin() { return loginPlatform('netease'); }
  async function openQQLogin() { return loginPlatform('qq'); }

  // ── Netease User Detail ──
function _makeNeteaseUser(profile) {
    return {
      avatarUrl: profile.avatarUrl || '',
      nickname: profile.nickname || '网易云用户',
      vipType: profile.vipType || 0,
      followeds: profile.followeds || 0,
      follows: profile.follows || 0,
      playlistCount: profile.playlistCount || 0,
    };
  }

  async function fetchNeteaseUserDetail() {
    try {
      const data = await fetchApi('/api/netease/account', {}, 'netease');
      if (data && data.profile) {
        ApiBridge.neteaseUser = _makeNeteaseUser(data.profile);
      } else {
        const fallbackData = await fetchApi('/api/netease/user/detail', {}, 'netease');
        if (fallbackData && fallbackData.profile) {
          ApiBridge.neteaseUser = _makeNeteaseUser(fallbackData.profile);
        } else {
          ApiBridge.neteaseUser = {
            avatarUrl: '', nickname: '网易云用户', vipType: 0,
            followeds: 0, follows: 0, playlistCount: 0,
          };
        }
      }
      return ApiBridge.neteaseUser;
    } catch (e) {
      _apiwarn('Failed to fetch Netease user detail:', e);
      return null;
    }
  }

  // ── QQ User Detail ──
  async function fetchQQUserDetail() {
    // Default user — shows QQ is logged in even if profile API fails
    if (!ApiBridge.qqUser) {
      ApiBridge.qqUser = { avatarUrl: '', nickname: 'QQ用户', vipLevel: 0, followers: 0, followings: 0, playlistCount: 0 };
    }
    try {
      const data = await fetchApi('/api/qq/user/detail', {}, 'qq', 'GET');
      _apilog('[fetchQQUserDetail] API response:', JSON.stringify(data).substring(0, 300));
      if (data && data.code === 0 && data.data) {
        const creator = data.data.creator || data.data;
        const nick = creator.nick || creator.nickname || creator.name || '';
        const headpic = (creator.headpic || creator.avatar || creator.avatarUrl || '').replace(/^http:/, 'https:');
        if (nick) ApiBridge.qqUser.nickname = nick;
        if (headpic) ApiBridge.qqUser.avatarUrl = headpic;
        ApiBridge.qqUser.vipLevel = (data.data.vipInfo && data.data.vipInfo.vipType) || 0;
        ApiBridge.qqUser.followers = creator.fanscnt || creator.followers || 0;
        ApiBridge.qqUser.followings = creator.followcnt || creator.followings || 0;
        ApiBridge.qqUser.playlistCount = creator.dissnum || creator.playlistCount || 0;
      }
      // Re-render user panel if open
      if (typeof UserPanel !== 'undefined' && UserPanel.activeTab === 'qq') {
        try { UserPanel.renderTabContent('qq'); } catch(_) {}
      }
      return ApiBridge.qqUser;
    } catch (e) {
      _apiwarn('Failed to fetch QQ user detail:', e);
      return ApiBridge.qqUser;
    }
  }

  // ── Kugou User Detail (disabled — Kugou API blocked by WAF) ──
  // Kugou support disabled (API blocked by WAF)
  /* eslint-disable no-unused-vars */
  async function fetchKugouUserDetail() { return null; }
  async function fetchKugouPlaylists() { return []; }
  /* eslint-enable no-unused-vars */

  // ── Qishui User Detail ──
  async function fetchQishuiUserDetail() {
    if (!ApiBridge.qishuiUser) {
      ApiBridge.qishuiUser = { avatarUrl: '', nickname: '汽水用户', vipType: 0, followers: 0, followings: 0, playlistCount: 0 };
    }
    try {
      // Use Electron IPC when available (bypasses douyin anti-bot)
      if (window.fluidmusic && window.fluidmusic.qishuiApi) {
        const result = await window.fluidmusic.qishuiApi('user/detail');
        _apilog('[QishuiUser] IPC result:', result);
        if (result && result.code === 0 && result.data) {
          const d = result.data;
          // douyin passport response: { data: { nickname, avatar_url, ... } }
          if (d.nickname || d.nick_name) ApiBridge.qishuiUser.nickname = d.nickname || d.nick_name;
          if (d.avatarUrl || d.avatar_url || d.avatar_medium) ApiBridge.qishuiUser.avatarUrl = d.avatarUrl || d.avatar_url || d.avatar_medium;
          if (d.follower_count !== undefined) ApiBridge.qishuiUser.followers = d.follower_count;
          if (d.following_count !== undefined) ApiBridge.qishuiUser.followings = d.following_count;
        }
      } else {
        // Fallback: server proxy (limited — douyin will block)
        const data = await fetchApi('/api/qishui/user/detail', {}, 'qishui');
        if (data && data.code === 0 && data.data) {
          const d = data.data;
          if (d.nickname) ApiBridge.qishuiUser.nickname = d.nickname;
          if (d.avatarUrl) ApiBridge.qishuiUser.avatarUrl = d.avatarUrl;
        }
      }
      return ApiBridge.qishuiUser;
    } catch (e) {
      _apiwarn('Failed to fetch Qishui user detail:', e);
      return ApiBridge.qishuiUser;
    }
  }
  async function fetchUserPlaylists() {
    const playlists = { netease: [], qq: [], qishui: [] };

    if (ApiBridge.neteaseLoggedIn) {
      try {
        // No uid needed — server resolves it from account endpoint automatically
        const data = await fetchApi('/api/netease/user/playlist', {}, 'netease');
        if (data && data.playlist) {
          playlists.netease = data.playlist.map((pl) => ({
            id: pl.id,
            name: pl.name,
            coverUrl: pl.coverImgUrl || '',
            trackCount: pl.trackCount || 0,
            platform: 'netease',
          }));
        }
      } catch (e) {
        _apiwarn('Failed to fetch Netease playlists:', e);
      }
    }

    if (ApiBridge.qqLoggedIn) {
      try {
        const data = await fetchApi('/api/qq/user/playlist', {}, 'qq', 'GET');
        // fcg_user_created_diss response: { code:0, data:{ disslist:[{ dissid, diss_name, diss_cover, song_cnt }] } }
        let qqPlaylists = [];
        if (data && data.code === 0 && data.data && Array.isArray(data.data.disslist)) {
          qqPlaylists = data.data.disslist || [];
        }
        playlists.qq = qqPlaylists.map((pl) => ({
          id: pl.dissid || pl.tid || String(pl.id || ''),
          name: pl.diss_name || pl.name || pl.title || pl.dirname || '',
          coverUrl: (pl.diss_cover || pl.logo || pl.picurl || pl.cover || '').replace(/^http:/, 'https:'),
          trackCount: pl.song_cnt || pl.songnum || pl.song_count || 0,
          platform: 'qq',
        }));
      } catch (e) {
        _apiwarn('Failed to fetch QQ playlists:', e);
      }
    }

    if (ApiBridge.qishuiLoggedIn) {
      try {
        // Use Electron IPC when available
        let data;
        if (window.fluidmusic && window.fluidmusic.qishuiApi) {
          const result = await window.fluidmusic.qishuiApi('user/playlist');
          _apilog('[QishuiPlaylist] IPC result:', result ? result.code : 'null');
          if (result && result.code === 0 && result.data) {
            data = result.data;
          }
        } else {
          data = await fetchApi('/api/qishui/user/playlist', {}, 'qishui');
        }
        // Luna PC playlist response: { data: { disslist: [...] } }
        if (data && data.data && Array.isArray(data.data.disslist)) {
          playlists.qishui = data.data.disslist.map((pl) => ({
            id: pl.dissid || pl.tid || String(pl.id || ''),
            name: pl.diss_name || pl.name || pl.title || pl.dirname || '',
            coverUrl: (pl.diss_cover || pl.logo || pl.picurl || pl.cover || '').replace(/^http:/, 'https:'),
            trackCount: pl.song_cnt || pl.songnum || pl.song_count || 0,
            platform: 'qishui',
          }));
        } else if (data && Array.isArray(data.disslist)) {
          playlists.qishui = data.disslist.map((pl) => ({
            id: pl.dissid || pl.tid || String(pl.id || ''),
            name: pl.diss_name || pl.name || pl.title || pl.dirname || '',
            coverUrl: (pl.diss_cover || pl.logo || pl.picurl || pl.cover || '').replace(/^http:/, 'https:'),
            trackCount: pl.song_cnt || pl.songnum || pl.song_count || 0,
            platform: 'qishui',
          }));
        }
      } catch (e) {
        _apiwarn('Failed to fetch Qishui playlists:', e);
      }
    }


    // Merge imported playlists marked as synced (from import tab)
    try {
      const synced = JSON.parse(localStorage.getItem('fluidmusic_synced_playlists') || '{}');
      const imported = JSON.parse(localStorage.getItem('fluidmusic_imported_playlists') || '{}');
      for (const [key, pl] of Object.entries(imported)) {
        const platform = pl.platform;
        if (synced[platform] && synced[platform][pl.id]) {
          if (!playlists[platform]) playlists[platform] = [];
          if (!playlists[platform].find(p => String(p.id) === String(pl.id))) {
            playlists[platform].push({ ...pl, _imported: true });
          }
        }
      }
    } catch(e) { /* ignore parse errors */ }
    return playlists;
  }

  // ── Netease API ──
  async function searchNetease(keywords, limit = 20) {
    return fetchApi('/api/netease/search', { keywords, limit }, 'netease');
  }
  async function getNeteasePlaylist(id) {
    return fetchApi('/api/netease/playlist/detail', { id }, 'netease');
  }
  async function getNeteaseUserPlaylist(uid) {
    return fetchApi('/api/netease/user/playlist', { uid }, 'netease');
  }
  async function getNeteaseSongUrl(id) {
    return fetchApi('/api/netease/song/url', { id }, 'netease');
  }
  async function getNeteaseLyric(id) {
    return fetchApi('/api/netease/lyric', { id }, 'netease');
  }

  // ── QQ API ──
  async function searchQQ(keywords, limit = 20) {
    return fetchApi('/api/qq/search', { keywords, limit }, 'qq');
  }
  async function getQQPlaylist(id) {
    return fetchApi('/api/qq/playlist/detail', { id }, 'qq');
  }
  async function getQQSongUrl(songmid) {
    return fetchApi('/api/qq/song/url', { songmid }, 'qq');
  }
  async function getQQLyric(songmid) {
    return fetchApi('/api/qq/lyric', { songmid }, 'qq');
  }

  // ── Qishui API ──
  async function searchQishui(keywords, limit = 20) {
    if (window.fluidmusic && window.fluidmusic.qishuiApi) {
      const result = await window.fluidmusic.qishuiApi('search', { keywords, limit });
      if (result && result.code === 0) return result.data;
      return null;
    }
    return fetchApi('/api/qishui/search', { keywords, limit }, 'qishui');
  }
  async function getQishuiTrackDetail(id) {
    if (window.fluidmusic && window.fluidmusic.qishuiApi) {
      const result = await window.fluidmusic.qishuiApi('track/detail', { id });
      if (result && result.code === 0) return { code: 0, data: result.data };
      return result;
    }
    return fetchApi('/api/qishui/track/detail', { id }, 'qishui');
  }
  async function getQishuiSongUrl(id) {
    if (window.fluidmusic && window.fluidmusic.qishuiApi) {
      const result = await window.fluidmusic.qishuiApi('song/url', { id });
      if (result && result.code === 0) return { code: 0, data: result.data };
      return result;
    }
    return fetchApi('/api/qishui/song/url', { id }, 'qishui');
  }
  async function getQishuiLyric(id) {
    if (window.fluidmusic && window.fluidmusic.qishuiApi) {
      const result = await window.fluidmusic.qishuiApi('lyric', { id });
      if (result && result.code === 0) return { code: 0, data: result.data };
      return result;
    }
    return fetchApi('/api/qishui/lyric', { id }, 'qishui');
  }

  // ── 导入歌单（通过分享链接）──
  function parsePlaylistUrl(url) {
    if (!url) return null;
    const raw = String(url).trim();
    if (!raw) return null;

    // Auto-extract URL from mixed text (e.g. "歌单｜… https://qishui.douyin.com/s/xxx/ [@xx]")
    const urlMatch = raw.match(/https?:\/\/[^\s<>"'\])]*/);
    const u = urlMatch ? urlMatch[0] : raw;

    // ── Netease ──
    let m = u.match(/music\.163\.com.*playlist[?&\/]id=(\d+)/);
    if (m) return { platform: 'netease', id: m[1] };
    m = u.match(/music\.163\.com\/playlist\/(\d+)/);
    if (m) return { platform: 'netease', id: m[1] };

    // ── QQ ──
    m = u.match(/y\.qq\.com\/n\/(?:ryqq|yqq)\/playlist\/(\d+)/);
    if (m) return { platform: 'qq', id: m[1] };
    m = u.match(/y\.qq\.com\/n\/(?:ryqq|yqq)\/playsquare\/(\d+)/);
    if (m) return { platform: 'qq', id: m[1] };
    m = u.match(/y\.qq\.com.*taoge.*[?&]id=(\d+)/);
    if (m) return { platform: 'qq', id: m[1] };
    m = u.match(/y\.qq\.com.*(?:playlist|taoge).*[?&]id=(\d+)/);
    if (m) return { platform: 'qq', id: m[1] };

    // ── Qishui ──
    m = u.match(/qishui\..*\/(?:playlist|album|music\/playlist)\/(\d+)/);
    if (m) return { platform: 'qishui', id: m[1] };
    m = u.match(/qishui\..*\/s\/([A-Za-z0-9]+)/);
    if (m) return { platform: 'qishui', id: m[1], _short: true };
    // music.douyin.com share: /qishui/share/playlist?playlist_id=xxx
    m = u.match(/douyin\.com.*playlist_id=(\d+)/);
    if (m) return { platform: 'qishui', id: m[1] };
    // Douyin share: camelCase playlistId=
    m = u.match(/douyin\.com.*playlistId=(\d+)/);
    if (m) return { platform: 'qishui', id: m[1] };

    // ── Kugou ──
    // https://www.kugou.com/yy/special/single/xxxxx.html (MOST COMMON)
    m = u.match(/kugou\.com\/yy\/special\/single\/(\d+)/);
    if (m) return { platform: 'kugou', id: m[1] };
    // https://www.kugou.com/mixsong/xxxxx.html
    m = u.match(/kugou\.com\/mixsong\/([A-Za-z0-9]+)/);
    if (m) return { platform: 'kugou', id: m[1] };
    // https://www.kugou.com/songlist/xxxxx or /share/xxxxx.html
    m = u.match(/kugou\.com\/(?:songlist|share)\/([A-Za-z0-9]+)/);
    if (m) return { platform: 'kugou', id: m[1] };
    // Kugou short link: t.kugou.com/xxxxx or t3.kugou.com/xxxxx
    m = u.match(/t\d*\.kugou\.com\/([A-Za-z0-9]+)/);
    if (m) return { platform: 'kugou', id: m[1], _short: true };

    // ── Bilibili ──
    // https://www.bilibili.com/video/BVxxxxx or b23.tv/xxxxx
    m = u.match(/bilibili\.com\/video\/(BV[A-Za-z0-9]+)/);
    if (m) return { platform: 'bilibili', id: m[1] };
    // b23.tv short link (needs resolution) or direct BV
    m = u.match(/b23\.tv\/([A-Za-z0-9]+)/);
    if (m) return { platform: 'bilibili', id: m[1], _short: m[1].startsWith('BV') ? false : true };
    m = u.match(/bilibili\.com\/bangumi\/play\/(?:ss|ep)(\d+)/);
    if (m) return { platform: 'bilibili', id: m[1] };

    // ── 5Sing ──
    // https://5sing.kugou.com/12345678/dj/xxxxx.html
    m = u.match(/5sing\.kugou\.com.*\/(?:dj|fc|song)\/([A-Za-z0-9]+)/);
    if (m) return { platform: 'fivesing', id: m[1] };

    // ── Qianqian (千千音乐) ──
    // https://music.91q.com/songlist/xxx or ?songlistid=xxx
    m = u.match(/91q\.com\/(?:songlist|tracklist|playlist)\/([A-Za-z0-9]+)/);
    if (m) return { platform: 'qianqian', id: m[1] };
    m = u.match(/91q\.com.*(?:songlistid|tracklistid|playlistid)=([A-Za-z0-9]+)/);
    if (m) return { platform: 'qianqian', id: m[1] };

    // ── JOOX ──
    // https://www.joox.com/.../playlist/xxx
    m = u.match(/joox\.com.*\/playlist\/([^/?#]+)/);
    if (m) return { platform: 'joox', id: m[1] };
    m = u.match(/joox\.com.*(?:playlistid|playlist_id)=([^&]+)/);
    if (m) return { platform: 'joox', id: m[1] };

    // ── Jamendo ──
    // https://www.jamendo.com/playlist/123456
    m = u.match(/jamendo\.com\/playlist\/(\d+)/);
    if (m) return { platform: 'jamendo', id: m[1] };

    // ── Apple Music ──
    // https://music.apple.com/.../playlist/.../pl.xxx
    m = u.match(/(?:music|itunes)\.apple\.com.*\/playlist\/[^/]+\/(pl\.[A-Za-z0-9._-]+)/);
    if (m) return { platform: 'apple', id: m[1] };
    m = u.match(/(?:music|itunes)\.apple\.com.*\/playlists?\/([A-Za-z0-9._-]+)/);
    if (m) return { platform: 'apple', id: m[1] };

    // ── Kuwo ──
    // http://www.kuwo.cn/playlist_detail/xxxxx
    m = u.match(/kuwo\.cn\/playlist_detail\/(\d+)/);
    if (m) return { platform: 'kuwo', id: m[1] };

    // ── Migu ──
    // https://music.migu.cn/v3/music/playlist/xxxxx
    m = u.match(/migu\.cn.*\/playlist\/(\d+)/);
    if (m) return { platform: 'migu', id: m[1] };
    // https://music.migu.cn/...?musicListId=xxx
    m = u.match(/migu\.cn.*musicListId=(\d+)/);
    if (m) return { platform: 'migu', id: m[1] };

    return null;
  }

  async function resolveQishuiShortLink(shortCode) {
    if (window.fluidmusic?.qishuiApi) {
      const result = await window.fluidmusic.qishuiApi('resolve-short-link', { code: shortCode });
      if (result?.code === 0 && result.data?.id) {
        return { platform: 'qishui', id: result.data.id, name: result.data.name, coverUrl: result.data.coverUrl, trackCount: result.data.trackCount };
      }
    }
    return null;
  }

  async function importPlaylistByUrl(url) {
    let parsed = parsePlaylistUrl(url);
    if (!parsed) return { ok: false, error: '无法识别链接格式，支持：网易云/QQ/汽水/酷狗/酷我/咪咕/B站/5Sing/千千/JOOX/Jamendo/Apple Music' };

    // Resolve short links — qishui via IPC, bilibili via server, kugou via server proxy
    if (parsed._short) {
      // bilibili b23.tv short link resolution
      // kugou short link: t.kugou.com → resolve via server redirect
      if (parsed.platform === 'kugou') {
        const resolvedResult = await fetchApi('/api/kugou/resolve-short', { code: parsed.id }, 'kugou');
        if (resolvedResult?.code === 0 && resolvedResult.data?.id) {
          const resolved = resolvedResult.data;
          const imported = getImportedPlaylists();
          const key = 'kugou_' + resolved.id;
          imported[key] = { id: resolved.id, name: resolved.name || '酷狗歌单', coverUrl: resolved.coverUrl || '', trackCount: resolved.trackCount || 0, platform: 'kugou' };
          try { localStorage.setItem('fluidmusic_imported_playlists', JSON.stringify(imported)); } catch(e) {}
          return { ok: true, playlist: imported[key] };
        }
        return { ok: false, error: '无法解析酷狗短链接，请使用完整歌单链接' };
      }

      if (parsed.platform === 'bilibili') {
        const resolvedResult = await fetchApi('/api/bilibili/resolve-short', { code: parsed.id }, 'bilibili');
        if (resolvedResult?.code === 0 && resolvedResult.data?.id) {
          const resolved = resolvedResult.data;
          const imported = getImportedPlaylists();
          const key = 'bilibili_' + resolved.id;
          imported[key] = { id: resolved.id, name: resolved.name || 'B站合集', coverUrl: resolved.coverUrl || '', trackCount: resolved.trackCount || 0, platform: 'bilibili' };
          try { localStorage.setItem('fluidmusic_imported_playlists', JSON.stringify(imported)); } catch(e) {}
          return { ok: true, playlist: imported[key] };
        }
        return { ok: false, error: '无法解析B站短链接，请使用完整BV号链接' };
      }

      const shortCode = parsed.id;
      const resolved = await resolveQishuiShortLink(shortCode);
      if (resolved) {
        const imported = getImportedPlaylists();
        const key = 'qishui_' + resolved.id;
        imported[key] = { id: resolved.id, name: resolved.name || '汽水歌单', coverUrl: resolved.coverUrl || '', trackCount: resolved.trackCount || 0, platform: 'qishui' };
        try { localStorage.setItem('fluidmusic_imported_playlists', JSON.stringify(imported)); } catch(e) {}
        return { ok: true, playlist: imported[key] };
      }
      return { ok: false, error: '无法解析汽水短链接（链接可能已失效），请尝试在浏览器中打开后复制完整歌单链接' };
    }

    _apilog('[Import] Parsed:', parsed.platform, parsed.id);

    let meta = null;
    if (parsed.platform === 'netease') {
      const data = await fetchApi('/api/netease/playlist/detail', { id: parsed.id }, 'netease');
      if (data?.playlist) {
        meta = { id: parsed.id, name: data.playlist.name, coverUrl: (data.playlist.coverImgUrl || '').replace(/^http:/, 'https:'), trackCount: data.playlist.trackCount || 0, platform: 'netease' };
      } else if (data?.result?.name) {
        meta = { id: parsed.id, name: data.result.name, coverUrl: (data.result.coverImgUrl || '').replace(/^http:/, 'https:'), trackCount: data.result.trackCount || 0, platform: 'netease' };
      }
    } else if (parsed.platform === 'qq') {
      const data = await fetchApi('/api/qq/playlist/detail', { id: parsed.id }, 'qq', 'GET');
      if (data?.cdlist?.[0]) {
        const pl = data.cdlist[0];
        meta = { id: parsed.id, name: pl.dissname || pl.diss_name || '', coverUrl: (pl.logo || pl.diss_cover || '').replace(/^http:/, 'https:'), trackCount: pl.songnum || pl.total_song_num || 0, platform: 'qq' };
      }
    } else if (parsed.platform === 'qishui') {
      // qishui playlist detail via IPC or SEO fallback
      const qsData = await fetchApi('/api/qishui/playlist/detail', { id: parsed.id }, 'qishui');
      if (qsData?.code === 0 && qsData.data) {
        meta = { id: parsed.id, name: qsData.data.name || '汽水歌单', coverUrl: (qsData.data.coverUrl || '').replace(/^http:/, 'https:'), trackCount: qsData.data.trackCount || 0, platform: 'qishui' };
      }
    } else if (parsed.platform === 'kugou') {
      const data = await fetchApi('/api/kugou/playlist/detail', { id: parsed.id }, 'kugou');
      if (data?.code === 0 && data.data) {
        meta = { id: parsed.id, name: data.data.name || '酷狗歌单', coverUrl: (data.data.coverUrl || '').replace(/^http:/, 'https:'), trackCount: data.data.trackCount || 0, platform: 'kugou' };
      }
    } else if (parsed.platform === 'kuwo') {
      const data = await fetchApi('/api/kuwo/playlist/detail', { id: parsed.id }, 'kuwo');
      if (data?.code === 0 && data.data) {
        meta = { id: parsed.id, name: data.data.name || '酷我歌单', coverUrl: (data.data.coverUrl || '').replace(/^http:/, 'https:'), trackCount: data.data.trackCount || 0, platform: 'kuwo' };
      }
    } else if (parsed.platform === 'migu') {
      const data = await fetchApi('/api/migu/playlist/detail', { id: parsed.id }, 'migu');
      if (data?.code === 0 && data.data) {
        meta = { id: parsed.id, name: data.data.name || '咪咕歌单', coverUrl: (data.data.coverUrl || '').replace(/^http:/, 'https:'), trackCount: data.data.trackCount || 0, platform: 'migu' };
      }
    } else if (parsed.platform === 'bilibili') {
      const data = await fetchApi('/api/bilibili/playlist/detail', { id: parsed.id }, 'bilibili');
      if (data?.code === 0 && data.data) {
        meta = { id: parsed.id, name: data.data.name || 'B站合集', coverUrl: (data.data.coverUrl || '').replace(/^http:/, 'https:'), trackCount: data.data.trackCount || 0, platform: 'bilibili' };
      }
    } else if (parsed.platform === 'fivesing') {
      const data = await fetchApi('/api/fivesing/playlist/detail', { id: parsed.id }, 'fivesing');
      if (data?.code === 0 && data.data) {
        meta = { id: parsed.id, name: data.data.name || '5Sing歌单', coverUrl: (data.data.coverUrl || '').replace(/^http:/, 'https:'), trackCount: data.data.trackCount || 0, platform: 'fivesing' };
      }
    } else if (parsed.platform === 'qianqian') {
      const data = await fetchApi('/api/qianqian/playlist/detail', { id: parsed.id }, 'qianqian');
      if (data?.code === 0 && data.data) {
        meta = { id: parsed.id, name: data.data.name || '千千歌单', coverUrl: (data.data.coverUrl || '').replace(/^http:/, 'https:'), trackCount: data.data.trackCount || 0, platform: 'qianqian' };
      }
    } else if (parsed.platform === 'joox') {
      const data = await fetchApi('/api/joox/playlist/detail', { id: parsed.id }, 'joox');
      if (data?.code === 0 && data.data) {
        meta = { id: parsed.id, name: data.data.name || 'JOOX歌单', coverUrl: (data.data.coverUrl || '').replace(/^http:/, 'https:'), trackCount: data.data.trackCount || 0, platform: 'joox' };
      }
    } else if (parsed.platform === 'jamendo') {
      const data = await fetchApi('/api/jamendo/playlist/detail', { id: parsed.id }, 'jamendo');
      if (data?.code === 0 && data.data) {
        meta = { id: parsed.id, name: data.data.name || 'Jamendo歌单', coverUrl: (data.data.coverUrl || '').replace(/^http:/, 'https:'), trackCount: data.data.trackCount || 0, platform: 'jamendo' };
      }
    } else if (parsed.platform === 'apple') {
      const data = await fetchApi('/api/apple/playlist/detail', { id: parsed.id }, 'apple');
      if (data?.code === 0 && data.data) {
        meta = { id: parsed.id, name: data.data.name || 'Apple Music歌单', coverUrl: (data.data.coverUrl || '').replace(/^http:/, 'https:'), trackCount: data.data.trackCount || 0, platform: 'apple' };
      }
    }

    if (!meta) return { ok: false, error: '获取歌单信息失败，请确认链接有效' };

    // Save to localStorage
    const imported = getImportedPlaylists();
    const key = meta.platform + '_' + meta.id;
    imported[key] = meta;
    try { localStorage.setItem('fluidmusic_imported_playlists', JSON.stringify(imported)); } catch(e) {}

    return { ok: true, playlist: meta };
  }

  function getImportedPlaylists() {
    try { return JSON.parse(localStorage.getItem('fluidmusic_imported_playlists') || '{}'); }
    catch(e) { return {}; }
  }

  function removeImportedPlaylist(platform, id) {
    const imported = getImportedPlaylists();
    delete imported[platform + '_' + id];
    try { localStorage.setItem('fluidmusic_imported_playlists', JSON.stringify(imported)); } catch(e) {}
  }

  // ── Exports ──
  ApiBridge.init = init;
  ApiBridge.loginPlatform = loginPlatform;
  ApiBridge.openNeteaseLogin = openNeteaseLogin;
  ApiBridge.openQQLogin = openQQLogin;
  ApiBridge.fetchNeteaseUserDetail = fetchNeteaseUserDetail;
  ApiBridge.fetchQQUserDetail = fetchQQUserDetail;
  ApiBridge.fetchUserPlaylists = fetchUserPlaylists;
  ApiBridge.fetchApi = fetchApi;
  ApiBridge.cookieStore = cookieStore;
  ApiBridge.searchNetease = searchNetease;
  ApiBridge.getNeteasePlaylist = getNeteasePlaylist;
  ApiBridge.getNeteaseUserPlaylist = getNeteaseUserPlaylist;
  ApiBridge.getNeteaseSongUrl = getNeteaseSongUrl;
  ApiBridge.getNeteaseLyric = getNeteaseLyric;
  ApiBridge.searchQQ = searchQQ;
  ApiBridge.getQQPlaylist = getQQPlaylist;
  ApiBridge.getQQSongUrl = getQQSongUrl;
  ApiBridge.getQQLyric = getQQLyric;
  ApiBridge.fetchQishuiUserDetail = fetchQishuiUserDetail;
  ApiBridge.searchQishui = searchQishui;
  ApiBridge.getQishuiTrackDetail = getQishuiTrackDetail;
  ApiBridge.getQishuiSongUrl = getQishuiSongUrl;
  ApiBridge.getQishuiLyric = getQishuiLyric;
  ApiBridge.parsePlaylistUrl = parsePlaylistUrl;
  ApiBridge.importPlaylistByUrl = importPlaylistByUrl;
  ApiBridge.getImportedPlaylists = getImportedPlaylists;
  ApiBridge.removeImportedPlaylist = removeImportedPlaylist;

  if (typeof __FM !== 'undefined') __FM.register('apiBridge', [], function () { return ApiBridge; }, { priority: 5 });
  window.ApiBridge = ApiBridge;
  console.log('FluidMusic API Bridge loaded');
})();
