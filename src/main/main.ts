
/**
 * @file main.ts
 * @brief Electronアプリのメインプロセス初期化・ウィンドウ管理。
 * @details
 * アプリ起動時のウィンドウ生成、IPCハンドラ登録、終了処理を担当。
 * 例:
 * @code
 * npm run start
 * @endcode
 * @author K.Furuichi
 * @date 2025-11-02
 * @version 0.1
 * @copyright MIT
 * @see preload.ts, renderer/index.html
 */
import path from 'node:path';

import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import type { SaveDialogOptions } from 'electron';

import type { LogLevel } from '../shared/settings';

import {
  getWorkspacePaths,
  initializeWorkspace,
  listCardFiles,
  listOutputFiles,
  loadCardFile,
  loadOutputFile,
  loadTraceFile,
  saveTraceFile,
  loadSettings,
  loadWorkspaceSnapshot,
  saveCardFileSnapshot,
  saveWorkspaceSnapshot,
  updateSettings,
} from './workspace';
import type { TraceFileSaveRequest } from '../shared/traceability';
import { initLogger, logMessage, updateLoggerSettings } from './logger';

const isDev = process.env.NODE_ENV === 'development'; ///< 開発モード判定

/**
 * @brief レンダラーのindex.htmlファイルパスを解決。
 * @return 絶対パス。
 */
const resolveRendererIndexFile = () => path.resolve(__dirname, '../renderer/index.html');

/**
 * @brief preload.jsファイルパスを解決。
 * @return 絶対パス。
 */
const resolvePreloadPath = () => path.join(__dirname, 'preload.js');

let mainWindow: BrowserWindow | null = null; ///< メインウィンドウ参照

/**
 * @brief メインウィンドウを生成・初期化。
 * @details
 * ウィンドウサイズ・WebPreferencesを設定し、ready-to-showで表示。
 * @todo 複数ウィンドウ対応。
 */
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,        ///< 初期幅
    height: 800,        ///< 初期高さ
    minWidth: 960,      ///< 最小幅
    minHeight: 600,     ///< 最小高さ
    show: false,        ///< 初期非表示
    webPreferences: {
      preload: resolvePreloadPath(), ///< preloadスクリプト
      contextIsolation: true,        ///< コンテキスト分離
      nodeIntegration: false,        ///< Node.js無効
      sandbox: true                  ///< サンドボックス有効
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show(); //!< ウィンドウ表示
  });

  mainWindow.loadFile(resolveRendererIndexFile()); //!< レンダラー読込

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' }); //!< DevTools分離表示
  }
};


/**
 * @brief レンダラーからのping要求を処理。
 * @param _event IPCイベント（未使用）
 * @param payload 受信メッセージ
 * @return { ok: true, timestamp: number }
 * @note デバッグ用。副作用: ログ出力。
 */
ipcMain.handle('app:ping', async (_event, payload: string) => {
  console.log(`[main] received ping: ${payload}`); //!< 受信ログ
  return { ok: true, timestamp: Date.now() };
});

ipcMain.handle('settings:load', async () => {
  return loadSettings();
});

ipcMain.handle('settings:update', async (_event, patch) => {
  if (typeof patch !== 'object' || patch === null) {
    throw new Error('Invalid settings payload');
  }

  const updated = await updateSettings(patch);
  updateLoggerSettings(updated);
  logMessage('info', '設定を更新しました');
  return updated;
});

ipcMain.handle('log:write', async (_event, payload: { level: LogLevel; message: string }) => {
  if (!payload || typeof payload.message !== 'string') {
    throw new Error('Invalid log payload');
  }

  logMessage(payload.level, payload.message);
  return { ok: true };
});

ipcMain.handle('workspace:save', async (_event, snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('Invalid workspace payload');
  }

  if (!Array.isArray(snapshot.cards)) {
    throw new Error('Workspace payload requires cards array');
  }

  const path = await saveWorkspaceSnapshot(snapshot);
  logMessage('info', `ワークスペースを保存しました: ${path}`);
  return { path };
});

ipcMain.handle('workspace:saveCardFile', async (_event, payload) => {
  const { fileName, snapshot } = payload ?? {};
  if (typeof fileName !== 'string') {
    throw new Error('保存ファイル名が無効です');
  }
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.cards)) {
    throw new Error('カードスナップショットが無効です');
  }

  const savedPath = await saveCardFileSnapshot(fileName, snapshot);
  logMessage('info', `カードファイルを保存しました: ${savedPath}`);
  return { path: savedPath };
});

ipcMain.handle('workspace:load', async () => {
  const snapshot = await loadWorkspaceSnapshot();
  if (snapshot) {
    logMessage('info', 'ワークスペーススナップショットを読み込みました');
  }
  return snapshot;
});

ipcMain.handle('workspace:listCardFiles', async () => {
  const files = await listCardFiles();
  logMessage('info', `カードファイル一覧を取得しました: ${files.length}件`);
  return files;
});

ipcMain.handle('workspace:listOutputFiles', async () => {
  const files = await listOutputFiles();
  logMessage('info', `出力ファイル一覧を取得しました: ${files.length}件`);
  return files;
});

ipcMain.handle('workspace:loadCardFile', async (_event, fileName: string) => {
  logMessage('info', `カードファイルを読み込みます (_input): ${fileName}`);
  const snapshot = await loadCardFile(fileName);
  if (snapshot) {
    logMessage('info', `カードファイルを読み込みました: ${fileName} (${snapshot.cards.length}枚)`);
  } else {
    logMessage('warn', `カードファイルの読み込みに失敗しました: ${fileName}`);
  }
  return snapshot;
});

ipcMain.handle('workspace:loadOutputFile', async (_event, fileName: string) => {
  logMessage('info', `出力ファイルを読み込みます (_out): ${fileName}`);
  const snapshot = await loadOutputFile(fileName);
  if (snapshot) {
    logMessage('info', `出力ファイルを読み込みました: ${fileName} (${snapshot.cards.length}枚)`);
  } else {
    logMessage('warn', `出力ファイルの読み込みに失敗しました: ${fileName}`);
  }
  return snapshot;
});

ipcMain.handle('workspace:loadTraceFile', async (_event, args: { leftFile: string; rightFile: string }) => {
  const { leftFile, rightFile } = args;
  logMessage('debug', `トレーサビリティファイルを探索します: left=${leftFile}, right=${rightFile}`);
  const trace = await loadTraceFile(leftFile, rightFile);
  if (trace) {
    logMessage('info', `トレーサビリティファイルを読み込みました: ${trace.fileName}`);
  } else {
    logMessage('debug', '対応するトレーサビリティファイルが見つかりませんでした');
  }
  return trace;
});

ipcMain.handle('workspace:saveTraceFile', async (_event, payload: TraceFileSaveRequest) => {
  logMessage('info', `トレーサビリティファイルを保存します: left=${payload.leftFile}, right=${payload.rightFile}`);
  const result = await saveTraceFile(payload);
  logMessage('info', `トレーサビリティファイルを保存しました: ${result.fileName}`);
  return result;
});

ipcMain.handle('dialog:promptSaveFile', async (_event, options: { defaultFileName?: string } = {}) => {
  const paths = getWorkspacePaths();
  const sanitizedDefault = typeof options.defaultFileName === 'string' && options.defaultFileName.trim().length > 0
    ? options.defaultFileName.trim()
    : 'cards.json';
  const defaultPath = path.join(paths.outputDir, sanitizedDefault);
  const browserWindow = BrowserWindow.getFocusedWindow() ?? mainWindow ?? undefined;
  const dialogOptions: SaveDialogOptions = {
    title: 'カードファイルを保存',
    defaultPath,
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
    properties: ['showOverwriteConfirmation', 'createDirectory'],
  };

  const result = browserWindow
    ? await dialog.showSaveDialog(browserWindow, dialogOptions)
    : await dialog.showSaveDialog(dialogOptions);
  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }
  return { canceled: false, fileName: path.basename(result.filePath) };
});


// アプリ起動時の初期化処理
app.whenReady().then(async () => {
  const paths = await initializeWorkspace();
  const settings = await loadSettings();
  await initLogger(settings, paths);
  logMessage('info', 'アプリケーションを起動しました');

  createWindow(); //!< 初回ウィンドウ生成

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(); //!< macOSで全ウィンドウ閉時の再生成
    }
  });
});


/**
 * @brief 全ウィンドウ閉時の終了処理。
 * @details
 * macOS以外ではアプリ終了。macOSは慣例的に残す。
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit(); //!< アプリ終了
  }
});
