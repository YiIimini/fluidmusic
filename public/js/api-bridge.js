// ============================================================
// FluidMusic — Platform API Bridge
// QQ Music + Netease Cloud Music + Kugou Music OAuth login via Electron IPC
// ============================================================
(function () {
  const ApiBridge = {
    neteaseLoggedIn: false,
    qqLoggedIn: false,
    kugouLoggedIn: false,
    neteaseUser: null,
    qqUser: null,
    kugouUser: null,
  };

  // ── Cookie store — populated on init and kept in sync via IPC events ──
  const cookieStore = { netease: '', qq: '' };

  // ── DataCache bridge: TS IndexedDB cache → legacy localStorage fallback ──
  // When the TS bridge is loaded, API responses are cached in IndexedDB via
  // __FM_TS.dataCache.  Otherwise we fall back to the synchronous localStorage
  // DataCache (data-cache.js).  The TS cache uses a store+key namespace so we
  // route everything through the "api" store.
  const _tsCache = (typeof window !== 'undefined' && window.__FM_TS && window.__FM_TS.dataCache)
    ? window.__FM_TS.dataCache
    : null;

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
          console.log('[fetchApi] ' + platform + ' ← cache ' + endpoint);
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

    console.log('[fetchApi] ' + platform + ' → ' + endpoint + ' | cookie:', !!cookieStore[platform], '| len:', (cookieStore[platform] || '').length);
    const res = await fetch(url, { method, headers });
    const json = await res.json();
    console.log('[fetchApi] ' + platform + ' ← ' + endpoint + ' | status:', res.status, '| hasData:', !!json);

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

        console.log('Login status loaded — netease:', ApiBridge.neteaseLoggedIn, 'qq:', ApiBridge.qqLoggedIn, 'qqCookie:', !!cookieStore.qq);

        if (ApiBridge.neteaseLoggedIn) await fetchNeteaseUserDetail();
        if (ApiBridge.qqLoggedIn) fetchQQUserDetail();
              }
    } catch (e) {
      console.warn('Failed to get login status:', e);
    }

    // Listen for login-state-changed events (pushed by main process after login/logout)
    if (typeof fluidmusic !== 'undefined' && fluidmusic.onLoginStateChanged) {
      fluidmusic.onLoginStateChanged((state) => {
        const { platform, loggedIn, cookie } = state;
        console.log('Login state changed:', platform, 'loggedIn:', loggedIn);

        ApiBridge[platform + 'LoggedIn'] = loggedIn;
        cookieStore[platform] = cookie || '';

        if (loggedIn) {
          // Set default user immediately so UserPanel shows login state
          if (!ApiBridge[platform + 'User']) {
            ApiBridge[platform + 'User'] = { avatarUrl: '', nickname: (platform === 'qq' ? 'QQ用户' : '网易云用户'), vipLevel: 0, followers: 0, followings: 0, playlistCount: 0 };
          }
          if (platform === 'netease') fetchNeteaseUserDetail();
          else if (platform === 'qq') fetchQQUserDetail();
                    // Trigger playlist re-sync
          window.dispatchEvent(new CustomEvent('fluidmusic:login', { detail: { platform } }));
        } else {
          ApiBridge[platform + 'User'] = null;
        }
      });
    }

    // Login buttons now handled through UserPanel overlay

    console.log('API Bridge initialized — cookies ready');
  }

  async function loginPlatform(platform) {
    if (typeof fluidmusic === 'undefined') {
      console.warn(platform + ' login not available (not in Electron)');
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
          console.log('[loginPlatform] Stored cookie for', platform, 'length:', result.cookie.length);
        }

        // 2. Fetch user profile after login
        let profile = null;
        try {
          if (platform === 'netease') profile = await fetchNeteaseUserDetail();
          else if (platform === 'qq') profile = await fetchQQUserDetail();
                  } catch (e) {
          console.warn('[loginPlatform] Profile fetch failed for', platform, ':', e.message);
        }

        console.log('[loginPlatform] Fetched profile for', platform, ':', profile ? profile.nickname : 'null');

        // 3. Profile fetched for UserPanel display

        // 4. Auto-check all playlists after login
        try {
          const playlists = await fetchUserPlaylists();
          // Set all playlists as synced by default
          try {
            let synced = JSON.parse(localStorage.getItem('fluidmusic_synced_playlists') || '{}');
            if (!synced[platform]) synced[platform] = {};
            const allPl = [...(playlists.netease || []), ...(playlists.qq || [])];
            allPl.forEach(pl => {
              if (pl.platform === platform) synced[platform][pl.id] = true;
            });
            localStorage.setItem('fluidmusic_synced_playlists', JSON.stringify(synced));
            console.log('[loginPlatform] Auto-checked ' + allPl.length + ' playlists for ' + platform);
          } catch(e) { console.warn('Auto-check failed:', e); }
          console.log('[loginPlatform] Fetched playlists after login:',
            'netease=' + (playlists.netease || []).length,
            'qq=' + (playlists.qq || []).length);

          // Trigger playlist refresh in left chamber
          window.dispatchEvent(new CustomEvent('playlists-updated', { detail: { playlists, platform } }));

          // Also update BubbleChamber directly
          if (typeof BubbleChamber !== 'undefined' && BubbleChamber.setUserPlaylists) {
            BubbleChamber.setUserPlaylists(playlists);
          }
        } catch (e) {
          console.error('[loginPlatform] Failed to fetch playlists:', e);
        }

        // Notify app of login (legacy event)
        window.dispatchEvent(new CustomEvent('fluidmusic:login', { detail: { platform } }));
      }
    } catch (e) {
      console.error(platform + ' login failed:', e);
    } finally {
      if (btn && !ApiBridge[platform + 'LoggedIn']) {
        const platformNames = { netease: '网易云音乐', qq: 'QQ音乐', };
        const platformIcons = { netease: '🎧', qq: '🎵', };
        const i18nKey = { netease: 'login.netease', qq: 'login.qq', }[platform];
        btn.innerHTML = (platformIcons[platform] || '') + ' ' +
          (typeof I18N !== 'undefined' ? I18N.t(i18nKey) : platformNames[platform]);
      }
    }
  }

  // Legacy compatibility
  async function openNeteaseLogin() { return loginPlatform('netease'); }
  async function openQQLogin() { return loginPlatform('qq'); }

  // ── Netease User Detail ──
  async function fetchNeteaseUserDetail() {
    try {
      // Use account endpoint — identifies user from cookie without needing uid
      const data = await fetchApi('/api/netease/account', {}, 'netease');
      if (data && data.profile) {
        ApiBridge.neteaseUser = {
          avatarUrl: data.profile.avatarUrl || '',
          nickname: data.profile.nickname || '网易云用户',
          vipType: data.profile.vipType || 0,
          followeds: data.profile.followeds || 0,
          follows: data.profile.follows || 0,
          playlistCount: data.profile.playlistCount || 0,
        };
      } else {
        // Fallback: try user/detail without uid (server will use account endpoint)
        const fallbackData = await fetchApi('/api/netease/user/detail', {}, 'netease');
        if (fallbackData && fallbackData.profile) {
          ApiBridge.neteaseUser = {
            avatarUrl: fallbackData.profile.avatarUrl || '',
            nickname: fallbackData.profile.nickname || '网易云用户',
            vipType: fallbackData.profile.vipType || 0,
            followeds: fallbackData.profile.followeds || 0,
            follows: fallbackData.profile.follows || 0,
            playlistCount: fallbackData.profile.playlistCount || 0,
          };
        } else {
          ApiBridge.neteaseUser = {
            avatarUrl: '', nickname: '网易云用户', vipType: 0,
            followeds: 0, follows: 0, playlistCount: 0,
          };
        }
      }
      return ApiBridge.neteaseUser;
    } catch (e) {
      console.warn('Failed to fetch Netease user detail:', e);
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
      console.log('[fetchQQUserDetail] API response:', JSON.stringify(data).substring(0, 300));
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
      console.warn('Failed to fetch QQ user detail:', e);
      return ApiBridge.qqUser;
    }
  }

  // ── Kugou User Detail (disabled — Kugou API blocked by WAF) ──
  async function fetchKugouUserDetail() {
    ApiBridge.kugouUser = {
      avatarUrl: '',
      nickname: '酷狗用户',
      vipType: 0,
      followers: 0,
      followings: 0,
      playlistCount: 0,
    };
    return ApiBridge.kugouUser;
  }
  async function fetchKugouPlaylists() {
    return [];
  }
  async function fetchUserPlaylists() {
    const playlists = { netease: [], qq: [] };

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
        console.warn('Failed to fetch Netease playlists:', e);
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
        console.warn('Failed to fetch QQ playlists:', e);
      }
    }

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

  if (typeof __FM !== 'undefined') __FM.register('apiBridge', [], function () { return ApiBridge; }, { priority: 5 });
  window.ApiBridge = ApiBridge;
  console.log('FluidMusic API Bridge loaded');
})();
