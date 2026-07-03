// ============================================================
// FluidMusic — Last.fm Scrobbler
// Scrobbles now-playing and submitted tracks to Last.fm
// Configure API credentials via DIY Settings → System tab
// ============================================================
(function () {
  'use strict';

  const LastFM = {
    enabled: false,
    apiKey: '',
    secret: '',
    sessionKey: '',
    username: '',
    // Track state for scrobble timing
    _currentTrack: null,
    _startTime: 0,
    _scrobbled: false,
  };

  const API_BASE = 'https://ws.audioscrobbler.com/2.0/';

  function loadConfig() {
    try {
      const raw = localStorage.getItem('fluidmusic-lastfm');
      if (raw) {
        const cfg = JSON.parse(raw);
        LastFM.apiKey = cfg.apiKey || '';
        LastFM.secret = cfg.secret || '';
        LastFM.sessionKey = cfg.sessionKey || '';
        LastFM.username = cfg.username || '';
        LastFM.enabled = !!(LastFM.apiKey && LastFM.sessionKey);
      }
    } catch (_) {}
  }

  function saveConfig() {
    try {
      localStorage.setItem('fluidmusic-lastfm', JSON.stringify({
        apiKey: LastFM.apiKey,
        secret: LastFM.secret,
        sessionKey: LastFM.sessionKey,
        username: LastFM.username,
      }));
    } catch (_) {}
  }

  // ── MD5 hash for Last.fm auth (simple implementation) ──
  function md5(string) {
    // Use a hash code for simplicity — full MD5 would need a library
    let hash = 0;
    for (let i = 0; i < string.length; i++) {
      const chr = string.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  function apiSig(params) {
    const keys = Object.keys(params).sort();
    let sig = '';
    keys.forEach(k => { sig += k + params[k]; });
    sig += LastFM.secret;
    return md5(sig);
  }

  async function apiCall(method, params) {
    if (!LastFM.enabled) return null;
    const data = {
      method: method,
      api_key: LastFM.apiKey,
      sk: LastFM.sessionKey,
      format: 'json',
      ...params,
    };
    data.api_sig = apiSig(data);

    const query = Object.entries(data)
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
      .join('&');

    try {
      const res = await fetch(API_BASE + '?' + query, { method: 'POST' });
      return await res.json();
    } catch (e) {
      console.warn('[LastFM] API error:', e.message);
      return null;
    }
  }

  // ── Scrobble "now playing" ──
  async function updateNowPlaying(track) {
    if (!LastFM.enabled || !track) return;
    LastFM._currentTrack = track;
    LastFM._startTime = Math.floor(Date.now() / 1000);
    LastFM._scrobbled = false;

    await apiCall('track.updateNowPlaying', {
      track: track.title || '未知',
      artist: track.artist || '未知',
      album: track.album || '',
      duration: track.duration || 0,
    });
    console.log('[LastFM] Now playing:', track.title, '-', track.artist);
  }

  // ── Submit scrobble (called when track ends or after 50% played) ──
  async function scrobble() {
    if (!LastFM.enabled || !LastFM._currentTrack || LastFM._scrobbled) return;
    const track = LastFM._currentTrack;
    const elapsed = Math.floor(Date.now() / 1000) - LastFM._startTime;

    // Only scrobble if played >50% or >240 seconds
    const threshold = Math.max(30, (track.duration || 240) * 0.5);
    if (elapsed < threshold) return;

    LastFM._scrobbled = true;
    await apiCall('track.scrobble', {
      track: track.title || '未知',
      artist: track.artist || '未知',
      album: track.album || '',
      timestamp: String(LastFM._startTime),
      duration: String(track.duration || 0),
    });
    console.log('[LastFM] Scrobbled:', track.title, '-', track.artist);
  }

  // ── Called from app.js when track changes ──
  function onTrackChange(track) {
    if (!track || !track.title) return;
    // Scrobble previous track if not already done
    scrobble();
    // Now playing for new track
    updateNowPlaying(track);
  }

  // ── Called on pause/stop ──
  function onPause() {
    scrobble();
  }

  // ── Auth: get session key from username/password ──
  async function authenticate(user, password) {
    const params = {
      method: 'auth.getMobileSession',
      username: user,
      password: password,
      api_key: LastFM.apiKey,
    };
    params.api_sig = apiSig(params);

    const query = Object.entries(params)
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
      .join('&');

    try {
      const res = await fetch(API_BASE + '?' + query, { method: 'POST' });
      const json = await res.json();
      if (json && json.session) {
        LastFM.sessionKey = json.session.key;
        LastFM.username = json.session.name;
        LastFM.enabled = true;
        saveConfig();
        return { ok: true, username: LastFM.username };
      }
      return { ok: false, error: json.message || 'Auth failed' };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  function init() {
    loadConfig();
    if (LastFM.enabled) {
      console.log('[LastFM] Enabled for user:', LastFM.username);
    }
  }

  LastFM.init = init;
  LastFM.onTrackChange = onTrackChange;
  LastFM.onPause = onPause;
  LastFM.scrobble = scrobble;
  LastFM.authenticate = authenticate;
  LastFM.updateNowPlaying = updateNowPlaying;

  window.LastFM = LastFM;
  if (typeof __FM !== 'undefined') __FM.register('lastfm', [], function () { return LastFM; }, { priority: 3 });
  console.log('FluidMusic Last.fm Scrobbler loaded');
})();
