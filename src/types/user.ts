// ============================================================
// FluidMusic — User & Login type definitions
// ============================================================

import { MusicPlatform } from './track';

export interface UserProfile {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  platform: MusicPlatform;
  vipType?: number;
  followCount?: number;
  fanCount?: number;
  playlistCount?: number;
}

export interface LoginState {
  platform: MusicPlatform;
  isLoggedIn: boolean;
  profile: UserProfile | null;
  cookie: string;
}
