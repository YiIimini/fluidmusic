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

  // ── Unified API fetcher — passes x-cookie & x-platform to the local server proxy ──
  async function fetchApi(endpoint, params = {}, platform, method = "GET") {
    const base = 'http://127.0.0.1:' + (window.location.port || 3000);
    const query = new URLSearchParams(params).toString();
    const url = base + endpoint + (query ? '?' + query : '');

    const headers = {};
    if (platform && cookieStore[platform]) {
      headers['x-cookie'] = cookieStore[platform];
      headers['x-platform'] = platform;
    }

    console.log('[fetchApi] ' + platform + ' → ' + endpoint + ' | cookie:', !!cookieStore[platform], '| len:', (cookieStore[platform] || '').length);
    const res = await fetch(url, { method, headers });
    const json = await res.json();
    console.log('[fetchApi] ' + platform + ' ← ' + endpoint + ' | status:', res.status, '| hasData:', !!json);
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
        }

        console.log('Login status loaded — netease:', ApiBridge.neteaseLoggedIn, 'qq:', ApiBridge.qqLoggedIn, '(kugou disabled)');

        // Fetch user profiles if already logged in (for UserPanel display)
        if (ApiBridge.neteaseLoggedIn) await fetchNeteaseUserDetail();
        if (ApiBridge.qqLoggedIn) await fetchQQUserDetail();
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
          // Re-fetch profile for UserPanel
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
    try {
      const data = await fetchApi('/api/qq/user/detail', {}, 'qq', 'GET');
      // fcg_get_profile_homepage.fcg response: { code:0, data:{ creator:{ nick, headpic, ... } } }
      if (data && data.code === 0 && data.data) {
        const creator = data.data.creator || data.data;
        ApiBridge.qqUser = {
          avatarUrl: (creator.headpic || creator.avatar || creator.avatarUrl || '').replace(/^http:/, 'https:'),
          nickname: creator.nick || creator.nickname || 'QQ用户',
          vipLevel: (data.data.vipInfo && data.data.vipInfo.vipType) || 0,
          followers: creator.fanscnt || creator.followers || 0,
          followings: creator.followcnt || creator.followings || 0,
          playlistCount: creator.dissnum || creator.playlistCount || 0,
        };
      }
      return ApiBridge.qqUser;
    } catch (e) {
      console.warn('Failed to fetch QQ user detail:', e);
      return null;
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

  window.ApiBridge = ApiBridge;
  console.log('FluidMusic API Bridge loaded');
})();
