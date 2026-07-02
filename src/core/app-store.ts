// ============================================================
// FluidMusic — AppStore: centralized state manager
// Single source of truth for all application state.
// Replaces window.X variable reads between modules.
// ============================================================

import { Track } from '../types/track';
import { PlayMode } from '../types/audio';
import { UserProfile } from '../types/user';
import { DIYSettings } from '../types/settings';
import { EventBus } from './event-bus';
import { EventNames } from '../types/events';

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  progress: number;
  volume: number;
  mode: PlayMode;
}

interface UIState {
  activeOverlay: 'settings' | 'user' | 'search' | null;
  pinnedChambers: { left: boolean; right: boolean; top: boolean };
}

interface UserState {
  netease: UserProfile | null;
  qq: UserProfile | null;
}

export interface AppState {
  player: PlayerState;
  ui: UIState;
  user: UserState;
  settings: DIYSettings | null;
}

type StateListener = (state: AppState) => void;

const DEFAULT_PLAYER: PlayerState = {
  currentTrack: null, queue: [], queueIndex: -1,
  isPlaying: false, progress: 0, volume: 0.8, mode: 'sequential',
};

const DEFAULT_UI: UIState = {
  activeOverlay: null,
  pinnedChambers: { left: false, right: false, top: true },
};

const DEFAULT_USER: UserState = { netease: null, qq: null };

export class AppStore {
  private state: AppState;
  private listeners = new Set<StateListener>();

  constructor(private bus: EventBus) {
    this.state = {
      player: { ...DEFAULT_PLAYER },
      ui: { ...DEFAULT_UI },
      user: { ...DEFAULT_USER },
      settings: null,
    };
  }

  getState(): Readonly<AppState> { return this.state; }

  subscribe(fn: StateListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setState(partial: Partial<AppState>): void {
    Object.assign(this.state, partial);
    this.listeners.forEach(fn => fn(this.state));
  }

  // Player actions
  playTrack(track: Track): void {
    this.state.player.currentTrack = track;
    this.state.player.isPlaying = true;
    this.state.player.progress = 0;
    this.notify();
    this.bus.emit(EventNames.TRACK_CHANGE, track);
  }

  setPlaying(playing: boolean): void {
    this.state.player.isPlaying = playing;
    this.notify();
    this.bus.emit(EventNames.PLAYBACK_STATE, { playing });
  }

  setProgress(progress: number): void {
    this.state.player.progress = progress;
    this.notify();
  }

  setVolume(volume: number): void {
    this.state.player.volume = Math.max(0, Math.min(1, volume));
    this.notify();
  }

  setMode(mode: PlayMode): void {
    this.state.player.mode = mode;
    this.notify();
  }

  // UI actions
  setOverlay(overlay: UIState['activeOverlay']): void {
    this.state.ui.activeOverlay = overlay;
    this.notify();
  }

  toggleChamber(chamber: 'left' | 'right' | 'top'): void {
    this.state.ui.pinnedChambers[chamber] = !this.state.ui.pinnedChambers[chamber];
    this.notify();
  }

  // User actions
  setUser(platform: 'netease' | 'qq', profile: UserProfile | null): void {
    this.state.user[platform] = profile;
    this.notify();
    if (profile) this.bus.emit(EventNames.LOGIN_COMPLETE, { platform, profile });
    else this.bus.emit(EventNames.LOGIN_LOGOUT, { platform });
  }

  // Settings
  updateSettings(settings: DIYSettings): void {
    this.state.settings = settings;
    this.notify();
    this.bus.emit(EventNames.SETTINGS_CHANGE, settings);
  }

  private notify(): void {
    this.listeners.forEach(fn => fn(this.state));
  }
}
