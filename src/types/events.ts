// ============================================================
// FluidMusic — Event name constants & type
// ============================================================

export const EventNames = {
  TRACK_CHANGE: 'track:change',
  TRACK_LIKE: 'track:like',
  PLAYBACK_STATE: 'playback:state',
  PLAYBACK_PROGRESS: 'playback:progress',
  LOGIN_COMPLETE: 'login:complete',
  LOGIN_LOGOUT: 'login:logout',
  SETTINGS_CHANGE: 'settings:change',
  SEARCH_OPEN: 'search:open',
  ERROR_SHOW: 'error:show',
} as const;

export type EventName = typeof EventNames[keyof typeof EventNames];
