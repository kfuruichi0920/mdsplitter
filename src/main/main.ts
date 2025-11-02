
/**
 * @file main.ts
 * @brief Electronアプリのメインプロセス初期化・ウィンドウ管理。
 * @details
 * アプリ起動時のウィンドウ生成、IPCハンドラ登録、終了処理を担当。
 * 例:
 * @code
 * npm run start
 * @endcode
 * @author kfuruichi0920
 * @date 2025-11-02
 * @version 0.1
 * @copyright MIT
 * @see preload.ts, renderer/index.html
 */
import path from 'node:path';

import { app, BrowserWindow, ipcMain } from 'electron';

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


// アプリ起動時の初期化処理
app.whenReady().then(() => {
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
