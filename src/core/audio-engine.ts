// ============================================================
// FluidMusic — AudioEngine (TypeScript)
// Web Audio API, real-time spectrum analysis (fftSize 2048)
// Bass(20-250Hz) / Mid(250-4kHz) / Treble(4k-20kHz) band separation
// Migrated from public/js/audio-engine.js
// ============================================================

import { AudioBands, EQPresetName, PlayMode } from '../types/audio';
import { Track } from '../types/track';
import { AppStore } from './app-store';

// ---- Constants ----

const EQ_FREQUENCIES = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 16000];

const EQ_PRESETS: Record<EQPresetName, number[]> = {
  flat:      [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
  pop:       [-1,  2,  3,  1, -1,  0,  2,  3,  4],
  rock:      [ 5,  4,  1, -2, -3,  1,  4,  5,  5],
  jazz:      [ 4,  2,  0, -1, -2,  0,  1,  2,  2],
  classical: [ 3,  2, -1, -2, -3, -2,  0,  2,  3],
  bass:      [ 8,  6,  2,  0, -2, -3, -2,  0,  0],
  vocal:     [-3, -2,  0,  3,  5,  3,  1,  0, -1],
};

const PRESET_LABELS: Record<string, string> = {
  flat: '关闭EQ', pop: '流行', rock: '摇滚', jazz: '爵士',
  classical: '古典', bass: '低音增强', vocal: '人声',
};

const MODE_ICONS: Record<PlayMode, string> = {
  sequential: '\u{1F501}', // 🔁
  random:     '\u{1F500}', // 🔀
  single:     '\u{1F502}', // 🔂
};

// ---- Helpers ----

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Root-mean-square magnitude for a frequency range [hz0, hz1].
 */
function bandRMS(
  data: Uint8Array,
  len: number,
  sampleRate: number,
  hz0: number,
  hz1: number,
): number {
  const binHz = sampleRate / (len * 2);
  const a = Math.max(0, Math.floor(hz0 / binHz));
  const b = Math.min(len - 1, Math.ceil(hz1 / binHz));
  if (a > b) return 0;
  let sum = 0;
  let count = 0;
  for (let i = a; i <= b; i++) {
    const v = data[i] / 255;
    sum += v * v;
    count++;
  }
  return count ? Math.sqrt(sum / count) : 0;
}

function trackDisplayName(track: Track): string {
  return track.name || (track as any).title || '未知歌曲';
}

function trackDisplayArtist(track: Track): string {
  return track.artist || '未知作者';
}

// ---- AudioEngine ----

export class AudioEngine {
  // -- Audio nodes --
  private ctx: AudioContext | null = null;
  private audio: HTMLAudioElement | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;

  // -- EQ --
  private eqFilters: BiquadFilterNode[] = [];
  private eqGains: number[] = [...EQ_PRESETS.flat];
  private _eqPreset: EQPresetName = 'flat';

  // -- Spectrum --
  private freqData: Uint8Array | null = null;
  private timeData: Uint8Array | null = null;
  private _bands: AudioBands = { bass: 0, mid: 0, treble: 0, energy: 0 };

  // -- Playback state --
  private _playing = false;
  private _volume = 0.7;
  private _playMode: PlayMode = 'sequential';
  private playlist: Track[] = [];
  private playlistIndex = -1;
  private currentTrack: Track | null = null;
  private _nextSkipCount = 0;
  private _tickerId: number | null = null;

  // -- Callbacks (for interop with legacy code) --
  onPlay?: () => void;
  onPause?: () => void;
  onTrackChange?: (track: Track) => void;
  onProgress?: (currentTime: number, duration: number) => void;
  onSpectrum?: (bands: AudioBands, freqData: Uint8Array) => void;

  // -- Injectable dependencies (decouple from window globals) --
  fetchTrackUrlFn?: (track: Track) => Promise<string>;
  showToastFn?: (message: string, duration?: number) => void;
  updateQueueDisplayFn?: (track: Track, playlist: Track[], index: number) => void;

  constructor(private store: AppStore) {}

  // ================================================================
  // Getters
  // ================================================================

  get playing(): boolean {
    return this._playing;
  }

  get volume(): number {
    return this._volume;
  }

  get mode(): PlayMode {
    return this._playMode;
  }

  get bands(): AudioBands {
    return this._bands;
  }

  get eqPreset(): EQPresetName {
    return this._eqPreset;
  }

  get eqEnabled(): boolean {
    return this._eqPreset !== 'flat';
  }

  getCurrentTrack(): Track | null {
    return this.currentTrack;
  }

  getPlaylist(): Track[] {
    return this.playlist;
  }

  getPlaylistIndex(): number {
    return this.playlistIndex;
  }

  // ================================================================
  // Initialisation
  // ================================================================

  /**
   * Create AudioContext, analyser, gain node, and start the spectrum tick loop.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  init(): void {
    if (this.ctx) return;

    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;

      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = this._volume;
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeData = new Uint8Array(this.analyser.frequencyBinCount);

      this.setupEQ();
      this.startTick();

      console.log('[AudioEngine] Initialized');
    } catch (e) {
      console.error('[AudioEngine] Failed to init AudioContext:', e);
    }
  }

  // ================================================================
  // Track loading
  // ================================================================

  /**
   * Load and prepare a track for playback.
   * @param url    Streaming URL
   * @param track  Optional metadata; falls back to store's currentTrack
   */
  loadTrack(url: string, track?: Track): HTMLAudioElement | null {
    this.init();

    const metadata = track || this.currentTrack || {
      id: '',
      name: '未知歌曲',
      artist: '未知作者',
      duration: 0,
      platform: 'local' as const,
      url,
    };

    this.currentTrack = metadata;
    this._nextSkipCount = 0;

    // Notify store
    this.store.playTrack(metadata);

    // Notify legacy callback
    if (this.onTrackChange) {
      this.onTrackChange(metadata);
    }

    // Build new audio element
    this.createAudioElement(url);

    this.updateMediaSession(metadata);

    return this.audio;
  }

  // ================================================================
  // Playback controls
  // ================================================================

  play(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.audio) {
      const playPromise = this.audio.play();
      if (playPromise) {
        playPromise.catch((e: Error) => {
          console.warn('[AudioEngine] Play failed:', e.message);
          // Retry once after user gesture
          if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().then(() => {
              this.audio?.play().catch(() => {});
            }).catch(() => {});
          }
        });
      }
    }
  }

  pause(): void {
    if (this.audio) {
      this.audio.pause();
    }
  }

  toggle(): void {
    if (this._playing) {
      this.pause();
    } else {
      this.play();
    }
  }

  seek(time: number): void {
    if (this.audio) {
      this.audio.currentTime = clamp(time, 0, this.audio.duration || 0);
    }
  }

  setVolume(v: number): void {
    this._volume = clamp(v, 0, 1);
    if (this.gainNode) {
      this.gainNode.gain.value = this._volume;
    }
    if (this.audio) {
      this.audio.volume = this._volume;
    }
    this.store.setVolume(this._volume);
  }

  // ================================================================
  // Play mode
  // ================================================================

  setMode(mode: PlayMode): void {
    this._playMode = mode;
    this.store.setMode(mode);
  }

  cycleMode(): PlayMode {
    const modes: PlayMode[] = ['sequential', 'random', 'single'];
    const idx = modes.indexOf(this._playMode);
    this._playMode = modes[(idx + 1) % modes.length];
    this.store.setMode(this._playMode);
    return this._playMode;
  }

  getModeIcon(): string {
    return MODE_ICONS[this._playMode];
  }

  // ================================================================
  // Playlist navigation
  // ================================================================

  setPlaylist(tracks: Track[], startIndex?: number): void {
    this.playlist = tracks || [];
    this.playlistIndex = startIndex ?? 0;
    this._nextSkipCount = 0;
  }

  async next(): Promise<void> {
    if (this.playlist.length === 0) {
      this.toast('⚠ 播放列表为空');
      return;
    }

    if (this._nextSkipCount >= this.playlist.length) {
      this._nextSkipCount = 0;
      this.toast('⚠ 无可播放曲目');
      return;
    }

    let nextIdx: number;
    if (this._playMode === 'random') {
      nextIdx = Math.floor(Math.random() * this.playlist.length);
    } else {
      nextIdx = (this.playlistIndex + 1) % this.playlist.length;
    }

    await this.playIndex(nextIdx, '⏭');
  }

  async previous(): Promise<void> {
    if (this.playlist.length === 0) {
      this.toast('⚠ 播放列表为空');
      return;
    }

    if (this._nextSkipCount >= this.playlist.length) {
      this._nextSkipCount = 0;
      this.toast('⚠ 无可播放曲目');
      return;
    }

    let prevIdx: number;
    if (this._playMode === 'random') {
      prevIdx = Math.floor(Math.random() * this.playlist.length);
    } else {
      prevIdx = (this.playlistIndex - 1 + this.playlist.length) % this.playlist.length;
    }

    await this.playIndex(prevIdx, '⏮');
  }

  // ================================================================
  // Spectrum
  // ================================================================

  /**
   * Run a one-shot frequency analysis and return the current smoothed bands.
   */
  getSpectrum(): AudioBands {
    this.updateSpectrum();
    return { ...this._bands };
  }

  // ================================================================
  // EQ (Equalizer)
  // ================================================================

  setEQPreset(presetName: string): void {
    const gains = EQ_PRESETS[presetName as EQPresetName];
    if (!gains) {
      console.warn('[AudioEngine] Unknown EQ preset:', presetName);
      return;
    }
    this._eqPreset = presetName as EQPresetName;

    for (let i = 0; i < this.eqFilters.length && i < gains.length; i++) {
      this.eqFilters[i].gain.value = gains[i];
      this.eqGains[i] = gains[i];
    }

    const label = PRESET_LABELS[presetName] || presetName;
    this.toast('\u{1F39B} EQ: ' + label); // 🎛
    console.log('[AudioEngine] EQ preset:', presetName, gains);
  }

  setEQBand(bandIndex: number, gainDB: number): void {
    if (bandIndex >= 0 && bandIndex < this.eqFilters.length) {
      this.eqFilters[bandIndex].gain.value = gainDB;
      this.eqGains[bandIndex] = gainDB;
    }
  }

  toggleEQ(): void {
    const presets = Object.keys(EQ_PRESETS) as EQPresetName[];
    const idx = presets.indexOf(this._eqPreset);
    const next = presets[(idx + 1) % presets.length];
    this.setEQPreset(next);
  }

  // ================================================================
  // Lifecycle
  // ================================================================

  /**
   * Full teardown: stop tick, disconnect nodes, release audio element, close context.
   */
  dispose(): void {
    // Stop the rAF tick
    if (this._tickerId !== null) {
      cancelAnimationFrame(this._tickerId);
      this._tickerId = null;
    }

    // Disconnect and release audio element
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.oncanplay = null;
      this.audio.onplay = null;
      this.audio.onpause = null;
      this.audio.onended = null;
      this.audio.ontimeupdate = null;
      this.audio.onerror = null;
      this.audio.load();
      this.audio = null;
    }

    // Disconnect source node
    if (this.source) {
      try {
        this.source.disconnect();
      } catch (_) {
        // ignore
      }
      this.source = null;
    }

    // Disconnect EQ chain
    for (const filter of this.eqFilters) {
      try {
        filter.disconnect();
      } catch (_) {
        // ignore
      }
    }
    this.eqFilters = [];

    // Disconnect analyser and gain
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch (_) {
        // ignore
      }
      this.analyser = null;
    }
    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch (_) {
        // ignore
      }
      this.gainNode = null;
    }

    // Close AudioContext
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }

    // Clear state
    this.freqData = null;
    this.timeData = null;
    this.currentTrack = null;
    this.playlist = [];
    this.playlistIndex = -1;
    this._playing = false;
    this._nextSkipCount = 0;

    console.log('[AudioEngine] Disposed');
  }

  // ================================================================
  // Private helpers
  // ================================================================

  /**
   * Build the peaking-filter EQ chain between gainNode and analyser.
   */
  private setupEQ(): void {
    if (!this.ctx || !this.gainNode || !this.analyser) return;

    // Tear down existing chain
    for (const f of this.eqFilters) {
      try { f.disconnect(); } catch (_) { /* ignore */ }
    }
    this.eqFilters = [];

    try { this.gainNode.disconnect(); } catch (_) { /* ignore */ }

    let prevNode: AudioNode = this.gainNode;
    for (let i = 0; i < EQ_FREQUENCIES.length; i++) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = EQ_FREQUENCIES[i];
      filter.Q.value = 0.7;
      filter.gain.value = this.eqGains[i] || 0;
      prevNode.connect(filter);
      prevNode = filter;
      this.eqFilters.push(filter);
    }
    prevNode.connect(this.analyser);

    console.log('[AudioEngine] EQ chain: ' + EQ_FREQUENCIES.length + ' bands');
  }

  /**
   * Create or recreate the HTMLAudioElement and wire up all event listeners.
   */
  private createAudioElement(url: string): void {
    // 1. Destroy old audio element
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.oncanplay = null;
      this.audio.onplay = null;
      this.audio.onpause = null;
      this.audio.onended = null;
      this.audio.ontimeupdate = null;
      this.audio.onerror = null;
      this.audio.load();
      this.audio = null;
    }

    // 2. Disconnect old source
    if (this.source) {
      try { this.source.disconnect(); } catch (_) { /* ignore */ }
      this.source = null;
    }

    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.volume = this._volume;
    audio.preload = 'auto';
    audio.src = url;

    audio.addEventListener('canplay', () => {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      try {
        if (this.ctx) {
          this.source = this.ctx.createMediaElementSource(audio);
          this.source.connect(this.gainNode!);
        }
      } catch (e: any) {
        console.warn('[AudioEngine] MediaElementSource error:', e.message);
      }
    });

    audio.addEventListener('play', () => {
      this._playing = true;
      this.store.setPlaying(true);
      if (this.onPlay) this.onPlay();
    });

    audio.addEventListener('pause', () => {
      this._playing = false;
      this.store.setPlaying(false);
      if (this.onPause) this.onPause();
    });

    audio.addEventListener('ended', () => {
      if (this._playMode === 'single') {
        audio.currentTime = 0;
        audio.play();
      } else {
        this.next();
      }
    });

    audio.addEventListener('timeupdate', () => {
      if (this.onProgress && audio.duration) {
        this.onProgress(audio.currentTime, audio.duration);
      }
      this.store.setProgress(audio.currentTime);
    });

    audio.addEventListener('error', (e: Event) => {
      const track = this.currentTrack;
      const trackName = track ? trackDisplayName(track) : 'unknown';
      console.warn(
        '[AudioEngine] Load error for:',
        trackName,
        '| platform:',
        track?.platform,
      );

      let reason = '';
      const audioEl = e.target as HTMLAudioElement;
      if (audioEl?.error) {
        switch (audioEl.error.code) {
          case MediaError.MEDIA_ERR_NETWORK:
            reason = '网络错误，请检查连接';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            reason = '音频解码失败，格式不支持';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            reason = '链接无效或已过期';
            if (track?.platform === 'qq') {
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
      } else if (
        track &&
        track.platform === 'qq' &&
        track.url &&
        track.url.includes('guid-error')
      ) {
        reason = 'QQ音乐鉴权失败，请重新登录';
      }

      console.warn('[AudioEngine] Diagnosed:', reason);
      this.toast('⚠ 播放失败: ' + reason, 3000);

      if (this.playlist.length > 1) {
        setTimeout(() => {
          this.next();
        }, 300);
      }
    });

    this.audio = audio;
  }

  /**
   * Start the requestAnimationFrame spectrum tick loop.
   */
  private startTick(): void {
    if (this._tickerId !== null) return;

    const tick = (): void => {
      if (this._playing || this._bands.energy > 0.001) {
        this.updateSpectrum();
      }
      this._tickerId = requestAnimationFrame(tick);
    };
    this._tickerId = requestAnimationFrame(tick);
  }

  /**
   * Perform one cycle of frequency analysis and apply smoothing.
   */
  private updateSpectrum(): void {
    if (!this.analyser || !this.freqData || !this.timeData) return;

    const rate = this.ctx?.sampleRate ?? 44100;

    (this.analyser.getByteFrequencyData as any)(this.freqData);
    (this.analyser.getByteTimeDomainData as any)(this.timeData);

    const len = this.freqData.length;
    const bass = bandRMS(this.freqData, len, rate, 20, 250);
    const mid = bandRMS(this.freqData, len, rate, 250, 4000);
    const treble = bandRMS(this.freqData, len, rate, 4000, 20000);

    let energySum = 0;
    for (let i = 0; i < len; i++) {
      energySum += this.freqData[i] / 255;
    }
    const energy = energySum / len;

    const smoothFactor = energy > 0.005 ? 0.12 : 0.06;
    this._bands.bass += (bass - this._bands.bass) * smoothFactor;
    this._bands.mid += (mid - this._bands.mid) * smoothFactor;
    this._bands.treble += (treble - this._bands.treble) * smoothFactor;
    this._bands.energy += (energy - this._bands.energy) * smoothFactor;

    if (this.onSpectrum) {
      this.onSpectrum(this._bands, this.freqData);
    }
  }

  /**
   * Play the track at the given playlist index, fetching a URL if needed.
   */
  private async playIndex(index: number, emoji: string): Promise<void> {
    this.playlistIndex = index;
    const track = this.playlist[index];
    if (!track) return;

    // Fetch URL for QQ tracks or tracks missing a URL
    if ((!track.url || track.platform === 'qq') && track.id) {
      try {
        track.url = this.fetchTrackUrlFn
          ? await this.fetchTrackUrlFn(track)
          : '';
      } catch (e) {
        console.warn('[AudioEngine] URL fetch failed:', e);
      }
    }

    if (track.url) {
      this.loadTrack(track.url, track);
      this.play();
      if (this.updateQueueDisplayFn) {
        this.updateQueueDisplayFn(track, this.playlist, index);
      }
      this.toast(emoji + ' ' + trackDisplayName(track));
      this._nextSkipCount = 0;
    } else {
      console.warn(
        '[AudioEngine] Skipping unplayable track:',
        trackDisplayName(track),
        '| platform:',
        track.platform,
      );
      this._nextSkipCount++;
      await this.next();
    }
  }

  private updateMediaSession(track: Track): void {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name,
      artist: track.artist,
      album: track.album || '',
      artwork: track.coverUrl
        ? [{ src: track.coverUrl, sizes: '300x300', type: 'image/jpeg' }]
        : [],
    });

    navigator.mediaSession.setActionHandler('play', () => this.play());
    navigator.mediaSession.setActionHandler('pause', () => this.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => this.previous());
    navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
    navigator.mediaSession.setActionHandler('stop', () => this.pause());
  }

  private toast(message: string, duration?: number): void {
    if (this.showToastFn) {
      this.showToastFn(message, duration);
    }
  }
}
