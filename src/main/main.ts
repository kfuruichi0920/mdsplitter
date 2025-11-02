import path from 'node:path';

import { app, BrowserWindow, ipcMain } from 'electron';

const isDev = process.env.NODE_ENV === 'development';
const resolveRendererIndexFile = () => path.resolve(__dirname, '../renderer/index.html');
const resolvePreloadPath = () => path.join(__dirname, 'preload.js');

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.loadFile(resolveRendererIndexFile());

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
};

ipcMain.handle('app:ping', async (_event, payload: string) => {
  console.log(`[main] received ping: ${payload}`);
  return { ok: true, timestamp: Date.now() };
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
