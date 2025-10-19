import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import * as path from 'path';
import { openFile, saveFile, saveFileAs, readFile } from './services/fileService';
import { initLogger, logInfo } from './services/logService';
import { initSettings, getSettings, updateSettings } from './services/settingsService';
import { initWorkDir } from './services/folderService';
import { convertToCards } from './services/converterService';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });

  // Load the index.html
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create application menu
  createMenu();

  // Setup IPC handlers
  setupIpcHandlers();
}

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            // TODO: Implement file open dialog
            console.log('Open file');
          },
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            // TODO: Implement save
            console.log('Save file');
          },
        },
        {
          label: 'Save As',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            // TODO: Implement save as
            console.log('Save as');
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'close' }],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Setup IPC handlers for file operations
 */
function setupIpcHandlers() {
  // File operations
  ipcMain.handle('file:open', async () => {
    return await openFile(mainWindow);
  });

  ipcMain.handle('file:save', async (_event, { filePath, content }) => {
    return await saveFile(filePath, content);
  });

  ipcMain.handle('file:saveAs', async (_event, { content, defaultPath }) => {
    return await saveFileAs(mainWindow, content, { defaultPath });
  });

  ipcMain.handle('file:read', async (_event, filePath: string) => {
    return await readFile(filePath);
  });

  // Settings operations
  ipcMain.handle('settings:get', async () => {
    return getSettings();
  });

  ipcMain.handle('settings:update', async (_event, updates) => {
    return await updateSettings(updates);
  });

  // Log operations
  ipcMain.handle('log:info', async (_event, message: string, meta?: Record<string, unknown>) => {
    logInfo(message, meta);
  });

  ipcMain.handle('log:warn', async (_event, message: string, meta?: Record<string, unknown>) => {
    const { logWarn } = await import('./services/logService');
    logWarn(message, meta);
  });

  ipcMain.handle('log:error', async (_event, message: string, error?: unknown) => {
    const { logError } = await import('./services/logService');
    logError(message, error);
  });

  ipcMain.handle('log:debug', async (_event, message: string, meta?: Record<string, unknown>) => {
    const { logDebug } = await import('./services/logService');
    logDebug(message, meta);
  });

  // Converter operations
  ipcMain.handle(
    'converter:convert',
    async (
      _event,
      {
        content,
        inputFilePath,
        copiedInputFilePath,
        fileName,
        fileExtension,
      }: {
        content: string;
        inputFilePath: string;
        copiedInputFilePath: string;
        fileName: string;
        fileExtension: string;
      }
    ) => {
      try {
        return convertToCards(
          content,
          inputFilePath,
          copiedInputFilePath,
          fileName,
          fileExtension
        );
      } catch (error) {
        const { logError } = await import('./services/logService');
        logError('Conversion failed', error);
        throw error;
      }
    }
  );
}

/**
 * Initialize application services
 */
async function initializeApp() {
  // Initialize logger
  initLogger();
  logInfo('Application starting...');

  // Initialize settings
  const settings = await initSettings();
  logInfo('Settings loaded', { settings });

  // Initialize work directory if set
  if (settings.workDir) {
    try {
      await initWorkDir(settings.workDir);
      logInfo('Work directory initialized', { workDir: settings.workDir });
    } catch (error) {
      logInfo('Failed to initialize work directory, will use default', { error });
    }
  }
}

// App lifecycle
app.whenReady().then(async () => {
  await initializeApp();
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
