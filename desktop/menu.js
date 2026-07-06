// ============================================================
// FluidMusic — macOS Application Menu
// Standard macOS menu bar with playback controls and window management
// ============================================================
const { Menu, app, shell } = require('electron');

function createApplicationMenu(mainWindow) {
  const isMac = process.platform === 'darwin';

  const template = [
    // macOS app menu
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { label: '关于 FluidMusic', role: 'about' },
        { type: 'separator' },
        {
          label: '偏好设置...',
          accelerator: 'Cmd+,',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('open-settings');
            }
          }
        },
        { type: 'separator' },
        { label: '服务', role: 'services' },
        { type: 'separator' },
        { label: '隐藏 FluidMusic', accelerator: 'Cmd+H', role: 'hide' },
        { label: '隐藏其他', accelerator: 'Cmd+Shift+H', role: 'hideOthers' },
        { label: '显示全部', role: 'unhide' },
        { type: 'separator' },
        { label: '退出 FluidMusic', accelerator: 'Cmd+Q', role: 'quit' },
      ]
    }] : []),

    // Playback menu
    {
      label: '播放',
      submenu: [
        {
          label: '播放 / 暂停',
          accelerator: 'Space',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('media-control', 'toggle');
            }
          }
        },
        {
          label: '下一曲',
          accelerator: 'Cmd+Right',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('media-control', 'next');
            }
          }
        },
        {
          label: '上一曲',
          accelerator: 'Cmd+Left',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('media-control', 'prev');
            }
          }
        },
        { type: 'separator' },
        {
          label: '音量增加',
          accelerator: 'Cmd+Up',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('media-control', 'vol-up');
            }
          }
        },
        {
          label: '音量减小',
          accelerator: 'Cmd+Down',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('media-control', 'vol-down');
            }
          }
        },
      ]
    },

    // Window menu
    {
      label: '窗口',
      submenu: [
        { label: '关闭窗口', accelerator: 'Cmd+W', role: 'close' },
        { label: '最小化', accelerator: 'Cmd+M', role: 'minimize' },
        { label: '缩放', role: 'zoom' },
        { type: "separator" },
        {
          label: "桌面歌词",
          accelerator: "Cmd+Shift+L",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send("media-control", "toggle-lyrics");
            }
          }
        },
        {
          label: "迷你播放器",
          accelerator: "Cmd+Shift+M",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send("media-control", "toggle-mini");
            }
          }
        },
        { type: 'separator' },
        { label: '进入全屏', accelerator: 'Cmd+Ctrl+F', role: 'togglefullscreen' },
        { type: 'separator' },
        { label: '前置全部窗口', role: 'front' },
      ]
    },

    // Help menu
    {
      label: '帮助',
      submenu: [
        {
          label: 'FluidMusic 项目主页',
          click: () => shell.openExternal('https://github.com/user/fluidmusic')
        },
        { type: 'separator' },
        {
          label: '开发者工具',
          accelerator: 'Cmd+Shift+I',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.toggleDevTools();
            }
          }
        },
      ]
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

module.exports = { createApplicationMenu };
