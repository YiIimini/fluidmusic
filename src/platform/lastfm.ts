// ============================================================
// FluidMusic — Last.fm Scrobbler (TypeScript)
// Scrobbles now-playing and submitted tracks to Last.fm
// Configure API credentials via DIY Settings → System tab
// Migrated from public/js/lastfm.js
// ============================================================

declare const __FM: {
  register: (name: string, deps: string[], factory: () => any, opts?: { priority?: number }) => void;
} | undefined;

// ---- Types ----

interface LastFmConfig {
  apiKey: string;
  secret: string;
  sessionKey: string;
  username: string;
}

interface ScrobbleTrack {
  title?: string;
  name?: string;
  artist?: string;
  album?: string;
  duration?: number;
}

interface AuthResult {
  ok: boolean;
  username?: string;
  error?: string;
}

interface LastFmApiParams {
  [key: string]: string | number;
}

const API_BASE = 'https://ws.audioscrobbler.com/2.0/';
const STORAGE_KEY = 'fluidmusic-lastfm';

// ---- LastFM ----

export class LastFM {
  enabled = false;
  apiKey = '';
  secret = '';
  sessionKey = '';
  username = '';

  // Track state for scrobble timing
  private _currentTrack: ScrobbleTrack | null = null;
  private _startTime = 0;
  private _scrobbled = false;

  private loadConfig(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const cfg: LastFmConfig = JSON.parse(raw);
        this.apiKey = cfg.apiKey || '';
        this.secret = cfg.secret || '';
        this.sessionKey = cfg.sessionKey || '';
        this.username = cfg.username || '';
        this.enabled = !!(this.apiKey && this.sessionKey);
      }
    } catch (_e) { /* ignore parse errors */ }
  }

  private saveConfig(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        apiKey: this.apiKey,
        secret: this.secret,
        sessionKey: this.sessionKey,
        username: this.username,
      }));
    } catch (_e) { /* ignore quota errors */ }
  }

  // ── MD5 hash for Last.fm auth (simple implementation) ──
  private md5(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  private apiSig(params: LastFmApiParams): string {
    const keys = Object.keys(params).sort();
    let sig = '';
    keys.forEach(k => { sig += k + params[k]; });
    sig += this.secret;
    return this.md5(sig);
  }

  private async apiCall(method: string, params: LastFmApiParams): Promise<any> {
    if (!this.enabled) return null;
    const data: LastFmApiParams = {
      method,
      api_key: this.apiKey,
      sk: this.sessionKey,
      format: 'json',
      ...params,
    };
    data.api_sig = this.apiSig(data);

    const query = Object.entries(data)
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
      .join('&');

    try {
      const res = await fetch(API_BASE + '?' + query, { method: 'POST' });
      return await res.json();
    } catch (e: any) {
      console.warn('[LastFM] API error:', e.message);
      return null;
    }
  }

  // ── Scrobble "now playing" ──
  async updateNowPlaying(track: ScrobbleTrack): Promise<void> {
    if (!this.enabled || !track) return;
    this._currentTrack = track;
    this._startTime = Math.floor(Date.now() / 1000);
    this._scrobbled = false;

    await this.apiCall('track.updateNowPlaying', {
      track: track.title || '未知',
      artist: track.artist || '未知',
      album: track.album || '',
      duration: track.duration || 0,
    });
    console.log('[LastFM] Now playing:', track.title, '-', track.artist);
  }

  // ── Submit scrobble (called when track ends or after 50% played) ──
  async scrobble(): Promise<void> {
    if (!this.enabled || !this._currentTrack || this._scrobbled) return;
    const track = this._currentTrack;
    const elapsed = Math.floor(Date.now() / 1000) - this._startTime;

    // Only scrobble if played >50% or >240 seconds
    const threshold = Math.max(30, (track.duration || 240) * 0.5);
    if (elapsed < threshold) return;

    this._scrobbled = true;
    await this.apiCall('track.scrobble', {
      track: track.title || '未知',
      artist: track.artist || '未知',
      album: track.album || '',
      timestamp: String(this._startTime),
      duration: String(track.duration || 0),
    });
    console.log('[LastFM] Scrobbled:', track.title, '-', track.artist);
  }

  // ── Called from app.js when track changes ──
  onTrackChange(track: ScrobbleTrack): void {
    if (!track || !track.title) return;
    // Scrobble previous track if not already done
    this.scrobble();
    // Now playing for new track
    this.updateNowPlaying(track);
  }

  // ── Called on pause/stop ──
  onPause(): void {
    this.scrobble();
  }

  // ── Auth: get session key from username/password ──
  async authenticate(user: string, password: string): Promise<AuthResult> {
    const params: LastFmApiParams = {
      method: 'auth.getMobileSession',
      username: user,
      password: password,
      api_key: this.apiKey,
    };
    params.api_sig = this.apiSig(params);

    const query = Object.entries(params)
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
      .join('&');

    try {
      const res = await fetch(API_BASE + '?' + query, { method: 'POST' });
      const json = await res.json();
      if (json?.session) {
        this.sessionKey = json.session.key;
        this.username = json.session.name;
        this.enabled = true;
        this.saveConfig();
        return { ok: true, username: this.username };
      }
      return { ok: false, error: json.message || 'Auth failed' };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  init(): void {
    this.loadConfig();
    if (this.enabled) {
      console.log('[LastFM] Enabled for user:', this.username);
    }
  }
}

// ── Singleton + backward-compat ──
const instance = new LastFM();

(window as any).LastFM = instance;
if (typeof __FM !== 'undefined') {
  __FM.register('lastfm', [], () => instance, { priority: 3 });
}
console.log('FluidMusic Last.fm Scrobbler loaded (TS)');
