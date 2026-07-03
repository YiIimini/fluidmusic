// ============================================================
// FluidMusic — Controllers Module
// SVG icon toggles, playback controls, mini player, playmode,
// sleep timer, queue management, inline lyric observer,
// showCustomDialog, progress bar, volume control
// Extracted from app.js v1.1.0
// ============================================================
(function () {
  'use strict';

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
    if (iconSeq) iconSeq.style.display = mode === 0 ? '' : 'none';
    if (iconShuffle) iconShuffle.style.display = mode === 1 ? '' : 'none';
    if (iconSingle) iconSingle.style.display = mode === 2 ? '' : 'none';
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

  // eslint-disable-next-line no-unused-vars
  function setupControllerButtons() {
    const btnPlay = document.getElementById('btn-play');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnLike = document.getElementById('btn-like');

    const btnVolume = document.getElementById('btn-volume');
    const progressBar = document.getElementById('progress-bar-container');
    const progressFill = document.getElementById('progress-bar-fill');
    const progressThumb = document.getElementById('progress-bar-thumb');
    const volumeSlider = document.getElementById('volume-slider');

    let playMode = 0; // 0=sequential, 1=shuffle, 2=single-loop
    // fxOn unused
    let isDraggingProgress = false;

    // ── Mini Player ──
    const miniPlayer = document.getElementById('mini-player');
    const btnMiniRestore = document.getElementById('btn-mini-restore');
    const btnMiniClose = document.getElementById('btn-mini-close');
    const btnMiniPlay = document.getElementById('btn-mini-play');
    const btnMiniPrev = document.getElementById('btn-mini-prev');
    const btnMiniNext = document.getElementById('btn-mini-next');

    function updateMiniPlayer(track) {
      if (!miniPlayer || miniPlayer.style.display === 'none') return;
      const title = document.getElementById('mini-title');
      const artist = document.getElementById('mini-artist');
      const cover = document.getElementById('mini-cover');
      if (title) title.textContent = track ? (track.title || '未知') : '未播放';
      if (artist) artist.textContent = track ? (track.artist || '—') : '—';
      if (cover && track && track.coverUrl) {
        cover.style.backgroundImage = 'url(' + track.coverUrl + ')';
      }
    }

    function showMiniPlayer() {
      if (!miniPlayer) return;
      miniPlayer.style.display = '';
      miniPlayer.style.opacity = '1';
      miniPlayer.style.transform = 'scale(1)';
      updateMiniPlayer(typeof FluidAudio !== 'undefined' ? FluidAudio.currentTrack : null);
    }

    function hideMiniPlayer() {
      if (!miniPlayer) return;
      miniPlayer.style.opacity = '0';
      miniPlayer.style.transform = 'scale(0.9)';
      setTimeout(() => { miniPlayer.style.display = 'none'; }, 300);
    }

    // Toggle with Cmd+Shift+M
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        if (miniPlayer && miniPlayer.style.display !== 'none') {
          hideMiniPlayer();
        } else {
          showMiniPlayer();
        }
      }
    });

    if (btnMiniRestore) btnMiniRestore.addEventListener('click', hideMiniPlayer);
    if (btnMiniClose) btnMiniClose.addEventListener('click', hideMiniPlayer);

    if (btnMiniPlay) {
      btnMiniPlay.addEventListener('click', () => {
        if (typeof FluidAudio !== 'undefined') {
          FluidAudio.togglePlay();
          btnMiniPlay.textContent = FluidAudio.playing ? '⏸' : '▶';
        }
      });
    }
    if (btnMiniPrev) {
      btnMiniPrev.addEventListener('click', () => {
        if (typeof FluidAudio !== 'undefined') FluidAudio.prev();
      });
    }
    if (btnMiniNext) {
      btnMiniNext.addEventListener('click', () => {
        if (typeof FluidAudio !== 'undefined') FluidAudio.next();
      });
    }

    // Drag mini player
    if (miniPlayer) {
      const header = document.getElementById('mini-player-header');
      let dragX = 0, dragY = 0;
      if (header) {
        header.addEventListener('mousedown', (e) => {
          dragX = e.clientX - miniPlayer.offsetLeft;
          dragY = e.clientY - miniPlayer.offsetTop;
          
          const onDrag = (ev) => {
            miniPlayer.style.left = (ev.clientX - dragX) + 'px';
            miniPlayer.style.top = (ev.clientY - dragY) + 'px';
            miniPlayer.style.right = 'auto';
            miniPlayer.style.bottom = 'auto';
          };
          const onDragEnd = () => {
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('mouseup', onDragEnd);
          };
          document.addEventListener('mousemove', onDrag);
          document.addEventListener('mouseup', onDragEnd);
        });
      }
    }

    // Expose for external use
    window._showMiniPlayer = showMiniPlayer;
    window._hideMiniPlayer = hideMiniPlayer;
    window._updateMiniPlayer = updateMiniPlayer;

    // ── Play / Pause ──
    if (btnPlay) {
      btnPlay.addEventListener('click', async () => {
        if (typeof FluidAudio !== 'undefined') {
          if (FluidAudio.audio && FluidAudio.audio.src && FluidAudio.currentTrack) {
            FluidAudio.togglePlay();
          } else if (FluidAudio.playlist.length > 0) {
            const idx = FluidAudio.playlistIndex >= 0 ? FluidAudio.playlistIndex : 0;
            const t = FluidAudio.playlist[idx];
            await window._ensureTrackUrl(t);
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


    // Init playmode icon from settings
    var savedMode = 0;
    if (typeof DIYSettings !== 'undefined' && DIYSettings.settings && DIYSettings.settings.playMode) {
      var modeMap = { sequential: 0, random: 1, single: 2 };
      savedMode = modeMap[DIYSettings.settings.playMode] || 0;
      if (typeof FluidAudio !== 'undefined') FluidAudio.playMode = DIYSettings.settings.playMode;
    }
    playMode = savedMode;
    setPlaymodeIcon(playMode);
    if (playMode > 0) {
      var bpm = document.getElementById('btn-playmode');
      if (bpm) bpm.classList.add('toggled');
    }
    // ── Inline lyric observer: show in center when right chamber hidden ──
    function updateInlineLyricVisibility() {
      const chamberRight = document.getElementById('chamber-right');
      const inlineLyric = document.getElementById('inline-lyric');
      if (!inlineLyric) return;
      // Respect user preference: 'show' = always visible
      if (inlineLyric.dataset.mode === 'show') {
        inlineLyric.style.display = '';
        return;
      }
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

    // ── Sleep Timer ──
    let sleepTimerId = null;
    let sleepEndTime = 0;
    const SLEEP_PRESETS = [0, 15, 30, 45, 60]; // minutes, 0 = off
    let sleepPresetIdx = 0;

    const btnSleep = document.getElementById('btn-sleep');
    const sleepDisplay = document.getElementById('sleep-timer-display');

    function updateSleepDisplay() {
      if (!sleepDisplay) return;
      if (!sleepTimerId || sleepEndTime <= 0) {
        sleepDisplay.style.display = 'none';
        if (btnSleep) btnSleep.classList.remove('toggled');
        return;
      }
      const remaining = Math.max(0, Math.ceil((sleepEndTime - Date.now()) / 1000));
      const min = Math.floor(remaining / 60);
      const sec = remaining % 60;
      sleepDisplay.style.display = '';
      sleepDisplay.textContent = min + ':' + String(sec).padStart(2, '0');
      if (btnSleep) btnSleep.classList.add('toggled');
    }

    function startSleepTimer(minutes) {
      clearInterval(sleepTimerId);
      if (minutes <= 0) {
        sleepEndTime = 0;
        updateSleepDisplay();
        showToast('⏰ 睡眠定时器已关闭');
        return;
      }
      sleepEndTime = Date.now() + minutes * 60 * 1000;
      showToast('⏰ 睡眠定时器: ' + minutes + ' 分钟');
      updateSleepDisplay();

      sleepTimerId = setInterval(() => {
        updateSleepDisplay();
        if (Date.now() >= sleepEndTime) {
          clearInterval(sleepTimerId);
          sleepTimerId = null;
          sleepEndTime = 0;
          if (typeof FluidAudio !== 'undefined' && FluidAudio.playing) {
            FluidAudio.pause();
            showToast('😴 睡眠定时结束，播放已暂停');
          }
          updateSleepDisplay();
        }
      }, 1000);
    }

    if (btnSleep) {
      btnSleep.addEventListener('click', () => {
        sleepPresetIdx = (sleepPresetIdx + 1) % SLEEP_PRESETS.length;
        startSleepTimer(SLEEP_PRESETS[sleepPresetIdx]);
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
              await window._ensureTrackUrl(track);
              if (track.url) {
                FluidAudio.load(track.url, track);
                FluidAudio.play();
                if (typeof BubbleChamber !== 'undefined') {
                  BubbleChamber.updateQueueDisplay(track, trackList, idx);
                }
                showToast('▶ ' + (track.title || track.name || '播放'));
              } else {
                showToast('⚠ 无法获取播放地址');
                // Auto-skip to next track after 1.5s
                setTimeout(function() {
                  if (typeof FluidAudio !== 'undefined' && FluidAudio.playlist && FluidAudio.playlist.length > 1) {
                    FluidAudio.next();
                  }
                }, 1500);
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

    // ── EQ / Audio Equalizer Toggle (cycles presets) ──
    const btnEQ = document.getElementById('btn-eq');
    if (btnEQ) {
      btnEQ.addEventListener('click', () => {
        if (typeof FluidAudio !== 'undefined' && FluidAudio.toggleEQ) {
          FluidAudio.toggleEQ();
          if (FluidAudio.eqEnabled) {
            btnEQ.classList.add('toggled');
          } else {
            btnEQ.classList.remove('toggled');
          }
        }
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
      // Sync volume from settings on startup
      if (typeof DIYSettings !== 'undefined' && DIYSettings.settings && DIYSettings.settings.volume != null) {
        var savedVol = Math.round(DIYSettings.settings.volume * 100);
        volumeSlider.value = savedVol;
        if (typeof FluidAudio !== 'undefined') FluidAudio.setVolume(DIYSettings.settings.volume);
        // Update volume icon
        var vid = document.getElementById('icon-volume-high');
        if (!vid) vid = document.getElementById('icon-volume-mid');
        if (vid) vid.style.display = savedVol > 0 ? '' : 'none';
      }

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

    // ── Custom Dialog (replaces native confirm/alert with styled UI) ──
    window.showCustomDialog = function (title, message, buttons) {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);';

      const btnHtml = (buttons || [{ text: '确定', style: 'primary' }]).map((b, i) => {
        const isPrimary = b.style === 'primary' || !b.style;
        const isDanger = b.style === 'danger';
        const bg = isDanger ? 'rgba(220,60,60,0.8)' : isPrimary ? 'var(--accent-color)' : 'transparent';
        const border = isPrimary || isDanger ? 'none' : '1px solid var(--glass-border)';
        return '<button class="custom-dialog-btn" data-idx="' + i + '" style="padding:7px 18px;border-radius:8px;border:' + border + ';background:' + bg + ';color:' + (isPrimary || isDanger ? '#fff' : 'var(--text-dim)') + ';cursor:pointer;font-size:12px;font-family:var(--font-main);transition:all 0.2s;">' + b.text + '</button>';
      }).join('');

      overlay.innerHTML = '<div style="background:rgba(14,14,28,0.96);border:1px solid var(--glass-border);border-radius:14px;padding:22px;width:340px;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);box-shadow:0 20px 60px rgba(0,0,0,0.5);"><div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">' + title + '</div><div style="font-size:12px;color:var(--text-dim);line-height:1.5;margin-bottom:16px;">' + message + '</div><div style="display:flex;gap:8px;justify-content:flex-end;">' + btnHtml + '</div></div>';
      document.body.appendChild(overlay);

      const close = () => overlay.remove();
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

      overlay.querySelectorAll('.custom-dialog-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx, 10);
          if (buttons && buttons[idx] && buttons[idx].action) {
            buttons[idx].action();
          }
          close();
        });
        btn.addEventListener('mouseenter', function() { this.style.opacity = '0.85'; });
        btn.addEventListener('mouseleave', function() { this.style.opacity = '1'; });
      });
    };

    // ── Toast notification system ──
    window.showToast = function (msg, duration) {
      duration = duration || 1500;
      let toast = document.getElementById('global-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'global-toast';
        toast.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:200;'
          + 'padding:8px 16px;border-radius:10px;background:rgba(10,10,24,0.9);border:1px solid rgba(255,255,255,0.1);'
          + 'box-shadow:0 4px 16px rgba(0,0,0,0.3);'
          + 'color:#fff;font-size:13px;font-family:var(--font-main);'
          + 'opacity:0;pointer-events:none;transition:opacity 0.3s ease-out,transform 0.3s ease-out;';
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

      progressBar.addEventListener('mousedown', (e) => {
        isDraggingProgress = true;
        progressBar.classList.add('dragging');
        progressBar.setPointerCapture(e.pointerId || 1);
        seekTo(e.clientX);
      });

      progressBar.addEventListener('pointermove', (e) => {
        if (!isDraggingProgress) return;
        seekTo(e.clientX);
      });

      progressBar.addEventListener('pointerup', () => {
        if (isDraggingProgress) {
          isDraggingProgress = false;
          progressBar.classList.remove('dragging');
        }
      });

      // Also handle pointer cancel (e.g. context menu, system gesture)
      progressBar.addEventListener('pointercancel', () => {
        if (isDraggingProgress) {
          isDraggingProgress = false;
          progressBar.classList.remove('dragging');
        }
      });
    }


  }

  // ── Expose to global scope for backward compat ──
  window.setPlayIcon = setPlayIcon;
  window.setLikeIcon = setLikeIcon;
  window.setPlaymodeIcon = setPlaymodeIcon;

  if (typeof __FM !== 'undefined') __FM.register('controllers', ['audioEngine'], function () {
    return { setPlayIcon, setLikeIcon, setPlaymodeIcon, formatTime };
  }, { priority: 6 });
  console.log('FluidMusic Controllers loaded');
})();
