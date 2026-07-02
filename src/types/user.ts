// ============================================================
// FluidMusic — User & Login type definitions
// ============================================================

export interface UserProfile {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  platform: 'netease' | 'qq';
  vipType?: number;
  followCount?: number;
  fanCount?: number;
  playlistCount?: number;
}

export interface LoginState {
  platform: 'netease' | 'qq';
  isLoggedIn: boolean;
  profile: UserProfile | null;
  cookie: string;
}
