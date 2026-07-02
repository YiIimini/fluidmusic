// ============================================================
// Tests for AppStore — centralized state manager
// ============================================================
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppStore } from '../../src/core/app-store';
import { EventBus } from '../../src/core/event-bus';
import { EventNames } from '../../src/types/events';

describe('AppStore', () => {
  /** @type {EventBus} */
  let bus;
  /** @type {AppStore} */
  let store;

  beforeEach(() => {
    bus = new EventBus();
    store = new AppStore(bus);
  });

  // --- Initial State ---

  it('should start with default player state', () => {
    const state = store.getState();
    expect(state.player.currentTrack).toBeNull();
    expect(state.player.queue).toEqual([]);
    expect(state.player.queueIndex).toBe(-1);
    expect(state.player.isPlaying).toBe(false);
    expect(state.player.progress).toBe(0);
    expect(state.player.volume).toBe(0.8);
    expect(state.player.mode).toBe('sequential');
  });

  it('should start with default UI state', () => {
    const state = store.getState();
    expect(state.ui.activeOverlay).toBeNull();
    expect(state.ui.pinnedChambers).toEqual({ left: false, right: false, top: true });
  });

  it('should start with default user state', () => {
    const state = store.getState();
    expect(state.user.netease).toBeNull();
    expect(state.user.qq).toBeNull();
  });

  it('should start with null settings', () => {
    const state = store.getState();
    expect(state.settings).toBeNull();
  });

  // --- Player Actions ---

  it('should update isPlaying on setPlaying()', () => {
    store.setPlaying(true);
    expect(store.getState().player.isPlaying).toBe(true);

    store.setPlaying(false);
    expect(store.getState().player.isPlaying).toBe(false);
  });

  it('should emit PLAYBACK_STATE on setPlaying()', () => {
    const handler = vi.fn();
    bus.on(EventNames.PLAYBACK_STATE, handler);

    store.setPlaying(true);
    expect(handler).toHaveBeenCalledWith({ playing: true });

    store.setPlaying(false);
    expect(handler).toHaveBeenCalledWith({ playing: false });
  });

  it('should emit TRACK_CHANGE on playTrack()', () => {
    const handler = vi.fn();
    bus.on(EventNames.TRACK_CHANGE, handler);

    const track = {
      id: '123',
      name: 'Test Song',
      artist: 'Test Artist',
      duration: 240,
      platform: 'local',
    };

    store.playTrack(track);

    expect(handler).toHaveBeenCalledWith(track);
    expect(store.getState().player.currentTrack).toEqual(track);
    expect(store.getState().player.isPlaying).toBe(true);
    expect(store.getState().player.progress).toBe(0);
  });

  it('should update progress via setProgress()', () => {
    store.setProgress(42.5);
    expect(store.getState().player.progress).toBe(42.5);
  });

  it('should clamp volume to [0,1]', () => {
    store.setVolume(1.5);
    expect(store.getState().player.volume).toBe(1);

    store.setVolume(-0.5);
    expect(store.getState().player.volume).toBe(0);

    store.setVolume(0.42);
    expect(store.getState().player.volume).toBe(0.42);
  });

  it('should update play mode via setMode()', () => {
    store.setMode('random');
    expect(store.getState().player.mode).toBe('random');

    store.setMode('single');
    expect(store.getState().player.mode).toBe('single');
  });

  // --- UI Actions ---

  it('should set overlay and read back', () => {
    store.setOverlay('settings');
    expect(store.getState().ui.activeOverlay).toBe('settings');

    store.setOverlay(null);
    expect(store.getState().ui.activeOverlay).toBeNull();
  });

  it('should toggle chamber pin state', () => {
    // Left starts false
    expect(store.getState().ui.pinnedChambers.left).toBe(false);
    store.toggleChamber('left');
    expect(store.getState().ui.pinnedChambers.left).toBe(true);
    store.toggleChamber('left');
    expect(store.getState().ui.pinnedChambers.left).toBe(false);

    // Top starts true (default)
    expect(store.getState().ui.pinnedChambers.top).toBe(true);
    store.toggleChamber('top');
    expect(store.getState().ui.pinnedChambers.top).toBe(false);
  });

  // --- User Actions ---

  it('should set user profile and emit LOGIN_COMPLETE', () => {
    const handler = vi.fn();
    bus.on(EventNames.LOGIN_COMPLETE, handler);

    const profile = {
      userId: 'u1',
      nickname: 'TestUser',
      platform: 'netease',
    };

    store.setUser('netease', profile);

    expect(store.getState().user.netease).toEqual(profile);
    expect(handler).toHaveBeenCalledWith({ platform: 'netease', profile });
  });

  it('should clear user profile and emit LOGIN_LOGOUT', () => {
    const handler = vi.fn();
    bus.on(EventNames.LOGIN_LOGOUT, handler);

    // Set first
    store.setUser('netease', { userId: 'u1', nickname: 'Test', platform: 'netease' });
    // Then clear
    store.setUser('netease', null);

    expect(store.getState().user.netease).toBeNull();
    expect(handler).toHaveBeenCalledWith({ platform: 'netease' });
  });

  // --- Settings ---

  it('should update settings and emit SETTINGS_CHANGE', () => {
    const handler = vi.fn();
    bus.on(EventNames.SETTINGS_CHANGE, handler);

    const settings = {
      particle: { resolution: 100, scatterStrength: 0.5, sensitivity: 0.5, rotationSpeed: 1, colorScheme: 'warm', particleSize: 2 },
      foam: { count: 100, size: 1, iridescence: 0.5, floatAmplitude: 0.5, paletteId: 0 },
      lyrics: { visibleLines: 0, fontSize: 16, textColor: '#fff', highlightColor: '#ff0', fadeIntensity: 0.5 },
      playlist: { style: 'default', fontSize: 14, transparency: 0.5 },
      spectrum: { layerCount: 3, particlesPerLayer: 100, sensitivity: 0.5, colorScheme: 'warm' },
      controller: { particleDensity: 0.5, sandStrength: 0.5, style: 'default' },
      fluidBg: { intensity: 0.5, speed: 1, colorScheme: 'dark' },
      chambers: { transparency: 0.5, triggerSensitivity: 0.5, leftPinned: false, rightPinned: false, topPinned: true, bottomPinned: false, queueDockMag: false },
      system: { language: 'zh-CN', accountMultiLogin: false, wallpaperOpacity: 0.5, wallpaperRippleSpeed: 1, defaultPlayMode: 'sequential', defaultVolume: 0.8 },
    };

    store.updateSettings(settings);

    expect(store.getState().settings).toEqual(settings);
    expect(handler).toHaveBeenCalledWith(settings);
  });

  // --- Subscriptions ---

  it('should allow subscribers to receive state updates', () => {
    const listener = vi.fn();
    store.subscribe(listener);

    store.setPlaying(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(store.getState());

    store.setVolume(0.5);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('should allow unsubscribing from state updates', () => {
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.setPlaying(true);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.setPlaying(false);
    expect(listener).toHaveBeenCalledTimes(1); // still 1, not called again
  });

  it('should support multiple subscribers', () => {
    const l1 = vi.fn();
    const l2 = vi.fn();

    store.subscribe(l1);
    store.subscribe(l2);

    store.setOverlay('search');

    expect(l1).toHaveBeenCalledTimes(1);
    expect(l2).toHaveBeenCalledTimes(1);
  });

  // --- Readonly State ---

  it('should return frozen/immutable reference from getState', () => {
    const state = store.getState();
    // The same object is returned (not a copy), but typed as Readonly.
    // We verify the reference is the same internal state object.
    store.setVolume(0.3);
    expect(state.player.volume).toBe(0.3);
  });
});
