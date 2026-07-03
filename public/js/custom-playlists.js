// ============================================================
// FluidMusic — Custom Playlist Manager
// Create/edit/delete local playlists, add/remove songs
// Persisted to localStorage key 'fluidmusic-custom-playlists'
// ============================================================
(function () {
  'use strict';

  const STORAGE_KEY = 'fluidmusic-custom-playlists';

  const CustomPlaylists = {
    playlists: [],  // [{ id, name, tracks: [], createdAt }]
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      CustomPlaylists.playlists = raw ? JSON.parse(raw) : [];
      // Ensure all have tracks array
      CustomPlaylists.playlists.forEach(p => { if (!p.tracks) p.tracks = []; });
    } catch (e) {
      CustomPlaylists.playlists = [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(CustomPlaylists.playlists));
    } catch (e) {
      if (typeof showToast !== 'undefined') showToast('⚠ 存储空间不足');
    }
  }

  function create(name) {
    if (!name || !name.trim()) {
      if (typeof showToast !== 'undefined') showToast('⚠ 请输入歌单名称');
      return null;
    }
    const pl = {
      id: 'custom_' + Date.now(),
      name: name.trim(),
      tracks: [],
      createdAt: Date.now(),
    };
    CustomPlaylists.playlists.push(pl);
    save();
    if (typeof showToast !== 'undefined') showToast('✅ 歌单「' + pl.name + '」已创建');
    return pl;
  }

  function remove(playlistId) {
    const idx = CustomPlaylists.playlists.findIndex(p => p.id === playlistId);
    if (idx < 0) return false;
    const name = CustomPlaylists.playlists[idx].name;
    CustomPlaylists.playlists.splice(idx, 1);
    save();
    if (typeof showToast !== 'undefined') showToast('🗑 歌单「' + name + '」已删除');
    return true;
  }

  function rename(playlistId, newName) {
    const pl = CustomPlaylists.playlists.find(p => p.id === playlistId);
    if (!pl || !newName || !newName.trim()) return false;
    pl.name = newName.trim();
    save();
    return true;
  }

  function addTrack(playlistId, track) {
    const pl = CustomPlaylists.playlists.find(p => p.id === playlistId);
    if (!pl) return false;
    // Deduplicate
    const exists = pl.tracks.some(t => t.id === track.id && t.platform === track.platform);
    if (exists) {
      if (typeof showToast !== 'undefined') showToast('📋 已在歌单中');
      return false;
    }
    pl.tracks.push({
      id: track.id,
      title: track.title || track.name || '未知',
      artist: track.artist || '',
      coverUrl: track.coverUrl || '',
      platform: track.platform || 'local',
      url: '',
      addedAt: Date.now(),
    });
    save();
    if (typeof showToast !== 'undefined') showToast('+ 已添加到「' + pl.name + '」');
    return true;
  }

  function removeTrack(playlistId, trackId, platform) {
    const pl = CustomPlaylists.playlists.find(p => p.id === playlistId);
    if (!pl) return false;
    const before = pl.tracks.length;
    pl.tracks = pl.tracks.filter(t => !(t.id === trackId && t.platform === platform));
    if (pl.tracks.length < before) {
      save();
      return true;
    }
    return false;
  }

  function getPlaylist(playlistId) {
    return CustomPlaylists.playlists.find(p => p.id === playlistId) || null;
  }

  function getAll() {
    return CustomPlaylists.playlists;
  }

  // eslint-disable-next-line no-unused-vars
  function getTrackCount(playlistId) {
    const pl = getPlaylist(playlistId);
    return pl ? pl.tracks.length : 0;
  }

  // ── Render custom playlists in left chamber ──
  function renderInSidebar(container) {
    if (!container) return;
    if (CustomPlaylists.playlists.length === 0) return;

    // Divider
    const divider = document.createElement('div');
    divider.className = 'playlist-platform-divider';
    divider.textContent = '📝 我的歌单';
    container.appendChild(divider);

    CustomPlaylists.playlists.forEach(pl => {
      const div = document.createElement('div');
      div.className = 'playlist-item playlist-item-rich';
      div.innerHTML = `
        <span class="playlist-item-cover playlist-cover-heart" style="font-size:20px;">📝</span>
        <div class="playlist-item-info">
          <span class="playlist-item-name">${escapeHtml(pl.name)}</span>
          <span class="playlist-item-count">${pl.tracks.length} 首 · 本地</span>
        </div>
        <button class="custom-pl-delete" data-id="${pl.id}" title="删除歌单" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:12px;margin-left:auto;padding:4px 8px;opacity:0;transition:opacity 0.2s;">✕</button>
      `;

      div.addEventListener('click', (e) => {
        if (e.target.closest('.custom-pl-delete')) return;
        loadCustomPlaylistTracks(pl);
      });

      // Delete button hover
      div.addEventListener('mouseenter', () => {
        const btn = div.querySelector('.custom-pl-delete');
        if (btn) btn.style.opacity = '1';
      });
      div.addEventListener('mouseleave', () => {
        const btn = div.querySelector('.custom-pl-delete');
        if (btn) btn.style.opacity = '0';
      });

      // Delete handler
      div.querySelector('.custom-pl-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        remove(pl.id);
        refreshSidebar();
      });

      container.appendChild(div);
    });
  }

  function loadCustomPlaylistTracks(pl) {
    const container = document.getElementById('playlist-items');
    if (!container) return;

    const backBtn = document.getElementById('btn-playlist-back');
    if (backBtn) backBtn.style.display = 'flex';

    if (pl.tracks.length === 0) {
      container.innerHTML = '<div class="playlist-item" style="text-align:center;padding:20px;color:var(--text-dim);">空歌单</div>';
      return;
    }

    // Render tracks similar to normal playlist tracks
    container.innerHTML = '';
    const playAll = document.createElement('div');
    playAll.className = 'playlist-item playlist-playall';
    playAll.textContent = '▶ 播放全部 (' + pl.tracks.length + ')';
    playAll.addEventListener('click', () => {
      if (typeof FluidAudio !== 'undefined') {
        FluidAudio.setPlaylist(pl.tracks, 0);
        // Play first track (fetch URL lazily)
        playFirstTrack(pl.tracks);
      }
    });
    container.appendChild(playAll);

    pl.tracks.forEach((track, i) => {
      const row = document.createElement('div');
      row.className = 'playlist-item playlist-item-row';
      const info = escapeHtml(track.title) + (track.artist ? ' — ' + escapeHtml(track.artist) : '');
      row.innerHTML = `
        <span class="pli-actions">
          <button class="pli-btn pli-play" data-idx="${i}" title="播放">▶</button>
          <button class="pli-btn pli-remove" data-idx="${i}" title="移除">✕</button>
        </span>
        <span class="pli-name">${info}</span>
      `;
      row.querySelector('.pli-play').addEventListener('click', async (e) => {
        e.stopPropagation();
        const t = pl.tracks[i];
        if ((!t.url || t.platform === 'qq') && t.id && typeof window._fetchTrackUrl === 'function') {
          t.url = await window._fetchTrackUrl(t);
        }
        if (t.url && typeof FluidAudio !== 'undefined') {
          FluidAudio.setPlaylist(pl.tracks, i);
          FluidAudio.load(t.url, t);
          FluidAudio.play();
        }
      });
      row.querySelector('.pli-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        removeTrack(pl.id, track.id, track.platform);
        loadCustomPlaylistTracks(pl);
      });
      container.appendChild(row);
    });
  }

  async function playFirstTrack(tracks) {
    const t = tracks[0];
    if ((!t.url || t.platform === 'qq') && t.id && typeof window._fetchTrackUrl === 'function') {
      try { t.url = await window._fetchTrackUrl(t); } catch (_) {}
    }
    if (t.url && typeof FluidAudio !== 'undefined') {
      FluidAudio.load(t.url, t);
      FluidAudio.play();
    }
  }

  function refreshSidebar() {
    if (typeof FluidMusicApp !== 'undefined' && FluidMusicApp.syncPlaylists) {
      FluidMusicApp.syncPlaylists();
    }
  }

  // ── Create playlist dialog ──
  function showCreateDialog() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);';
    overlay.innerHTML = `
      <div style="background:rgba(10,10,24,0.95);border:1px solid var(--glass-border);border-radius:14px;padding:20px;width:320px;backdrop-filter:blur(20px);">
        <div style="font-size:14px;color:var(--text-primary);margin-bottom:12px;">创建新歌单</div>
        <input id="new-pl-name" type="text" placeholder="歌单名称..." autofocus
          style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid var(--glass-border);background:rgba(255,255,255,0.05);color:var(--text-primary);font-size:13px;outline:none;margin-bottom:12px;">
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="new-pl-cancel" style="padding:6px 16px;border-radius:8px;border:1px solid var(--glass-border);background:transparent;color:var(--text-dim);cursor:pointer;">取消</button>
          <button id="new-pl-confirm" style="padding:6px 16px;border-radius:8px;border:none;background:var(--accent-color);color:#fff;cursor:pointer;">创建</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#new-pl-name');
    overlay.querySelector('#new-pl-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#new-pl-confirm').addEventListener('click', () => {
      const pl = create(input.value);
      if (pl) {
        overlay.remove();
        refreshSidebar();
      }
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const pl = create(input.value);
        if (pl) { overlay.remove(); refreshSidebar(); }
      }
    });
    setTimeout(() => input.focus(), 100);
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Init ──
  function init() {
    load();
    console.log('[CustomPlaylists] Loaded', CustomPlaylists.playlists.length, 'custom playlists');
  }

  CustomPlaylists.init = init;
  CustomPlaylists.create = create;
  CustomPlaylists.remove = remove;
  CustomPlaylists.rename = rename;
  CustomPlaylists.addTrack = addTrack;
  CustomPlaylists.removeTrack = removeTrack;
  CustomPlaylists.getAll = getAll;
  CustomPlaylists.getPlaylist = getPlaylist;
  CustomPlaylists.renderInSidebar = renderInSidebar;
  CustomPlaylists.loadCustomPlaylistTracks = loadCustomPlaylistTracks;
  CustomPlaylists.showCreateDialog = showCreateDialog;

  window.CustomPlaylists = CustomPlaylists;
  if (typeof __FM !== 'undefined') __FM.register('customPlaylists', [], function () { return CustomPlaylists; }, { priority: 7 });
  console.log('FluidMusic Custom Playlists loaded');
})();
