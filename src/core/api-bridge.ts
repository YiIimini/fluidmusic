// ============================================================
// FluidMusic — ApiBridge: Platform API communication layer
// Handles NetEase + QQ Music API calls via local Express proxy.
// Migrated from public/js/api-bridge.js (IIFE → TypeScript class).
// ============================================================

import { Track, Playlist, SearchResult, MusicPlatform } from '../types/track';
import { UserProfile, LoginState } from '../types/user';
import { EventBus } from './event-bus';
import { AppStore } from './app-store';

// ============================================================
// Types
// ============================================================

type Platform = MusicPlatform;

interface PlaylistMap {
  qishui: Playlist[];
  netease: Playlist[];
  qq: Playlist[];
}

/**
 * Electron preload bridge (window.fluidmusic) — typed subset used by ApiBridge.
 */
interface FluidMusicIPC {
  loginPlatform(platform: string): Promise<{ ok: boolean; cookie?: string }>;
  logoutPlatform(platform: string): Promise<void>;
  getLoginStatus(): Promise<Record<string, { loggedIn: boolean; cookie: string }>>;
  onLoginStateChanged(
    callback: (state: { platform: string; loggedIn: boolean; cookie: string }) => void
  ): () => void;
}

declare global {
  interface Window {
    fluidmusic?: FluidMusicIPC;
  }
}

/**
 * Constructor options for ApiBridge.
 */
export interface ApiBridgeOptions {
  /**
   * Server base URL.
   * Defaults to http://127.0.0.1:PORT where PORT is window.location.port or 3000.
   */
  serverBase?: string;
  /**
   * I18n translation function. Falls back to simplified Chinese strings.
   */
  t?: (key: string) => string;
  /**
   * Electron IPC bridge override. Injected for testing; defaults to window.fluidmusic.
   */
  ipc?: FluidMusicIPC;
}

// ============================================================
// NetEase raw API response shapes (partial)
// ============================================================

interface NeteaseAccountResponse {
  profile?: {
    userId?: number;
    avatarUrl?: string;
    nickname?: string;
    vipType?: number;
    followeds?: number;
    follows?: number;
    playlistCount?: number;
  };
}

interface NeteasePlaylistItem {
  id: number;
  name: string;
  coverImgUrl?: string;
  trackCount?: number;
}

interface NeteasePlaylistsResponse {
  playlist?: NeteasePlaylistItem[];
}

interface NeteaseSearchResponse {
  result?: {
    songs?: Array<{
      id: number;
      name: string;
      ar?: Array<{ name: string }>;
      al?: { name: string; picUrl?: string };
      dt?: number;
    }>;
    songCount?: number;
  };
}

// ============================================================
// QQ raw API response shapes (partial)
// ============================================================

interface QQUserDetailResponse {
  code?: number;
  data?: {
    creator?: {
      nick?: string;
      headpic?: string;
      fanscnt?: number;
      followcnt?: number;
      dissnum?: number;
      nickname?: string;
      avatar?: string;
      avatarUrl?: string;
      followers?: number;
      followings?: number;
      playlistCount?: number;
    };
    vipInfo?: { vipType?: number };
    nick?: string;
    headpic?: string;
    avatar?: string;
    avatarUrl?: string;
    fanscnt?: number;
    followers?: number;
    followcnt?: number;
    followings?: number;
    dissnum?: number;
    playlistCount?: number;
  };
}

interface QQPlaylistItem {
  dissid?: string | number;
  tid?: string | number;
  id?: string | number;
  diss_name?: string;
  name?: string;
  title?: string;
  dirname?: string;
  diss_cover?: string;
  logo?: string;
  picurl?: string;
  cover?: string;
  song_cnt?: number;
  songnum?: number;
  song_count?: number;
}

interface QQPlaylistsResponse {
  code?: number;
  data?: {
    disslist?: QQPlaylistItem[];
  };
}

interface QQSearchResponse {
  data?: {
    song?: {
      list?: Array<{
        songmid: string;
        songname: string;
        singer?: Array<{ name: string }>;
        albumname?: string;
        albummid?: string;
        interval?: number;
      }>;
      totalnum?: number;
    };
  };
}

// ============================================================
// ApiBridge Class
// ============================================================

export class ApiBridge {
  // --- Private state ---
  private cookieStore = new Map<Platform, string>();
  private neteaseProfile: UserProfile | null = null;
  private qqProfile: UserProfile | null = null;
  private qishuiProfile: UserProfile | null = null;

  // --- Dependencies ---
  private bus: EventBus;
  private store: AppStore;
  private serverBase: string;
  private t: (key: string) => string;
  private ipcOverride?: FluidMusicIPC;

  // --- Cleanup ---
  private loginStateUnsub?: () => void;

  constructor(bus: EventBus, store: AppStore, options: ApiBridgeOptions = {}) {
    this.bus = bus;
    this.store = store;
    this.ipcOverride = options.ipc;

    this.serverBase =
      options.serverBase ??
      `http://127.0.0.1:${(typeof window !== 'undefined' && window.location.port) || 3000}`;

    this.t =
      options.t ??
      ((key: string): string => {
        const fallbacks: Record<string, string> = {
          'login.logging': '登录中...',
          'login.netease': '网易云音乐',
          'login.qq': 'QQ音乐',
        };
        return fallbacks[key] ?? key;
      });
  }

  // ============================================================
  // Accessors
  // ============================================================

  get isNeteaseLoggedIn(): boolean {
    return this.cookieStore.has('netease') && this.cookieStore.get('netease')!.length > 0;
  }

  get isQQLoggedIn(): boolean {
    return this.cookieStore.has('qq') && this.cookieStore.get('qq')!.length > 0;
  }

  get isQishuiLoggedIn(): boolean {
    return this.cookieStore.has('qishui') && this.cookieStore.get('qishui')!.length > 0;
  }

  getUserProfile(platform: Platform): UserProfile | null {
    return platform === 'netease' ? this.neteaseProfile : this.qqProfile;
  }

  // ============================================================
  // Core: Unified API Fetcher
  // ============================================================

  /**
   * Sends a request to the local Express proxy server.
   * Automatically attaches x-cookie and x-platform headers when a platform
   * cookie is available.
   */
  async fetchApi(
    endpoint: string,
    params: Record<string, string | number | boolean> = {},
    platform?: Platform,
    method: 'GET' | 'POST' = 'GET'
  ): Promise<unknown> {
    const query = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    ).toString();
    const url = this.serverBase + endpoint + (query ? '?' + query : '');

    const headers: Record<string, string> = {};
    if (platform && this.cookieStore.has(platform)) {
      headers['x-cookie'] = this.cookieStore.get(platform)!;
      headers['x-platform'] = platform;
    }

    console.log(
      `[ApiBridge] ${platform ?? '?'} → ${endpoint} | cookie:`,
      platform ? this.cookieStore.has(platform) : false,
      '| len:',
      platform ? (this.cookieStore.get(platform)?.length ?? 0) : 0
    );

    const res = await fetch(url, { method, headers });
    const json = await res.json();

    console.log(
      `[ApiBridge] ${platform ?? '?'} ← ${endpoint} | status:`,
      res.status,
      '| hasData:',
      !!json
    );

    return json;
  }

  // ============================================================
  // Initialization
  // ============================================================

  /**
   * Initializes the API bridge: loads login status from Electron main process,
   * fetches user profiles for already-logged-in platforms, and subscribes to
   * login-state-change events pushed by the main process.
   */
  async init(): Promise<void> {
    const ipc = this.resolveIPC();

    if (ipc) {
      try {
        const status = await ipc.getLoginStatus();

        if (status.netease?.loggedIn && status.netease.cookie) {
          this.cookieStore.set('netease', status.netease.cookie);
        }
        if (status.qq?.loggedIn && status.qq.cookie) {
          this.cookieStore.set('qq', status.qq.cookie);
        }

        console.log(
          '[ApiBridge] Login status loaded — netease:',
          this.isNeteaseLoggedIn,
          'qq:',
          this.isQQLoggedIn
        );

        if (this.isNeteaseLoggedIn) await this.fetchNeteaseUserDetail();
        if (this.isQQLoggedIn) await this.fetchQQUserDetail();
        if (this.isQishuiLoggedIn) await this.fetchQishuiUserDetail();
      } catch (e) {
        console.warn('[ApiBridge] Failed to get login status:', e);
      }

      // Listen for login-state-changed events (pushed by main process after login/logout)
      this.loginStateUnsub = ipc.onLoginStateChanged((state) => {
        const { platform, loggedIn, cookie } = state;
        console.log('[ApiBridge] Login state changed:', platform, 'loggedIn:', loggedIn);

        if (loggedIn && cookie) {
          this.cookieStore.set(platform as Platform, cookie);
          if (platform === 'netease') this.fetchNeteaseUserDetail();
          else if (platform === 'qq') this.fetchQQUserDetail();
          else if (platform === 'qishui') this.fetchQishuiUserDetail();
        } else {
          this.cookieStore.delete(platform as Platform);
          (this.store as any).setUser(platform, null);
        }
      });
    }

    console.log('[ApiBridge] Initialized — cookies ready');
  }

  // ============================================================
  // Authentication
  // ============================================================

  /**
   * Triggers OAuth login for the given platform via Electron IPC.
   * On success, stores the cookie, fetches user profile and playlists,
   * and emits events via EventBus.
   */
  async loginPlatform(platform: Platform): Promise<void> {
    const ipc = this.resolveIPC();
    if (!ipc) {
      console.warn(`[ApiBridge] ${platform} login not available (not in Electron)`);
      return;
    }

    try {
      const result = await ipc.loginPlatform(platform);

      if (result && result.ok) {
        // 1. Store cookie from login result immediately
        if (result.cookie) {
          this.cookieStore.set(platform, result.cookie);
          console.log(
            `[ApiBridge] Stored cookie for ${platform}, length:`,
            result.cookie.length
          );
        }

        // 2. Fetch user profile
        let profile: UserProfile | null = null;
        try {
          if (platform === 'netease') {
            profile = await this.fetchNeteaseUserDetail();
          } else if (platform === 'qq') {
            profile = await this.fetchQQUserDetail();
          } else if (platform === 'qishui') {
            profile = await this.fetchQishuiUserDetail();
          }
        } catch (e) {
          console.warn(
            `[ApiBridge] Profile fetch failed for ${platform}:`,
            (e as Error).message
          );
        }

        console.log(
          `[ApiBridge] Fetched profile for ${platform}:`,
          profile ? profile.nickname : 'null'
        );

        // 3. Auto-check all playlists after login
        try {
          const playlists = await this.fetchUserPlaylists();
          this.autoCheckSyncedPlaylists(platform, playlists);

          console.log(
            '[ApiBridge] Fetched playlists after login:',
            `netease=${(playlists.netease || []).length}`,
            `qq=${(playlists.qq || []).length}`
          );

          // Notify via EventBus (replaces window.dispatchEvent)
          this.bus.emit('playlists-updated', { playlists, platform });
        } catch (e) {
          console.error('[ApiBridge] Failed to fetch playlists:', e);
        }

        // Notify login complete (replaces CustomEvent 'fluidmusic:login')
        this.bus.emit('login:complete', { platform });
      }
    } catch (e) {
      console.error(`[ApiBridge] ${platform} login failed:`, e);
    }
  }

  /**
   * Returns the current login status for one or all platforms.
   * Prefers live IPC data; falls back to local cookie-store state.
   */
  async getLoginStatus(platform?: Platform): Promise<LoginState[]> {
    const ipc = this.resolveIPC();

    if (ipc) {
      try {
        const status = await ipc.getLoginStatus();
        const platforms: Platform[] = platform ? [platform] : ['netease', 'qq', 'qishui'];
        return platforms.map((p) => ({
          platform: p,
          isLoggedIn: status[p]?.loggedIn ?? false,
          profile: this.getUserProfile(p),
          cookie: status[p]?.cookie ?? '',
        }));
      } catch (e) {
        console.warn('[ApiBridge] getLoginStatus IPC failed:', e);
      }
    }

    // Fallback: check local state
    const platforms: Platform[] = platform ? [platform] : ['netease', 'qq', 'qishui'];
    return platforms.map((p) => ({
      platform: p,
      isLoggedIn: this.cookieStore.has(p) && this.cookieStore.get(p)!.length > 0,
      profile: this.getUserProfile(p),
      cookie: this.cookieStore.get(p) ?? '',
    }));
  }

  // ============================================================
  // User Playlists
  // ============================================================

  /**
   * Fetches user playlists from all logged-in platforms.
   * Merges NetEase + QQ results into a typed PlaylistMap.
   */
  async fetchUserPlaylists(): Promise<PlaylistMap> {
    const playlists: PlaylistMap = { netease: [], qq: [], qishui: [] };

    if (this.isNeteaseLoggedIn) {
      try {
        const data = await this.fetchApi(
          '/api/netease/user/playlist',
          {},
          'netease'
        ) as NeteasePlaylistsResponse;
        if (data?.playlist) {
          playlists.netease = data.playlist.map(
            (pl): Playlist => ({
              id: String(pl.id),
              name: pl.name,
              coverUrl: pl.coverImgUrl ?? '',
              trackCount: pl.trackCount ?? 0,
              platform: 'netease',
            })
          );
        }
      } catch (e) {
        console.warn('[ApiBridge] Failed to fetch Netease playlists:', e);
      }
    }

    if (this.isQQLoggedIn) {
      try {
        const data = await this.fetchApi(
          '/api/qq/user/playlist',
          {},
          'qq'
        ) as QQPlaylistsResponse;
        if (data?.code === 0 && data?.data?.disslist) {
          playlists.qq = data.data.disslist.map(
            (pl): Playlist => ({
              id: String(pl.dissid ?? pl.tid ?? pl.id ?? ''),
              name: pl.diss_name ?? pl.name ?? pl.title ?? pl.dirname ?? '',
              coverUrl: (
                pl.diss_cover ?? pl.logo ?? pl.picurl ?? pl.cover ?? ''
              ).replace(/^http:/, 'https:'),
              trackCount: pl.song_cnt ?? pl.songnum ?? pl.song_count ?? 0,
              platform: 'qq',
            })
          );
        }
      } catch (e) {
        console.warn('[ApiBridge] Failed to fetch QQ playlists:', e);
      }
    }


    if (this.isQishuiLoggedIn) {
      try {
        const data = await this.fetchApi(
          '/api/qishui/user/playlist',
          {},
          'qishui'
        ) as any;
        if (data?.code === 0 && data?.data?.disslist) {
          playlists.qishui = data.data.disslist.map(
            (pl: any): Playlist => ({
              id: String(pl.dissid ?? pl.tid ?? pl.id ?? ''),
              name: pl.diss_name ?? pl.name ?? pl.title ?? pl.dirname ?? '',
              coverUrl: (
                pl.diss_cover ?? pl.logo ?? pl.picurl ?? pl.cover ?? ''
              ).replace(/^http:/, 'https:'),
              trackCount: pl.song_cnt ?? pl.songnum ?? pl.song_count ?? 0,
              platform: 'qishui',
            })
          );
        }
      } catch (e) {
        console.warn('[ApiBridge] Failed to fetch Qishui playlists:', e);
      }
    }
    return playlists;
  }

  // ============================================================
  // Individual Playlist Detail
  // ============================================================

  async getNeteasePlaylist(id: string | number): Promise<unknown> {
    return this.fetchApi('/api/netease/playlist/detail', { id }, 'netease');
  }

  async getNeteaseUserPlaylist(uid: string | number): Promise<unknown> {
    return this.fetchApi('/api/netease/user/playlist', { uid }, 'netease');
  }

  async getQQPlaylist(id: string | number): Promise<unknown> {
    return this.fetchApi('/api/qq/playlist/detail', { id }, 'qq');
  }

  // ============================================================
  // Lyrics
  // ============================================================

  async getNeteaseLyric(id: string | number): Promise<unknown> {
    return this.fetchApi('/api/netease/lyric', { id }, 'netease');
  }

  async getQQLyric(songmid: string): Promise<unknown> {
    return this.fetchApi('/api/qq/lyric', { songmid }, 'qq');
  }

  // ============================================================
  // Song URLs
  // ============================================================

  async getNeteaseSongUrl(id: string | number): Promise<unknown> {
    return this.fetchApi('/api/netease/song/url', { id }, 'netease');
  }

  async getQQSongUrl(songmid: string): Promise<unknown> {
    return this.fetchApi('/api/qq/song/url', { songmid }, 'qq');
  }

  // ============================================================
  // Search
  // ============================================================

  /**
   * Cross-platform song search. When no platform is specified, searches both
   * NetEase and QQ concurrently and merges results. Returns a typed SearchResult.
   */
  async searchSongs(
    query: string,
    platform?: Platform,
    limit: number = 20
  ): Promise<SearchResult> {
    if (platform) {
      return platform === 'netease'
        ? this.searchNeteaseAsResult(query, limit)
        : this.searchQQAsResult(query, limit);
    }

    // Cross-platform: search all, merge results
    const [neteaseResult, qqResult, qishuiResult] = await Promise.allSettled([
      this.searchNeteaseAsResult(query, limit),
      this.searchQQAsResult(query, limit),
      this.searchQishuiAsResult(query, limit),
    ]);

    const tracks: Track[] = [];
    let total = 0;

    if (neteaseResult.status === 'fulfilled') {
      tracks.push(...neteaseResult.value.tracks);
      total += neteaseResult.value.total;
    }
    if (qqResult.status === 'fulfilled') {
      tracks.push(...qqResult.value.tracks);
      total += qqResult.value.total;
    }
    if (qishuiResult.status === 'fulfilled') {
      tracks.push(...qishuiResult.value.tracks);
      total += qishuiResult.value.total;
    }

    return {
      tracks,
      total,
      hasMore: tracks.length >= limit * 3,
    };
  }

  /**
   * Raw NetEase search — returns the unprocessed API response.
   */
  async searchNetease(keywords: string, limit: number = 20): Promise<unknown> {
    return this.fetchApi('/api/netease/search', { keywords, limit }, 'netease');
  }

  /**
   * Raw QQ search — returns the unprocessed API response.
   */
  async searchQQ(keywords: string, limit: number = 20): Promise<unknown> {
    return this.fetchApi('/api/qq/search', { keywords, limit }, 'qq');
  }

  // ============================================================
  // Legacy Compatibility Aliases
  // ============================================================

  async openNeteaseLogin(): Promise<void> {
    return this.loginPlatform('netease');
  }

  async openQQLogin(): Promise<void> {
    return this.loginPlatform('qq');
  }

  // ============================================================
  // Lifecycle
  // ============================================================

  /**
   * Cleans up IPC listeners and internal state. Call when the app is shutting down
   * or before discarding the instance.
   */
  destroy(): void {
    this.loginStateUnsub?.();
    this.loginStateUnsub = undefined;
    this.cookieStore.clear();
    this.neteaseProfile = null;
    this.qqProfile = null;
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  /**
   * Resolves the Electron IPC bridge. Uses the injected override if provided;
   * otherwise falls back to window.fluidmusic.
   */
  private resolveIPC(): FluidMusicIPC | undefined {
    if (this.ipcOverride) return this.ipcOverride;
    if (typeof window !== 'undefined') return window.fluidmusic;
    return undefined;
  }

  // --- User Profile Fetchers ---

  private async fetchNeteaseUserDetail(): Promise<UserProfile | null> {
    try {
      // Primary: account endpoint (identifies user from cookie, no uid needed)
      const data = await this.fetchApi('/api/netease/account', {}, 'netease') as NeteaseAccountResponse;

      let profile: NeteaseAccountResponse['profile'] | null;

      if (data?.profile) {
        profile = data.profile;
      } else {
        // Fallback: user/detail without uid (server resolves from cookie)
        const fallback = await this.fetchApi(
          '/api/netease/user/detail',
          {},
          'netease'
        ) as NeteaseAccountResponse;
        profile = fallback?.profile ?? null;
      }

      this.neteaseProfile = {
        userId: String(profile?.userId ?? ''),
        nickname: profile?.nickname ?? '网易云用户',
        avatarUrl: profile?.avatarUrl ?? '',
        platform: 'netease',
        vipType: profile?.vipType ?? 0,
        followCount: profile?.follows ?? 0,
        fanCount: profile?.followeds ?? 0,
        playlistCount: profile?.playlistCount ?? 0,
      };

      this.store.setUser('netease', this.neteaseProfile);
      return this.neteaseProfile;
    } catch (e) {
      console.warn('[ApiBridge] Failed to fetch Netease user detail:', e);
      return null;
    }
  }

  private async fetchQQUserDetail(): Promise<UserProfile | null> {
    try {
      const data = await this.fetchApi('/api/qq/user/detail', {}, 'qq') as QQUserDetailResponse;

      if (data?.code === 0 && data?.data) {
        // QQ response shape varies; normalise through a loose accessor
        const c = (data.data.creator ?? data.data) as Record<string, unknown>;
        const nick = (c.nick ?? c.nickname ?? 'QQ用户') as string;
        const headpic = (c.headpic ?? c.avatar ?? c.avatarUrl ?? '') as string;
        this.qqProfile = {
          userId: '',
          nickname: nick,
          avatarUrl: headpic.replace(/^http:/, 'https:'),
          platform: 'qq',
          vipType: (data.data.vipInfo?.vipType ?? 0) as number,
          followCount: (c.followcnt ?? c.followings ?? 0) as number,
          fanCount: (c.fanscnt ?? c.followers ?? 0) as number,
          playlistCount: (c.dissnum ?? c.playlistCount ?? 0) as number,
        };
      }

      this.store.setUser('qq', this.qqProfile);
      return this.qqProfile;
    } catch (e) {
      console.warn('[ApiBridge] Failed to fetch QQ user detail:', e);
      return null;
    }
  }

  // --- Synced Playlists Helper ---

  /**
   * Marks all playlists for the given platform as "synced" in localStorage,
   * so the left-chamber auto-check UI reflects the login state.
   */
  private autoCheckSyncedPlaylists(platform: Platform, playlists: PlaylistMap): void {
    try {
      const raw = localStorage.getItem('fluidmusic_synced_playlists');
      const synced: Record<string, Record<string, boolean>> = raw ? JSON.parse(raw) : {};
      if (!synced[platform]) synced[platform] = {};

      const allPl = [...(playlists.netease || []), ...(playlists.qq || [])];
      for (const pl of allPl) {
        if (pl.platform === platform) {
          synced[platform][pl.id] = true;
        }
      }

      localStorage.setItem('fluidmusic_synced_playlists', JSON.stringify(synced));
      console.log(`[ApiBridge] Auto-checked ${allPl.length} playlists for ${platform}`);
    } catch (e) {
      console.warn('[ApiBridge] Auto-check failed:', e);
    }
  }

  // --- Search Result Transformers ---

  /**
   * Searches NetEase and transforms the raw response into a typed SearchResult.
   */
  private async searchNeteaseAsResult(
    keywords: string,
    limit: number
  ): Promise<SearchResult> {
    const data = await this.fetchApi(
      '/api/netease/search',
      { keywords, limit },
      'netease'
    ) as NeteaseSearchResponse;

    const songs = data?.result?.songs ?? [];
    const tracks: Track[] = songs.map((s) => ({
      id: String(s.id),
      name: s.name,
      artist: s.ar?.map((a) => a.name).join('/') ?? '未知艺术家',
      album: s.al?.name,
      coverUrl: s.al?.picUrl,
      duration: Math.round((s.dt ?? 0) / 1000),
      platform: 'netease' as const,
    }));

    return {
      tracks,
      total: data?.result?.songCount ?? tracks.length,
      hasMore: tracks.length >= limit,
    };
  }

  /**
   * Searches QQ Music and transforms the raw response into a typed SearchResult.
   */
  private async searchQQAsResult(
    keywords: string,
    limit: number
  ): Promise<SearchResult> {
    const data = await this.fetchApi(
      '/api/qq/search',
      { keywords, limit },
      'qq'
    ) as QQSearchResponse;

    const list = data?.data?.song?.list ?? [];
    const tracks: Track[] = list.map((s) => ({
      id: s.songmid,
      name: s.songname,
      artist: s.singer?.map((si) => si.name).join('/') ?? '未知艺术家',
      album: s.albumname,
      coverUrl: s.albummid
        ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${s.albummid}.jpg`
        : undefined,
      duration: s.interval ?? 0,
      platform: 'qq' as const,
    }));

    return {
      tracks,
      total: data?.data?.song?.totalnum ?? tracks.length,
      hasMore: tracks.length >= limit,
    };
  }

  // ============================================================
  // Qishui / Luna Platform Methods
  // ============================================================

  private async fetchQishuiUserDetail(): Promise<UserProfile | null> {
    try {
      const data = await this.fetchApi(
        '/api/qishui/user/detail',
        {},
        'qishui'
      ) as any;
      if (data?.code === 0 && data?.data) {
        const d = data.data;
        this.qishuiProfile = {
          userId: String(d.userId ?? d.uid ?? ''),
          nickname: d.nickname ?? d.nick ?? '汽水用户',
          avatarUrl: (d.avatarUrl ?? d.avatar ?? d.headpic ?? '').replace(/^http:/, 'https:'),
          platform: 'qishui',
          vipType: 0,
          followCount: d.followCount ?? d.followings ?? 0,
          fanCount: d.fanCount ?? d.followers ?? 0,
          playlistCount: d.playlistCount ?? d.dissnum ?? 0,
        };
        this.store.setUser('qishui', this.qishuiProfile);
        return this.qishuiProfile;
      }
      return null;
    } catch (e) {
      console.warn('[ApiBridge] Failed to fetch Qishui user detail:', e);
      return null;
    }
  }

  async searchQishui(keywords: string, limit: number = 20): Promise<unknown> {
    return this.fetchApi('/api/qishui/search', { keywords, limit }, 'qishui');
  }

  async getQishuiTrackDetail(id: string | number): Promise<unknown> {
    return this.fetchApi('/api/qishui/track/detail', { id }, 'qishui');
  }

  async getQishuiLyric(id: string | number): Promise<unknown> {
    return this.fetchApi('/api/qishui/lyric', { id }, 'qishui');
  }

  async getQishuiSongUrl(id: string | number): Promise<unknown> {
    return this.fetchApi('/api/qishui/song/url', { id }, 'qishui');
  }

  private async searchQishuiAsResult(keywords: string, limit: number): Promise<SearchResult> {
    const data = await this.fetchApi(
      '/api/qishui/search',
      { keywords, limit },
      'qishui'
    ) as any;

    const items = data?.result_groups?.[0]?.data ?? [];
    const tracks: Track[] = items.map((item: any) => {
      const t = item?.entity?.track ?? {};
      const artists = (t.artists || []).map((a: any) => a.name || '');
      const cover = t.album?.url_cover || {};
      const coverUrl = cover.urls && cover.uri
        ? cover.urls[0] + cover.uri + '~tplv-b829550vbb-c5_375x375.webp'
        : undefined;
      return {
        id: String(t.id || ''),
        name: t.name || '',
        artist: artists.join('/') || '未知艺术家',
        album: t.album?.name,
        coverUrl,
        duration: Math.round((t.duration ?? 0) / 1000),
        platform: 'qishui' as const,
      };
    });

    return {
      tracks,
      total: items.length,
      hasMore: items.length >= limit,
    };
  }
}
