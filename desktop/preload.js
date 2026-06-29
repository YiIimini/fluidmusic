const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fluidmusic', {
  // Window controls
  minimize: () => ipcRenderer.invoke('fluidmusic-window-minimize'),
  toggleFullscreen: () => ipcRenderer.invoke('fluidmusic-window-toggle-fullscreen'),
  close: () => ipcRenderer.invoke('fluidmusic-window-close'),
  getWindowState: () => ipcRenderer.invoke('fluidmusic-window-get-state'),
  windowMinimize: () => ipcRenderer.invoke('fluidmusic-window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('fluidmusic-window-maximize'),
  windowClose: () => ipcRenderer.invoke('fluidmusic-window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('fluidmusic-window-is-maximized'),

  // Window state events
  onWindowState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('fluidmusic-window-state', listener);
    return () => ipcRenderer.removeListener('fluidmusic-window-state', listener);
  },

  // Music platform login (legacy per-platform)
  openNeteaseLogin: () => ipcRenderer.invoke('netease-music-open-login'),
  clearNeteaseLogin: () => ipcRenderer.invoke('netease-music-clear-login'),
  openQQMusicLogin: () => ipcRenderer.invoke('qq-music-open-login'),
  clearQQMusicLogin: () => ipcRenderer.invoke('qq-music-clear-login'),

  // Unified login platform interface
  loginPlatform: (platform) => ipcRenderer.invoke('fluidmusic-login-platform', platform),
  logoutPlatform: (platform) => ipcRenderer.invoke('fluidmusic-logout-platform', platform),
  getLoginStatus: () => ipcRenderer.invoke('fluidmusic-get-login-status'),
  getCookies: () => ipcRenderer.invoke('fluidmusic-get-cookies'),

  // Login state change events (pushed by main process after login/logout)
  onLoginStateChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('login-state-changed', listener);
    return () => ipcRenderer.removeListener('login-state-changed', listener);
  },

  // Debug: renderer-to-terminal logging
  log: (msg) => ipcRenderer.send('fluidmusic-renderer-log', msg),

  // Wallpaper
  pickWallpaper: () => ipcRenderer.invoke('fluidmusic-pick-wallpaper'),

  // Settings persistence
  saveSettings: (settings) => ipcRenderer.invoke('fluidmusic-save-settings', settings),
  loadSettings: () => ipcRenderer.invoke('fluidmusic-load-settings'),
});

window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add('fluidmusic-desktop');
  document.body.classList.add('fluidmusic-shell');
});
