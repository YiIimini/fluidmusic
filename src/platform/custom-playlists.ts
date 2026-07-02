// ============================================================
// FluidMusic — Custom Playlist Manager (TypeScript)
// Create / edit / delete local playlists, add / remove songs
// Persisted to localStorage key 'fluidmusic-custom-playlists'
// Migrated from public/js/custom-playlists.js
// ============================================================

import type { Track } from '../types/track';

declare const __FM: {
  register: (name: string, deps: string[], factory: () => any, opts?: { priority?: number }) => void;
} | undefined;

declare const showToast: ((msg: string) => void) | undefined;
declare const FluidAudio: {
  setPlaylist: (tracks: any[], startIndex: number) => void;
  load: (url: string, track: any) => void;
  play: () => void;
} | undefined;
declare const FluidMusicApp: {
  syncPlaylists: () => void;
} | undefined;

// ---- Types ----

export interface CustomPlaylistTrack {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  platform: string;
  url: string;
  addedAt: number;
}

export interface CustomPlaylist {
  id: string;
  name: string;
  tracks: CustomPlaylistTrack[];
  createdAt: number;
}

const STORAGE_KEY = 'fluidmusic-custom-playlists';

// ---- CustomPlaylists ----

export class CustomPlaylists {
  playlists: CustomPlaylist[] = [];

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.playlists = raw ? JSON.parse(raw) : [];
      // Ensure all have tracks array
      this.playlists.forEach(p => { if (!p.tracks) p.tracks = []; });
    } catch (_e) {
      this.playlists = [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.playlists));
    } catch (_e) {
      if (typeof showToast !== 'undefined') showToast('⚠ 存储空间不足');
    }
  }

  /**
   * Create a new custom playlist. Returns the playlist or null if name is empty.
   */
  create(name: string): CustomPlaylist | null {
    if (!name || !name.trim()) {
      if (typeof showToast !== 'undefined') showToast('⚠ 请输入歌单名称');
      return null;
    }
    const pl: CustomPlaylist = {
      id: 'custom_' + Date.now(),
      name: name.trim(),
      tracks: [],
      createdAt: Date.now(),
    };
    this.playlists.push(pl);
    this.save();
    if (typeof showToast !== 'undefined') showToast('✅ 歌单「' + pl.name + '」已创建');
    return pl;
  }

  /**
   * Delete a custom playlist by id. Returns true if deleted.
   */
  remove(playlistId: string): boolean {
    const idx = this.playlists.findIndex(p => p.id === playlistId);
    if (idx < 0) return false;
    const name = this.playlists[idx].name;
    this.playlists.splice(idx, 1);
    this.save();
    if (typeof showToast !== 'undefined') showToast('\u{1F5D1} 歌单「' + name + '」已删除');
    return true;
  }

  /**
   * Rename a custom playlist. Returns true on success.
   */
  rename(playlistId: string, newName: string): boolean {
    const pl = this.playlists.find(p => p.id === playlistId);
    if (!pl || !newName || !newName.trim()) return false;
    pl.name = newName.trim();
    this.save();
    return true;
  }

  /**
   * Add a track to a custom playlist (deduplicates by id + platform).
   * Returns true if added.
   */
  addTrack(playlistId: string, track: Track): boolean {
    const pl = this.playlists.find(p => p.id === playlistId);
    if (!pl) return false;
    const exists = pl.tracks.some(t => t.id === track.id && t.platform === track.platform);
    if (exists) {
      if (typeof showToast !== 'undefined') showToast('\u{1F4CB} 已在歌单中');
      return false;
    }
    pl.tracks.push({
      id: track.id,
      title: track.name || '未知',
      artist: track.artist || '',
      coverUrl: track.coverUrl || '',
      platform: track.platform || 'local',
      url: '',
      addedAt: Date.now(),
    });
    this.save();
    if (typeof showToast !== 'undefined') showToast('+ 已添加到「' + pl.name + '」');
    return true;
  }

  /**
   * Remove a track from a custom playlist by track id + platform.
   * Returns true if removed.
   */
  removeTrack(playlistId: string, trackId: string, platform: string): boolean {
    const pl = this.playlists.find(p => p.id === playlistId);
    if (!pl) return false;
    const before = pl.tracks.length;
    pl.tracks = pl.tracks.filter(t => !(t.id === trackId && t.platform === platform));
    if (pl.tracks.length < before) {
      this.save();
      return true;
    }
    return false;
  }

  /**
   * Get a single playlist by id, or null if not found.
   */
  getPlaylist(playlistId: string): CustomPlaylist | null {
    return this.playlists.find(p => p.id === playlistId) || null;
  }

  /**
   * Return all custom playlists.
   */
  getAll(): CustomPlaylist[] {
    return this.playlists;
  }

  /**
   * Return number of tracks in a playlist (0 if not found).
   */
  getTrackCount(playlistId: string): number {
    const pl = this.getPlaylist(playlistId);
    return pl ? pl.tracks.length : 0;
  }

  // ── Render custom playlists in left chamber ──
  renderInSidebar(container: HTMLElement): void {
    if (!container) return;
    if (this.playlists.length === 0) return;

    // Divider
    const divider = document.createElement('div');
    divider.className = 'playlist-platform-divider';
    divider.textContent = '\u{1F4DD} 我的歌单';
    container.appendChild(divider);

    this.playlists.forEach(pl => {
      const div = document.createElement('div');
      div.className = 'playlist-item playlist-item-rich';
      div.innerHTML =
        '<span class="playlist-item-cover playlist-cover-heart" style="font-size:20px;">\u{1F4DD}</span>' +
        '<div class="playlist-item-info">' +
          '<span class="playlist-item-name">' + this.escapeHtml(pl.name) + '</span>' +
          '<span class="playlist-item-count">' + pl.tracks.length + ' 首 · 本地</span>' +
        '</div>' +
        '<button class="custom-pl-delete" data-id="' + pl.id + '" title="删除歌单" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:12px;margin-left:auto;padding:4px 8px;opacity:0;transition:opacity 0.2s;">✕</button>';

      div.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.custom-pl-delete')) return;
        this.loadCustomPlaylistTracks(pl);
      });

      // Delete button hover
      div.addEventListener('mouseenter', () => {
        const btn = div.querySelector('.custom-pl-delete') as HTMLElement | null;
        if (btn) btn.style.opacity = '1';
      });
      div.addEventListener('mouseleave', () => {
        const btn = div.querySelector('.custom-pl-delete') as HTMLElement | null;
        if (btn) btn.style.opacity = '0';
      });

      // Delete handler
      const delBtn = div.querySelector('.custom-pl-delete');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.remove(pl.id);
          this.refreshSidebar();
        });
      }

      container.appendChild(div);
    });
  }

  loadCustomPlaylistTracks(pl: CustomPlaylist): void {
    const container = document.getElementById('playlist-items');
    if (!container) return;

    const backBtn = document.getElementById('btn-playlist-back');
    if (backBtn) backBtn.style.display = 'flex';

    if (pl.tracks.length === 0) {
      container.innerHTML = '<div class="playlist-item" style="text-align:center;padding:20px;color:var(--text-dim);">空歌单</div>';
      return;
    }

    container.innerHTML = '';
    const playAll = document.createElement('div');
    playAll.className = 'playlist-item playlist-playall';
    playAll.textContent = '▶ 播放全部 (' + pl.tracks.length + ')';
    playAll.addEventListener('click', () => {
      if (typeof FluidAudio !== 'undefined') {
        FluidAudio.setPlaylist(pl.tracks, 0);
        this.playFirstTrack(pl.tracks);
      }
    });
    container.appendChild(playAll);

    pl.tracks.forEach((track, i) => {
      const row = document.createElement('div');
      row.className = 'playlist-item playlist-item-row';
      const info = this.escapeHtml(track.title) + (track.artist ? ' — ' + this.escapeHtml(track.artist) : '');
      row.innerHTML =
        '<span class="pli-actions">' +
          '<button class="pli-btn pli-play" data-idx="' + i + '" title="播放">▶</button>' +
          '<button class="pli-btn pli-remove" data-idx="' + i + '" title="移除">✕</button>' +
        '</span>' +
        '<span class="pli-name">' + info + '</span>';

      const playBtn = row.querySelector('.pli-play');
      if (playBtn) {
        playBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const t = pl.tracks[i];
          if ((!t.url || t.platform === 'qq') && t.id && typeof (window as any)._fetchTrackUrl === 'function') {
            t.url = await (window as any)._fetchTrackUrl(t);
          }
          if (t.url && typeof FluidAudio !== 'undefined') {
            FluidAudio.setPlaylist(pl.tracks, i);
            FluidAudio.load(t.url, t);
            FluidAudio.play();
          }
        });
      }

      const removeBtn = row.querySelector('.pli-remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.removeTrack(pl.id, track.id, track.platform);
          this.loadCustomPlaylistTracks(pl);
        });
      }

      container.appendChild(row);
    });
  }

  private async playFirstTrack(tracks: CustomPlaylistTrack[]): Promise<void> {
    const t = tracks[0];
    if ((!t.url || t.platform === 'qq') && t.id && typeof (window as any)._fetchTrackUrl === 'function') {
      try { t.url = await (window as any)._fetchTrackUrl(t); } catch (_e) { /* ignore */ }
    }
    if (t.url && typeof FluidAudio !== 'undefined') {
      FluidAudio.load(t.url, t);
      FluidAudio.play();
    }
  }

  private refreshSidebar(): void {
    if (typeof FluidMusicApp !== 'undefined' && FluidMusicApp.syncPlaylists) {
      FluidMusicApp.syncPlaylists();
    }
  }

  // ── Create playlist dialog ──
  showCreateDialog(): void {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);';
    overlay.innerHTML =
      '<div style="background:rgba(10,10,24,0.95);border:1px solid var(--glass-border);border-radius:14px;padding:20px;width:320px;backdrop-filter:blur(20px);">' +
        '<div style="font-size:14px;color:var(--text-primary);margin-bottom:12px;">创建新歌单</div>' +
        '<input id="new-pl-name" type="text" placeholder="歌单名称..." autofocus ' +
          'style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid var(--glass-border);background:rgba(255,255,255,0.05);color:var(--text-primary);font-size:13px;outline:none;margin-bottom:12px;">' +
        '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
          '<button id="new-pl-cancel" style="padding:6px 16px;border-radius:8px;border:1px solid var(--glass-border);background:transparent;color:var(--text-dim);cursor:pointer;">取消</button>' +
          '<button id="new-pl-confirm" style="padding:6px 16px;border-radius:8px;border:none;background:var(--accent-color);color:#fff;cursor:pointer;">创建</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#new-pl-name') as HTMLInputElement | null;
    const cancelBtn = overlay.querySelector('#new-pl-cancel');
    const confirmBtn = overlay.querySelector('#new-pl-confirm');

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => overlay.remove());
    }
    if (confirmBtn && input) {
      confirmBtn.addEventListener('click', () => {
        const pl = this.create(input.value);
        if (pl) {
          overlay.remove();
          this.refreshSidebar();
        }
      });
    }
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const pl = this.create(input.value);
          if (pl) { overlay.remove(); this.refreshSidebar(); }
        }
      });
      setTimeout(() => input.focus(), 100);
    }
  }

  private escapeHtml(str: string): string {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Init ──
  init(): void {
    this.load();
    console.log('[CustomPlaylists] Loaded', this.playlists.length, 'custom playlists');
  }
}

// ── Singleton + backward-compat ──
const instance = new CustomPlaylists();

(window as any).CustomPlaylists = instance;
if (typeof __FM !== 'undefined') {
  __FM.register('customPlaylists', [], () => instance, { priority: 7 });
}
console.log('FluidMusic Custom Playlists loaded (TS)');
