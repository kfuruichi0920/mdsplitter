
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
import { promises as fs } from 'node:fs';

import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import type { OpenDialogOptions, SaveDialogOptions } from 'electron';

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
import type { WorkspacePaths } from './workspace';
import type { TraceFileSaveRequest } from '../shared/traceability';
import { initLogger, logMessage, updateLoggerSettings } from './logger';
import { DocumentLoadError, loadDocumentFromPath } from './documentLoader';
import type { LoadedDocument } from './documentLoader';

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
let isQuitting = false; ///< アプリ終了中フラグ
let userClosingDecision: 'discard' | 'apply' | 'cancel' | null = null; ///< ユーザーのクローズ時の選択

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

  //! ウィンドウクローズイベントをフック
  mainWindow.on('close', (event) => {
    if (isQuitting) {
      //! 既にアプリ終了処理中の場合は、そのままクローズを許可
      return;
    }

    //! レンダラープロセスに未保存の変更確認を要求
    event.preventDefault();
    mainWindow?.webContents.send('app:checkUnsavedChanges');
  });
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

/**
 * @brief 未保存の変更に対するユーザーの選択を処理。
 * @details
 * レンダラープロセスからのユーザーの選択を受け取り、適切なアクションを実行。
 * - 'discard': 未保存の変更を破棄してアプリを終了
 * - 'apply': 未保存の変更を保存してアプリを終了（レンダラー側で保存後、再度終了要求）
 * - 'cancel': アプリの終了をキャンセル
 */
ipcMain.on('app:unsavedChangesResponse', (_event, response: { action: 'discard' | 'apply' | 'cancel' }) => {
  const { action } = response;
  userClosingDecision = action;

  if (action === 'discard') {
    //! 変更を破棄して終了
    logMessage('info', 'ユーザーが変更を破棄してアプリを終了しました');
    isQuitting = true;
    mainWindow?.close();
    app.quit();
  } else if (action === 'apply') {
    //! 変更を適用（レンダラー側で保存処理を実行）
    //! レンダラー側で保存が完了したら'app:savedAndReadyToQuit'イベントが送信される
    logMessage('info', 'ユーザーが変更を保存してアプリを終了します');
  } else if (action === 'cancel') {
    //! 終了をキャンセル
    logMessage('info', 'ユーザーがアプリの終了をキャンセルしました');
    userClosingDecision = null;
  }
});

/**
 * @brief レンダラー側で保存が完了し、アプリ終了の準備ができたことを通知。
 * @details
 * 'apply'アクション選択後、レンダラー側で全ての保存が完了したら
 * このイベントが送信され、アプリを安全に終了する。
 */
ipcMain.on('app:savedAndReadyToQuit', () => {
  logMessage('info', '全ての変更を保存しました。アプリを終了します');
  isQuitting = true;
  mainWindow?.close();
  app.quit();
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

ipcMain.handle('document:pickSource', async () => {
  const browserWindow = BrowserWindow.getFocusedWindow() ?? mainWindow ?? undefined;
  const paths = getWorkspacePaths();
  const options: OpenDialogOptions = {
    title: '変換するテキスト/Markdownファイルを選択',
    defaultPath: paths.inputDir,
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown'] },
      { name: 'Text', extensions: ['txt'] },
      { name: 'すべて', extensions: ['txt', 'md', 'markdown'] },
    ],
    properties: ['openFile'],
  };

  const result = browserWindow
    ? await dialog.showOpenDialog(browserWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  try {
    const settings = await loadSettings();
    const document = await loadDocumentFromPath(result.filePaths[0], settings);
    const imported = await importSourceDocument(document, paths);
    logMessage(
      document.sizeStatus === 'warn' ? 'warn' : 'info',
      `入力ファイルを読み込みました: ${document.fileName} (${document.encoding}, ${document.sizeBytes} bytes)`,
    );
    return {
      canceled: false,
      document: {
        fileName: document.fileName,
        baseName: document.baseName,
        extension: document.extension,
        sizeBytes: document.sizeBytes,
        encoding: document.encoding,
        content: document.content,
        isMarkdown: document.isMarkdown,
        sizeStatus: document.sizeStatus,
        workspaceFileName: imported?.fileName ?? null,
        workspacePath: imported?.absolutePath ?? null,
      },
    };
  } catch (error) {
    if (error instanceof DocumentLoadError) {
      logMessage('warn', `入力ファイルの読み込みに失敗しました (${error.code}): ${error.message}`);
      return { canceled: false, error: { message: error.message, code: error.code } };
    }
    logMessage('error', `入力ファイル読み込みで予期せぬ例外: ${String(error)}`);
    return { canceled: false, error: { message: '入力ファイルの読み込み中にエラーが発生しました。', code: 'READ_FAILED' } };
  }
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
    isQuitting = true;
    app.quit(); //!< アプリ終了
  }
});

/**
 * @brief アプリ終了前の処理。
 * @details
 * Cmd+Qなどでアプリ全体の終了が要求された場合の処理。
 */
app.on('before-quit', (event) => {
  if (isQuitting) {
    //! 既にアプリ終了処理中の場合は、そのまま終了を許可
    return;
  }

  //! 未保存の変更確認が必要な場合は終了を一時停止
  if (!mainWindow) {
    return;
  }

  event.preventDefault();
  isQuitting = false;
  //! レンダラープロセスに未保存の変更確認を要求
  mainWindow.webContents.send('app:checkUnsavedChanges');
});
const sanitizeInputFileName = (fileName: string, fallbackExt = '.txt'): string => {
  const trimmed = fileName?.trim?.() ?? '';
  const ext = path.extname(trimmed) || fallbackExt;
  const base = (ext ? trimmed.slice(0, -ext.length) : trimmed) || 'imported_document';
  const safeBase = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeExt = ext.replace(/[^a-zA-Z0-9._-]/g, '').length > 0 ? ext : fallbackExt;
  return `${safeBase}${safeExt}`;
};

const fileExists = async (targetPath: string): Promise<boolean> => {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    return false;
  }
};

const ensureUniqueInputFileName = async (dir: string, preferred: string): Promise<string> => {
  const ext = path.extname(preferred);
  const base = ext ? preferred.slice(0, -ext.length) : preferred;
  let attempt = preferred;
  let counter = 1;
  while (await fileExists(path.join(dir, attempt))) {
    attempt = `${base}_${String(counter).padStart(2, '0')}${ext}`;
    counter += 1;
  }
  return attempt;
};

const isWithinDirectory = (targetPath: string, directory: string): boolean => {
  const relative = path.relative(directory, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const importSourceDocument = async (
  doc: LoadedDocument,
  paths: WorkspacePaths,
): Promise<{ fileName: string; absolutePath: string } | null> => {
  const resolvedInputDir = path.resolve(paths.inputDir);
  const resolvedOriginal = path.resolve(doc.originalPath);
  if (isWithinDirectory(resolvedOriginal, resolvedInputDir)) {
    return {
      fileName: path.basename(resolvedOriginal),
      absolutePath: resolvedOriginal,
    };
  }

  try {
    const sanitized = sanitizeInputFileName(doc.fileName, doc.extension || '.txt');
    const uniqueName = await ensureUniqueInputFileName(resolvedInputDir, sanitized);
    const destination = path.join(resolvedInputDir, uniqueName);
    await fs.copyFile(resolvedOriginal, destination);
    logMessage('info', `入力ファイルをワークスペースにコピーしました: ${uniqueName}`);
    return {
      fileName: uniqueName,
      absolutePath: destination,
    };
  } catch (error) {
    console.error('[main] failed to import source document', error);
    logMessage('warn', '入力ファイルのコピーに失敗しました。元ファイルを直接参照します。');
    return null;
  }
};
