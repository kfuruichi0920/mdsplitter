
/**
 * @file preload.ts
 * @brief Electronのpreloadスクリプト。レンダラーへ安全なAPIを公開。
 * @details
 * contextBridgeを用いてwindow.appに型付きAPIを公開。
 * 例:
 * @code
 * window.app.ping('hello').then(res => ...)
 * @endcode
 * @author kfuruichi0920
 * @date 2025-11-02
 * @version 0.1
 * @copyright MIT
 * @see main.ts, renderer
 */
import { contextBridge, ipcRenderer } from 'electron';

import type { AppSettings, AppSettingsPatch } from '../shared/settings';


/**
 * @brief window.appで公開するAPI型定義。
 * @details
 * ping: メインプロセスへメッセージ送信し、応答をPromiseで返す。
 */
type AppAPI = {
  /**
   * @brief メインプロセスにpingメッセージを送信。
   * @param message 送信する文字列。
   * @return 応答結果Promise。
   * @retval { ok: boolean; timestamp: number }
   * @note 通信失敗時は例外。@todo エラー処理方針明確化。
   */
  ping: (message: string) => Promise<{ ok: boolean; timestamp: number }>;
  settings: {
    /** 設定を読み込む。 */
    load: () => Promise<AppSettings>;
    /** 設定を更新する。 */
    update: (patch: AppSettingsPatch) => Promise<AppSettings>;
  };
};


/**
 * @brief レンダラーから利用可能なAPI実装。
 * @details
 * メインプロセスの'app:ping'ハンドラを呼び出す。
 */
const api: AppAPI = {
  ping: async (message: string) => ipcRenderer.invoke('app:ping', message),
  settings: {
    load: async () => ipcRenderer.invoke('settings:load'),
    update: async (patch: AppSettingsPatch) => ipcRenderer.invoke('settings:update', patch),
  },
};


/**
 * @brief window.appとしてAPIを公開。
 * @details
 * contextIsolation有効時の安全なAPI公開。
 */
contextBridge.exposeInMainWorld('app', api);
