// ============================================================
// FluidMusic — Playlist Chamber: track lists, platform playlists, play-all
// ============================================================
(function () {
  'use strict';
  const PlaylistChamber = {
    playlistItems: [],
    currentView: 'playlists', // 'playlists' | 'tracks' | 'favorites' | 'queue'

    // ── Playlist loading / empty states ──
    showPlaylistLoading() {
      const container = document.getElementById('playlist-items');
      if (!container) return;
      container.innerHTML = `<div class="playlist-loading">
        <div class="playlist-loading-spinner"></div>
        ${typeof I18N !== 'undefined' ? I18N.t('playlist.loading') : '加载中...'}
      </div>`;
    },

    showPlaylistEmpty() {
      const container = document.getElementById('playlist-items');
      if (!container) return;
      container.innerHTML = `<div class="playlist-item">${typeof I18N !== 'undefined' ? I18N.t('playlist.empty') : '暂无歌单'}</div>`;
    },

    refreshPlaylistLabels() {
      if (PlaylistChamber.currentView === 'playlists' && typeof FluidMusicApp !== 'undefined') {
        FluidMusicApp.syncPlaylists();
      }
    },

    // Force-refresh the playlist list — called after login sync
    async refreshPlaylistList() {
      console.log('[BubbleChamber] refreshPlaylistList() called');
      if (typeof ApiBridge === 'undefined') {
        console.warn('[BubbleChamber] ApiBridge not available for playlist refresh');
        return;
      }

      PlaylistChamber.showPlaylistLoading();

      try {
        const playlists = await ApiBridge.fetchUserPlaylists();
        console.log('[BubbleChamber] refreshPlaylistList — fetched:',
          'netease=' + (playlists.netease || []).length,
          'qq=' + (playlists.qq || []).length,
  '');

        PlaylistChamber.setUserPlaylists(playlists);
      } catch (e) {
        console.error('[BubbleChamber] refreshPlaylistList failed:', e);
        PlaylistChamber.showPlaylistEmpty();
      }
    },

    // Refresh sidebar from cache only (no API call) — used after user toggles synced playlists
    refreshPlaylistListFromCache() {
      if (typeof DataCache === 'undefined') return;
      const playlists = DataCache.getCachedPlaylists();
      if (!playlists) {
        console.log('[BubbleChamber] refreshFromCache: no cached playlists, falling back to API');
        PlaylistChamber.refreshPlaylistList();
        return;
      }
      console.log('[BubbleChamber] refreshFromCache: updating sidebar from local cache');
      PlaylistChamber.setUserPlaylists(playlists);
    },

    // Fetch and cache songs for a single playlist (used when user enables sync)
    async fetchAndCachePlaylistSongs(pl) {
      if (typeof ApiBridge === 'undefined' || typeof DataCache === 'undefined') return;
      try {
        let tracks = [];
        if (pl.platform === 'netease') {
          const data = await ApiBridge.getNeteasePlaylist(pl.id);
          const plData = (data && (data.playlist || data.result));
          if (plData && plData.tracks) {
            tracks = plData.tracks
              .filter(t => { if (!t.id || !t.name) return false; if (t.status === -1 || t.noCopyrightRcmd) return false; if (t.fee > 0 && t.privilege && t.privilege.st < 0) return false; return true; })
              .map(t => ({ title: t.name, artist: (t.ar || []).map(a => a.name).join('/'), url: '', coverUrl: ((t.al && t.al.picUrl) || pl.coverUrl || '').replace(/^http:/, 'https:'), id: t.id, platform: pl.platform }));
          }
        } else if (pl.platform === 'qq') {
          const data = await ApiBridge.getQQPlaylist(pl.id);
          if (data && data.cdlist && data.cdlist[0] && data.cdlist[0].songlist) {
            tracks = data.cdlist[0].songlist
              .filter(t => { if (!t.songmid && !t.id) return false; if (!t.name && !t.songname) return false; if (t.pay && (t.pay.pay_play === 1 || t.pay.pay_down === 1)) return false; if (t.action && t.action.switch) return false; return true; })
              .map(t => ({ title: t.name || t.songname || '未知', artist: (t.singer || []).map(s => s.name).join('/') || '未知', url: '', coverUrl: ((t.albumurl || t.albummid ? 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + t.albummid + '.jpg' : '') || pl.coverUrl || '').replace(/^http:/, 'https:'), id: t.songmid || t.id, platform: pl.platform }));
          }
        }
        if (tracks.length > 0) {
          DataCache.cachePlaylistSongs(pl.id, pl.platform, tracks);
          console.log('[fetchAndCachePlaylistSongs] Cached ' + tracks.length + ' songs for ' + pl.platform + ' ' + pl.name);
        }
      } catch (e) {
        console.warn('[fetchAndCachePlaylistSongs] Failed for ' + pl.platform + ' ' + pl.name, e);
      }
    },

    // ── Get synced playlist IDs from user settings ──
    getSyncedPlaylistIds() {
      try {
        return JSON.parse(localStorage.getItem('fluidmusic_synced_playlists') || '{}');
      } catch(e) { return {}; }
    },

    // Filter playlists to only show synced ones
    filterSyncedPlaylists(playlists) {
      const synced = PlaylistChamber.getSyncedPlaylistIds();
      const filtered = { netease: [], qq: [] };

      (playlists.netease || []).forEach(pl => {
        if (synced.netease && synced.netease[pl.id]) filtered.netease.push(pl);
      });
      (playlists.qq || []).forEach(pl => {
        if (synced.qq && synced.qq[pl.id]) filtered.qq.push(pl);
      });

      return filtered;
    },

    setUserPlaylists(playlists) {
      const container = document.getElementById('playlist-items');
      if (!container) return;

      const backBtnHide = document.getElementById('btn-playlist-back');
      if (backBtnHide) backBtnHide.style.display = 'none';
      PlaylistChamber.currentView = 'playlists';

      // Filter to only synced playlists
      playlists = PlaylistChamber.filterSyncedPlaylists(playlists);

      const allPlaylists = [
        ...(playlists.netease || []),
        ...(playlists.qq || []),
      ];

      if (allPlaylists.length === 0 && (!window.CustomPlaylists || window.CustomPlaylists.getAll().length === 0)) {
        PlaylistChamber.showPlaylistEmpty();
      } else if (allPlaylists.length > 0 || (window.CustomPlaylists && window.CustomPlaylists.getAll().length > 0)) {
        // Will render below
      } else {
        PlaylistChamber.showPlaylistEmpty();
      }

      container.innerHTML = '';

      // ── Custom Playlists Section (local) ──
      if (typeof CustomPlaylists !== 'undefined') {
        CustomPlaylists.renderInSidebar(container);
      }

      const names = { netease: '🎧 网易云音乐', qq: '🎵 QQ音乐' };
      const platforms = ['netease', 'qq'];
      let firstPlatform = true;

      platforms.forEach((pf) => {
        const pfPlaylists = playlists[pf] || [];
        if (pfPlaylists.length === 0) return;

        // Platform divider
        if (!firstPlatform) {
          const divider = document.createElement('div');
          divider.className = 'playlist-platform-divider';
          divider.textContent = names[pf];
          container.appendChild(divider);
        } else {
          firstPlatform = false;
        }

        pfPlaylists.forEach((pl) => {
          const div = document.createElement('div');
          div.className = 'playlist-item playlist-item-rich';

          const platformClass = pl.platform === 'qq' ? 'qq' : 'net';
          const dot = `<span class="platform-dot ${platformClass}"></span>`;

        const hasCover = pl.coverUrl && String(pl.coverUrl).trim();
        let coverHtml = hasCover
          ? `<img class="playlist-item-cover" src="${ChamberBase.escapeHtml(pl.coverUrl)}" alt="" onerror="this.style.display='none'">`
          : `<span class="playlist-item-cover playlist-cover-heart">❤️</span>`;

        const desc = (pl.description || pl.desc || pl.bio || '...').substring(0, 60);
        const platformLabel = pl.platform === 'qq' ? 'QQ' : '网易';
        div.innerHTML = `
          ${coverHtml}
          <div class="playlist-item-info">
            <span class="playlist-item-name">${ChamberBase.escapeHtml(pl.name)}</span>
            <span class="playlist-item-count">${dot} ${ChamberBase.escapeHtml(platformLabel)} · ${ChamberBase.escapeHtml(desc)}</span>
          </div>
        `;

        div.addEventListener('click', () => {
          PlaylistChamber.loadPlaylistSongs(pl);
        });

          container.appendChild(div);
        });
      });

      // Apply chamber pinned state from settings
      var settings = null;
      try { var raw = localStorage.getItem('fluidmusic-settings'); if (raw) settings = JSON.parse(raw); } catch(_) {}
      var pins = { top: true, bottom: true, left: false, right: false };
      if (settings) {
        if (typeof settings.chamberTopPinned === 'boolean') pins.top = settings.chamberTopPinned;
        if (typeof settings.chamberBottomPinned === 'boolean') pins.bottom = settings.chamberBottomPinned;
        if (typeof settings.chamberLeftPinned === 'boolean') pins.left = settings.chamberLeftPinned;
        if (typeof settings.chamberRightPinned === 'boolean') pins.right = settings.chamberRightPinned;
      }
      ChamberBase.pinned = pins;
      Object.keys(pins).forEach(function(side) {
        if (pins[side]) {
          var el = document.getElementById('chamber-' + side);
          if (el) el.classList.add('visible', 'pinned');
        }
      });
    },

    async loadPlaylistSongs(pl) {
      const container = document.getElementById('playlist-items');
      if (!container) return;

      PlaylistChamber.currentView = 'tracks';

      try {
        // Check cache first — show immediately if available
        let tracks = [];
        let cachedTracks = null;
        if (typeof DataCache !== 'undefined') {
          cachedTracks = DataCache.getCachedPlaylistSongs(pl.id, pl.platform);
          if (cachedTracks && cachedTracks.length > 0) {
            console.log('[Playlist] CACHE HIT for', pl.platform, pl.id, '-', cachedTracks.length, 'tracks (instant)');
            tracks = cachedTracks;
            // Show cached immediately — no loading spinner needed
            if (typeof showToast !== 'undefined') showToast('📦 缓存加载 ' + cachedTracks.length + ' 首');
            PlaylistChamber.renderTrackList(tracks, 0, pl);
            const backBtn = document.getElementById('btn-playlist-back');
            if (backBtn) backBtn.style.display = 'flex';
            if (typeof FluidAudio !== 'undefined') {
              FluidAudio.setPlaylist(tracks, 0);
            }
            if (typeof QueueChamber !== 'undefined') {
              QueueChamber.updateQueueDisplay(tracks[0], tracks, 0);
            }
            return;
          }
        }
        // No cache — fetch from API
        console.log('[Playlist] CACHE MISS for', pl.platform, pl.id, '- fetching from API...');
        if (typeof showToast !== 'undefined') showToast('🌐 正在获取歌单...');
        PlaylistChamber.showPlaylistLoading();
        await PlaylistChamber.fetchTracksFromApi(pl);
        return;
      } catch (e) {
        console.error('Failed to load playlist songs:', e);
        const failText = typeof I18N !== 'undefined' ? I18N.t('playlist.loadFail') : '加载失败';
        const backBtn2 = document.getElementById('btn-playlist-back');
        if (backBtn2) backBtn2.style.display = 'flex';
        container.innerHTML = `<div class="playlist-item">${failText}</div>`;
      }
    },

    // ── Core API fetcher ──
    async fetchTracksFromApi(pl, opts) {
      opts = opts || {};
      const container = document.getElementById('playlist-items');
      if (!container) return;

      // Show loading only if no cached content showing
      if (!container.querySelector('.playlist-item')) {
        container.innerHTML = `<div class="playlist-loading">
          <div class="playlist-loading-spinner"></div>
          ${typeof I18N !== 'undefined' ? I18N.t('playlist.loadingSongs') : '首次获取歌单信息，请耐心等待...'}
        </div>`;
      }

      try {
        let tracks = [];
        if (pl.platform === 'netease' && typeof ApiBridge !== 'undefined') {
          const data = await ApiBridge.getNeteasePlaylist(pl.id);
          const plData = (data && (data.playlist || data.result));
          if (plData && plData.tracks) {
            tracks = plData.tracks
              .filter((t) => {
                // Strict copyright filter — exclude all unplayable tracks
                if (!t.id || !t.name) return false;
                // Status: -1 (deleted), anything non-zero is suspicious
                if (t.status === -1 || t.noCopyrightRcmd) return false;
                // Fee check: any paid track that user has no privilege for
                if (t.fee > 0 && (!t.privilege || t.privilege.st == null || t.privilege.st < 0)) return false;
                // Privilege-based: st=-200 means copyright blocked
                if (t.privilege && t.privilege.st === -200) return false;
                return true;
              })
              .map((t) => ({
                title: t.name,
                artist: (t.ar || []).map((a) => a.name).join('/'),
                url: '',
                coverUrl: ((t.al && t.al.picUrl) || pl.coverUrl || '').replace(/^http:/, 'https:'),
                id: t.id,
                platform: pl.platform,
              }));
          }
        } else if (pl.platform === 'qq' && typeof ApiBridge !== 'undefined') {
          const data = await ApiBridge.getQQPlaylist(pl.id);
          console.log('[QQ PlaylistDetail] raw response keys:', data ? Object.keys(data) : 'null',
            '| cdlist:', data && data.cdlist ? data.cdlist.length : 0,
            '| firstSong:', data && data.cdlist && data.cdlist[0] && data.cdlist[0].songlist ? data.cdlist[0].songlist[0] : 'NONE');
          if (data && data.cdlist && data.cdlist[0] && data.cdlist[0].songlist) {
            tracks = data.cdlist[0].songlist
              .filter((t) => {
                // Strict copyright filter — exclude all unplayable QQ tracks
                if (!t.songmid && !t.id) return false;
                if (!t.name && !t.songname) return false;
                // Pay checks: pay_play (streaming), pay_down (download), pay_status (overall)
                if (t.pay && (t.pay.pay_play === 1 || t.pay.pay_down === 1 || t.pay.pay_status === 1)) return false;
                // Action checks: switch (replaced), msg (copyright notice)
                if (t.action && (t.action.switch || (t.action.msg && /版权|copyright/i.test(t.action.msg)))) return false;
                // Status checks: negative = unavailable
                if (t.status != null && t.status < 0) return false;
                return true;
              })
              .map((t) => ({
              title: t.name || t.songname || '未知',
              artist: (t.singer || []).map((s) => s.name).join('/') || '未知',
              url: '',
              coverUrl: ((t.albumurl || t.albummid ? 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + t.albummid + '.jpg' : '') || pl.coverUrl || '').replace(/^http:/, 'https:'),
              id: t.songmid || t.id,
              platform: pl.platform,
            }));
          }
        }




        if (tracks.length === 0) {
          const emptyText = typeof I18N !== 'undefined' ? I18N.t('playlist.emptyPlaylist') : '歌单为空';
          // Show fixed back button in header
          const backBtn = document.getElementById('btn-playlist-back');
          if (backBtn) backBtn.style.display = 'flex';
          container.innerHTML = `<div class="playlist-item">${emptyText}</div>`;
          return;
        }

        // Cache verified playlist data (using consistent key format)
        if (typeof DataCache !== 'undefined' && pl.id) {
          DataCache.cachePlaylistSongs(pl.id, pl.platform,
            tracks.map(t => ({ title: t.title, artist: t.artist, coverUrl: t.coverUrl, id: t.id, platform: t.platform, url: t.url }))
          );

        if (opts.silent) { console.log('[Playlist] Silent cache update — ' + pl.platform + ' ' + pl.id + ' (' + tracks.length + ' tracks)'); return; }
        }

        if (typeof FluidAudio !== 'undefined') {
          FluidAudio.setPlaylist(tracks, 0);
        }

        // Show back button when viewing tracks
        const backBtn3 = document.getElementById('btn-playlist-back');
        if (backBtn3) backBtn3.style.display = 'flex';

        PlaylistChamber.renderTrackList(tracks, 0, pl);

        if (typeof FluidAudio !== 'undefined' && FluidAudio.playlist) {
          if (typeof QueueChamber !== 'undefined') {
            QueueChamber.updateQueueDisplay(tracks[0], tracks, 0);
          }
        }
      } catch (e) {
        console.error('Failed to load playlist songs:', e);
        const failText = typeof I18N !== 'undefined' ? I18N.t('playlist.loadFail') : '加载失败';
        const backBtn2 = document.getElementById('btn-playlist-back');
        if (backBtn2) backBtn2.style.display = 'flex';
        if (container) container.innerHTML = `<div class="playlist-item">${failText}</div>`;
      }
    },

    // ── Lazy track URL fetcher ──
    async fetchTrackUrl(track) {
      if (typeof ApiBridge === 'undefined') return '';
      const trackId = track.id || track.songmid || '';
      const platform = track.platform || '';

      // 1. Check cached URL first
      if (typeof DataCache !== 'undefined') {
        const cached = DataCache.getCachedTrackUrl(trackId, platform);
        if (cached) { console.log('[URL Cache] HIT', platform, track.title || trackId); return cached; }
        console.log('[URL Cache] MISS', platform, track.title || trackId);
      }

      try {
        let url = '';
        let apiResponse = null;
        if (track.platform === 'netease') {
          apiResponse = await ApiBridge.getNeteaseSongUrl(track.id);
          url = (apiResponse && apiResponse.data && apiResponse.data[0] && apiResponse.data[0].url) || '';
        } else if (track.platform === 'qq') {
          apiResponse = await ApiBridge.getQQSongUrl(track.id);
          if (apiResponse && apiResponse.req_0 && apiResponse.req_0.data) {
            const d = apiResponse.req_0.data;
            const sip = (d.sip || [])[0] || '';
            const purl = (d.midurlinfo && d.midurlinfo[0] && d.midurlinfo[0].purl) || '';
            if (sip && purl) url = sip + purl;
          }
        }
        // 2. Cache the fetched URL
        if (url && typeof DataCache !== 'undefined') {
          DataCache.cacheTrackUrl(trackId, platform, url);
        }
        // 3. Diagnose failure when URL is empty
        if (!url && typeof showToast !== 'undefined') {
          const reason = PlaylistChamber.diagnoseUrlFailure(track, apiResponse);
          showToast('⚠ ' + reason, 3500);
        }
        return url;
      } catch (e) {
        console.warn('Failed to fetch track URL:', e);
        if (typeof showToast !== 'undefined') {
          showToast('⚠ 网络请求失败，请检查网络连接', 3000);
        }
      }
      return '';
    },

    // Diagnose why a track URL fetch failed
    diagnoseUrlFailure(track, apiResponse) {
      if (track.platform === 'netease') {
        if (!apiResponse || apiResponse.code !== 200) {
          return '网易云: 歌曲无版权或已下架';
        }
        const songData = apiResponse.data && apiResponse.data[0];
        if (songData && songData.fee > 0) return '网易云: 付费歌曲/VIP专属';
        if (songData && songData.noCopyrightRcmd) return '网易云: 版权受限（无版权）';
        return '网易云: 无可用播放源';
      }
      if (track.platform === 'qq') {
        if (!apiResponse || !apiResponse.req_0 || !apiResponse.req_0.data) {
          return 'QQ音乐: API返回异常';
        }
        const d = apiResponse.req_0.data;
        const purl = (d.midurlinfo && d.midurlinfo[0] && d.midurlinfo[0].purl) || '';
        if (!purl) return 'QQ音乐: 歌曲无版权或VIP专属';
        if (purl.includes('guid-error')) return 'QQ音乐: 登录鉴权失败，请重新登录';
        return 'QQ音乐: 无可用播放源';
      }
      return '无法获取播放地址（版权/VIP限制）';
    },

    setPlaylist(tracks, currentIndex) {
      const container = document.getElementById('playlist-items');
      if (!container) return;

      PlaylistChamber.playlistItems = tracks || [];
      container.innerHTML = '';

      if (!tracks || tracks.length === 0) {
        PlaylistChamber.showPlaylistEmpty();
        return;
      }

      tracks.forEach((track, i) => {
        const div = document.createElement('div');
        div.className = 'playlist-item' + (i === currentIndex ? ' active' : '');
        div.textContent = track.title || track.name || '未知歌曲';
        div.addEventListener('click', async () => {
          if (typeof FluidAudio !== 'undefined' && FluidAudio.playlist[i]) {
            const t = FluidAudio.playlist[i];
            if ((!t.url || t.platform === 'qq') && t.id) {
              t.url = await PlaylistChamber.fetchTrackUrl(t);
            }
            if (t.url) {
              FluidAudio.load(t.url, t);
              FluidAudio.play();
              PlaylistChamber.setActivePlaylistItem(i);
            }
          }
        });
        container.appendChild(div);
      });
    },

    renderTrackList(tracks, currentIndex, sourcePlaylist) {
      const container = document.getElementById('playlist-items');
      if (!container) return;

      container.innerHTML = '';

      // Play All button — uses cached track data, fetches URL only for first track
      if (tracks.length > 0) {
        const playAll = document.createElement('div');
        playAll.className = 'playlist-item playlist-playall';
        playAll.textContent = '▶ 播放全部 (' + tracks.length + ')';
        playAll.addEventListener('click', async () => {
          if (typeof FluidAudio !== 'undefined') {
            // Respect current play mode: shuffle list if in random mode
            var playTracks = tracks.slice();
            var startIdx = 0;
            var mode = (FluidAudio.playMode || 'sequential');
            if (mode === 'random') {
              // Fisher-Yates shuffle
              for (var i = playTracks.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var tmp = playTracks[i]; playTracks[i] = playTracks[j]; playTracks[j] = tmp;
              }
            }
            FluidAudio.setPlaylist(playTracks, startIdx);
            if (typeof QueueChamber !== 'undefined') {
              QueueChamber.updateQueueDisplay(playTracks[startIdx], playTracks, startIdx);
            }
            const t = playTracks[startIdx];
            // Fetch URL ONLY for the first track — rest on-demand
            if ((!t.url || t.platform === 'qq') && t.id) {
              try { t.url = await PlaylistChamber.fetchTrackUrl(t); } catch(e) {}
            }
            if (t.url) {
              FluidAudio.load(t.url, t);
              FluidAudio.play();
              PlaylistChamber.setActivePlaylistItem(0);
            } else if (typeof showToast !== 'undefined') {
              showToast('⚠ 无法获取播放地址');
              // Auto-skip to next
              setTimeout(function() { FluidAudio.next(); }, 1500);
            }
          }
        });
        container.appendChild(playAll);
      }

      tracks.forEach((track, i) => {
        const row = document.createElement('div');
        row.className = 'playlist-item playlist-item-row' + (i === currentIndex ? ' active' : '');

        const trackInfo = track.title || track.name || '未知';
        const artistInfo = track.artist ? ' — ' + track.artist : '';

        const thumbUrl = track.coverUrl || '';
        const thumbHtml = thumbUrl
          ? `<img class="pli-thumb" src="${ChamberBase.escapeHtml(thumbUrl)}" alt="" onerror="this.style.display='none'">`
          : `<span class="pli-thumb pli-thumb-empty">🎵</span>`;

        row.innerHTML = `
          ${thumbHtml}
          <span class="pli-name">${ChamberBase.escapeHtml(trackInfo + artistInfo)}</span>
          <span class="pli-actions">
            <button class="pli-btn pli-fav" data-action="fav" data-idx="${i}" title="收藏">♥</button>
            <button class="pli-btn pli-play" data-action="play" data-idx="${i}" title="立即播放">▶</button>
            <button class="pli-btn pli-add" data-action="add" data-idx="${i}" title="添加到队列">+</button>
          </span>
        `;

        // Wire actions
        row.querySelector('.pli-fav').addEventListener('click', (e) => {
          e.stopPropagation();
          if (typeof Favorites !== 'undefined') { const added = Favorites.toggle(track); if (typeof showToast !== 'undefined') showToast(added ? '❤️ 已收藏' : '💔 取消收藏'); }
          row.querySelector('.pli-fav').classList.toggle('active', typeof Favorites !== 'undefined' && Favorites.has(track));
        });
        row.querySelector('.pli-play').addEventListener('click', async (e) => {
          e.stopPropagation();
          const btn = e.currentTarget;
          const origText = btn.textContent;
          btn.textContent = '…';
          const t = tracks[i];
          if ((!t.url || t.platform === 'qq') && t.id) t.url = await PlaylistChamber.fetchTrackUrl(t);
          if (t.url && typeof FluidAudio !== 'undefined') {
            FluidAudio.setPlaylist(tracks, i);
            if (typeof QueueChamber !== 'undefined') {
              QueueChamber.updateQueueDisplay(t, tracks, i);
            }
            FluidAudio.load(t.url, t);
            FluidAudio.play();
            PlaylistChamber.setActivePlaylistItem(i);
            if (typeof showToast !== 'undefined') showToast('▶ ' + (t.title || t.name || ''));
          } else {
            btn.textContent = '✗';
            setTimeout(() => { btn.textContent = origText; }, 800);
            return;
          }
          btn.textContent = origText;
        });
        row.querySelector('.pli-add').addEventListener('click', (e) => {
          e.stopPropagation();
          if (typeof FluidAudio !== 'undefined') {
            const exists = FluidAudio.playlist.find(p => p.id === track.id && p.platform === track.platform);
            const btn = e.currentTarget;
            if (!exists) {
              FluidAudio.playlist.push(track);
              btn.textContent = '✓';
              if (typeof showToast !== 'undefined') showToast('+ 已添加到队列');
            } else {
              FluidAudio.playlist = FluidAudio.playlist.filter(p => !(p.id === track.id && p.platform === track.platform));
              btn.textContent = '+';
              if (typeof showToast !== 'undefined') showToast('− 从队列移除');
            }
            if (typeof QueueChamber !== 'undefined') {
              QueueChamber.updateQueueDisplay(FluidAudio.currentTrack, FluidAudio.playlist, FluidAudio.playlistIndex);
            }
            setTimeout(() => { btn.textContent = exists ? '+' : '✓'; }, 600);
          }
        });

        // Initial fav state
        if (typeof Favorites !== 'undefined' && Favorites.has(track)) {
          row.querySelector('.pli-fav').classList.add('active');
        }

        container.appendChild(row);
      });
    },

    setActivePlaylistItem(index) {
      const container = document.getElementById('playlist-items');
      if (!container) return;
      const items = container.querySelectorAll('.playlist-item');
      items.forEach((item, i) => {
        item.classList.toggle('active', i === index);
      });
    },

    // ── Favorites list rendering ──
    renderFavoritesList() {
      const container = document.getElementById('playlist-items');
      if (!container) return;
      PlaylistChamber.currentView = 'favorites';

      if (typeof Favorites === 'undefined') return;
      const tracks = Favorites.getAll();

      if (tracks.length === 0) {
        container.innerHTML = '<div class="playlist-item">收藏列表为空</div>';
        return;
      }

      container.innerHTML = '';
      tracks.forEach((track, i) => {
        const row = document.createElement('div');
        row.className = 'playlist-item playlist-item-row';
        const info = ChamberBase.escapeHtml(track.title) + (track.artist ? ' — ' + ChamberBase.escapeHtml(track.artist) : '');
        row.innerHTML = `
          <span class="pli-actions">
            <button class="pli-btn pli-play" data-idx="${i}" title="立即播放">▶</button>
            <button class="pli-btn pli-add" data-idx="${i}" title="添加到队列">+</button>
            <button class="pli-btn pli-remove" data-idx="${i}" title="从收藏移除">✕</button>
          </span>
          <span class="pli-name">${info}</span>
        `;
        row.querySelector('.pli-play').addEventListener('click', async (e) => {
          e.stopPropagation();
          const t = tracks[i];
          if ((!t.url || t.platform === 'qq') && t.id && typeof ApiBridge !== 'undefined') {
            t.url = await PlaylistChamber.fetchTrackUrl(t);
          }
          if (t.url && typeof FluidAudio !== 'undefined') {
            FluidAudio.load(t.url, t);
            FluidAudio.play();
          }
        });
        row.querySelector('.pli-add').addEventListener('click', (e) => {
          e.stopPropagation();
          if (typeof FluidAudio !== 'undefined') {
            FluidAudio.playlist.push(track);
            if (typeof QueueChamber !== 'undefined') {
              QueueChamber.updateQueueDisplay(FluidAudio.currentTrack, FluidAudio.playlist, FluidAudio.playlistIndex);
            }
          }
        });
        row.querySelector('.pli-remove').addEventListener('click', (e) => {
          e.stopPropagation();
          if (typeof Favorites !== 'undefined') {
            Favorites.remove(track);
            PlaylistChamber.renderFavoritesList();
          }
        });
        container.appendChild(row);
      });
    },

    // ── Queue list rendering ──
    renderQueueList() {
      const container = document.getElementById('playlist-items');
      if (!container) return;
      PlaylistChamber.currentView = 'queue';

      if (typeof FluidAudio === 'undefined') return;
      const tracks = FluidAudio.playlist || [];

      if (tracks.length === 0) {
        container.innerHTML = '<div class="playlist-item">播放队列为空</div>';
        return;
      }

      container.innerHTML = '';
      tracks.forEach((track, i) => {
        const row = document.createElement('div');
        row.className = 'playlist-item playlist-item-row' + (i === (FluidAudio.playlistIndex || 0) ? ' active' : '');
        const info = ChamberBase.escapeHtml(track.title || track.name || '未知') + (track.artist ? ' — ' + ChamberBase.escapeHtml(track.artist) : '');
        row.innerHTML = `
          <span class="pli-actions">
            <button class="pli-btn pli-play" data-idx="${i}" title="播放">▶</button>
            <button class="pli-btn pli-remove" data-idx="${i}" title="移除">✕</button>
          </span>
          <span class="pli-name">${info}</span>
        `;
        row.querySelector('.pli-play').addEventListener('click', async (e) => {
          e.stopPropagation();
          const t = tracks[i];
          if ((!t.url || t.platform === 'qq') && t.id && typeof ApiBridge !== 'undefined') {
            t.url = await PlaylistChamber.fetchTrackUrl(t);
          }
          if (t.url && typeof FluidAudio !== 'undefined') {
            FluidAudio.load(t.url, t);
            FluidAudio.play();
            FluidAudio.playlistIndex = i;
          }
        });
        row.querySelector('.pli-remove').addEventListener('click', (e) => {
          e.stopPropagation();
          tracks.splice(i, 1);
          if (typeof FluidAudio !== 'undefined') FluidAudio.playlist = tracks;
          PlaylistChamber.renderQueueList();
        });
        container.appendChild(row);
      });
    },
  };

  window.PlaylistChamber = PlaylistChamber;
  console.log('FluidMusic Playlist Chamber loaded');
})();
