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

      console.log('Audio engine initialized');
    } catch (e) {
      console.error('Failed to init AudioContext:', e);
    }
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
    if (FluidAudio.audio) {
      FluidAudio.audio.pause();
      FluidAudio.audio.removeAttribute('src');
      FluidAudio.audio.load();
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
      // Disconnect old source if any, then create new one
      if (FluidAudio.source) {
        try { FluidAudio.source.disconnect(); } catch(e) {}
        FluidAudio.source = null;
      }
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
      console.warn('[Audio] Load error for:', FluidAudio.currentTrack ? (FluidAudio.currentTrack.title || FluidAudio.currentTrack.id) : 'unknown');
      if (FluidAudio.playlist.length > 1) {
        setTimeout(() => {
          if (typeof showToast !== 'undefined') showToast('⚠ 播放失败，自动下一曲');
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
      function tick() {
        if (FluidAudio.playing || FluidAudio.bands.energy > 0.001) {
          updateSpectrum();
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
  };

  FluidAudio.load = function (url, metadata) {
    initAudioContext();
    const audio = createAudioElement(url);
    const track = metadata || { title: '未知歌曲', artist: '未知作者' };
    FluidAudio.currentTrack = track;
    // Fire onTrackChange IMMEDIATELY for UI sync (title, cover, queue)
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
          track.url = await (window._fetchTrackUrl ? window._fetchTrackUrl(track) : Promise.resolve(''));
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
          track.url = await (window._fetchTrackUrl ? window._fetchTrackUrl(track) : Promise.resolve(''));
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

  window.FluidAudio = FluidAudio;
  console.log('FluidMusic Audio Engine loaded');
})();
