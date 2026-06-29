// ============================================================
// FluidMusic — Main Application Controller
// Orchestrates all modules, render loop, and user interactions
// ============================================================
(function () {
  'use strict';

  let lastTime = 0;
  let appReady = false;

  // ── Background brightness detection for auto text contrast ──
  function detectBackgroundBrightness(element) {
    if (!element) return 0.5;
    const rect = element.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    // Sample points from behind the element using a hidden canvas
    const bgCanvas = document.getElementById('bg-canvas');
    if (!bgCanvas) return 0.5;

    try {
      const ctx = bgCanvas.getContext('2d');
      if (!ctx) return 0.5;
      // Sample a small region
      const imageData = ctx.getImageData(
        Math.max(0, cx * (bgCanvas.width / window.innerWidth)),
        Math.max(0, cy * (bgCanvas.height / window.innerHeight)),
        1, 1
      );
      if (imageData && imageData.data) {
        const [r, g, b] = imageData.data;
        // Perceived brightness (luminance formula)
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      }
    } catch (e) {
      // Fallback: use element's own background analysis
    }

    // Fallback: check if the area has mostly dark or light surroundings
    const sampleY = cy / window.innerHeight;
    // Top area tends to have desktop background (lighter), bottom darker
    return sampleY > 0.5 ? 0.3 : 0.6;
  }

  function applyTextContrast() {
    // Check key text areas
    const areas = [
      { el: document.getElementById('chamber-left'), selector: '#chamber-left' },
      { el: document.getElementById('chamber-right'), selector: '#chamber-right' },
      { el: document.getElementById('chamber-top'), selector: '#chamber-top' },
      { el: document.getElementById('song-info'), selector: null },
    ];

    areas.forEach(({ el }) => {
      if (!el) return;
      const brightness = detectBackgroundBrightness(el);
      if (brightness < 0.45) {
        el.classList.add('text-adapt-light');
        el.classList.remove('text-adapt-dark');
      } else {
        el.classList.add('text-adapt-dark');
        el.classList.remove('text-adapt-light');
      }
    });
  }

  // ── SVG icon toggles ──
  function setPlayIcon(playing) {
    const iconPlay = document.getElementById('icon-play');
    const iconPause = document.getElementById('icon-pause');
    if (iconPlay && iconPause) {
      iconPlay.style.display = playing ? 'none' : '';
      iconPause.style.display = playing ? '' : 'none';
    }
  }

  function setLikeIcon(liked) {
    const btnLike = document.getElementById('btn-like');
    if (!btnLike) return;
    const svg = btnLike.querySelector('svg');
    if (!svg) return;
    if (liked) {
      svg.setAttribute('fill', 'currentColor');
      svg.setAttribute('stroke', 'none');
    } else {
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
    }
  }

  function setPlaymodeIcon(mode) {
    const iconSeq = document.getElementById('icon-playmode-seq');
    const iconShuffle = document.getElementById('icon-playmode-shuffle');
    const iconSingle = document.getElementById('icon-playmode-single');
    if (iconSeq) iconSeq.style.display = mode === 2 ? '' : 'none';
    if (iconShuffle) iconShuffle.style.display = mode === 1 ? '' : 'none';
    if (iconSingle) iconSingle.style.display = mode === 0 ? '' : 'none';
    const btn = document.getElementById('btn-playmode');
    if (btn) {
      const titles = ['播放模式: 顺序播放', '播放模式: 随机播放', '播放模式: 单曲循环'];
      btn.title = titles[mode] || titles[0];
    }
  }

  // ── Controller button handlers ──
  function formatTime(sec) {
    if (!sec || isNaN(sec) || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  function setupControllerButtons() {
    const btnPlay = document.getElementById('btn-play');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnLike = document.getElementById('btn-like');

    const btnFx = document.getElementById('btn-fx');
    const btnVolume = document.getElementById('btn-volume');
    const progressBar = document.getElementById('progress-bar-container');
    const progressFill = document.getElementById('progress-bar-fill');
    const progressThumb = document.getElementById('progress-bar-thumb');
    const progressParticles = document.getElementById('progress-bar-particles');
    const volumeSlider = document.getElementById('volume-slider');

    let playMode = 0; // 0=sequential, 1=shuffle, 2=single-loop
    let fxOn = false;
    let isDraggingProgress = false;

    // ── Play / Pause ──
    if (btnPlay) {
      btnPlay.addEventListener('click', async () => {
        if (typeof FluidAudio !== 'undefined') {
          if (FluidAudio.audio && FluidAudio.audio.src && FluidAudio.currentTrack) {
            FluidAudio.togglePlay();
          } else if (FluidAudio.playlist.length > 0) {
            const idx = FluidAudio.playlistIndex >= 0 ? FluidAudio.playlistIndex : 0;
            const t = FluidAudio.playlist[idx];
            if ((!t.url || t.platform === 'qq') && t.id && window._fetchTrackUrl) {
              try { t.url = await window._fetchTrackUrl(t); } catch(e) {}
            }
            if (t.url) {
              FluidAudio.load(t.url, t);
              FluidAudio.play();
              if (typeof BubbleChamber !== 'undefined') {
                BubbleChamber.updateQueueDisplay(t, FluidAudio.playlist, idx);
              }
            } else {
              showToast('⚠ 无法获取播放地址');
              return;
            }
          } else {
            showToast('⚠ 队列为空');
            return;
          }
          setPlayIcon(FluidAudio.playing);
          showToast(FluidAudio.playing ? '▶ 播放' : '⏸ 暂停');
        }
      });
    }

    // ── Prev ──
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (typeof FluidAudio !== 'undefined') { FluidAudio.prev(); showToast('⏮ 上一曲'); }
      });
    }

    // ── Next ──
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (typeof FluidAudio !== 'undefined') { FluidAudio.next(); showToast('⏭ 下一曲'); }
      });
    }

    // ── Like / Add to Favorites ──
    if (btnLike) {
      btnLike.addEventListener('click', () => {
        const track = typeof FluidAudio !== 'undefined' ? FluidAudio.currentTrack : null;
        if (track && track.id && typeof Favorites !== 'undefined') {
          const added = Favorites.toggle(track);
          if (added) {
            btnLike.classList.add('liked');
            showToast('❤️ 已收藏');
          } else {
            btnLike.classList.remove('liked');
            showToast('💔 取消收藏');
          }
        }
      });
    }

    // ── Play Mode (sequential → shuffle → single-loop) ──
    const btnPlaymode = document.getElementById('btn-playmode');
    if (btnPlaymode) {
      btnPlaymode.addEventListener('click', () => {
        playMode = (playMode + 1) % 3;
        setPlaymodeIcon(playMode);
        const modeNames = ['顺序播放', '随机播放', '单曲循环'];
        if (playMode > 0) {
          btnPlaymode.classList.add('toggled');
        } else {
          btnPlaymode.classList.remove('toggled');
        }
        if (typeof FluidAudio !== 'undefined') {
          const modes = ['sequential', 'random', 'single'];
          FluidAudio.playMode = modes[playMode];
        }
        showToast('🔀 ' + modeNames[playMode]);
      });
    }


    // Init playmode icon
    setPlaymodeIcon(0);
    // ── Inline lyric observer: show in center when right chamber hidden ──
    function updateInlineLyricVisibility() {
      const chamberRight = document.getElementById('chamber-right');
      const inlineLyric = document.getElementById('inline-lyric');
      if (!inlineLyric) return;
      const isRightVisible = chamberRight && chamberRight.classList.contains('visible');
      if (isRightVisible) {
        inlineLyric.style.display = 'none';
      } else {
        inlineLyric.style.display = '';
      }
    }
    // Observe right chamber visibility changes via MutationObserver
    const chamberRight = document.getElementById('chamber-right');
    if (chamberRight) {
      const observer = new MutationObserver(updateInlineLyricVisibility);
      observer.observe(chamberRight, { attributes: true, attributeFilter: ['class'] });
    }
    // Initial state
    updateInlineLyricVisibility();
    // Expose for BubbleChamber to call
    window._updateInlineLyricVisibility = updateInlineLyricVisibility;

    // ── Queue Swap: toggle favorites ↔ playback queue covers ──
    const btnQueueSwap = document.getElementById('btn-queue-swap');
    const queueLabel = document.getElementById('queue-label');
    const queueArea = document.getElementById('queue-area');
    let queueMode = 'queue'; // 'queue' | 'favorites'
    if (btnQueueSwap) {
      btnQueueSwap.addEventListener('click', () => {
        if (queueLabel) {
          queueLabel.style.opacity = '0';
          queueLabel.style.transform = 'translateY(-6px)';
        }
        if (queueArea) {
          queueArea.querySelectorAll('.queue-item').forEach((item) => {
            item.style.transition = 'all 0.25s var(--spring-collapse)';
            item.style.opacity = '0';
            item.style.transform = 'scale(0.7) translateY(-4px)';
          });
        }
        setTimeout(() => {
          queueMode = queueMode === 'queue' ? 'favorites' : 'queue';
          if (queueMode === 'favorites') {
            if (queueLabel) queueLabel.textContent = '❤️ 收藏列表';
            const favTracks = (typeof Favorites !== 'undefined') ? Favorites.getAll() : [];
            if (typeof BubbleChamber !== 'undefined') {
              BubbleChamber.updateQueueDisplay(favTracks[0] || null, favTracks, 0);
            }
            showToast('切换到收藏列表');
          } else {
            if (queueLabel) queueLabel.textContent = '📀 播放队列';
            const pl = (typeof FluidAudio !== 'undefined') ? (FluidAudio.playlist || []) : [];
            if (typeof BubbleChamber !== 'undefined') {
              BubbleChamber.updateQueueDisplay(FluidAudio && FluidAudio.currentTrack, pl, FluidAudio ? FluidAudio.playlistIndex : 0);
            }
            showToast('切换到播放队列');
          }
          if (queueLabel) {
            queueLabel.style.opacity = '1';
            queueLabel.style.transform = 'translateY(0)';
          }
          if (queueArea) {
            queueArea.querySelectorAll('.queue-item').forEach((item) => {
              item.style.transition = 'all 0.4s var(--spring-expand)';
              item.style.opacity = '';
              item.style.transform = '';
              setTimeout(() => { item.style.transition = ''; }, 400);
            });
          }
        }, 250);
      });
    }

    // ── Queue Clear ──
    const btnQueueClear = document.getElementById('btn-queue-clear');
    if (btnQueueClear) {
      btnQueueClear.addEventListener('click', () => {
        if (queueMode === 'favorites') {
          if (typeof Favorites !== 'undefined') {
            Favorites.clear();
            if (typeof BubbleChamber !== 'undefined') BubbleChamber.renderFavoritesList();
          }
        } else {
          if (typeof FluidAudio !== 'undefined') {
            FluidAudio.playlist = [];
            FluidAudio.playlistIndex = -1;
          }
          if (typeof BubbleChamber !== 'undefined') BubbleChamber.renderQueueList();
        }
      });
    }

    // ── Queue Cover Click: click any cover in top chamber to play that track ──
    const queueAreaEl = document.getElementById('queue-area');
    if (queueAreaEl) {
      queueAreaEl.addEventListener('click', (e) => {
        const item = e.target.closest('.queue-item');
        if (!item) return;
        const idx = parseInt(item.dataset.index, 10);
        if (isNaN(idx)) return;
        // Determine which list to play from (queue vs favorites)
        const trackList = queueMode === 'favorites'
          ? ((typeof Favorites !== 'undefined') ? Favorites.getAll() : [])
          : ((typeof FluidAudio !== 'undefined') ? FluidAudio.playlist : []);
        if (idx >= 0 && idx < trackList.length) {
          const track = trackList[idx];
          if (typeof FluidAudio !== 'undefined') {
            FluidAudio.playlistIndex = idx;
            FluidAudio.setPlaylist(trackList, idx);
            // Trigger URL fetch then play
            (async () => {
              if ((!track.url || track.platform === 'qq') && track.id && window._fetchTrackUrl) {
                try { track.url = await window._fetchTrackUrl(track); } catch(e) {}
              }
              if (track.url) {
                FluidAudio.load(track.url, track);
                FluidAudio.play();
                if (typeof BubbleChamber !== 'undefined') {
                  BubbleChamber.updateQueueDisplay(track, trackList, idx);
                }
                showToast('▶ ' + (track.title || track.name || '播放'));
              } else {
                showToast('⚠ 无法获取播放地址');
              }
            })();
          }
        }
      });
    }

    // ── Playlist Back Button ──
    const btnPlaylistBack = document.getElementById('btn-playlist-back');
    if (btnPlaylistBack) {
      btnPlaylistBack.addEventListener('click', () => {
        // Go back to playlist list immediately — try cache first
        if (typeof DataCache !== 'undefined') {
          const cached = DataCache.getCachedPlaylists();
          if (cached && typeof BubbleChamber !== 'undefined') {
            BubbleChamber.setUserPlaylists(cached);
            if (typeof showToast !== 'undefined') showToast('返回歌单列表');
            return;
          }
        }
        // Fallback: re-fetch from API
        if (typeof FluidMusicApp !== 'undefined' && FluidMusicApp.syncPlaylists) {
          FluidMusicApp.syncPlaylists();
        }
      });
    }

    // ── FX / Effects Toggle (cycles foam equalizer presets) ──
    const fxPresets = ['pearl', 'deepsea', 'stardust', 'aurora'];
    let fxIndex = 0;
    if (btnFx) {
      btnFx.addEventListener('click', () => {
        fxIndex = (fxIndex + 1) % fxPresets.length;
        btnFx.classList.add('toggled');
        if (typeof FoamEqualizer !== 'undefined') {
          FoamEqualizer.setPreset(fxPresets[fxIndex]);
          showToast('🎨 特效: ' + fxPresets[fxIndex]);
        }
        setTimeout(() => btnFx.classList.remove('toggled'), 600);
      });
    }

    // ── Volume Button: hover=tooltip slider, click=mute/unmute ──
    const volumeTooltip = document.getElementById('volume-tooltip');
    let volBeforeMute = 70;
    let volHoverTimer = null;

    if (btnVolume && volumeTooltip && volumeSlider) {
      // Hover: show tooltip
      btnVolume.addEventListener('mouseenter', () => {
        clearTimeout(volHoverTimer);
        volumeTooltip.classList.add('visible');
      });
      btnVolume.addEventListener('mouseleave', () => {
        volHoverTimer = setTimeout(() => {
          volumeTooltip.classList.remove('visible');
        }, 300);
      });
      volumeTooltip.addEventListener('mouseenter', () => {
        clearTimeout(volHoverTimer);
      });
      volumeTooltip.addEventListener('mouseleave', () => {
        volumeTooltip.classList.remove('visible');
      });

      // Click: mute/unmute
      btnVolume.addEventListener('click', (e) => {
        e.stopPropagation();
        const iconOn = document.getElementById('icon-vol-on');
        const iconMute = document.getElementById('icon-vol-mute');
        if (typeof FluidAudio !== 'undefined') {
          if (FluidAudio.volume > 0.01) {
            volBeforeMute = Math.round(FluidAudio.volume * 100);
            FluidAudio.setVolume(0);
            volumeSlider.value = 0;
            if (iconOn) iconOn.style.display = 'none';
            if (iconMute) iconMute.style.display = '';
            showToast('🔇 静音');
          } else {
            const v = volBeforeMute || 70;
            FluidAudio.setVolume(v / 100);
            volumeSlider.value = v;
            if (iconOn) iconOn.style.display = '';
            if (iconMute) iconMute.style.display = 'none';
            showToast('🔊 音量 ' + v);
          }
        }
      });

      // Slider change
      volumeSlider.addEventListener('input', () => {
        const v = volumeSlider.value / 100;
        if (typeof FluidAudio !== 'undefined') FluidAudio.setVolume(v);
        const iconOn = document.getElementById('icon-vol-on');
        const iconMute = document.getElementById('icon-vol-mute');
        if (v < 0.01) {
          if (iconOn) iconOn.style.display = 'none';
          if (iconMute) iconMute.style.display = '';
        } else {
          if (iconOn) iconOn.style.display = '';
          if (iconMute) iconMute.style.display = 'none';
        }
      });
    }

    // ── Toast notification system ──
    window.showToast = function (msg, duration) {
      duration = duration || 1500;
      let toast = document.getElementById('global-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'global-toast';
        toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:99;'
          + 'padding:6px 16px;border-radius:12px;background:rgba(10,10,24,0.75);border:1px solid var(--glass-border);'
          + 'backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);'
          + 'color:var(--text-primary);font-size:11px;font-family:var(--font-main);'
          + 'opacity:0;pointer-events:none;transition:opacity 0.25s var(--spring-expand),transform 0.25s var(--spring-expand);';
        document.body.appendChild(toast);
      }
      toast.textContent = msg;
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(-8px)';
      clearTimeout(toast._timer);
      toast._timer = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(0)';
      }, duration);
    };

    // ── Progress Bar with Drag ──
    if (progressBar && progressFill && progressThumb) {
      const seekTo = (clientX) => {
        const rect = progressBar.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        progressFill.style.width = (ratio * 100) + '%';
        progressThumb.style.left = (ratio * 100) + '%';
        if (typeof FluidAudio !== 'undefined' && FluidAudio.audio) {
          FluidAudio.seek(ratio * (FluidAudio.audio.duration || 0));
        }
        return ratio;
      };

      const spawnParticle = (clientX, clientY) => {
        if (!progressParticles) return;
        const rect = progressBar.getBoundingClientRect();
        const particle = document.createElement('div');
        particle.className = 'progress-particle';
        const px = (Math.random() - 0.5) * 60;
        const py = (Math.random() - 0.5) * 40 - 20;
        particle.style.setProperty('--px', px + 'px');
        particle.style.setProperty('--py', py + 'px');
        particle.style.left = (clientX - rect.left) + 'px';
        particle.style.top = (rect.height / 2) + 'px';
        progressParticles.appendChild(particle);
        setTimeout(() => particle.remove(), 600);
      };

      progressBar.addEventListener('mousedown', (e) => {
        isDraggingProgress = true;
        progressBar.classList.add('dragging');
        const ratio = seekTo(e.clientX);
        spawnParticle(e.clientX, e.clientY);
      });

      document.addEventListener('mousemove', (e) => {
        if (!isDraggingProgress) return;
        seekTo(e.clientX);
        if (Math.random() < 0.3) spawnParticle(e.clientX, e.clientY);
      });

      document.addEventListener('mouseup', () => {
        if (isDraggingProgress) {
          isDraggingProgress = false;
          progressBar.classList.remove('dragging');
        }
      });
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
      document.getElementById('song-title').textContent = track.title || '未知歌曲';
      document.getElementById('song-artist').textContent = track.artist || '未知作者';

      // Sync particle cover — always attempt, even without explicit coverUrl
      if (typeof ParticleCover !== 'undefined') {
        if (track && track.coverUrl) {
          ParticleCover.loadImage(track.coverUrl);
        } else if (track) {
          // Try generating a cover URL from platform data
          console.log('[onTrackChange] No coverUrl for track:', track.title || track.name);
        }
      }
      // Sync top chamber queue display
      if (typeof FluidAudio !== 'undefined' && typeof BubbleChamber !== 'undefined') {
        BubbleChamber.updateQueueDisplay(track, FluidAudio.playlist || [], FluidAudio.playlistIndex);
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

      // Fetch lyrics if available
      if (track && track.id && track.platform && typeof ApiBridge !== 'undefined') {
        (async () => {
          try {
            let lyricText = '';
            if (track.platform === 'netease') {
              const data = await ApiBridge.getNeteaseLyric(track.id);
              lyricText = (data && data.lrc && data.lrc.lyric) || (data && data.tlyric && data.tlyric.lyric) || '';
            } else if (track.platform === 'qq') {
              const data = await ApiBridge.getQQLyric(track.id);
              lyricText = (data && data.lyric) || '';
            }


            if (lyricText && typeof BubbleChamber !== 'undefined') {
              BubbleChamber.setLyrics(lyricText, 0);
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
        return true;
      } else {
        console.log('No playlists found — showing empty state');
        if (typeof BubbleChamber !== 'undefined') {
          BubbleChamber.showPlaylistEmpty();
        }
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
      btnMaximize.addEventListener('click', async () => {
        if (fluidmusic.windowMaximize) {
          fluidmusic.windowMaximize();
        }
      });
    }
  }

  // ── Keyboard shortcuts ──
  function setupKeyboard() {
    window.addEventListener('keydown', (e) => {
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
  function setupRefreshButton() {
    const btn = document.getElementById('btn-refresh-playlists');
    if (btn) {
      btn.addEventListener('click', () => {
        syncPlaylists();
      });
    }
  }

  // ── Auto contrast polling ──
  let contrastTimer = null;
  function startContrastPolling() {
    applyTextContrast();
    contrastTimer = setInterval(applyTextContrast, 5000);
    window.addEventListener('resize', () => {
      clearTimeout(contrastTimer);
      contrastTimer = setTimeout(applyTextContrast, 500);
    });
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
    } else {
      layer.style.backgroundImage = '';
      layer.style.opacity = '0';
      layer.classList.remove('loaded');
    }
  };

  function initWallpaper() {
    try {
      const saved = localStorage.getItem('fluidmusic-wallpaper');
      if (saved) {
        applyWallpaper(saved);
      }
      // Apply opacity from settings (in case DIYSettings loaded first)
      const layer = document.getElementById('wallpaper-layer');
      if (layer && layer.classList.contains('loaded')) {
        const raw = localStorage.getItem('fluidmusic-settings');
        if (raw) {
          const s = JSON.parse(raw);
          if (s.wallpaperOpacity != null) layer.style.opacity = s.wallpaperOpacity;
        }
      }
    } catch(e) {}
  }

  // ── Main render loop ──
  function animate(timestamp) {
    requestAnimationFrame(animate);

    const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.1) : 0.016;
    lastTime = timestamp;

    if (typeof FluidBackground !== 'undefined' && FluidBackground.initialized) {
      FluidBackground.tick(dt);
      FluidBackground.render();
    }

    if (typeof ParticleCover !== 'undefined' && ParticleCover.initialized) {
      ParticleCover.tick(dt);
      ParticleCover.render();
    }

    if (typeof FoamSystem !== 'undefined' && FoamSystem.initialized) {
      FoamSystem.tick(dt);
      FoamSystem.render();
    if (typeof FoamSystem !== 'undefined' && typeof FoamSystem.updateFoamVisibility === 'function') {
      FoamSystem.updateFoamVisibility();
    }
    }


    // ── Progress bar + time display update ──
    if (typeof FluidAudio !== 'undefined' && FluidAudio.audio && !isNaN(FluidAudio.audio.duration)) {
      const ratio = FluidAudio.audio.currentTime / FluidAudio.audio.duration;
      const fill = document.getElementById('progress-bar-fill');
      const thumb = document.getElementById('progress-bar-thumb');
      if (fill && !document.getElementById('progress-bar-container').classList.contains('dragging')) {
        fill.style.width = (ratio * 100) + '%';
      }
      if (thumb && !document.getElementById('progress-bar-container').classList.contains('dragging')) {
        thumb.style.left = (ratio * 100) + '%';
      }
      const tc = document.getElementById('time-current');
      const td = document.getElementById('time-duration');
      if (tc) tc.textContent = formatTime(FluidAudio.audio.currentTime);
      if (td) td.textContent = formatTime(FluidAudio.audio.duration);
    }
    if (typeof FoamEqualizer !== 'undefined' && FoamEqualizer.initialized) {
      FoamEqualizer.tick(dt);
      FoamEqualizer.render();
    if (typeof Spectrum3D !== 'undefined' && Spectrum3D.initialized) {
      Spectrum3D.tick(dt);
      Spectrum3D.render();
    }
    }
  }

  // ── Initialization ──
  async function init() {
    console.log('FluidMusic starting...');

    // 0. Init i18n first
    if (typeof I18N !== 'undefined') {
      I18N.init();
    }

    // 0. Init favorites (needs to be early for like button state)
    if (typeof Favorites !== 'undefined') {
      Favorites.init();
    }

    // 1. Init audio engine
    if (typeof FluidAudio !== 'undefined') {
      FluidAudio.init();
      setupAudioCallbacks();
    }

    // 2. Init fluid background
    if (typeof FluidBackground !== 'undefined') {
      FluidBackground.init();
    }

    // 3. Init particle cover with demo image
    if (typeof ParticleCover !== 'undefined') {
      const initOk = ParticleCover.init(null, 'assets/icon.png');
      if (initOk === false) console.warn('[init] ParticleCover failed to init');
    }

    // 4. Init foam system
    if (typeof FoamSystem !== 'undefined') {
      FoamSystem.init();
    }

    // 5. Init foam equalizer (replaces old spectrum)
    if (typeof FoamEqualizer !== 'undefined') {
      FoamEqualizer.init();
    if (typeof Spectrum3D !== 'undefined') {
      Spectrum3D.init();
    }
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
    setupKeyboard();

    // ── 11. Smart startup: favorites → cache → API batch ──
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingMsg = document.getElementById('loading-msg');
    const loadingSub = document.getElementById('loading-sub');

    function updateLoading(msg, sub) {
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

    // Clean old song caches before fetching new data (avoid stale entries)
    if (typeof DataCache !== 'undefined') {
      DataCache.clearAllPlaylistSongs();
      console.log('[Startup] Old playlist song caches cleared');
    }

    // Step C: Load cached or API playlists with delays
    const hasAnyLogin = (typeof ApiBridge !== 'undefined') &&
      (ApiBridge.neteaseLoggedIn || ApiBridge.qqLoggedIn);

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
        hasRealPlaylists = true;
        // Start background pre-fetch of all playlist songs
        if (typeof DataCache !== 'undefined') {
          setTimeout(() => prefetchAllPlaylistSongs(cachedPlaylists), 500);
        }

        // Background refresh with delay
        setTimeout(async () => {
          updateLoading('更新歌单数据', '后台同步中...');
          const fresh = await syncPlaylists();
          if (fresh) {
            if (typeof DataCache !== 'undefined') {
              // syncPlaylists already calls fetchUserPlaylists internally
              // DataCache is updated in syncPlaylists via the BubbleChamber path
            }
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

    // 13. Start auto contrast detection
    startContrastPolling();

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

    if (fetchList.length === 0) {
      console.log('[Prefetch] No synced playlists to fetch');
      return;
    }
    console.log('[Prefetch] Pre-fetching', fetchList.length, 'of', allPl.length, 'synced playlists...');

    console.log('[Prefetch] Starting background fetch of', fetchList.length, 'playlists...');
    updateLoading('预缓存歌单歌曲', '0/' + fetchList.length);

    for (let i = 0; i < fetchList.length; i++) {
      const pl = fetchList[i];
      // Skip if already cached and fresh
      if (DataCache.getCachedPlaylistSongs(pl.id, pl.platform)) {
        updateLoading('预缓存歌单', (i+1) + '/' + allPl.length + ' (跳过已缓存)');
        continue;
      }
      updateLoading('预缓存歌单', (i+1) + '/' + allPl.length + ' ' + (pl.name || '').substring(0, 12));
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
