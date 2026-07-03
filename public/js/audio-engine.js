// ============================================================
// FluidMusic — Audio Engine
// Web Audio API, real-time spectrum analysis (fftSize 2048)
// Bass(20-250Hz) / Mid(250-4kHz) / Treble(4k-20kHz) band separation
// ============================================================
(function () {
  if (typeof window === 'undefined') return;

  const FluidAudio = {
    ctx: null,
    analyser: null,
    source: null,
    audio: null,
    gainNode: null,
    playing: false,
    currentTrack: null,
    playlist: [],
    playlistIndex: -1,
    volume: 0.7,
    playMode: 'sequential', // sequential | random | single
    freqData: null,
    timeData: null,

    // Audio frequency bands
    bands: {
      bass: 0,
      mid: 0,
      treble: 0,
      energy: 0,
    },

    // Smoothing factors
    smooth: { bass: 0, mid: 0, treble: 0, energy: 0 },

    // Audio Equalizer
    eqEnabled: false,
    eqPreset: 'flat',
    eqBands: [60, 170, 310, 600, 1000, 3000, 6000, 12000, 16000],
    eqFilters: [],
    eqGains: [0, 0, 0, 0, 0, 0, 0, 0, 0], // dB values

    // EQ presets (gain values in dB for each band)
    eqPresets: {
      flat:   [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
      pop:    [-1,  2,  3,  1, -1,  0,  2,  3,  4],
      rock:   [ 5,  4,  1, -2, -3,  1,  4,  5,  5],
      jazz:   [ 4,  2,  0, -1, -2,  0,  1,  2,  2],
      classical: [3, 2, -1, -2, -3, -2,  0,  2,  3],
      bass:   [ 8,  6,  2,  0, -2, -3, -2,  0,  0],
      vocal:  [-3, -2,  0,  3,  5,  3,  1,  0, -1],
      custom: [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    },

    // Callbacks
    onPlay: null,
    onPause: null,
    onTrackChange: null,
    onProgress: null,
    onSpectrum: null,
  };

  function initAudioContext() {
    if (FluidAudio.ctx) return;
    try {
      FluidAudio.ctx = new (window.AudioContext || window.webkitAudioContext)();
      FluidAudio.analyser = FluidAudio.ctx.createAnalyser();
      FluidAudio.analyser.fftSize = 2048;
      FluidAudio.analyser.smoothingTimeConstant = 0.8;

      FluidAudio.gainNode = FluidAudio.ctx.createGain();
      FluidAudio.gainNode.gain.value = FluidAudio.volume;
      FluidAudio.gainNode.connect(FluidAudio.analyser);
      FluidAudio.analyser.connect(FluidAudio.ctx.destination);

      FluidAudio.freqData = new Uint8Array(FluidAudio.analyser.frequencyBinCount);
      FluidAudio.timeData = new Uint8Array(FluidAudio.analyser.frequencyBinCount);

      // Setup EQ filter chain
      setupEQ();

      console.log('Audio engine initialized');
    } catch (e) {
      console.error('Failed to init AudioContext:', e);
    }
  }

  // ── Audio Equalizer ──
  function setupEQ() {
    if (!FluidAudio.ctx) return;
    FluidAudio.eqFilters = [];
    // Disconnect old chain, insert EQ between gain and analyser
    try { FluidAudio.gainNode.disconnect(); } catch (_) {}

    // Build peaking filter chain
    let prevNode = FluidAudio.gainNode;
    for (let i = 0; i < FluidAudio.eqBands.length; i++) {
      const filter = FluidAudio.ctx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = FluidAudio.eqBands[i];
      filter.Q.value = 0.7;
      filter.gain.value = FluidAudio.eqGains[i] || 0;
      prevNode.connect(filter);
      prevNode = filter;
      FluidAudio.eqFilters.push(filter);
    }
    // Connect to analyser
    prevNode.connect(FluidAudio.analyser);
    console.log('[EQ] Filter chain set up: ' + FluidAudio.eqBands.length + ' bands');
  }

  function setEQPreset(presetName) {
    const gains = FluidAudio.eqPresets[presetName];
    if (!gains) {
      console.warn('[EQ] Unknown preset:', presetName);
      return;
    }
    FluidAudio.eqPreset = presetName;
    FluidAudio.eqEnabled = presetName !== 'flat';
    for (let i = 0; i < FluidAudio.eqFilters.length && i < gains.length; i++) {
      FluidAudio.eqFilters[i].gain.value = gains[i];
      FluidAudio.eqGains[i] = gains[i];
    }
    if (typeof showToast !== 'undefined') {
      const names = { flat: '关闭EQ', pop: '流行', rock: '摇滚', jazz: '爵士', classical: '古典', bass: '低音增强', vocal: '人声' };
      showToast('🎛 EQ: ' + (names[presetName] || presetName));
    }
    console.log('[EQ] Preset:', presetName, gains);
  }

  function setEQBand(bandIndex, gainDB) {
    if (bandIndex >= 0 && bandIndex < FluidAudio.eqFilters.length) {
      FluidAudio.eqFilters[bandIndex].gain.value = gainDB;
      FluidAudio.eqGains[bandIndex] = gainDB;
    }
  }

  function toggleEQ() {
    const presets = Object.keys(FluidAudio.eqPresets);
    const idx = presets.indexOf(FluidAudio.eqPreset);
    const next = presets[(idx + 1) % presets.length];
    setEQPreset(next);
  }

  // ── Frequency band analysis ──
  function bandRMS(data, len, sampleRate, hz0, hz1) {
    const binHz = sampleRate / (len * 2);
    const a = Math.max(0, Math.floor(hz0 / binHz));
    const b = Math.min(len - 1, Math.ceil(hz1 / binHz));
    if (a > b) return 0;
    let sum = 0, count = 0;
    for (let i = a; i <= b; i++) {
      const v = data[i] / 255;
      sum += v * v;
      count++;
    }
    return count ? Math.sqrt(sum / count) : 0;
  }

  function updateSpectrum() {
    if (!FluidAudio.analyser || !FluidAudio.freqData) return;
    const rate = FluidAudio.ctx ? FluidAudio.ctx.sampleRate : 44100;

    FluidAudio.analyser.getByteFrequencyData(FluidAudio.freqData);
    FluidAudio.analyser.getByteTimeDomainData(FluidAudio.timeData);

    const len = FluidAudio.freqData.length;
    const bass = bandRMS(FluidAudio.freqData, len, rate, 20, 250);
    const mid = bandRMS(FluidAudio.freqData, len, rate, 250, 4000);
    const treble = bandRMS(FluidAudio.freqData, len, rate, 4000, 20000);

    let energySum = 0;
    for (let i = 0; i < len; i++) energySum += FluidAudio.freqData[i] / 255;
    const energy = energySum / len;

    // Smooth transitions
    const smoothFactor = energy > 0.005 ? 0.12 : 0.06;
    FluidAudio.bands.bass += (bass - FluidAudio.bands.bass) * smoothFactor;
    FluidAudio.bands.mid += (mid - FluidAudio.bands.mid) * smoothFactor;
    FluidAudio.bands.treble += (treble - FluidAudio.bands.treble) * smoothFactor;
    FluidAudio.bands.energy += (energy - FluidAudio.bands.energy) * smoothFactor;

    if (FluidAudio.onSpectrum) {
      FluidAudio.onSpectrum(FluidAudio.bands, FluidAudio.freqData);
    }
  }

  // ── Audio element management ──
  function createAudioElement(url) {
    // 1. Thoroughly destroy old audio element to prevent memory leaks
    if (FluidAudio.audio) {
      FluidAudio.audio.pause();
      FluidAudio.audio.removeAttribute('src');
      // Remove all event listeners to break references for GC
      FluidAudio.audio.oncanplay = null;
      FluidAudio.audio.onplay = null;
      FluidAudio.audio.onpause = null;
      FluidAudio.audio.onended = null;
      FluidAudio.audio.ontimeupdate = null;
      FluidAudio.audio.onerror = null;
      FluidAudio.audio.load();
      FluidAudio.audio = null;
    }

    // 2. Disconnect old MediaElementSource before creating a new one
    if (FluidAudio.source) {
      try { FluidAudio.source.disconnect(); } catch(e) {}
      FluidAudio.source = null;
    }

    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.volume = FluidAudio.volume;
    audio.preload = 'auto';
    audio.src = url;

    audio.addEventListener('canplay', () => {
      if (FluidAudio.ctx && FluidAudio.ctx.state === 'suspended') {
        FluidAudio.ctx.resume();
      }
      // Source already disconnected above; this is safe
      try {
        FluidAudio.source = FluidAudio.ctx.createMediaElementSource(audio);
        FluidAudio.source.connect(FluidAudio.gainNode);
      } catch (e) {
        console.warn('MediaElementSource error:', e.message);
      }
    });

    audio.addEventListener('play', () => {
      FluidAudio.playing = true;
      if (FluidAudio.onPlay) FluidAudio.onPlay();
    });

    audio.addEventListener('pause', () => {
      FluidAudio.playing = false;
      if (FluidAudio.onPause) FluidAudio.onPause();
    });

    audio.addEventListener('ended', () => {
      if (FluidAudio.playMode === 'single') {
        audio.currentTime = 0;
        audio.play();
      } else {
        FluidAudio.next();
      }
    });

    audio.addEventListener('timeupdate', () => {
      if (FluidAudio.onProgress && audio.duration) {
        FluidAudio.onProgress(audio.currentTime, audio.duration);
      }
    });

    audio.addEventListener('error', (e) => {
      const track = FluidAudio.currentTrack;
      const trackName = track ? (track.title || track.id) : 'unknown';
      console.warn('[Audio] Load error for:', trackName, '| platform:', track && track.platform);

      // Diagnose the failure reason
      let reason = '';
      const audioEl = e.target;
      if (audioEl && audioEl.error) {
        switch (audioEl.error.code) {
          case MediaError.MEDIA_ERR_NETWORK:
            reason = '网络错误，请检查连接';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            reason = '音频解码失败，格式不支持';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            reason = '链接无效或已过期';
            if (track && track.platform === 'qq') {
              reason += '（QQ音乐链接30分钟后过期）';
            }
            break;
          case MediaError.MEDIA_ERR_ABORTED:
            reason = '播放被中断';
            break;
          default:
            reason = '未知播放错误';
        }
      } else if (track && !track.url) {
        reason = '无播放地址（歌曲可能为VIP/版权受限）';
      } else if (track && track.platform === 'qq' && track.url && track.url.includes('guid-error')) {
        reason = 'QQ音乐鉴权失败，请重新登录';
      }

      console.warn('[Audio] Diagnosed:', reason);
      if (typeof showToast !== 'undefined') {
        showToast('⚠ 播放失败: ' + reason, 3000);
      }

      if (FluidAudio.playlist.length > 1) {
        setTimeout(() => {
          FluidAudio.next();
        }, 300);
      }
    });

    FluidAudio.audio = audio;
    return audio;
  }

  // ── Public API ──
  FluidAudio.init = function () {
    initAudioContext();
    if (!FluidAudio._tickerStarted) {
      FluidAudio._tickerStarted = true;
      const tick = () => {
        if (FluidAudio.playing || FluidAudio.bands.energy > 0.001) {
          updateSpectrum();
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  };

  FluidAudio.load = function (url, metadata) {
    initAudioContext();
    const audio = createAudioElement(url);
    const track = metadata || { title: '未知歌曲', artist: '未知作者' };
    FluidAudio.currentTrack = track;
    // Fire onTrackChange IMMEDIATELY for UI sync (title, cover, queue, particle cover)
    if (FluidAudio.onTrackChange) {
      FluidAudio.onTrackChange(track);
    }
    // Also update title/artist directly for instant feedback
    try {
      document.getElementById('song-title').textContent = track.title || '未知歌曲';
      document.getElementById('song-artist').textContent = track.artist || '未知作者';
    } catch(_) {}
    return audio;
  };

  FluidAudio.play = function () {
    if (FluidAudio.ctx && FluidAudio.ctx.state === 'suspended') {
      FluidAudio.ctx.resume().catch(() => {});
    }
    if (FluidAudio.audio) {
      const playPromise = FluidAudio.audio.play();
      if (playPromise) {
        playPromise.catch((e) => {
          console.warn('Play failed:', e.message);
          // Retry once after user gesture
          if (FluidAudio.ctx && FluidAudio.ctx.state === 'suspended') {
            FluidAudio.ctx.resume().then(() => {
              FluidAudio.audio.play().catch(() => {});
            }).catch(() => {});
          }
        });
      }
    }
  };

  FluidAudio.pause = function () {
    if (FluidAudio.audio) FluidAudio.audio.pause();
  };

  FluidAudio.togglePlay = function () {
    if (FluidAudio.playing) FluidAudio.pause();
    else FluidAudio.play();
  };

  FluidAudio.setVolume = function (v) {
    FluidAudio.volume = Math.max(0, Math.min(1, v));
    if (FluidAudio.gainNode) FluidAudio.gainNode.gain.value = FluidAudio.volume;
    if (FluidAudio.audio) FluidAudio.audio.volume = FluidAudio.volume;
  };

  FluidAudio.seek = function (time) {
    if (FluidAudio.audio) {
      FluidAudio.audio.currentTime = Math.max(0, Math.min(time, FluidAudio.audio.duration || 0));
    }
  };

  FluidAudio.setPlayMode = function (mode) {
    FluidAudio.playMode = mode;
  };

  FluidAudio.cyclePlayMode = function () {
    const modes = ['sequential', 'random', 'single'];
    const idx = modes.indexOf(FluidAudio.playMode);
    FluidAudio.playMode = modes[(idx + 1) % modes.length];
    return FluidAudio.playMode;
  };

  FluidAudio.setPlaylist = function (tracks, startIndex) {
    FluidAudio.playlist = tracks || [];
    FluidAudio.playlistIndex = startIndex || 0;
  };

  FluidAudio.next = async function () {
    if (FluidAudio.playlist.length === 0) {
      if (typeof showToast !== 'undefined') showToast('⚠ 播放列表为空');
      return;
    }
    // Guard: if we tried all tracks and none playable, give up
    FluidAudio._nextSkipCount = (FluidAudio._nextSkipCount || 0);
    if (FluidAudio._nextSkipCount >= FluidAudio.playlist.length) {
      FluidAudio._nextSkipCount = 0;
      if (typeof showToast !== 'undefined') showToast('⚠ 无可播放曲目');
      return;
    }
    let nextIdx;
    if (FluidAudio.playMode === 'random') {
      nextIdx = Math.floor(Math.random() * FluidAudio.playlist.length);
    } else {
      nextIdx = (FluidAudio.playlistIndex + 1) % FluidAudio.playlist.length;
    }
    FluidAudio.playlistIndex = nextIdx;
    const track = FluidAudio.playlist[nextIdx];
    if (track) {
      if ((!track.url || track.platform === 'qq') && track.id) {
        try {
          await window._ensureTrackUrl(track);
        } catch(e) { console.warn('URL fetch failed:', e); }
      }
      if (track.url) {
        FluidAudio.load(track.url, track);
        FluidAudio.play();
        if (typeof BubbleChamber !== 'undefined') {
          BubbleChamber.updateQueueDisplay(track, FluidAudio.playlist, nextIdx);
        }
        if (typeof showToast !== 'undefined') showToast('⏭ ' + (track.title || track.name || '下一曲'));
        FluidAudio._nextSkipCount = 0;
      } else {
        // Auto-skip unplayable tracks (QQ UIN empty, guid-error, copyright-restricted)
        console.warn('[FluidAudio] Skipping unplayable track:', track.title || track.id, '| platform:', track.platform);
        FluidAudio._nextSkipCount++;
        FluidAudio.next();
      }
    }
  };

  FluidAudio.prev = async function () {
    if (FluidAudio.playlist.length === 0) {
      if (typeof showToast !== 'undefined') showToast('⚠ 播放列表为空');
      return;
    }
    FluidAudio._nextSkipCount = (FluidAudio._nextSkipCount || 0);
    if (FluidAudio._nextSkipCount >= FluidAudio.playlist.length) {
      FluidAudio._nextSkipCount = 0;
      if (typeof showToast !== 'undefined') showToast('⚠ 无可播放曲目');
      return;
    }
    let prevIdx;
    if (FluidAudio.playMode === 'random') {
      prevIdx = Math.floor(Math.random() * FluidAudio.playlist.length);
    } else {
      prevIdx = (FluidAudio.playlistIndex - 1 + FluidAudio.playlist.length) % FluidAudio.playlist.length;
    }
    FluidAudio.playlistIndex = prevIdx;
    const track = FluidAudio.playlist[prevIdx];
    if (track) {
      if ((!track.url || track.platform === 'qq') && track.id) {
        try {
          await window._ensureTrackUrl(track);
        } catch(e) { console.warn('URL fetch failed:', e); }
      }
      if (track.url) {
        FluidAudio.load(track.url, track);
        FluidAudio.play();
        if (typeof BubbleChamber !== 'undefined') {
          BubbleChamber.updateQueueDisplay(track, FluidAudio.playlist, prevIdx);
        }
        if (typeof showToast !== 'undefined') showToast('⏮ ' + (track.title || track.name || '上一曲'));
        FluidAudio._nextSkipCount = 0;
      } else {
        console.warn('[FluidAudio] Skipping unplayable track:', track.title || track.id, '| platform:', track.platform);
        FluidAudio._nextSkipCount++;
        FluidAudio.next();
      }
    }
  };

  FluidAudio.getPlayModeIcon = function () {
    return { sequential: '🔁', random: '🔀', single: '🔂' }[FluidAudio.playMode] || '🔁';
  };

  FluidAudio.setEQPreset = setEQPreset;
  FluidAudio.setEQBand = setEQBand;
  FluidAudio.toggleEQ = toggleEQ;
  FluidAudio.eqEnabled = false;
  FluidAudio.eqPreset = 'flat';

  if (typeof __FM !== 'undefined') __FM.register('audioEngine', [], function () { return FluidAudio; }, { priority: 8 });
  window.FluidAudio = FluidAudio;
  console.log('FluidMusic Audio Engine loaded');
})();
