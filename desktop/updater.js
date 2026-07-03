// ============================================================
// FluidMusic — Auto-Updater (macOS)
// Uses electron-updater to check for and install updates
// ============================================================
const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');

let mainWindow = null;
let updateCheckInterval = null;

// Configure autoUpdater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowDowngrade = false;

function initAutoUpdater(window) {
  mainWindow = window;
  if (!mainWindow) return;

  // ── Events ──
  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Checking for updates...');
    sendToRenderer('update-status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[Updater] Update available:', info.version);
    sendToRenderer('update-status', {
      status: 'available',
      version: info.version,
      releaseDate: info.releaseDate,
    });

    // Ask user
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '发现新版本',
      message: 'FluidMusic ' + info.version + ' 可用',
      detail: '是否立即下载更新？',
      buttons: ['立即下载', '稍后提醒'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.downloadUpdate();
        sendToRenderer('update-status', { status: 'downloading' });
      }
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] No update available');
    sendToRenderer('update-status', { status: 'up-to-date' });
  });

  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('update-status', {
      status: 'downloading',
      percent: Math.round(progress.percent),
    });
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('[Updater] Update downloaded');
    sendToRenderer('update-status', { status: 'downloaded' });

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '更新已下载',
      message: '更新已下载完成，是否立即重启安装？',
      buttons: ['立即重启', '稍后安装'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[Updater] Error:', err.message);
    sendToRenderer('update-status', { status: 'error', message: err.message });
  });

  // Start periodic check (every 4 hours)
  checkForUpdates();
  updateCheckInterval = setInterval(checkForUpdates, 4 * 60 * 60 * 1000);
}

function checkForUpdates() {
  try {
    autoUpdater.checkForUpdates().catch((e) => {
      console.warn('[Updater] Check failed:', e.message);
    });
  } catch (e) {
    console.warn('[Updater] Auto-update not configured:', e.message);
  }
}

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function stopAutoUpdater() {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
}

module.exports = { initAutoUpdater, checkForUpdates, stopAutoUpdater };
