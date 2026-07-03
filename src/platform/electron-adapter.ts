// src/platform/electron-adapter.ts
// Production adapter: delegates to Electron preload bridge

import type { PlatformAdapter } from './platform-adapter';

export function createElectronAdapter(): PlatformAdapter {
  const fm = (window as any).fluidmusic;

  return {
    type: 'electron',

    async login(platform) {
      if (!fm?.loginPlatform) return { ok: false, error: 'Not in Electron' };
      return fm.loginPlatform(platform);
    },
    async logout(platform) {
      if (fm?.logoutPlatform) await fm.logoutPlatform(platform);
    },
    async getLoginStatus() {
      if (!fm?.getLoginStatus) return {};
      return fm.getLoginStatus();
    },
    async getCookies() {
      if (!fm?.getCookies) return { netease: '', qq: '' };
      return fm.getCookies();
    },

    async pickImage() {
      if (!fm?.pickWallpaper) return { ok: false, error: 'Not in Electron' };
      return fm.pickWallpaper();
    },
    async pickVideo() {
      if (!fm?.pickBgVideo) return { ok: false, error: 'Not in Electron' };
      return fm.pickBgVideo();
    },
    async importAudioFiles() {
      if (!fm?.importLocalFiles) return [];
      return fm.importLocalFiles();
    },
    async clearBgVideo() {
      if (fm?.clearBgVideo) await fm.clearBgVideo();
    },

    minimize() { fm?.minimize?.(); },
    maximize() { fm?.windowMaximize?.(); },
    close() { fm?.close?.(); },
    async isMaximized() {
      if (!fm?.windowIsMaximized) return false;
      return fm.windowIsMaximized();
    },

    async saveSettings(data) {
      if (fm?.saveSettings) await fm.saveSettings(data);
      else localStorage.setItem('fluidmusic-settings', JSON.stringify(data));
    },
    async loadSettings() {
      if (fm?.loadSettings) return fm.loadSettings();
      const raw = localStorage.getItem('fluidmusic-settings');
      return raw ? JSON.parse(raw) : null;
    },

    onWindowState(cb) {
      return fm?.onWindowState?.(cb) || (() => {});
    },
    onThemeChanged(cb) {
      return fm?.onThemeChanged?.(cb) || (() => {});
    },
    onMediaControl(cb) {
      return fm?.onMediaControl?.(cb) || (() => {});
    },
  };
}
