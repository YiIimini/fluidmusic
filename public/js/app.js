// ============================================================
// FluidMusic — Main Application Controller
// Orchestrates all modules, render loop, and user interactions
// ============================================================
(function () {
  'use strict';

  let lastTime = 0;
  let appReady = false;

  // ── Visual Effects Toggles ──
  // Persisted to localStorage, defaults: lightweight effects ON, heavy OFF
  const VISUAL_DEFAULTS = {
    fluidBg: true,        // Fluid background (low GPU)
    particleCover: true,  // 3D particle album cover
  };

  let _visualEnabled = { ...VISUAL_DEFAULTS };

  function loadVisualSettings() {
    try {
      const saved = localStorage.getItem('fluidmusic-visual');
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.keys(VISUAL_DEFAULTS).forEach(k => {
          if (typeof parsed[k] === 'boolean') _visualEnabled[k] = parsed[k];
        });
      }
    } catch (_) { /* keep defaults */ }
  }

  function saveVisualSettings() {
    try {
      localStorage.setItem('fluidmusic-visual', JSON.stringify(_visualEnabled));
    } catch (_) { /* ignore quota */ }
  }

  // Expose for DIY settings panel
  window._fluidVisualEnabled = _visualEnabled;
  window._fluidVisualSave = function() {
    saveVisualSettings();
    // Sync cover fallback when particle toggle changes
    _syncCoverFallback();
  };

  function _syncCoverFallback() {
    var fb = document.getElementById('cover-fallback');
    if (fb) {
      fb.style.display = _visualEnabled.particleCover ? 'none' : 'block';
    }
  }


  // ── Audio callbacks ──
  function setupAudioCallbacks() {
    if (typeof FluidAudio === 'undefined') return;

    FluidAudio.onPlay = function () {
      setPlayIcon(true);
    };

    FluidAudio.onPause = function () {
      setPlayIcon(false);
    };

    FluidAudio.onTrackChange = function (track) {
      // Emit through TS EventBus for cross-module communication
      if (window.__FM_TS && window.__FM_TS.eventBus) {
        window.__FM_TS.eventBus.emit('track:change', track);
      }

      document.getElementById('song-title').textContent = track.title || '未知歌曲';
      document.getElementById('song-artist').textContent = track.artist || '未知作者';

      // Scrobble to Last.fm
      if (typeof LastFM !== 'undefined') LastFM.onTrackChange(track);

      // Sync mini player
      if (typeof _updateMiniPlayer === 'function') _updateMiniPlayer(track);

      // Sync particle cover — always attempt
      // Update fallback cover image (always show, even if particle cover disabled)
      const fallbackImg = document.getElementById('cover-fallback');
      const coverUrl = track.coverUrl || track.cover || '';
      if (fallbackImg && coverUrl && String(coverUrl).startsWith('http')) {
        fallbackImg.src = coverUrl;
        fallbackImg.style.display = _visualEnabled.particleCover ? 'none' : 'block';
      } else if (fallbackImg) {
        fallbackImg.src = 'assets/icon.png';
        fallbackImg.style.display = _visualEnabled.particleCover ? 'none' : 'block';
      }

      if (_visualEnabled.particleCover && typeof ParticleCover !== 'undefined' && ParticleCover.initialized && track) {
        if (coverUrl && String(coverUrl).startsWith('http')) {
          ParticleCover.loadImage(coverUrl);
        } else if (coverUrl) {
          const fixed = String(coverUrl).replace(/^http:/, 'https:');
          if (fixed.startsWith('https://')) ParticleCover.loadImage(fixed);
        }
      }
      // Sync top chamber queue display + active track highlight
      if (typeof FluidAudio !== 'undefined' && typeof BubbleChamber !== 'undefined') {
        BubbleChamber.updateQueueDisplay(track, FluidAudio.playlist || [], FluidAudio.playlistIndex);
        if (typeof BubbleChamber.setActivePlaylistItem === 'function') {
          BubbleChamber.setActivePlaylistItem(FluidAudio.playlistIndex);
        }
      }

      // Sync like button with favorites
      const btnLike = document.getElementById('btn-like');
      if (btnLike && typeof Favorites !== 'undefined') {
        if (track && track.id && Favorites.has(track)) {
          btnLike.classList.add('liked');
        } else {
          btnLike.classList.remove('liked');
        }
      }

      // Fetch lyrics if available (with translation for Netease)
      if (track && track.id && track.platform && typeof ApiBridge !== 'undefined') {
        (async () => {
          try {
            let lyricText = '';
            let transText = '';
            if (track.platform === 'netease') {
              const data = await ApiBridge.getNeteaseLyric(track.id);
              lyricText = (data && data.lrc && data.lrc.lyric) || '';
              transText = (data && data.tlyric && data.tlyric.lyric) || '';
            } else if (track.platform === 'qq') {
              const data = await ApiBridge.getQQLyric(track.id);
              lyricText = (data && data.lyric) || '';
            }

            if (lyricText && typeof BubbleChamber !== 'undefined') {
              BubbleChamber.setLyrics(lyricText, 0, transText);
            }
          } catch (e) {
            console.warn('Failed to fetch lyrics:', e);
          }
        })();
      }
    };

    FluidAudio.onProgress = function (current, duration) {
      const fill = document.getElementById('progress-bar-fill');
      if (fill && duration > 0) {
        fill.style.width = (current / duration * 100) + '%';
      }
      // Sync lyrics
      if (typeof BubbleChamber !== 'undefined' && BubbleChamber.findLyricIndex) {
        const idx = BubbleChamber.findLyricIndex(current);
        if (idx >= 0) BubbleChamber.highlightLyric(idx);
      }
    };
  }

  // ── Demo playlist ──
  function loadDemoPlaylist() {
    const demoTracks = [
      { title: 'Fluid Dreams', artist: 'FluidMusic', url: '', coverUrl: 'assets/icon.png' },
      { title: 'Ocean Waves', artist: 'FluidMusic', url: '', coverUrl: 'assets/icon.png' },
      { title: 'Particle Storm', artist: 'FluidMusic', url: '', coverUrl: 'assets/icon.png' },
      { title: 'Bubble Float', artist: 'FluidMusic', url: '', coverUrl: 'assets/icon.png' },
      { title: 'Neon Rain', artist: 'FluidMusic', url: '', coverUrl: 'assets/icon.png' },
    ];

    if (typeof FluidAudio !== 'undefined') {
      FluidAudio.setPlaylist(demoTracks, 0);
    }

    if (typeof BubbleChamber !== 'undefined') {
      BubbleChamber.setPlaylist(demoTracks, 0);
      BubbleChamber.updateQueueDisplay(demoTracks[0], demoTracks, 0);
    }
  }

  // ── Sync real playlists from logged-in platforms ──
  // Returns true if at least one platform returned playlists
  let _syncPending = false;
  let _lastSyncTime = 0;

  async function syncPlaylists() {
    if (typeof ApiBridge === 'undefined') return false;
    if (_syncPending) { console.log('[syncPlaylists] Skipped (in-flight)'); return false; }
    const now = Date.now();
    if (_lastSyncTime && (now - _lastSyncTime) < 8000) { console.log('[syncPlaylists] Skipped (cooldown)'); return true; }

    _syncPending = true;

    // Show loading state
    if (typeof BubbleChamber !== 'undefined') {
      BubbleChamber.showPlaylistLoading();
    }

    try {
      const playlists = await ApiBridge.fetchUserPlaylists();
      const hasNetease = playlists.netease && playlists.netease.length > 0;
      const hasQQ = playlists.qq && playlists.qq.length > 0;

      if (hasNetease || hasQQ) {
        if (typeof BubbleChamber !== 'undefined') {
          BubbleChamber.setUserPlaylists(playlists);
        }
        console.log('Playlists synced: netease=' + (playlists.netease || []).length +
                    ', qq=' + (playlists.qq || []).length +
'');
        _lastSyncTime = Date.now();
        _syncPending = false;
        return true;
      } else {
        console.log('No playlists found — showing empty state');
        if (typeof BubbleChamber !== 'undefined') {
          BubbleChamber.showPlaylistEmpty();
        }
        _syncPending = false;
        return false;
      }
    } catch (e) {
      console.warn('Failed to sync playlists:', e);
      if (typeof BubbleChamber !== 'undefined') {
        BubbleChamber.showPlaylistEmpty();
      }
      _syncPending = false;
      return false;
    }
  }

  // ── macOS Traffic Lights (Electron only) ──
  function setupTrafficLights() {
    const tlContainer = document.getElementById('traffic-lights');
    if (!tlContainer) return;

    if (typeof fluidmusic === 'undefined') return;

    tlContainer.classList.remove('traffic-lights-hidden');

    const btnClose = document.getElementById('tl-close');
    const btnMinimize = document.getElementById('tl-minimize');
    const btnMaximize = document.getElementById('tl-maximize');

    if (btnClose) {
      btnClose.addEventListener('click', () => {
        if (fluidmusic.windowClose) fluidmusic.windowClose();
      });
    }

    if (btnMinimize) {
      btnMinimize.addEventListener('click', () => {
        if (fluidmusic.windowMinimize) fluidmusic.windowMinimize();
      });
    }

    if (btnMaximize) {
      btnMaximize.addEventListener('click', () => {
        if (fluidmusic.toggleFullscreen) {
          fluidmusic.toggleFullscreen();
        }
      });
    }
  }

  // ── Keyboard shortcuts ──
  function setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      // Desktop lyric window toggle: Cmd+Shift+L
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        if (typeof fluidmusic !== 'undefined' && fluidmusic.toggleLyrics) {
          fluidmusic.toggleLyrics();
        }
        return;
      }
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (typeof FluidAudio !== 'undefined') FluidAudio.togglePlay();
          break;
        case 'ArrowLeft':
          if (e.metaKey || e.ctrlKey) {
            if (typeof FluidAudio !== 'undefined') FluidAudio.prev();
          }
          break;
        case 'ArrowRight':
          if (e.metaKey || e.ctrlKey) {
            if (typeof FluidAudio !== 'undefined') FluidAudio.next();
          }
          break;
        case 'ArrowUp':
          if (typeof FluidAudio !== 'undefined') {
            FluidAudio.setVolume(Math.min(1, FluidAudio.volume + 0.05));
            const slider = document.getElementById('volume-slider');
            if (slider) slider.value = Math.round(FluidAudio.volume * 100);
          }
          break;
        case 'ArrowDown':
          if (typeof FluidAudio !== 'undefined') {
            FluidAudio.setVolume(Math.max(0, FluidAudio.volume - 0.05));
            const slider = document.getElementById('volume-slider');
            if (slider) slider.value = Math.round(FluidAudio.volume * 100);
          }
          break;
        case 'KeyF':
          if (typeof fluidmusic !== 'undefined' && fluidmusic.toggleFullscreen) {
            fluidmusic.toggleFullscreen();
          }
          break;
      }
    });
  }

  // ── Playlist refresh button ──
  function setupImportButton() {
    const btn = document.getElementById('btn-import-local');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      if (typeof fluidmusic === 'undefined' || !fluidmusic.importLocalFiles) {
        showToast('⚠ 本地导入需要 Electron 环境');
        return;
      }
      try {
        const result = await fluidmusic.importLocalFiles();
        if (result && result.ok && result.tracks && result.tracks.length > 0) {
          if (typeof FluidAudio !== 'undefined') {
            FluidAudio.playlist.push(...result.tracks);
            if (FluidAudio.playlistIndex < 0) FluidAudio.playlistIndex = 0;
            if (typeof BubbleChamber !== 'undefined') {
              BubbleChamber.updateQueueDisplay(FluidAudio.currentTrack, FluidAudio.playlist, FluidAudio.playlistIndex);
            }
          }
          showToast('✅ 已导入 ' + result.tracks.length + ' 首本地歌曲');
        }
      } catch (e) {
        showToast('⚠ 导入失败');
      }
    });
  }

  function setupRefreshButton() {
    const btn = document.getElementById('btn-refresh-playlists');
    if (btn) {
      btn.addEventListener('click', () => {
        syncPlaylists();
      });
    }
  }



  // ── Wallpaper loader ──
  window.applyWallpaper = function (dataUrl) {
    const layer = document.getElementById('wallpaper-layer');
    if (!layer) return;
    const opacity = document.documentElement.style.getPropertyValue('--wallpaper-opacity') || 0.5;
    if (dataUrl) {
      layer.style.backgroundImage = 'url(' + dataUrl + ')';
      layer.style.opacity = opacity;
      layer.classList.add('loaded');
      // Enhance glass blur when wallpaper is active for deep water transparency
      document.documentElement.style.setProperty('--glass-blur-amount', '18px');
      document.documentElement.style.setProperty('--chamber-alpha', '0.12');
    } else {
      layer.style.backgroundImage = '';
      layer.style.opacity = '0';
      layer.classList.remove('loaded');
      document.documentElement.style.setProperty('--glass-blur-amount', '12px');
      document.documentElement.style.setProperty('--chamber-alpha', '0.08');
    }
  };

  function initWallpaper() {
    try {
      // Apply fluidBg canvas visibility on startup
      var lbg = document.getElementById('layer-bg');
      if (lbg && _visualEnabled.fluidBg) lbg.classList.add('fluid-active');
    } catch(e) {}
    try {
      // Restore video background — reconstruct URL with current port
      if (localStorage.getItem('fluidmusic-has-bg-video') === 'true') {
        var wpLayer = document.getElementById('wallpaper-layer');
        if (wpLayer) {
          var videoUrl = window.location.origin + '/bg-video?t=' + Date.now();
          var vidHtml = '<video src="' + videoUrl + '" autoplay muted loop playsinline preload="auto" style="width:100%;height:100%;object-fit:cover;background:#0a0a14;" onerror="this.parentElement.classList.remove(\'loaded\');this.parentElement.innerHTML=\'\';localStorage.removeItem(\'fluidmusic-has-bg-video\');"></video>';
          wpLayer.innerHTML = vidHtml;
          wpLayer.classList.add('loaded');
        }
      }
      // Restore image background
      var saved = localStorage.getItem('fluidmusic-wallpaper');
      if (saved) {
        applyWallpaper(saved);
      }
      // Apply opacity from settings
      var layer = document.getElementById('wallpaper-layer');
      if (layer && layer.classList.contains('loaded')) {
        var raw = localStorage.getItem('fluidmusic-settings');
        if (raw) {
          var s = JSON.parse(raw);
          if (s.wallpaperOpacity != null) layer.style.opacity = s.wallpaperOpacity;
        }
      }
    } catch(e) {}
  }

  // ── Main render loop ──
  let _lowPowerMode = false;
  // eslint-disable-next-line no-unused-vars
  let _lastLowPowerRender = 0;
  let _lastUIUpdate = 0;
  
  // LOW_POWER_FPS kept for future adaptive rendering
// eslint-disable-next-line no-unused-vars
  const LOW_POWER_FPS = 2;       // Render at 2fps when idle
  

  function isIdle() {
    // Window hidden → full low power
    if (document.hidden) return true;
    // Audio not playing and no pending transitions → low power
    const audioIdle = (typeof FluidAudio === 'undefined' ||
                       !FluidAudio.audio ||
                       FluidAudio.audio.paused);
    // Keep full rate during cover transitions
    const hasTransition = (typeof ParticleCover !== 'undefined' &&
                           ParticleCover.initialized &&
                           typeof ParticleCover._transitioning !== 'undefined' &&
                           ParticleCover._transitioning);
    return audioIdle && !hasTransition;
  }

  function updateLowPowerMode() {
    const wasLow = _lowPowerMode;
    _lowPowerMode = isIdle();
    if (!_lowPowerMode && wasLow) {
      lastTime = performance.now(); // reset dt to avoid jump
    }
    if (_lowPowerMode && !wasLow) {
      _lastLowPowerRender = performance.now(); // allow one immediate low-power frame
    }
  }

  // Visibility changes (window hide/show)
  document.addEventListener('visibilitychange', () => {
    updateLowPowerMode();
  });

  function animate(timestamp) {
    requestAnimationFrame(animate);

    updateLowPowerMode();

    // Full low power: window hidden — skip everything
    if (document.hidden) {
      lastTime = timestamp;
      return;
    }

    // Idle low power: audio paused, no transition — skip ALL rendering
    if (_lowPowerMode) {
      lastTime = timestamp;
      return;
    }

    const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.1) : 0.016;
    lastTime = timestamp;

    // ── Unified visual rendering via shared WebGL context ──
    const V = _visualEnabled;
    if (typeof RendererManager !== 'undefined' && RendererManager.initialized) {
      // Tick all visual modules (in registration order) — only if enabled
      if (V.fluidBg && typeof FluidBackground !== 'undefined' && FluidBackground.initialized) {
        FluidBackground.tick(dt);
      }
      if (V.particleCover && typeof ParticleCover !== 'undefined' && ParticleCover.initialized) {
        ParticleCover.tick(dt);
      }
      // Single render call composites all layers
      RendererManager.render();
    } else {
      // Fallback: legacy per-module rendering
      if (V.fluidBg && typeof FluidBackground !== 'undefined' && FluidBackground.initialized) {
        FluidBackground.tick(dt);
        FluidBackground.render();
      }
      if (V.particleCover && typeof ParticleCover !== 'undefined' && ParticleCover.initialized) {
        ParticleCover.tick(dt);
        ParticleCover.render();
      }
    }

    // Audio-reactive lyric animation
    if (typeof BubbleChamber !== 'undefined' && BubbleChamber.animateLyrics) {
      BubbleChamber.animateLyrics();
    }

    // ── Progress bar + time display update (throttled to 250ms) ──
    if (typeof FluidAudio !== 'undefined' && FluidAudio.audio && !isNaN(FluidAudio.audio.duration)) {
      if (timestamp - _lastUIUpdate > 250) {
        _lastUIUpdate = timestamp;
        const ratio = FluidAudio.audio.currentTime / FluidAudio.audio.duration;
        const fill = document.getElementById('progress-bar-fill');
        const thumb = document.getElementById('progress-bar-thumb');
        const container = document.getElementById('progress-bar-container');
        if (fill && container && !container.classList.contains('dragging')) {
          fill.style.width = (ratio * 100) + '%';
        }
        if (thumb && container && !container.classList.contains('dragging')) {
          thumb.style.left = (ratio * 100) + '%';
        }
        const tc = document.getElementById('time-current');
        const td = document.getElementById('time-duration');
        if (tc) tc.textContent = formatTime(FluidAudio.audio.currentTime);
        if (td) td.textContent = formatTime(FluidAudio.audio.duration);
      }
    }
  }

  // ── Initialization ──
  async function init() {
    console.log('FluidMusic starting...');

    // 0. Load visual settings
    loadVisualSettings();
    console.log('[init] Visual settings:', JSON.stringify(_visualEnabled));

    // 0. Init i18n first
    if (typeof I18N !== 'undefined') {
      I18N.init();
    }

    // 0. Init favorites, custom playlists, lastfm
    if (typeof LastFM !== 'undefined') {
      LastFM.init();
    }
    if (typeof CustomPlaylists !== 'undefined') {
      CustomPlaylists.init();
    }
    if (typeof Favorites !== 'undefined') {
      Favorites.init();
    }

    // 0.5 Init shared WebGL renderer (must come before visual modules)
    if (typeof RendererManager !== 'undefined') {
      RendererManager.init();
    }

    // 1. Init audio engine
    if (typeof FluidAudio !== 'undefined') {
      FluidAudio.init();
      setupAudioCallbacks();
    }

    // 2. Init fluid background (registers with RendererManager)
    if (_visualEnabled.fluidBg && typeof FluidBackground !== 'undefined') {
      FluidBackground.init();
    }

    // 3. Init particle cover with demo image (heavy — disabled by default)
    if (_visualEnabled.particleCover && typeof ParticleCover !== 'undefined') {
      const initOk = ParticleCover.init(null, 'assets/icon.png');
      if (initOk === false) {
        console.warn('[init] ParticleCover failed to init');
      } else {
        console.log('[init] ParticleCover init OK');
      }
    } else {
      console.log('[init] ParticleCover disabled (toggle in DIY settings)');
    }

    // 6. Init bubble chambers
    if (typeof BubbleChamber !== 'undefined') {
      BubbleChamber.init();
    }

    // 7. Init API bridge (populates cookieStore, fetches profiles)
    let hasRealPlaylists = false;
    if (typeof ApiBridge !== 'undefined') {
      await ApiBridge.init();
    }

    // Listen for login events to re-sync playlists
    window.addEventListener('fluidmusic:login', () => {
      syncPlaylists();
    });

    window.addEventListener('playlists-updated', (e) => {
      if (e.detail && e.detail.playlists) {
        if (typeof BubbleChamber !== 'undefined' && BubbleChamber.setUserPlaylists) {
          BubbleChamber.setUserPlaylists(e.detail.playlists);
        }
      } else {
        syncPlaylists();
      }
    });

    window.addEventListener('fluidmusic:locale-change', () => {
      if (typeof BubbleChamber !== 'undefined') BubbleChamber.refreshPlaylistLabels();
    });

    // 7.5 Init search module
    if (typeof FluidSearch !== 'undefined') {
      FluidSearch.init();
    }

    // 8. Init user panel overlay
    if (typeof UserPanel !== 'undefined') {
      UserPanel.init();
    }

    // 9. Init DIY settings
    if (typeof DIYSettings !== 'undefined') {
      DIYSettings.init();
    }

    // 9.5 Init wallpaper
    initWallpaper();

    // 10. Setup UI controls
    setupTrafficLights();
    setupControllerButtons();
    setupRefreshButton();
    setupImportButton();
    setupKeyboard();

    // ── 11. Smart startup: favorites → cache → API batch ──
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingMsg = document.getElementById('loading-msg');
    const loadingSub = document.getElementById('loading-sub');

    function updateLoading(msg, sub) {
  window._updateLoading = updateLoading;
      if (loadingMsg) loadingMsg.textContent = msg;
      if (loadingSub) loadingSub.textContent = sub || '';
    }

    // Step A: Show favorites immediately (instant, from localStorage)
    if (typeof Favorites !== 'undefined') {
      const favs = Favorites.getAll();
      if (favs.length > 0) {
        updateLoading('加载收藏列表', favs.length + ' 首已收藏');
        if (typeof FluidAudio !== 'undefined') {
          FluidAudio.setPlaylist(favs, -1);
        }
        if (typeof BubbleChamber !== 'undefined') {
          BubbleChamber.updateQueueDisplay(null, favs, -1);
        }
      }
    }

    // Step B: Check cache for playlists
    let cachedPlaylists = null;
    if (typeof DataCache !== 'undefined') {
      cachedPlaylists = DataCache.getCachedPlaylists();
    }

    // KEEP cached songs — only refresh in background, never wipe
    console.log('[Startup] Preserving existing caches, background refresh only');


    // Step C: Load cached or API playlists with delays
    const hasAnyLogin = (typeof ApiBridge !== 'undefined') &&
      (ApiBridge.neteaseLoggedIn || ApiBridge.qqLoggedIn);
    console.log('[Startup] hasAnyLogin:', hasAnyLogin, '| netease:', ApiBridge && ApiBridge.neteaseLoggedIn, '| qq:', ApiBridge && ApiBridge.qqLoggedIn, '| cachedPlaylists:', !!cachedPlaylists);

    if (hasAnyLogin) {
      updateLoading('同步歌单数据', '正在从服务器获取最新数据...');

      if (cachedPlaylists) {
        // Show cached data immediately
        updateLoading('加载缓存歌单', '显示上次同步的数据...');
        if (typeof BubbleChamber !== 'undefined') {
          BubbleChamber.setUserPlaylists(cachedPlaylists);
        }
        if (typeof DataCache !== 'undefined') {
          DataCache.cachePlaylists(cachedPlaylists); // refresh timestamp
        }
        // eslint-disable-next-line no-unused-vars
        hasRealPlaylists = true;
        // Start background pre-fetch of all playlist songs
        if (typeof DataCache !== 'undefined') {
          setTimeout(() => prefetchAllPlaylistSongs(cachedPlaylists), 500);
        }

        // Background refresh: only if playlist cache is stale (>6h since last fetch)
        setTimeout(async () => {
          const cacheEntry = typeof DataCache !== 'undefined' ? DataCache.get('playlists') : null;
          const isStale = !cacheEntry || (Date.now() - cacheEntry.ts) > 6 * 60 * 60 * 1000;
          if (isStale) {
            console.log('[Startup] Playlist cache stale, background refresh...');
            updateLoading('更新歌单数据', '后台同步中...');
            const fresh = await syncPlaylists();
            if (fresh && typeof DataCache !== 'undefined') {
              // Re-run prefetch for fresh playlists in background
              const latest = DataCache.getCachedPlaylists();
              if (latest) setTimeout(() => prefetchAllPlaylistSongs(latest), 1000);
            }
          } else {
            console.log('[Startup] Playlist cache fresh, skipping API refresh');
          }
          if (loadingOverlay) loadingOverlay.classList.add('hidden');
        }, 2000);
      } else {
        // No cache, first-time login — batch fetch with delays
        updateLoading('首次同步歌单', '请稍候，正在获取数据...');

        // Batch fetch: one platform at a time with delay
        const platforms = [];
        if (ApiBridge.neteaseLoggedIn) platforms.push('netease');
        if (ApiBridge.qqLoggedIn) platforms.push('qq');

        if (platforms.length > 0 && typeof DataCache !== 'undefined') {
          for (let i = 0; i < platforms.length; i++) {
            updateLoading('同步歌单 ' + (i+1) + '/' + platforms.length,
              ({netease:'网易云音乐', qq:'QQ音乐'})[platforms[i]]);
            try {
              const partial = {};
              // Fetch single platform
              if (platforms[i] === 'netease') {
                const data = await ApiBridge.fetchApi('/api/netease/user/playlist', {}, 'netease');
                if (data && data.playlist) {
                  partial.netease = data.playlist.map(pl => ({
                    id: pl.id, name: pl.name, coverUrl: pl.coverImgUrl || '',
                    trackCount: pl.trackCount || 0, platform: 'netease'
                  }));
                }
              } else if (platforms[i] === 'qq') {
                const data = await ApiBridge.fetchApi('/api/qq/user/playlist', {}, 'qq', 'GET');
                // fcg_user_created_diss response: { code: 0, data: { disslist: [...] } }
                if (data && data.code === 0 && data.data && Array.isArray(data.data.disslist)) {
                  partial.qq = data.data.disslist.map(pl => ({
                    id: pl.dissid || pl.tid || String(pl.id || ''),
                    name: pl.diss_name || pl.name || pl.title || pl.dirname || '',
                    coverUrl: (pl.diss_cover || pl.logo || pl.picurl || pl.cover || '').replace(/^http:/, 'https:'),
                    trackCount: pl.song_cnt || pl.songnum || pl.song_count || 0, platform: 'qq'


                  }));
                }
              }

              // Merge into cached
              if (cachedPlaylists) {
                Object.assign(cachedPlaylists, partial);
              } else {
                cachedPlaylists = { netease: [], qq: [], ...partial };
              }
              // Update UI incrementally
              if (typeof BubbleChamber !== 'undefined') {
                BubbleChamber.setUserPlaylists(cachedPlaylists);
              }
            } catch(e) {
              console.warn('Batch fetch failed for', platforms[i], e);
            }
            // Delay between platforms
            if (i < platforms.length - 1) {
              await new Promise(r => setTimeout(r, 1500));
            }
          }
          // Cache final result
          DataCache.cachePlaylists(cachedPlaylists);
          // eslint-disable-next-line no-unused-vars
        hasRealPlaylists = true;
        }
          // Start background pre-fetch of all playlist songs
          if (typeof DataCache !== 'undefined') {
            setTimeout(() => prefetchAllPlaylistSongs(cachedPlaylists), 1000);
          }
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
      }
    } else {
      // No login → show cached data or demo
      if (cachedPlaylists) {
        updateLoading('加载缓存数据', '上次同步的歌单');
        if (typeof BubbleChamber !== 'undefined') {
          BubbleChamber.setUserPlaylists(cachedPlaylists);
        }
        // eslint-disable-next-line no-unused-vars
        hasRealPlaylists = true;
        setTimeout(() => {
          if (loadingOverlay) loadingOverlay.classList.add('hidden');
        }, 500);
      } else {
        updateLoading('准备就绪', '登录后可同步在线歌单');
        loadDemoPlaylist();
        setTimeout(() => {
          if (loadingOverlay) loadingOverlay.classList.add('hidden');
        }, 800);
      }
    }

    // Hide overlay after timeout (fallback)
    setTimeout(() => {
      if (loadingOverlay && !loadingOverlay.classList.contains('hidden')) {
        loadingOverlay.classList.add('hidden');
      }
    }, 15000);

    // 12. Also handle later logins — capture playlist data for caching
    const origSetUserPlaylists = typeof BubbleChamber !== 'undefined' ? BubbleChamber.setUserPlaylists : null;
    if (origSetUserPlaylists && typeof DataCache !== 'undefined') {
      const orig = BubbleChamber.setUserPlaylists;
      BubbleChamber.setUserPlaylists = function(pl) {
        DataCache.cachePlaylists(pl);
        return orig.call(BubbleChamber, pl);
      };
    }

    // 12. Setup window state handler
    if (typeof fluidmusic !== 'undefined' && fluidmusic.onWindowState) {
      fluidmusic.onWindowState((state) => {
        if (state.isFullScreen !== undefined) {
          // Update any fullscreen-dependent UI
        }
      });
    }

    // 12.5 Wire macOS native events (menu bar, dock, media keys)
    if (typeof fluidmusic !== 'undefined') {
      if (fluidmusic.onMediaControl) {
        fluidmusic.onMediaControl((action) => {
          switch (action) {
            case 'toggle':
              if (typeof FluidAudio !== 'undefined') FluidAudio.togglePlay();
              break;
            case 'play':
              if (typeof FluidAudio !== 'undefined' && FluidAudio.audio && FluidAudio.audio.paused) FluidAudio.play();
              break;
            case 'pause':
              if (typeof FluidAudio !== 'undefined' && !FluidAudio.audio?.paused) FluidAudio.pause();
              break;
            case 'next':
              if (typeof FluidAudio !== 'undefined') FluidAudio.next();
              break;
            case 'prev':
              if (typeof FluidAudio !== 'undefined') FluidAudio.prev();
              break;
            case 'vol-up':
              if (typeof FluidAudio !== 'undefined') {
                FluidAudio.setVolume(Math.min(1, FluidAudio.volume + 0.05));
              }
              break;
            case 'vol-down':
              if (typeof FluidAudio !== 'undefined') {
                FluidAudio.setVolume(Math.max(0, FluidAudio.volume - 0.05));
              }
              break;
          }
        });
      }
      if (fluidmusic.onOpenSettings) {
        fluidmusic.onOpenSettings(() => {
          if (typeof DIYSettings !== 'undefined' && DIYSettings.toggle) {
            DIYSettings.toggle();
          }
        });
      }
      if (fluidmusic.onThemeChanged) {
        fluidmusic.onThemeChanged((theme) => {
          document.documentElement.setAttribute('data-theme', theme);
        });
      }
    }

    // 13. Start auto contrast detection
    if (typeof VisualContrast !== "undefined") VisualContrast.startContrastPolling();

    appReady = true;
    console.log('FluidMusic ready!');

    // Start render loop
    lastTime = performance.now();
    requestAnimationFrame(animate);
  }

  // ── Start when DOM is ready ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ── Background pre-fetch all playlist songs into cache ──
  async function prefetchAllPlaylistSongs(playlists) {
    if (!playlists || typeof ApiBridge === 'undefined' || typeof DataCache === 'undefined') return;
    const allPl = [...(playlists.netease || []), ...(playlists.qq || [])];
    if (allPl.length === 0) return;

    // Filter by user-selected synced playlists
    let syncedIds = {};
    try { syncedIds = JSON.parse(localStorage.getItem('fluidmusic_synced_playlists') || '{}'); } catch(e) {}
    const fetchList = allPl.filter(pl => {
      const platformIds = syncedIds[pl.platform] || {};
      return !!platformIds[pl.id];
    });

    // Auto-sync all playlists if none are explicitly synced
    if (fetchList.length === 0) {
      console.log('[Prefetch] No synced playlists — auto-syncing all ' + allPl.length + ' playlists');
      allPl.forEach(pl => {
        if (!syncedIds[pl.platform]) syncedIds[pl.platform] = {};
        syncedIds[pl.platform][pl.id] = true;
      });
      localStorage.setItem('fluidmusic_synced_playlists', JSON.stringify(syncedIds));
      // Re-filter now that all are synced
      fetchList.push(...allPl);
    }
    console.log('[Prefetch] Pre-fetching', fetchList.length, 'of', allPl.length, 'synced playlists...');

    console.log('[Prefetch] Starting background fetch of', fetchList.length, 'playlists...');
    if (window._updateLoading) window._updateLoading('预缓存歌单歌曲', '0/' + fetchList.length);

    for (let i = 0; i < fetchList.length; i++) {
      const pl = fetchList[i];
      if (DataCache.getCachedPlaylistSongs(pl.id, pl.platform)) {
        if (window._updateLoading) window._updateLoading('预缓存歌单', (i+1) + '/' + allPl.length + ' (跳过已缓存)');
        continue;
      }
      if (window._updateLoading) window._updateLoading('预缓存歌单', (i+1) + '/' + allPl.length + ' ' + (pl.name || '').substring(0, 12));
      try {
        let tracks = [];
        if (pl.platform === 'netease') {
          const data = await ApiBridge.getNeteasePlaylist(pl.id);
          const plData = (data && (data.playlist || data.result));
          if (plData && plData.tracks) {
            tracks = plData.tracks
              .filter(t => { if (!t.id || !t.name) return false; if (t.status === -1 || t.noCopyrightRcmd) return false; if (t.fee > 0 && t.privilege && t.privilege.st != null && t.privilege.st < 0) return false; return true; })
              .map(t => ({
                title: t.name,
                artist: (t.ar || []).map(a => a.name).join('/'),
                url: '',
                coverUrl: ((t.al && t.al.picUrl) || pl.coverUrl || '').replace(/^http:/, 'https:'),
                id: t.id, platform: 'netease'
              }));
          }
        } else if (pl.platform === 'qq') {
          const data = await ApiBridge.getQQPlaylist(pl.id);
          if (data && data.cdlist && data.cdlist[0] && data.cdlist[0].songlist) {
            tracks = data.cdlist[0].songlist
              .filter(t => { if (!t.songmid && !t.id) return false; if (!t.name && !t.songname) return false; if (t.pay && (t.pay.pay_play === 1 || t.pay.pay_down === 1)) return false; if (t.action && t.action.switch) return false; if (t.status != null && t.status < 0) return false; return true; })
              .map(t => ({
                title: t.name || t.songname || '未知',
                artist: (t.singer || []).map(s => s.name).join('/') || '未知',
                url: '',
                coverUrl: ((t.albumurl || t.albummid ? 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + t.albummid + '.jpg' : '') || pl.coverUrl || '').replace(/^http:/, 'https:'),
                id: t.songmid || t.id, platform: 'qq'
              }));
          }
        }
        if (tracks.length > 0) {
          DataCache.cachePlaylistSongs(pl.id, pl.platform, tracks);
          console.log('[Prefetch] Cached', tracks.length, 'songs for', pl.platform, pl.name);
        }
      } catch (e) {
        console.warn('[Prefetch] Failed for', pl.platform, pl.name, ':', e.message);
      }
      // Delay between playlist fetches to avoid rate-limit
      if (i < fetchList.length - 1) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }
    console.log('[Prefetch] Complete — all playlist songs cached');
  }


  // ── Export for external control ──
  window.FluidMusicApp = {
    isReady: () => appReady,
    syncPlaylists: syncPlaylists,
    togglePlay: () => { if (typeof FluidAudio !== 'undefined') FluidAudio.togglePlay(); },
    nextTrack: () => { if (typeof FluidAudio !== 'undefined') FluidAudio.next(); },
    prevTrack: () => { if (typeof FluidAudio !== 'undefined') FluidAudio.prev(); },
    getQueueMode: () => (typeof queueMode !== 'undefined' ? queueMode : 'queue'),
  };

  console.log('FluidMusic App Controller loaded');
})();
