// ============================================================
// FluidMusic — User Management Overlay
// Tabbed panel for multi-platform account management
// ============================================================
(function () {
  'use strict';

  const UserPanel = {
    overlay: null,
    panel: null,
    activeTab: 'netease',
  };

  function init() {
    UserPanel.overlay = document.getElementById('user-overlay');
    UserPanel.panel = document.getElementById('user-panel');
    if (!UserPanel.overlay) return;

    // Wire close button
    const closeBtn = document.getElementById('user-panel-close');
    if (closeBtn) closeBtn.addEventListener('click', hide);

    // Close on overlay click
    UserPanel.overlay.addEventListener('click', (e) => {
      if (e.target === UserPanel.overlay) hide();
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && UserPanel.overlay.classList.contains('open')) hide();
    });

    // Wire TABs
    const tabs = document.querySelectorAll('#user-tabs .user-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const platform = tab.dataset.tab;
        switchTab(platform);
      });
    });

    console.log('User Panel initialized');
  }

  function toggle() {
    if (!UserPanel.overlay) {
      console.error('[UserPanel] toggle called but overlay is null');
      return;
    }
    if (UserPanel.overlay.classList.contains('open')) {
      hide();
    } else {
      show();
    }
  }

  function show() {
    if (!UserPanel.overlay) return;
    render();
    UserPanel.overlay.classList.add('open');
  }

  function hide() {
    if (!UserPanel.overlay) return;
    UserPanel.overlay.classList.remove('open');
  }

  function switchTab(platform) {
    UserPanel.activeTab = platform;
    const tabs = document.querySelectorAll('#user-tabs .user-tab');
    tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === platform));
    renderTabContent(platform);
  }

  function render() {
    switchTab(UserPanel.activeTab);
  }

  function renderTabContent(platform) {
    const content = document.getElementById('user-content');
    if (!content) return;

    const loggedIn = typeof ApiBridge !== 'undefined' ? ApiBridge[platform + 'LoggedIn'] : false;
    const user = typeof ApiBridge !== 'undefined' ? ApiBridge[platform + 'User'] : null;
    const cssClass = platform === 'qq' ? 'qq' : 'net';
    const names = { netease: '网易云音乐', qq: 'QQ音乐' };
    const icons = { netease: '🎧', qq: '🎵' };

    if (loggedIn && user) {
      const avatarUrl = user.avatarUrl || '';
      const nickname = user.nickname || '用户';

      let vipBadge = '';
      if (platform === 'netease' && user.vipType > 0) {
        vipBadge = `<span class="user-panel-vip">${user.vipType >= 10 ? '黑胶VIP' : 'VIP'}</span>`;
      } else if (platform === 'qq' && user.vipLevel > 0) {
        vipBadge = `<span class="user-panel-vip">${user.vipLevel >= 7 ? '豪华VIP' : 'VIP'}</span>`;
      }

      const followers = user.followeds || user.followers || 0;
      const following = user.follows || user.followings || 0;
      const plCount = user.playlistCount || 0;

      let avatarHtml = '';
      if (avatarUrl) {
        avatarHtml = `<img class="user-panel-avatar" src="${escHtml(avatarUrl)}" alt="${escHtml(nickname)}" onerror="this.style.display='none'">`;
      }

      content.innerHTML = `
        <div class="user-panel-row ${cssClass}">
          ${avatarHtml}
          <div class="user-panel-info">
            <span class="user-panel-nick">${escHtml(nickname)}</span>
            <span class="user-panel-meta">
              <span class="user-panel-platform-tag ${cssClass}">${icons[platform]} ${names[platform]}</span>
              ${vipBadge}
            </span>
            <span class="user-panel-meta" style="margin-top:4px">
              <span>${fmtNum(followers)} 粉丝</span>
              <span>${fmtNum(following)} 关注</span>
              <span>${fmtNum(plCount)} 歌单</span>
            </span>
          </div>
          <div class="user-panel-actions">
            <button class="user-panel-btn logout" data-platform="${platform}">退出</button>
          </div>
        </div>
        <div class="user-panel-section-title">📋 我的歌单</div>
        <div id="user-playlist-list-${platform}" class="user-playlist-list">
          <div class="playlist-loading"><div class="playlist-loading-spinner"></div>加载中...</div>
        </div>
      `;

      // Wire logout
      content.querySelector('.user-panel-btn.logout').addEventListener('click', async () => {
        await handleLogout(platform);
      });

      // Fetch playlists
      fetchAndShowPlaylists(platform);

    } else if (loggedIn) {
      content.innerHTML = `
        <div class="user-panel-row ${cssClass}">
          <div class="user-panel-info">
            <span class="user-panel-nick">${icons[platform]} ${names[platform]}</span>
            <span class="user-panel-meta">
              <span class="user-panel-platform-tag ${cssClass}">已登录</span>
            </span>
          </div>
          <div class="user-panel-actions">
            <button class="user-panel-btn logout" data-platform="${platform}">退出</button>
          </div>
        </div>
        <div class="user-panel-section-title">📋 我的歌单</div>
        <div id="user-playlist-list-${platform}" class="user-playlist-list">
          <div class="playlist-loading"><div class="playlist-loading-spinner"></div>加载中...</div>
        </div>
      `;
      content.querySelector('.user-panel-btn.logout').addEventListener('click', async () => {
        await handleLogout(platform);
      });
      fetchAndShowPlaylists(platform);

    } else {
      content.innerHTML = `
        <div class="user-panel-row ${cssClass}">
          <div class="user-panel-info">
            <span class="user-panel-nick">${icons[platform]} ${names[platform]}</span>
            <span class="user-panel-meta">
              <span class="user-panel-not-logged">未登录</span>
            </span>
          </div>
          <div class="user-panel-actions">
            <button class="user-panel-btn login ${cssClass}" data-platform="${platform}">登录</button>
          </div>
        </div>
      `;
      content.querySelector('.user-panel-btn.login').addEventListener('click', async () => {
        await handleLogin(platform);
      });
    }
  }

  // Fetch playlists for a platform and render in user panel
  async function fetchAndShowPlaylists(platform) {
    const container = document.getElementById('user-playlist-list-' + platform);
    if (!container || typeof ApiBridge === 'undefined') return;

    try {
      let playlists = [];
      if (platform === 'netease') {
        const data = await ApiBridge.fetchApi('/api/netease/user/playlist', {}, 'netease');
        if (data && data.playlist) {
          playlists = data.playlist.map(pl => ({
            id: pl.id, name: pl.name, coverUrl: pl.coverImgUrl || '',
            trackCount: pl.trackCount || 0, platform: 'netease',
            createTime: pl.createTime || pl.updateTime || pl.trackUpdateTime || null,
          }));
      } } else if (platform === 'qq') {
        const data = await ApiBridge.fetchApi('/api/qq/user/playlist', {}, 'qq', 'GET');
        // fcg_user_created_diss + fcg_get_profile_order_asset merged response: { code: 0, data: { disslist: [...] } }
        if (data && data.code === 0 && data.data && Array.isArray(data.data.disslist)) {
          playlists = data.data.disslist.map(pl => ({
            id: pl.dissid || pl.tid || String(pl.id || ''),
            name: pl.diss_name || pl.name || pl.title || pl.dirname || '',
            coverUrl: (pl.diss_cover || pl.logo || pl.picurl || pl.cover || '').replace(/^http:/, 'https:'),
            trackCount: pl.song_cnt || pl.songnum || pl.song_count || 0, platform: 'qq',
            createTime: pl.diss_createtime || pl.create_time || pl.modify_time || pl.commit_time || null,
          }));
        }
      
      }

      if (playlists.length === 0) {
        container.innerHTML = '<div class="user-panel-not-logged">暂无歌单</div>';
        return;
      }

      // Load synced playlist IDs from localStorage
      let syncedIds = {};
      try {
        syncedIds = JSON.parse(localStorage.getItem('fluidmusic_synced_playlists') || '{}');
      } catch(e) { syncedIds = {}; }
      const platformIds = syncedIds[platform] || {};

      container.innerHTML = playlists.map(pl => {
        const isSynced = !!platformIds[pl.id];
        // Format date
        let dateStr = '';
        if (pl.createTime) {
          const d = new Date(typeof pl.createTime === 'number' ? pl.createTime * 1000 : pl.createTime);
          if (!isNaN(d.getTime())) dateStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        }
        // Cover HTML
        let coverHtml = '';
        if (pl.coverUrl) {
          coverHtml = '<img class="playlist-item-cover" src="' + escHtml(pl.coverUrl) + '" alt="" onerror="this.style.display=\'none\'" style="width:36px;height:36px;border-radius:6px;object-fit:cover;flex-shrink:0;">';
        }
        return '<div class="user-playlist-item">'
          + '<label class="user-playlist-label" style="cursor:pointer;display:flex;align-items:center;gap:8px;flex:1;min-width:0;">'
          + '<input type="checkbox" class="user-pl-check" data-pid="' + pl.id + '" data-platform="' + pl.platform + '" ' + (isSynced ? 'checked' : '') + '>'
          + coverHtml
          + '<span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;">'
          + '<span class="user-pl-name">' + escHtml(pl.name) + '</span>'
          + (dateStr ? '<span style="color:var(--text-dim);font-size:9px;">' + dateStr + '</span>' : '')
          + '</span>'
          + '</label>'
          + '<span style="color:var(--text-dim);font-size:10px;white-space:nowrap;flex-shrink:0;">' + (isSynced ? '显示' : '隐藏') + '</span>'
          + '</div>';
      }).join('');

      // Wire checkboxes
      container.querySelectorAll('.user-pl-check').forEach(cb => {
        cb.addEventListener('change', () => {
          const pid = cb.dataset.pid;
          const pplatform = cb.dataset.platform;
          if (!syncedIds[pplatform]) syncedIds[pplatform] = {};
          if (cb.checked) {
            syncedIds[pplatform][pid] = true;
            // Re-fetch and cache songs for this playlist
            localStorage.setItem('fluidmusic_synced_playlists', JSON.stringify(syncedIds));
            if (typeof DataCache !== 'undefined') {
              // Background re-fetch
              const pl = { id: pid, platform: pplatform, name: cb.closest('.user-playlist-item').querySelector('.user-pl-name')?.textContent || '' };
              if (typeof BubbleChamber !== 'undefined' && BubbleChamber.loadPlaylistSongs) {
                // Trigger re-fetch through loadPlaylistSongs — will fetch and cache
                console.log('[UserPanel] Re-checked playlist ' + pid + ', triggering re-fetch');
              }
            }
          } else {
            delete syncedIds[pplatform][pid];
            localStorage.setItem('fluidmusic_synced_playlists', JSON.stringify(syncedIds));
            // Clear this playlist's song cache
            if (typeof DataCache !== 'undefined') {
              DataCache.remove('plsongs_' + pplatform + '_' + pid);
              console.log('[UserPanel] Cleared cache for playlist ' + pid);
            }
          }
          // Update status text
          const statusEl = cb.closest('.user-playlist-item').querySelector('span:last-child');
          if (statusEl) statusEl.textContent = cb.checked ? '显示' : '隐藏';
          // Refresh main playlist list
          if (typeof FluidMusicApp !== 'undefined' && FluidMusicApp.syncPlaylists) {
            FluidMusicApp.syncPlaylists();
          if (typeof BubbleChamber !== 'undefined' && BubbleChamber.refreshPlaylistList) {
            setTimeout(() => BubbleChamber.refreshPlaylistList(), 300);
          }
          }
        });
      });
    } catch (e) {
      console.warn('Failed to fetch playlists for', platform, ':', e);
      container.innerHTML = '<div class="user-panel-not-logged">加载失败</div>';
    }
  }


  async function handleLogout(platform) {
    try {
      if (typeof fluidmusic !== 'undefined' && fluidmusic.logoutPlatform) {
        await fluidmusic.logoutPlatform(platform);
      }
      if (typeof ApiBridge !== 'undefined') {
        ApiBridge[platform + 'LoggedIn'] = false;
        ApiBridge[platform + 'User'] = null;
        if (ApiBridge.cookieStore) ApiBridge.cookieStore[platform] = '';
      }
      // Clear this platform's playlist song caches
      if (typeof DataCache !== 'undefined') {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('fluidmusic_cache_plsongs_' + platform + '_')) {
            keys.push(k);
          }
        }
        keys.forEach(k => localStorage.removeItem(k));
        console.log('[Logout] Cleared ' + keys.length + ' song caches for ' + platform);
      }
      // Clear this platform's synced playlist IDs
      try {
        const synced = JSON.parse(localStorage.getItem('fluidmusic_synced_playlists') || '{}');
        delete synced[platform];
        localStorage.setItem('fluidmusic_synced_playlists', JSON.stringify(synced));
      } catch(e) {}
      renderTabContent(platform);
      window.dispatchEvent(new CustomEvent('fluidmusic:login', { detail: { platform } }));
    } catch (e) {
      console.error('Logout failed:', e);
    }
  }

  async function handleLogin(platform) {
    hide();
    if (typeof ApiBridge !== 'undefined' && ApiBridge.loginPlatform) {
      await ApiBridge.loginPlatform(platform);
    }
  }

  function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function fmtNum(n) {
    if (n == null || isNaN(n)) return '0';
    if (n >= 10000) return (n / 10000).toFixed(1) + '万';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
  }

  UserPanel.init = init;
  UserPanel.toggle = toggle;
  UserPanel.show = show;
  UserPanel.hide = hide;
  UserPanel.renderTabContent = renderTabContent;

  window.UserPanel = UserPanel;
  console.log('FluidMusic User Panel loaded');
})();
