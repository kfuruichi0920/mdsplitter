/**
 * @file matrixWindowManager.ts
 * @brief トレースマトリクスウィンドウの管理クラス。
 * @details
 * 複数のマトリクスウィンドウ生成・閉鎖・イベントブロードキャストを管理。
 * ウィンドウID→コンテキストのマップで状態管理。計算量O(1)（生成・削除）、O(N)（ブロードキャスト）。
 * 例:
 * @code
 * const manager = new MatrixWindowManager();
 * const windowId = manager.createMatrixWindow('req.json', 'spec.json');
 * manager.broadcastTraceChange(event);
 * manager.closeMatrixWindow(windowId);
 * @endcode
 * @author K.Furuichi
 * @date 2025-11-16
 * @version 0.1
 * @copyright MIT
 * @see matrixProtocol.ts, main.ts
 */

import path from 'node:path';

import { BrowserWindow } from 'electron';
import { nanoid } from 'nanoid';

import type { CardSelectionChangeEvent, MatrixInitPayload, MatrixOpenRequest, TraceChangeEvent } from '@/shared/matrixProtocol';

/**
 * @brief マトリクスウィンドウのコンテキスト。
 * @details
 * BrowserWindow参照、左右ファイル名を保持。
 */
type MatrixWindowContext = {
  window: BrowserWindow; ///< Electronウィンドウ参照。
  leftFile: string; ///< 左側カードファイル名。
  rightFile: string; ///< 右側カードファイル名。
};

/**
 * @brief マトリクスレンダラーHTMLファイルパスを解決。
 * @return 絶対パス。
 */
const resolveMatrixRendererPath = (): string => path.resolve(__dirname, '../renderer/index.html');

/**
 * @brief preload.jsファイルパスを解決。
 * @return 絶対パス。
 */
const resolvePreloadPath = (): string => path.join(__dirname, 'preload.js');

/**
 * @brief トレースマトリクスウィンドウ管理クラス。
 * @details
 * ウィンドウ生成・閉鎖・イベントブロードキャスト・ID検索を提供。
 * スレッド安全ではない（ElectronメインプロセスはシングルスレッドのためOK）。
 */
export class MatrixWindowManager {
  private readonly windows = new Map<string, MatrixWindowContext>(); ///< ウィンドウID→コンテキストマップ。

  /**
   * @brief マトリクスウィンドウを生成。
   * @details
   * nanoidでウィンドウIDを生成し、BrowserWindowを作成・初期化。
   * ready-to-showで表示、did-finish-loadで初期化ペイロード送信。
   * @param leftFile 左側カードファイル名。
   * @param rightFile 右側カードファイル名。
   * @return 生成されたウィンドウID。
   */
  createMatrixWindow(leftFile: string, rightFile: string): string {
    const windowId = nanoid();
    const browserWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 960,
      minHeight: 600,
      show: false,
      title: 'Trace Matrix',
      webPreferences: {
        preload: resolvePreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    const payload: MatrixInitPayload = { windowId, leftFile, rightFile };

    browserWindow.once('ready-to-show', () => browserWindow.show());
    browserWindow.loadFile(resolveMatrixRendererPath(), { hash: 'matrix' }).catch((error) => {
      console.error('[MatrixWindowManager] failed to load renderer', error);
    });

    browserWindow.webContents.once('did-finish-load', () => {
      browserWindow.webContents.send('matrix:init', payload);
    });

    browserWindow.on('closed', () => {
      this.windows.delete(windowId);
    });

    this.windows.set(windowId, { window: browserWindow, leftFile, rightFile });
    return windowId;
  }

  /**
   * @brief 指定IDのマトリクスウィンドウを閉鎖。
   * @details
   * ウィンドウが存在すればclose()を呼び、マップから削除。
   * @param windowId ウィンドウID。
   */
  closeMatrixWindow(windowId: string): void {
    const context = this.windows.get(windowId);
    context?.window.close();
    this.windows.delete(windowId);
  }

  /**
   * @brief リクエストからマトリクスウィンドウを生成。
   * @details
   * leftFile/rightFileの検証後、createMatrixWindowを呼び出す。
   * @param request マトリクスオープンリクエスト。
   * @return 生成されたウィンドウID。
   * @throws Error leftFile/rightFileが不正な場合。
   */
  openFromRequest(request: MatrixOpenRequest): string {
    if (!request.leftFile || !request.rightFile) {
      throw new Error('Matrix open request requires both leftFile and rightFile');
    }
    return this.createMatrixWindow(request.leftFile, request.rightFile);
  }

  /**
   * @brief トレース変更イベントを全ウィンドウにブロードキャスト。
   * @details
   * 計算量O(N)（N: ウィンドウ数）。
   * @param event トレース変更イベント。
   */
  broadcastTraceChange(event: TraceChangeEvent): void {
    this.windows.forEach(({ window }) => {
      window.webContents.send('matrix:trace-changed', event);
    });
  }

  /**
   * @brief カード選択変更イベントをブロードキャスト。
   * @details
   * excludeWindowId指定時は該当ウィンドウを除外。計算量O(N)。
   * @param event カード選択変更イベント。
   * @param options ブロードキャストオプション（除外ウィンドウID等）。
   */
  broadcastCardSelection(event: CardSelectionChangeEvent, options?: { excludeWindowId?: string }): void {
    this.windows.forEach(({ window }, windowId) => {
      if (options?.excludeWindowId && options.excludeWindowId === windowId) {
        return;
      }
      window.webContents.send('matrix:card-selection', event);
    });
  }

  /**
   * @brief WebContents IDからウィンドウIDを検索。
   * @details
   * 計算量O(N)（N: ウィンドウ数）。
   * @param webContentsId WebContents ID。
   * @return ウィンドウID、見つからなければundefined。
   */
  getWindowIdByWebContentsId(webContentsId: number): string | undefined {
    for (const [windowId, context] of this.windows.entries()) {
      if (context.window.webContents.id === webContentsId) {
        return windowId;
      }
    }
    return undefined;
  }
}
