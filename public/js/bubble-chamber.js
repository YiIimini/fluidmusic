// ============================================================
// FluidMusic — Bubble Chamber Manager
// Edge-triggered spring-animated bubble chambers
// Left: Playlist, Right: Lyrics, Top: Account+Queue, Bottom: Controller
// ============================================================
(function () {
  const BubbleChamber = {
    chambers: {},
    pinned: { top: true, bottom: true, left: false, right: false },
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
      let dockMagEnabled = true;
      let dockRafId = null;
      let dockMouseX = 0, dockMouseY = 0;
      let dockActive = false;

      // Cache item rects once per frame to avoid layout thrashing
      const updateDockMagnification = () => {
        dockRafId = null;
        if (!dockMagEnabled || !dockActive) return;

        const items = queueArea.querySelectorAll('.queue-item');
        if (items.length === 0) return;

        // Read phase: cache all rects at once (single layout pass)
        const itemData = [];
        items.forEach((item) => {
          const r = item.getBoundingClientRect();
          itemData.push({
            el: item,
            cx: r.left + r.width / 2,
            cy: r.top + r.height / 2,
          });
        });

        // Write phase: apply transforms (no layout reads below this line)
        const maxDist = 220;
        for (let i = 0; i < itemData.length; i++) {
          const { el, cx, cy } = itemData[i];
          const dx = dockMouseX - cx;
          const dy = dockMouseY - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDist) {
            const factor = 1 - (dist / maxDist);
            const scale = 0.85 + factor * 0.75;
            const rotY = (dx / maxDist) * 35;
            const rotX = -(dy / maxDist) * 25;
            const lift = -factor * 8;
            el.style.transform = 'perspective(500px) rotateY(' + rotY.toFixed(1) + 'deg) rotateX(' + rotX.toFixed(1) + 'deg) scale(' + scale.toFixed(2) + ') translateY(' + lift.toFixed(1) + 'px)';
            el.style.opacity = (0.35 + factor * 0.65).toFixed(2);
            el.style.zIndex = Math.round(8 + factor * 5);
            // Use box-shadow instead of filter for performance
            const shadowAlpha = factor * 0.5;
            el.style.boxShadow = '0 ' + (factor * 12).toFixed(0) + 'px ' + (factor * 16).toFixed(0) + 'px rgba(0,0,0,' + shadowAlpha.toFixed(2) + ')';
            el.classList.add('dock-active');
          } else {
            el.style.transform = '';
            el.style.opacity = '';
            el.style.zIndex = '';
            el.style.boxShadow = '';
            el.classList.remove('dock-active');
          }
        }
      }

      const scheduleDockUpdate = (e) => {
        dockMouseX = e.clientX;
        dockMouseY = e.clientY;
        if (!dockRafId) {
          dockRafId = requestAnimationFrame(updateDockMagnification);
        }
      };

      queueArea.addEventListener('mousemove', (e) => {
        scheduleDockUpdate(e);
        // Edge-triggered carousel scroll
        var rect = queueArea.getBoundingClientRect();
        var edgePct = 0.15; // 15% from edges triggers scroll
        var leftEdge = rect.left + rect.width * edgePct;
        var rightEdge = rect.right - rect.width * edgePct;
        var scrollSpeed = 0;
        if (e.clientX < leftEdge) {
          scrollSpeed = -3 * (1 - (e.clientX - rect.left) / (rect.width * edgePct));
        } else if (e.clientX > rightEdge) {
          scrollSpeed = 3 * ((e.clientX - rightEdge) / (rect.width * edgePct));
        }
        queueArea.scrollLeft += scrollSpeed;
      }, { passive: true });
      queueArea.addEventListener('mouseenter', () => { dockActive = true; });
      queueArea.addEventListener('mouseleave', () => {
        dockActive = false;
        if (dockRafId) { cancelAnimationFrame(dockRafId); dockRafId = null; }
        queueArea.querySelectorAll('.queue-item').forEach((item) => {
          item.style.transform = '';
          item.style.opacity = '';
          item.style.zIndex = '';
          item.style.boxShadow = '';
          item.classList.remove('dock-active');
        });
      });

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

  function setLyrics(lyricText, currentIndex, transText) {
    const container = document.getElementById('lyrics-container');
    if (!container) return;

    BubbleChamber.lyricTimes = parseLyricTimes(lyricText);
    // Parse translation lyrics too (for bilingual display)
    BubbleChamber.transTimes = transText ? parseLyricTimes(transText) : null;

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
      div.innerHTML = '<span class="lyric-orig">' + escapeHtml(lt.text) + '</span>';

      // Find matching translation (closest time match)
      if (BubbleChamber.transTimes && BubbleChamber.transTimes.length > 0) {
        let bestTrans = '';
        let bestDiff = Infinity;
        for (const tt of BubbleChamber.transTimes) {
          const diff = Math.abs(tt.time - lt.time);
          if (diff < bestDiff && diff < 3) { // within 3 seconds
            bestDiff = diff;
            bestTrans = tt.text;
          }
        }
        if (bestTrans && bestTrans !== lt.text) {
          div.innerHTML += '<span class="lyric-trans">' + escapeHtml(bestTrans) + '</span>';
        }
      }

      container.appendChild(div);
    });
    highlightLyric(0);
  }

  // Find lyric index for current playback time using binary search
  function findLyricIndex(currentTimeSec) {
    const times = BubbleChamber.lyricTimes;
    if (!times || times.length === 0) return -1;
    // Binary search: find the last lyric whose time <= currentTimeSec
    let lo = 0, hi = times.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (times[mid].time <= currentTimeSec) {
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return hi >= 0 ? hi : 0;
  }

  function highlightLyric(index) {
    const container = document.getElementById('lyrics-container');
    if (!container) return;
    const changed = BubbleChamber._lastLyricIdx !== index;
    BubbleChamber._lastLyricIdx = index;
    const lines = container.querySelectorAll('.lyric-line');
    lines.forEach((line, i) => {
      const isActive = (i === index);
      if (line.classList.contains('active') !== isActive) {
        line.classList.toggle('active', isActive);
        if (isActive) {
          // Reset transform on newly active line
          line.style.transform = '';
          line.style.textShadow = '';
        }
      }
    });
    if (index >= 0 && lines[index]) {
      // Update inline lyric in center core
      const inlineLyric = document.getElementById('inline-lyric');
      if (inlineLyric && BubbleChamber.lyricTimes && index >= 0 && index < BubbleChamber.lyricTimes.length) {
        inlineLyric.textContent = BubbleChamber.lyricTimes[index].text;
      }
      if (changed) {
        lines[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  // Audio-reactive lyric animation — called from render loop
  function animateLyrics() {
    if (!BubbleChamber._lastLyricIdx || BubbleChamber._lastLyricIdx < 0) return;
    const container = document.getElementById('lyrics-container');
    if (!container) return;
    const lines = container.querySelectorAll('.lyric-line');
    const idx = BubbleChamber._lastLyricIdx;
    if (!lines[idx]) return;

    let energy = 0, bass = 0, mid = 0;
    if (typeof FluidAudio !== 'undefined' && FluidAudio.bands) {
      energy = FluidAudio.bands.energy || 0;
      bass = FluidAudio.bands.bass || 0;
      mid = FluidAudio.bands.mid || 0;
    }

    const activeLine = lines[idx];

    // Gentle breathing scale — feels alive
    const scale = 1 + energy * 0.08 + bass * 0.06;
    // Subtle vertical float — like the lyric is floating on sound waves
    const floatY = Math.sin(Date.now() * 0.003) * 2 * energy + bass * 3;
    // Color warmth shifts with energy
    const glowIntensity = energy * 0.6 + bass * 0.4;

    activeLine.style.transform = 'scale(' + scale.toFixed(3) + ') translateY(' + floatY.toFixed(1) + 'px)';
    activeLine.style.textShadow = '0 0 ' + (8 + glowIntensity * 20).toFixed(0) + 'px rgba(180,200,255,' + (0.2 + glowIntensity * 0.5).toFixed(2) + '), 0 ' + (bass * 8).toFixed(0) + 'px ' + (bass * 12).toFixed(0) + 'px rgba(130,160,255,' + (bass * 0.3).toFixed(2) + ')';

    // Neighboring lines get subtle movement too
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const ni = idx + i;
      if (ni >= 0 && ni < lines.length && !lines[ni].classList.contains('active')) {
        const dist = Math.abs(i);
        const nFloat = Math.sin(Date.now() * 0.002 + i) * energy * (3 - dist);
        lines[ni].style.transform = 'translateY(' + nFloat.toFixed(1) + 'px)';
        lines[ni].style.opacity = (0.4 - dist * 0.08 + energy * 0.15).toFixed(2);
      }
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

  // Refresh sidebar from cache only (no API call) — used after user toggles synced playlists
  function refreshPlaylistListFromCache() {
    if (typeof DataCache === 'undefined') return;
    const playlists = DataCache.getCachedPlaylists();
    if (!playlists) {
      console.log('[BubbleChamber] refreshFromCache: no cached playlists, falling back to API');
      refreshPlaylistList();
      return;
    }
    console.log('[BubbleChamber] refreshFromCache: updating sidebar from local cache');
    setUserPlaylists(playlists);
  }

  // Fetch and cache songs for a single playlist (used when user enables sync)
  async function fetchAndCachePlaylistSongs(pl) {
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

    if (allPlaylists.length === 0 && (!window.CustomPlaylists || window.CustomPlaylists.getAll().length === 0)) {
      showPlaylistEmpty();
    } else if (allPlaylists.length > 0 || (window.CustomPlaylists && window.CustomPlaylists.getAll().length > 0)) {
      // Will render below
    } else {
      showPlaylistEmpty();
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
        ? `<img class="playlist-item-cover" src="${escapeHtml(pl.coverUrl)}" alt="" onerror="this.style.display='none'">`
        : `<span class="playlist-item-cover playlist-cover-heart">❤️</span>`;

      const desc = (pl.description || pl.desc || pl.bio || '...').substring(0, 60);
      const platformLabel = pl.platform === 'qq' ? 'QQ' : '网易';
      div.innerHTML = `
        ${coverHtml}
        <div class="playlist-item-info">
          <span class="playlist-item-name">${escapeHtml(pl.name)}</span>
          <span class="playlist-item-count">${dot} ${escapeHtml(platformLabel)} · ${escapeHtml(desc)}</span>
        </div>
      `;

      div.addEventListener('click', () => {
        loadPlaylistSongs(pl);
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
    BubbleChamber.pinned = pins;
    Object.keys(pins).forEach(function(side) {
      if (pins[side]) {
        var el = document.getElementById('chamber-' + side);
        if (el) el.classList.add('visible', 'pinned');
      }
    });
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
        const reason = diagnoseUrlFailure(track, apiResponse);
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
  }

  // Diagnose why a track URL fetch failed
  function diagnoseUrlFailure(track, apiResponse) {
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
          updateQueueDisplay(playTracks[startIdx], playTracks, startIdx);
          const t = playTracks[startIdx];
          // Fetch URL ONLY for the first track — rest on-demand
          if ((!t.url || t.platform === 'qq') && t.id) {
            try { t.url = await fetchTrackUrl(t); } catch(e) {}
          }
          if (t.url) {
            FluidAudio.load(t.url, t);
            FluidAudio.play();
            setActivePlaylistItem(0);
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
        ? `<img class="pli-thumb" src="${escapeHtml(thumbUrl)}" alt="" onerror="this.style.display='none'">`
        : `<span class="pli-thumb pli-thumb-empty">🎵</span>`;

      row.innerHTML = `
        ${thumbHtml}
        <span class="pli-name">${escapeHtml(trackInfo + artistInfo)}</span>
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

    // Sync with play mode: random mode shuffles the display order
    var displayOrder = pl.slice();
    var mode = (typeof FluidAudio !== 'undefined') ? FluidAudio.playMode : 'sequential';
    if (mode === 'random' && pl.length > 1) {
      // Keep current track at its position, shuffle the rest
      var rest = displayOrder.slice(0, idx).concat(displayOrder.slice(idx + 1));
      for (var ri = rest.length - 1; ri > 0; ri--) {
        var rj = Math.floor(Math.random() * (ri + 1));
        var tmp = rest[ri]; rest[ri] = rest[rj]; rest[rj] = tmp;
      }
      displayOrder = rest.slice(0, idx).concat([displayOrder[idx]], rest.slice(idx));
    }

    for (let i = 0; i < total; i++) {
      const offset = i - center;
      let trackIndex = 0;
      if (displayOrder.length > 0) {
        trackIndex = ((idx + offset) % displayOrder.length + displayOrder.length) % displayOrder.length;
      }
      const track = displayOrder[trackIndex];

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
  BubbleChamber.refreshPlaylistListFromCache = refreshPlaylistListFromCache;
  BubbleChamber.fetchAndCachePlaylistSongs = fetchAndCachePlaylistSongs;
  BubbleChamber.renderFavoritesList = renderFavoritesList;
  BubbleChamber.getSyncedPlaylistIds = getSyncedPlaylistIds;
  BubbleChamber.filterSyncedPlaylists = filterSyncedPlaylists;
  BubbleChamber.renderQueueList = renderQueueList;
  BubbleChamber.animateLyrics = animateLyrics;

  if (typeof __FM !== 'undefined') __FM.register('bubbleChamber', [], function () { return BubbleChamber; }, { priority: 5 });
  window.BubbleChamber = BubbleChamber;
  window._fetchTrackUrl = fetchTrackUrl;
  console.log('FluidMusic Bubble Chamber Manager loaded');
})();
