const { BrowserWindow, screen } = require('electron');
const path = require('path');

let lyricWindow = null;

function createLyricWindow(parent) {
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

  lyricWindow.on('closed', function () { lyricWindow = null; });

  return lyricWindow;
}

function sendLyricUpdate(text, nextText) {
  if (lyricWindow && !lyricWindow.isDestroyed()) {
    lyricWindow.webContents.send('lyric-update', { text, nextText });
  }
}

function closeLyricWindow() {
  if (lyricWindow && !lyricWindow.isDestroyed()) {
    lyricWindow.close();
    lyricWindow = null;
  }
}

function getLyricWindow() {
  return lyricWindow;
}

module.exports = { createLyricWindow, sendLyricUpdate, closeLyricWindow, getLyricWindow };
