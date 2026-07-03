// src/platform/browser-adapter.ts
// Browser polyfill: localStorage + fetch for everything Electron can't do

import type { PlatformAdapter } from './platform-adapter';

export function createBrowserAdapter(): PlatformAdapter {
  return {
    type: 'browser',

    async login() {
      return { ok: false, error: '请在桌面端登录' };
    },
    async logout() {},
    async getLoginStatus() {
      return {};
    },
    async getCookies() {
      return { netease: '', qq: '' };
    },

    async pickImage() {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) return resolve({ ok: false, cancelled: true });
          const reader = new FileReader();
          reader.onload = () => resolve({ ok: true, dataUrl: reader.result as string });
          reader.readAsDataURL(file);
        };
        input.click();
      });
    },
    async pickVideo() {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*';
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) return resolve({ ok: false, cancelled: true });
          const url = URL.createObjectURL(file);
          resolve({ ok: true, dataUrl: url });
        };
        input.click();
      });
    },
    async importAudioFiles() { return []; },
    async clearBgVideo() {},

    minimize() {},
    maximize() {},
    close() { window.close(); },
    async isMaximized() { return false; },

    async saveSettings(data) {
      localStorage.setItem('fluidmusic-settings', JSON.stringify(data));
    },
    async loadSettings() {
      const raw = localStorage.getItem('fluidmusic-settings');
      return raw ? JSON.parse(raw) : null;
    },

    onWindowState() { return () => {}; },
    onThemeChanged(cb) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => cb(mq.matches ? 'dark' : 'light');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    },
    onMediaControl() { return () => {}; },
  };
}
