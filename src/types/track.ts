// ============================================================
// FluidMusic — Track, Playlist & Search type definitions
// ============================================================

export interface Track {
  id: string;
  name: string;
  artist: string;
  album?: string;
  coverUrl?: string;
  duration: number;          // seconds
  platform: 'netease' | 'qq' | 'local';
  url?: string;              // streaming URL (may expire)
  lyric?: string;            // raw LRC text
}

export interface Playlist {
  id: string;
  name: string;
  coverUrl?: string;
  trackCount: number;
  platform: 'netease' | 'qq' | 'local';
  tracks?: Track[];
  userId?: string;
  description?: string;
}

export interface SearchResult {
  tracks: Track[];
  total: number;
  hasMore: boolean;
}
