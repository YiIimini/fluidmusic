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

    // Wire TABs — re-fetch profile on each click to get latest data
    const tabs = document.querySelectorAll('#user-tabs .user-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const platform = tab.dataset.tab;
        if (platform === 'netease' && typeof ApiBridge !== 'undefined' && ApiBridge.neteaseLoggedIn) {
          ApiBridge.fetchNeteaseUserDetail().then(() => switchTab(platform));
        } else if (platform === 'qq' && typeof ApiBridge !== 'undefined' && ApiBridge.qqLoggedIn) {
          ApiBridge.fetchQQUserDetail().then(() => switchTab(platform));
        } else if (platform === 'qishui' && typeof ApiBridge !== 'undefined' && ApiBridge.qishuiLoggedIn) {
          ApiBridge.fetchQishuiUserDetail().then(() => switchTab(platform));
        } else {
          switchTab(platform);
        }
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
      if (typeof fluidmusic !== 'undefined' && fluidmusic.setOverlayOpen) {
        fluidmusic.setOverlayOpen(true);
      }
    }
  }

  function show() {
    if (!UserPanel.overlay) return;
    UserPanel.overlay.classList.add('open');
    switchTab(UserPanel.activeTab);
  }

  function hide() {
    if (!UserPanel.overlay) return;
    UserPanel.overlay.classList.remove('open');
    if (typeof fluidmusic !== 'undefined' && fluidmusic.setOverlayOpen) {
      fluidmusic.setOverlayOpen(false);
    }
  }
  // (toggle function above replaces both show/hide dispatch)


  function switchTab(platform) {
    UserPanel.activeTab = platform;
    const tabs = document.querySelectorAll('#user-tabs .user-tab');
    tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === platform));
    renderTabContent(platform);
  }

  // eslint-disable-next-line no-unused-vars
  // eslint-disable-next-line no-unused-vars
  function render() {
    switchTab(UserPanel.activeTab);
  }

  function renderTabContent(platform) { console.log("[UserPanel] renderTabContent platform:", platform, "loggedIn:", typeof ApiBridge !== "undefined" ? ApiBridge[platform + "LoggedIn"] : "ApiBridge未定义", "user:", typeof ApiBridge !== "undefined" ? JSON.stringify(ApiBridge[platform + "User"]) : "N/A");
    const content = document.getElementById('user-content');
    if (!content) return;

    if (platform === 'import') { renderImportTab(); return; }

    const loggedIn = typeof ApiBridge !== 'undefined' ? ApiBridge[platform + 'LoggedIn'] : false;
    const user = typeof ApiBridge !== 'undefined' ? ApiBridge[platform + 'User'] : null;
    const cssClass = platform === 'qq' ? 'qq' : (platform === 'qishui' ? 'qishui' : 'net');
    const names = { netease: '网易云音乐', qq: 'QQ音乐', qishui: '汽水音乐' };
    const icons = { netease: '🎧', qq: '🎵', qishui: '🎼' };

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
        avatarHtml = `<img class="user-panel-avatar" src="${escHtml(avatarUrl)}" alt="${escHtml(nickname)}">`;
      }

      content.innerHTML = `
        <div class="user-panel-row ${cssClass}" style="color:#fff !important">
          ${avatarHtml}
          <div class="user-panel-info">
            <span class="user-panel-nick" style="color:#fff !important;font-size:16px;">${escHtml(nickname)}</span>
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
  // ── 导入歌单 Tab ──
  let _importTabRendered = false;

  function renderImportTab() {
    const content = document.getElementById('user-content');
    if (!content) return;

    if (_importTabRendered) {
      renderImportList();
      return;
    }
    _importTabRendered = true;

    content.innerHTML = '<div style="padding:12px 16px;">'
      + '<div class="user-panel-section-title">🔗 粘贴歌单链接</div>'
      + '<div style="display:flex;gap:8px;margin-bottom:4px;">'
      + '<input id="import-url-input" type="text" placeholder="粘贴歌单链接（支持12个平台）" style="flex:1;padding:8px 12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#fff;font-size:13px;outline:none;min-width:0;">'
      + '<button id="import-url-btn" style="padding:8px 16px;background:var(--color-accent);border:none;border-radius:8px;color:#fff;font-size:13px;cursor:pointer;white-space:nowrap;">解析导入</button>'
      + '</div>'
      + '<div id="import-msg" style="font-size:12px;color:var(--text-dim);min-height:18px;margin-bottom:12px;"></div>'
      + '<div class="user-panel-section-title">📥 已导入的歌单</div>'
      + '<div id="import-list" style="max-height:360px;overflow-y:auto;"></div>'
      + '</div>';

    // Wire import button
    const input = document.getElementById('import-url-input');
    const btn = document.getElementById('import-url-btn');
    const msg = document.getElementById('import-msg');
    const names = { netease: '🎧 网易云', qq: '🎵 QQ', qishui: '🎼 汽水', kugou: '🎤 酷狗', kuwo: '🎶 酷我', migu: '📻 咪咕', bilibili: '📺 B站', fivesing: '🎙 5Sing', qianqian: '🎶 千千', joox: '🌏 JOOX', jamendo: '🎸 Jamendo', apple: '🍎 Apple Music' };

    const doImport = async () => {
      const url = input.value.trim();
      if (!url) return;
      btn.disabled = true; btn.textContent = '解析中...';
      msg.textContent = '正在获取歌单信息...'; msg.style.color = '';
      try {
        const result = await ApiBridge.importPlaylistByUrl(url);
        if (result.ok) {
          const pl = result.playlist;
          msg.innerHTML = '✅ 已导入: <b>' + escHtml(pl.name) + '</b> (' + (names[pl.platform] || pl.platform) + ')';
          msg.style.color = '#4ade80';
          input.value = '';
          renderImportList();
        } else {
          msg.textContent = '❌ ' + (result.error || '导入失败');
          msg.style.color = '#f87171';
        }
      } catch (e) {
        msg.textContent = '❌ ' + e.message;
        msg.style.color = '#f87171';
      } finally {
        btn.disabled = false; btn.textContent = '解析导入';
      }
    };
    btn.addEventListener('click', doImport);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doImport(); });

    // Paste handler — works natively with Cmd+V / right-click Paste
    input.addEventListener('paste', (e) => {
      // Let the default paste behavior work (fills input.value)
      // Then trigger import after a short delay
      setTimeout(() => {
        const pasted = input.value.trim();
        if (pasted) {
          msg.textContent = '📋 已粘贴链接，点击「解析导入」或按 Enter';
          msg.style.color = '';
        }
      }, 50);
    });

    // Right-click context menu — simple native-like paste option
    input.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Remove any existing custom menu
      const existing = document.getElementById('ctx-paste-menu');
      if (existing) existing.remove();
      const menu = document.createElement('div');
      menu.id = 'ctx-paste-menu';
      menu.style.cssText = 'position:fixed;z-index:99999;background:#1e1e2e;border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:4px 0;min-width:100px;box-shadow:0 4px 12px rgba(0,0,0,0.5);';
      menu.style.left = e.clientX + 'px';
      menu.style.top = e.clientY + 'px';
      menu.innerHTML = '<div id="ctx-paste-btn" style="padding:6px 12px;color:#fff;cursor:pointer;font-size:12px;">📋 粘贴</div>';
      document.body.appendChild(menu);
      const close = () => {
        if (menu.parentNode) menu.remove();
        document.removeEventListener('click', close, true);
      };
      // Use setTimeout to let this click finish before adding listener
      setTimeout(() => document.addEventListener('click', close, true), 0);
      const pasteBtn = document.getElementById('ctx-paste-btn');
      if (pasteBtn) {
        pasteBtn.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          try {
            const text = await navigator.clipboard.readText();
            if (text) {
              input.value = text;
              input.focus();
              msg.textContent = '📋 已粘贴链接，点击「解析导入」或按 Enter';
              msg.style.color = '';
            }
          } catch(ex) {
            // Clipboard API might not be available; just focus the input
            input.focus();
          }
          close();
        });
      }
    });

    renderImportList();
  }
  function renderImportList() {
    const list = document.getElementById('import-list');
    if (!list) return;
    const imported = typeof ApiBridge !== 'undefined' && ApiBridge.getImportedPlaylists ? ApiBridge.getImportedPlaylists() : {};
    const entries = Object.values(imported);
    const names = { netease: '🎧 网易云', qq: '🎵 QQ', qishui: '🎼 汽水', kugou: '🎤 酷狗', kuwo: '🎶 酷我', migu: '📻 咪咕', bilibili: '📺 B站', fivesing: '🎙 5Sing', qianqian: '🎶 千千', joox: '🌏 JOOX', jamendo: '🎸 Jamendo', apple: '🍎 Apple Music' };

    if (entries.length === 0) {
      list.innerHTML = '<div style="color:var(--text-dim);font-size:12px;text-align:center;padding:20px;">暂无导入歌单，在上方粘贴链接</div>';
      return;
    }

    let syncedIds = {};
    try { syncedIds = JSON.parse(localStorage.getItem('fluidmusic_synced_playlists') || '{}'); } catch(e) {}

    list.innerHTML = entries.map(pl => {
      const isSynced = !!(syncedIds[pl.platform] && syncedIds[pl.platform][pl.id]);
      let coverHtml = '<span style="display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);font-size:16px;width:36px;height:36px;border-radius:6px;flex-shrink:0;">📋</span>';
      if (pl.coverUrl) {
        coverHtml = '<img src="' + escHtml(pl.coverUrl) + '" alt="" style="width:36px;height:36px;border-radius:6px;object-fit:cover;flex-shrink:0;">';
      }
      return '<div class="user-playlist-item" style="display:flex;align-items:center;gap:8px;padding:6px 0;">'
        + coverHtml
        + '<div style="flex:1;min-width:0;">'
        + '<div style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escHtml(pl.name) + '</div>'
        + '<div style="font-size:10px;color:var(--text-dim);">' + (names[pl.platform] || pl.platform) + ' · ' + (pl.trackCount || '?') + '首</div>'
        + '</div>'
        + (isSynced
          ? '<button class="import-pl-rm-btn" data-pid="' + pl.id + '" data-platform="' + pl.platform + '" style="padding:4px 8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:5px;color:var(--text-dim);cursor:pointer;font-size:11px;white-space:nowrap;">移除</button>'
          : '<button class="import-pl-add-btn" data-pid="' + pl.id + '" data-platform="' + pl.platform + '" data-name="' + escHtml(pl.name) + '" style="padding:4px 8px;background:var(--color-accent);border:none;border-radius:5px;color:#fff;cursor:pointer;font-size:11px;white-space:nowrap;">添加到应用</button>')
        + '<button class="import-pl-del-btn" data-pid="' + pl.id + '" data-platform="' + pl.platform + '" style="padding:4px 6px;background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:12px;opacity:0.5;flex-shrink:0;" title="删除">✕</button>'
        + '</div>';
    }).join('');

    // Wire buttons (delegated via class selectors)
    list.querySelectorAll('.import-pl-add-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.dataset.pid, pplatform = btn.dataset.platform;
        try { syncedIds = JSON.parse(localStorage.getItem('fluidmusic_synced_playlists') || '{}'); } catch(e) { syncedIds = {}; }
        if (!syncedIds[pplatform]) syncedIds[pplatform] = {};
        syncedIds[pplatform][pid] = true;
        localStorage.setItem('fluidmusic_synced_playlists', JSON.stringify(syncedIds));
        renderImportList();
        if (typeof showToast !== 'undefined') showToast('✅ 已添加到应用歌单');
        window.dispatchEvent(new CustomEvent('playlists-updated', { detail: { platform: pplatform } }));
      });
    });
    list.querySelectorAll('.import-pl-rm-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.dataset.pid, pplatform = btn.dataset.platform;
        try { syncedIds = JSON.parse(localStorage.getItem('fluidmusic_synced_playlists') || '{}'); } catch(e) { syncedIds = {}; }
        if (syncedIds[pplatform]) delete syncedIds[pplatform][pid];
        localStorage.setItem('fluidmusic_synced_playlists', JSON.stringify(syncedIds));
        renderImportList();
        if (typeof showToast !== 'undefined') showToast('已从应用歌单移除');
        window.dispatchEvent(new CustomEvent('playlists-updated', { detail: { platform: pplatform } }));
      });
    });
    list.querySelectorAll('.import-pl-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.dataset.pid, pplatform = btn.dataset.platform;
        if (typeof ApiBridge !== 'undefined' && ApiBridge.removeImportedPlaylist) {
          ApiBridge.removeImportedPlaylist(pplatform, pid);
        }
        try { syncedIds = JSON.parse(localStorage.getItem('fluidmusic_synced_playlists') || '{}'); } catch(e) { syncedIds = {}; }
        if (syncedIds[pplatform]) delete syncedIds[pplatform][pid];
        localStorage.setItem('fluidmusic_synced_playlists', JSON.stringify(syncedIds));
        renderImportList();
        if (typeof showToast !== 'undefined') showToast('已删除导入歌单');
        window.dispatchEvent(new CustomEvent('playlists-updated', { detail: { platform: pplatform } }));
      });
    });
  }

  // Reset import tab state when switching away
  const _origSwitchTab = switchTab;
  switchTab = function(platform) {
    if (platform !== 'import') _importTabRendered = false;
    _origSwitchTab(platform);
  };

  // ── Fetch playlists ──  // ── Fetch playlists ──
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
        let coverHtml = '<span class="playlist-item-cover" style="display:flex;align-items:center;justify-content:center;background:rgba(238,102,68,0.12);border:1px solid rgba(238,102,68,0.2);font-size:18px;width:36px;height:36px;border-radius:6px;flex-shrink:0;">❤️</span>';
        if (pl.coverUrl) {
          coverHtml = '<img class="playlist-item-cover" src="' + escHtml(pl.coverUrl) + '" alt="" style="width:36px;height:36px;border-radius:6px;object-fit:cover;flex-shrink:0;">';
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
        cb.addEventListener('change', async () => {
          const pid = cb.dataset.pid;
          const pplatform = cb.dataset.platform;
          if (!syncedIds[pplatform]) syncedIds[pplatform] = {};
          const statusEl = cb.closest('.user-playlist-item').querySelector('span:last-child');

          if (cb.checked) {
            // 1. Mark as synced
            syncedIds[pplatform][pid] = true;
            localStorage.setItem('fluidmusic_synced_playlists', JSON.stringify(syncedIds));
            if (statusEl) { statusEl.textContent = '加载中…'; statusEl.style.color = 'var(--text-dim)'; }
            // 2. Fetch and cache songs for this playlist
            const plName = cb.closest('.user-playlist-item').querySelector('.user-pl-name')?.textContent || '';
            const pl = { id: pid, platform: pplatform, name: plName, coverUrl: '' };
            if (typeof BubbleChamber !== 'undefined' && BubbleChamber.fetchAndCachePlaylistSongs) {
              await BubbleChamber.fetchAndCachePlaylistSongs(pl);
              console.log('[UserPanel] Cached songs for playlist: ' + plName);
            }
            if (statusEl) { statusEl.textContent = '显示'; statusEl.style.color = ''; }
            if (typeof showToast !== 'undefined') showToast('✅ 已缓存: ' + plName.substring(0, 20));
          } else {
            // 1. Remove from synced
            delete syncedIds[pplatform][pid];
            localStorage.setItem('fluidmusic_synced_playlists', JSON.stringify(syncedIds));
            // 2. Clear this playlist's song cache
            if (typeof DataCache !== 'undefined') {
              DataCache.remove('plsongs_' + pplatform + '_' + pid);
              console.log('[UserPanel] Cleared cache for playlist ' + pid);
            }
            if (statusEl) { statusEl.textContent = '隐藏'; statusEl.style.color = ''; }
            if (typeof showToast !== 'undefined') showToast('🗑 已清除缓存');
          }

          // Refresh sidebar from cache only (no API call)
          if (typeof BubbleChamber !== 'undefined' && BubbleChamber.refreshPlaylistListFromCache) {
            BubbleChamber.refreshPlaylistListFromCache();
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

  if (typeof __FM !== 'undefined') __FM.register('userPanel', [], function () { return UserPanel; }, { priority: 5 });
  window.UserPanel = UserPanel;
  console.log('FluidMusic User Panel loaded');
})();
