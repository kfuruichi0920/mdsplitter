import path from 'node:path';

import { app, BrowserWindow, ipcMain, shell } from 'electron';

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
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Security: Block navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const currentUrl = mainWindow?.webContents.getURL();
    
    // Only allow navigation within the app
    if (currentUrl && !navigationUrl.startsWith('file://')) {
      console.warn(`[main] Blocked navigation to: ${navigationUrl}`);
      event.preventDefault();
    }
  });

  // Security: Control window.open behavior
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const parsedUrl = new URL(url);
    
    // Open HTTPS URLs in external browser
    if (parsedUrl.protocol === 'https:') {
      shell.openExternal(url);
    } else {
      console.warn(`[main] Blocked window.open to: ${url}`);
    }
    
    return { action: 'deny' };
  });

  mainWindow.loadFile(resolveRendererIndexFile());

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
};

ipcMain.handle('app:ping', async (_event, payload: unknown) => {
  // Input validation
  if (typeof payload !== 'string') {
    console.error('[main] Invalid payload type for app:ping');
    throw new Error('Invalid payload: expected string');
  }
  
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

// Global error handlers for better stability
process.on('uncaughtException', (error) => {
  console.error('[main] Uncaught exception:', error);
  // In production, you might want to send this to a logging service
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[main] Unhandled rejection at:', promise, 'reason:', reason);
  // In production, you might want to send this to a logging service
});
