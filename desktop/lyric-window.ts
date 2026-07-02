import { BrowserWindow, screen } from 'electron';
import path from 'path';

let lyricWindow: BrowserWindow | null = null;

export function createLyricWindow(parent: BrowserWindow): BrowserWindow {
  if (lyricWindow && !lyricWindow.isDestroyed()) {
    lyricWindow.focus();
    return lyricWindow;
  }

  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;

  lyricWindow = new BrowserWindow({
    width: 800,
    height: 120,
    x: Math.round((screenW - 800) / 2),
    y: screenH - 150,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    hasShadow: false,
    parent,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  lyricWindow.loadFile(path.join(__dirname, '../public/lyric.html'));
  lyricWindow.setVisibleOnAllWorkspaces(true);

  lyricWindow.on('closed', () => { lyricWindow = null; });

  return lyricWindow;
}

export function sendLyricUpdate(text: string, nextText: string): void {
  if (lyricWindow && !lyricWindow.isDestroyed()) {
    lyricWindow.webContents.send('lyric-update', { text, nextText });
  }
}

export function closeLyricWindow(): void {
  if (lyricWindow && !lyricWindow.isDestroyed()) {
    lyricWindow.close();
    lyricWindow = null;
  }
}

export function getLyricWindow(): BrowserWindow | null {
  return lyricWindow;
}
