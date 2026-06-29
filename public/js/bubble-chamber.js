// ============================================================
// FluidMusic — Bubble Chamber Manager
// Edge-triggered spring-animated bubble chambers
// Left: Playlist, Right: Lyrics, Top: Account+Queue, Bottom: Controller
// ============================================================
(function () {
  const BubbleChamber = {
    chambers: {},
    pinned: { left: false, right: false, top: false, bottom: false },
    hovered: { left: false, right: false, top: false },
    edgeZones: {},
    lyricsLines: [],
    playlistItems: [],
    currentView: 'playlists', // 'playlists' | 'tracks'
  };

  function init() {
    console.log('[BubbleChamber] init START');
    try {
    ['left', 'right', 'top', 'bottom'].forEach((side) => {
      const el = document.getElementById('chamber-' + side);
      if (el) {
        BubbleChamber.chambers[side] = el;
  // bottom is edge-triggered like others
      }
    });

    // Edge trigger zones
    const edgeLeft = document.getElementById('edge-left');
    const edgeRight = document.getElementById('edge-right');
    const edgeTop = document.getElementById('edge-top');

    if (edgeLeft) {
      edgeLeft.addEventListener('mouseenter', () => handleEdgeEnter('left'));
      edgeLeft.addEventListener('mouseleave', () => handleEdgeLeave('left'));
      edgeLeft.addEventListener('click', () => handleEdgeClick('left'));
    }
    if (edgeRight) {
      edgeRight.addEventListener('mouseenter', () => handleEdgeEnter('right'));
      edgeRight.addEventListener('mouseleave', () => handleEdgeLeave('right'));
      edgeRight.addEventListener('click', () => handleEdgeClick('right'));
    }
    if (edgeTop) {
      edgeTop.addEventListener('mouseenter', () => handleEdgeEnter('top'));
      edgeTop.addEventListener('mouseleave', () => handleEdgeLeave('top'));
      edgeTop.addEventListener('click', () => handleEdgeClick('top'));
    }

    const edgeBottom = document.getElementById('edge-bottom');
    if (edgeBottom) {
      edgeBottom.addEventListener('mouseenter', () => handleEdgeEnter('bottom'));
      edgeBottom.addEventListener('mouseleave', () => handleEdgeLeave('bottom'));
      edgeBottom.addEventListener('click', () => handleEdgeClick('bottom'));
    }

    // Auto-show pinned chambers on startup
    Object.keys(BubbleChamber.pinned).forEach((side) => {
      if (BubbleChamber.pinned[side]) showChamber(side);
    });

    ['left', 'right', 'bottom'].forEach((side) => {
      const el = document.getElementById('chamber-' + side);
      if (el) {
        el.addEventListener('mouseenter', () => {
          BubbleChamber.hovered[side] = true;
          showChamber(side);
        });
        el.addEventListener('mouseleave', () => {
          BubbleChamber.hovered[side] = false;
          if (!BubbleChamber.pinned[side]) {
            hideChamber(side);
          }
        });
      }
    });
    // Top chamber: always visible, but hide on mouseleave if not pinned
    const topEl = document.getElementById('chamber-top');
    if (topEl) {
      topEl.addEventListener('mouseenter', () => {
        BubbleChamber.hovered.top = true;
        showChamber('top');
      });
      topEl.addEventListener('mouseleave', () => {
        BubbleChamber.hovered.top = false;
        if (!BubbleChamber.pinned.top) {
          // Keep visible by default (it's the queue display)
          // Only hide if explicitly unpinned via click
        }
      });
    }

    // ── Dock-style magnification for queue covers ──
    const queueArea = document.getElementById('queue-area');
    if (queueArea) {
      const items = queueArea.querySelectorAll('.queue-item');
      let dockMagEnabled = true; // can be toggled via settings

      function updateDockMagnification(e) {
        if (!dockMagEnabled) return;
        const qRect = queueArea.getBoundingClientRect();
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        items.forEach((item) => {
          const iRect = item.getBoundingClientRect();
          const itemCenterX = iRect.left + iRect.width / 2;
          const itemCenterY = iRect.top + iRect.height / 2;
          const dx = mouseX - itemCenterX;
          const dy = mouseY - itemCenterY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 220;
          if (dist < maxDist) {
            const factor = 1 - (dist / maxDist);
            const scale = 0.85 + factor * 0.75;
            const rotY = (dx / maxDist) * 35; // rotate toward mouse X
            const rotX = -(dy / maxDist) * 25; // rotate toward mouse Y (inverted)
            const brightness = 0.4 + factor * 1.4;
            item.style.transform = 'perspective(500px) rotateY(' + rotY.toFixed(1) + 'deg) rotateX(' + rotX.toFixed(1) + 'deg) scale(' + scale.toFixed(2) + ') translateY(' + (-factor * 8).toFixed(1) + 'px)';
            item.style.filter = 'brightness(' + brightness.toFixed(2) + ') saturate(' + (0.4 + factor * 1.2).toFixed(2) + ') drop-shadow(0 ' + (factor * 12).toFixed(0) + 'px ' + (factor * 16).toFixed(0) + 'px rgba(0,0,0,' + (factor * 0.5).toFixed(2) + '))';
            item.style.opacity = (0.35 + factor * 0.65).toFixed(2);
            item.style.zIndex = Math.round(8 + factor * 5);
          } else {
            item.style.transform = '';
            item.style.filter = '';
            item.style.opacity = '';
            item.style.zIndex = '';
          }
        });
      }

      queueArea.addEventListener('mousemove', updateDockMagnification);
      queueArea.addEventListener('mouseleave', () => {
        items.forEach((item) => {
          item.style.transform = '';
          item.style.filter = '';
          item.style.opacity = '';
          item.style.zIndex = '';
        });
      });

      // Expose toggle
      window._dockMagEnabled = function(v) { dockMagEnabled = v; };
    }

    // Wire user management and settings buttons
    const btnUser = document.getElementById('btn-user');
    if (btnUser) {
      btnUser.addEventListener('click', (e) => {
        e.stopPropagation();
        try {
          if (typeof UserPanel !== 'undefined' && UserPanel.toggle) {
            UserPanel.toggle();
            if (typeof showToast !== 'undefined') showToast('👤 用户管理');
          }
        } catch(err) { console.error('[BTN] User toggle error:', err); }
      });
    }
    const btnSettings = document.getElementById('btn-settings');
    if (btnSettings) {
      btnSettings.addEventListener('click', (e) => {
        e.stopPropagation();
        try {
          if (typeof DIYSettings !== 'undefined' && DIYSettings.toggle) {
            DIYSettings.toggle();
            if (typeof showToast !== 'undefined') showToast('⚙️ 设置');
          }
        } catch(err) { console.error('[BTN] Settings toggle error:', err); }
      });
    }

    } catch(e) { console.error('[BubbleChamber] init ERROR:', e); }
    console.log('Bubble Chamber Manager initialized');
  }

  function handleEdgeEnter(side) {
    BubbleChamber.hovered[side] = true;
    showChamber(side);
  }

  function handleEdgeLeave(side) {
    BubbleChamber.hovered[side] = false;
    setTimeout(() => {
      if (!BubbleChamber.hovered[side] && !BubbleChamber.pinned[side]) {
        hideChamber(side);
      }
    }, 150);
  }

  function handleEdgeClick(side) {
    BubbleChamber.pinned[side] = !BubbleChamber.pinned[side];
    const el = BubbleChamber.chambers[side];
    if (!el) return;

    if (BubbleChamber.pinned[side]) {
      el.classList.add('pinned');
    } else {
      el.classList.remove('pinned');
      if (!BubbleChamber.hovered[side]) {
        hideChamber(side);
      }
    }
  }

  function showChamber(side) {
    const el = BubbleChamber.chambers[side];
    if (!el) return;
    el.classList.add('visible');
    // Sync inline lyric visibility (right chamber → center single-line lyric)
    if (side === 'right' && typeof window._updateInlineLyricVisibility === 'function') {
      setTimeout(window._updateInlineLyricVisibility, 50);
    }
    el.classList.remove('hiding');
  }

  function hideChamber(side) {
    const el = BubbleChamber.chambers[side];
    if (!el) return;
    if (BubbleChamber.pinned[side]) return;
    el.classList.add('hiding');
    el.classList.remove('visible');
    // Sync inline lyric visibility
    if (side === 'right' && typeof window._updateInlineLyricVisibility === 'function') {
      setTimeout(window._updateInlineLyricVisibility, 50);
    }
  }

  // ── Lyrics rendering ──
  // Parse LRC text into {time_sec, text} array
  function parseLyricTimes(lyricText) {
    const result = [];
    if (!lyricText) return result;
    const lines = lyricText.split('\n');
    const timeRe = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
    lines.forEach((line) => {
      const matches = [];
      let m;
      while ((m = timeRe.exec(line)) !== null) {
        const min = parseInt(m[1], 10);
        const sec = parseInt(m[2], 10);
        const ms = m[3] ? parseInt(m[3].padEnd(3, '0'), 10) : 0;
        matches.push(min * 60 + sec + ms / 1000);
      }
      const text = line.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g, '').trim();
      if (text && matches.length > 0) {
        matches.forEach((time) => result.push({ time, text }));
      }
    });
    result.sort((a, b) => a.time - b.time);
    return result;
  }

  function setLyrics(lyricText, currentIndex) {
    const container = document.getElementById('lyrics-container');
    if (!container) return;

    BubbleChamber.lyricTimes = parseLyricTimes(lyricText);

    container.innerHTML = '';
    if (BubbleChamber.lyricTimes.length === 0) {
      const div = document.createElement('div');
      div.className = 'lyric-line active';
      div.textContent = typeof I18N !== 'undefined' ? I18N.t('lyrics.empty') : '暂无歌词';
      container.appendChild(div);
      BubbleChamber.lyricsLines = [(typeof I18N !== 'undefined' ? I18N.t('lyrics.empty') : '暂无歌词')];
      return;
    }

    BubbleChamber.lyricsLines = BubbleChamber.lyricTimes.map(l => l.text);
    BubbleChamber.lyricTimes.forEach((lt, i) => {
      const div = document.createElement('div');
      div.className = 'lyric-line';
      div.textContent = lt.text;
      container.appendChild(div);
    });
    highlightLyric(0);
  }

  // Find lyric index for current playback time
  function findLyricIndex(currentTimeSec) {
    const times = BubbleChamber.lyricTimes;
    if (!times || times.length === 0) return -1;
    for (let i = times.length - 1; i >= 0; i--) {
      if (times[i].time <= currentTimeSec) return i;
    }
    return 0;
  }

  function highlightLyric(index) {
    const container = document.getElementById('lyrics-container');
    if (!container) return;
    if (BubbleChamber._lastLyricIdx === index) return;
    BubbleChamber._lastLyricIdx = index;
    const lines = container.querySelectorAll('.lyric-line');
    lines.forEach((line, i) => {
      line.classList.toggle('active', i === index);
    });
    if (index >= 0 && lines[index]) {
    // Update inline lyric in center core
    const inlineLyric = document.getElementById('inline-lyric');
    if (inlineLyric && BubbleChamber.lyricTimes && index >= 0 && index < BubbleChamber.lyricTimes.length) {
      inlineLyric.textContent = BubbleChamber.lyricTimes[index].text;
    }
      lines[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // ── Playlist loading / empty states ──
  function showPlaylistLoading() {
    const container = document.getElementById('playlist-items');
    if (!container) return;
    container.innerHTML = `<div class="playlist-loading">
      <div class="playlist-loading-spinner"></div>
      ${typeof I18N !== 'undefined' ? I18N.t('playlist.loading') : '加载中...'}
    </div>`;
  }

  function showPlaylistEmpty() {
    const container = document.getElementById('playlist-items');
    if (!container) return;
    container.innerHTML = `<div class="playlist-item">${typeof I18N !== 'undefined' ? I18N.t('playlist.empty') : '暂无歌单'}</div>`;
  }

  function refreshPlaylistLabels() {
    if (BubbleChamber.currentView === 'playlists' && typeof FluidMusicApp !== 'undefined') {
      FluidMusicApp.syncPlaylists();
    }
  }

  // Force-refresh the playlist list — called after login sync
  async function refreshPlaylistList() {
    console.log('[BubbleChamber] refreshPlaylistList() called');
    if (typeof ApiBridge === 'undefined') {
      console.warn('[BubbleChamber] ApiBridge not available for playlist refresh');
      return;
    }

    showPlaylistLoading();

    try {
      const playlists = await ApiBridge.fetchUserPlaylists();
      console.log('[BubbleChamber] refreshPlaylistList — fetched:',
        'netease=' + (playlists.netease || []).length,
        'qq=' + (playlists.qq || []).length,
'');

      setUserPlaylists(playlists);
    } catch (e) {
      console.error('[BubbleChamber] refreshPlaylistList failed:', e);
      showPlaylistEmpty();
    }
  }

  // ── User playlist rendering (with covers, 48px) ──

  // ── Get synced playlist IDs from user settings ──
  function getSyncedPlaylistIds() {
    try {
      return JSON.parse(localStorage.getItem('fluidmusic_synced_playlists') || '{}');
    } catch(e) { return {}; }
  }

  // Filter playlists to only show synced ones
  function filterSyncedPlaylists(playlists) {
    const synced = getSyncedPlaylistIds();
    const filtered = { netease: [], qq: [] };
    
    (playlists.netease || []).forEach(pl => {
      if (synced.netease && synced.netease[pl.id]) filtered.netease.push(pl);
    });
    (playlists.qq || []).forEach(pl => {
      if (synced.qq && synced.qq[pl.id]) filtered.qq.push(pl);
    });
    
    return filtered;
  }

  function setUserPlaylists(playlists) {
    const container = document.getElementById('playlist-items');
    if (!container) return;

    const backBtnHide = document.getElementById('btn-playlist-back');
    if (backBtnHide) backBtnHide.style.display = 'none';
    BubbleChamber.currentView = 'playlists';

    // Filter to only synced playlists
    playlists = filterSyncedPlaylists(playlists);

    const allPlaylists = [
      ...(playlists.netease || []),
      ...(playlists.qq || []),
    ];

    if (allPlaylists.length === 0) {
      showPlaylistEmpty();
      return;
    }

    container.innerHTML = '';

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

      let coverHtml = `<span class="playlist-item-cover" style="display:flex;align-items:center;justify-content:center;background:rgba(238,102,68,0.12);border:1px solid rgba(238,102,68,0.2);font-size:22px;">❤️</span>`;
      if (pl.coverUrl) {
        coverHtml = `<img class="playlist-item-cover" src="${escapeHtml(pl.coverUrl)}" alt="" onerror="this.style.display='none';this.parentElement.querySelector('.playlist-item-info .playlist-item-count').innerHTML='${dot} '+(this.parentElement.querySelector('.playlist-item-info .playlist-item-count').dataset.desc||'...');">`;
      }

      const desc = (pl.description || pl.desc || pl.bio || '...').substring(0, 60);
      const platformLabel = pl.platform === 'qq' ? 'QQ' : '网易';
      div.innerHTML = `
        ${coverHtml}
        <div class="playlist-item-info">
          <span class="playlist-item-name">${escapeHtml(pl.name)}</span>
          <span class="playlist-item-count" data-desc="${escapeHtml(desc)}">${dot} ${escapeHtml(platformLabel)} · ${escapeHtml(desc)}</span>
        </div>
      `;

      div.addEventListener('click', () => {
        loadPlaylistSongs(pl);
      });

        container.appendChild(div);
      });
    });

    // Pin left chamber to show playlists
    const chamberLeft = document.getElementById('chamber-left');
    if (chamberLeft) {
      chamberLeft.classList.add('visible', 'pinned');
      BubbleChamber.pinned.left = true;
    }
  }

  async function loadPlaylistSongs(pl) {
    const container = document.getElementById('playlist-items');
    if (!container) return;

    BubbleChamber.currentView = 'tracks';

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
          renderTrackList(tracks, 0, pl);
          const backBtn = document.getElementById('btn-playlist-back');
          if (backBtn) backBtn.style.display = 'flex';
          if (typeof FluidAudio !== 'undefined') {
            FluidAudio.setPlaylist(tracks, 0);
          }
          updateQueueDisplay(tracks[0], tracks, 0);
          // Background silent cache refresh (no UI re-render)
          setTimeout(async () => {
            await fetchTracksFromApi(pl, { skipUrlPrefetch: true, silent: true });
          }, 500);
          return;
        }
      }
      // No cache — fetch from API
      console.log('[Playlist] CACHE MISS for', pl.platform, pl.id, '- fetching from API...');
      if (typeof showToast !== 'undefined') showToast('🌐 正在获取歌单...');
      showPlaylistLoading();
      await fetchTracksFromApi(pl);
      return;
    } catch (e) {
      console.error('Failed to load playlist songs:', e);
      const failText = typeof I18N !== 'undefined' ? I18N.t('playlist.loadFail') : '加载失败';
      const backBtn2 = document.getElementById('btn-playlist-back');
      if (backBtn2) backBtn2.style.display = 'flex';
      container.innerHTML = `<div class="playlist-item">${failText}</div>`;
    }
  }

  // ── Core API fetcher ──
  async function fetchTracksFromApi(pl, opts) {
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


      // ── URL pre-fetch filter: verify playability for QQ ──
      // Skip URL pre-fetch for background refreshes (cached tracks already have URLs)
      if (tracks.length > 0 && pl.platform === 'qq' && !opts.skipUrlPrefetch) {
        const cachedTracks = [];
        const failedTracks = [];
        // Pre-fetch URLs in staggered batches (3 tracks per batch, 400ms apart) to avoid rate-limit
        for (let i = 0; i < tracks.length; i += 3) {
          const batch = tracks.slice(i, i + 3);
          const results = await Promise.allSettled(batch.map(async (t) => {
            // Check cache first
            const cacheKey = 'track_url_' + pl.platform + '_' + t.id;
            let url = (typeof DataCache !== 'undefined') ? DataCache.get(cacheKey) : null;
            if (!url) {
              url = await fetchTrackUrl(t);
              if (url && typeof DataCache !== 'undefined') {
                DataCache.set(cacheKey, url);
              }
            }
            t.url = url || '';
            return t;
          }));
          results.forEach((r) => {
            if (r.status === 'fulfilled' && r.value.url) cachedTracks.push(r.value);
            else if (r.status === 'fulfilled') failedTracks.push(r.value);
          });
          // Stagger: wait between batches
          if (i + 3 < tracks.length) await new Promise(r => setTimeout(r, 400));
        }
        console.log('[Playlist] URL pre-fetch: ' + cachedTracks.length + ' playable, ' + failedTracks.length + ' filtered out');
        tracks = cachedTracks;
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

      renderTrackList(tracks, 0, pl);

      if (typeof FluidAudio !== 'undefined' && FluidAudio.playlist) {
        updateQueueDisplay(tracks[0], tracks, 0);
      }
    } catch (e) {
      console.error('Failed to load playlist songs:', e);
      const failText = typeof I18N !== 'undefined' ? I18N.t('playlist.loadFail') : '加载失败';
      const backBtn2 = document.getElementById('btn-playlist-back');
      if (backBtn2) backBtn2.style.display = 'flex';
      if (container) container.innerHTML = `<div class="playlist-item">${failText}</div>`;
    }
  }


  // ── Lazy track URL fetcher ──
  async function fetchTrackUrl(track) {
    if (typeof ApiBridge === 'undefined') return '';
    try {
      if (track.platform === 'netease') {
        const data = await ApiBridge.getNeteaseSongUrl(track.id);
        return (data && data.data && data.data[0] && data.data[0].url) || '';
      } else if (track.platform === 'qq') {
        const data = await ApiBridge.getQQSongUrl(track.id);
        // QQ song URL response: { req_0: { data: { midurlinfo: [...], sip: [...] } } }
        if (data && data.req_0 && data.req_0.data) {
          const d = data.req_0.data;
          const sip = (d.sip || [])[0] || '';
          const purl = (d.midurlinfo && d.midurlinfo[0] && d.midurlinfo[0].purl) || '';
          if (sip && purl) return sip + purl;
        }
        return '';
      
      }
    } catch (e) {
      console.warn('Failed to fetch track URL:', e);
    }
    return '';
  }

  function setPlaylist(tracks, currentIndex) {
    const container = document.getElementById('playlist-items');
    if (!container) return;

    BubbleChamber.playlistItems = tracks || [];
    container.innerHTML = '';

    if (!tracks || tracks.length === 0) {
      showPlaylistEmpty();
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
            t.url = await fetchTrackUrl(t);
          }
          if (t.url) {
            FluidAudio.load(t.url, t);
            FluidAudio.play();
            setActivePlaylistItem(i);
          }
        }
      });
      container.appendChild(div);
    });
  }

  function renderTrackList(tracks, currentIndex, sourcePlaylist) {
    const container = document.getElementById('playlist-items');
    if (!container) return;

    container.innerHTML = '';

    // Play All button
    if (tracks.length > 0) {
      const playAll = document.createElement('div');
      playAll.className = 'playlist-item playlist-playall';
      playAll.textContent = '▶ 播放全部 (' + tracks.length + ')';
      playAll.addEventListener('click', async () => {
        if (typeof FluidAudio !== 'undefined') {
          // Pre-fetch URLs for all tracks
          for (const t of tracks) {
            if ((!t.url || t.platform === 'qq') && t.id) { try { t.url = await fetchTrackUrl(t); } catch(e) {} }
          }
          FluidAudio.setPlaylist(tracks, 0);
          updateQueueDisplay(tracks[0], tracks, 0);
          const t = tracks[0];
          if (t.url) {
            FluidAudio.load(t.url, t);
            FluidAudio.play();
            setActivePlaylistItem(0);
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

      row.innerHTML = `
        <span class="pli-actions">
          <button class="pli-btn pli-fav" data-action="fav" data-idx="${i}" title="收藏">♥</button>
          <button class="pli-btn pli-play" data-action="play" data-idx="${i}" title="立即播放">▶</button>
          <button class="pli-btn pli-add" data-action="add" data-idx="${i}" title="添加到队列">+</button>
        </span>
        <span class="pli-name">${escapeHtml(trackInfo + artistInfo)}</span>
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
        if ((!t.url || t.platform === 'qq') && t.id) t.url = await fetchTrackUrl(t);
        if (t.url && typeof FluidAudio !== 'undefined') {
          FluidAudio.setPlaylist(tracks, i);
          updateQueueDisplay(t, tracks, i);
          FluidAudio.load(t.url, t);
          FluidAudio.play();
          setActivePlaylistItem(i);
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
          updateQueueDisplay(FluidAudio.currentTrack, FluidAudio.playlist, FluidAudio.playlistIndex);
          setTimeout(() => { btn.textContent = exists ? '+' : '✓'; }, 600);
        }
      });

      // Initial fav state
      if (typeof Favorites !== 'undefined' && Favorites.has(track)) {
        row.querySelector('.pli-fav').classList.add('active');
      }

      container.appendChild(row);
    });
  }

  function setActivePlaylistItem(index) {
    const container = document.getElementById('playlist-items');
    if (!container) return;
    const items = container.querySelectorAll('.playlist-item');
    items.forEach((item, i) => {
      item.classList.toggle('active', i === index);
    });
  }

  // ── Favorites list rendering ──
  function renderFavoritesList() {
    const container = document.getElementById('playlist-items');
    if (!container) return;
    BubbleChamber.currentView = 'favorites';

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
      const info = escapeHtml(track.title) + (track.artist ? ' — ' + escapeHtml(track.artist) : '');
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
          t.url = await fetchTrackUrl(t);
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
          updateQueueDisplay(FluidAudio.currentTrack, FluidAudio.playlist, FluidAudio.playlistIndex);
        }
      });
      row.querySelector('.pli-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof Favorites !== 'undefined') {
          Favorites.remove(track);
          renderFavoritesList();
        }
      });
      container.appendChild(row);
    });
  }

  // ── Queue list rendering ──
  function renderQueueList() {
    const container = document.getElementById('playlist-items');
    if (!container) return;
    BubbleChamber.currentView = 'queue';

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
      const info = escapeHtml(track.title || track.name || '未知') + (track.artist ? ' — ' + escapeHtml(track.artist) : '');
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
          t.url = await fetchTrackUrl(t);
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
        renderQueueList();
      });
      container.appendChild(row);
    });
  }

  // ── Queue rendering ──
  function updateQueueDisplay(currentTrack, playlist, currentIndex) {
    const queueArea = document.getElementById('queue-area');
    if (!queueArea) return;

    const items = queueArea.querySelectorAll('.queue-item');
    const total = items.length;
    const center = Math.floor(total / 2);
    const pl = playlist || [];
    const idx = (currentIndex != null) ? currentIndex : -1;

    for (let i = 0; i < total; i++) {
      const offset = i - center;
      let trackIndex = 0;
      if (pl.length > 0) {
        trackIndex = ((idx + offset) % pl.length + pl.length) % pl.length;
      }
      const track = pl[trackIndex];

      items[i].className = 'queue-item';
      if (offset === 0) {
        items[i].classList.add('center');
      } else if (Math.abs(offset) >= 2) {
        items[i].classList.add('far');
      }

      items[i].dataset.index = pl.length > 0 ? trackIndex : '';
      if (track && track.coverUrl) {
        items[i].style.background = `url(${track.coverUrl}) center/cover`;
      } else {
        items[i].style.background = '';
      }
    }
  }

  // ── Enhanced Account Display ──
  // profile: { avatarUrl, nickname, vipType/vipLevel, followeds/followers, follows/followings, playlistCount }



  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── User Management Panel ──








  // Click on account cards toggles the user panel

  // ── Exports ──
  BubbleChamber.init = init;
  BubbleChamber.setLyrics = setLyrics;
  BubbleChamber.highlightLyric = highlightLyric;
  BubbleChamber.findLyricIndex = findLyricIndex;
  BubbleChamber.setPlaylist = setPlaylist;
  BubbleChamber.setUserPlaylists = setUserPlaylists;
  BubbleChamber.loadPlaylistSongs = loadPlaylistSongs;
  BubbleChamber.setActivePlaylistItem = setActivePlaylistItem;
  BubbleChamber.updateQueueDisplay = updateQueueDisplay;
  BubbleChamber.showPlaylistLoading = showPlaylistLoading;
  BubbleChamber.showPlaylistEmpty = showPlaylistEmpty;
  BubbleChamber.refreshPlaylistLabels = refreshPlaylistLabels;
  BubbleChamber.refreshPlaylistList = refreshPlaylistList;
  BubbleChamber.renderFavoritesList = renderFavoritesList;
  BubbleChamber.getSyncedPlaylistIds = getSyncedPlaylistIds;
  BubbleChamber.filterSyncedPlaylists = filterSyncedPlaylists;
  BubbleChamber.renderQueueList = renderQueueList;

  window.BubbleChamber = BubbleChamber;
  window._fetchTrackUrl = fetchTrackUrl;
  console.log('FluidMusic Bubble Chamber Manager loaded');
})();
