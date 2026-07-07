// ============================================================
// FluidMusic — Track, Playlist & Search type definitions
// ============================================================

/**
 * All supported music platforms.
 * P0: netease, qq (migrated from legacy)
 * P1: kugou, kuwo, migu, qishui (new adapters)
 * P2: spotify, applemusic, lx (official API / fallback)
 */
export type MusicPlatform =
  | 'netease'
  | 'qq'
  | 'kugou'
  | 'kuwo'
  | 'migu'
  | 'qishui'
  | 'spotify'
  | 'applemusic'
  | 'lx';

export interface Track {
  id: string;
  name: string;
  artist: string;
  album?: string;
  coverUrl?: string;
  duration: number;          // seconds
  platform: MusicPlatform | 'local';
  url?: string;              // streaming URL (may expire)
  lyric?: string;            // raw LRC text
}

export interface Playlist {
  id: string;
  name: string;
  coverUrl?: string;
  trackCount: number;
  platform: MusicPlatform | 'local';
  tracks?: Track[];
  userId?: string;
  description?: string;
}

export interface SearchResult {
  tracks: Track[];
  total: number;
  hasMore: boolean;
}
