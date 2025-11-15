
/**
 * @file preload.ts
 * @brief Electronのpreloadスクリプト。レンダラーへ安全なAPIを公開。
 * @details
 * contextBridgeを用いてwindow.appに型付きAPIを公開。
 * 例:
 * @code
 * window.app.ping('hello').then(res => ...)
 * @endcode
 * @author K.Furuichi
 * @date 2025-11-02
 * @version 0.1
 * @copyright MIT
 * @see main.ts, renderer
 */
import { contextBridge, ipcRenderer } from 'electron';

import type { AppSettings, AppSettingsPatch, LogLevel } from '../shared/settings';
import type { WorkspaceSnapshot } from '../shared/workspace';
import type { LoadedTraceabilityFile, TraceFileSaveRequest, TraceFileSaveResult } from '../shared/traceability';
import type { DocumentLoadErrorCode } from './documentLoader';


/**
 * @brief 未保存の変更に対するユーザーのアクション。
 */
export type UnsavedChangesAction = 'discard' | 'apply' | 'cancel';

/**
 * @brief 未保存の変更確認の応答。
 */
export type UnsavedChangesResponse = {
  action: UnsavedChangesAction;
};

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
  /** ログを書き込む。 */
  log: (level: LogLevel, message: string) => Promise<void>;
  workspace: {
    /** カードスナップショットを保存する。 */
    save: (snapshot: WorkspaceSnapshot) => Promise<{ path: string }>;
    /** 編集済みのカードを指定ファイル名で保存する。 */
    saveCardFile: (fileName: string, snapshot: WorkspaceSnapshot) => Promise<{ path: string }>;
    /** トレーサビリティファイルを保存する。 */
    saveTraceFile: (payload: TraceFileSaveRequest) => Promise<TraceFileSaveResult>;
    /** 保存済みスナップショットを読み込む。 */
    load: () => Promise<WorkspaceSnapshot | null>;
    /** _inputディレクトリ内のカードファイル一覧を取得する。 */
    listCardFiles: () => Promise<string[]>;
    /** _outディレクトリ内の出力ファイル一覧を取得する。 */
    listOutputFiles: () => Promise<string[]>;
    /** 指定されたカードファイルを読み込む（_inputディレクトリから）。 */
    loadCardFile: (fileName: string) => Promise<WorkspaceSnapshot | null>;
    /** 指定された出力ファイルを読み込む（_outディレクトリから）。 */
    loadOutputFile: (fileName: string) => Promise<WorkspaceSnapshot | null>;
    /** 左右カードファイルに対応するトレーサビリティファイルを読み込む。 */
    loadTraceFile: (leftFile: string, rightFile: string) => Promise<LoadedTraceabilityFile | null>;
  };
  dialogs: {
    promptSaveFile: (options?: { defaultFileName?: string }) => Promise<{ canceled: boolean; fileName?: string }>;
  };
  document: {
    pickSource: () => Promise<PickDocumentResult>;
  };
  unsavedChanges: {
    /** 未保存の変更確認イベントのリスナーを設定。 */
    onCheckUnsavedChanges: (callback: () => void) => void;
    /** 未保存の変更に対するユーザーの選択を送信。 */
    sendResponse: (response: UnsavedChangesResponse) => void;
    /** 保存完了後、アプリ終了の準備ができたことを通知。 */
    notifySavedAndReadyToQuit: () => void;
  };
};

type PickDocumentSuccess = {
  canceled: false;
  document: {
    fileName: string;
    baseName: string;
    extension: string;
    sizeBytes: number;
    encoding: string;
    content: string;
    isMarkdown: boolean;
    sizeStatus: 'ok' | 'warn';
    workspaceFileName: string | null;
    workspacePath: string | null;
  };
};

type PickDocumentError = {
  canceled: false;
  error: {
    message: string;
    code: DocumentLoadErrorCode | 'READ_FAILED';
  };
};

type PickDocumentCancelled = { canceled: true };

type PickDocumentResult = PickDocumentSuccess | PickDocumentError | PickDocumentCancelled;


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
  log: async (level: LogLevel, message: string) => ipcRenderer.invoke('log:write', { level, message }),
  workspace: {
    save: async (snapshot: WorkspaceSnapshot) => ipcRenderer.invoke('workspace:save', snapshot),
    saveCardFile: async (fileName: string, snapshot: WorkspaceSnapshot) =>
      ipcRenderer.invoke('workspace:saveCardFile', { fileName, snapshot }),
    saveTraceFile: async (payload: TraceFileSaveRequest) =>
      ipcRenderer.invoke('workspace:saveTraceFile', payload),
    load: async () => ipcRenderer.invoke('workspace:load'),
    listCardFiles: async () => ipcRenderer.invoke('workspace:listCardFiles'),
    listOutputFiles: async () => ipcRenderer.invoke('workspace:listOutputFiles'),
    loadCardFile: async (fileName: string) => ipcRenderer.invoke('workspace:loadCardFile', fileName),
    loadOutputFile: async (fileName: string) => ipcRenderer.invoke('workspace:loadOutputFile', fileName),
    loadTraceFile: async (leftFile: string, rightFile: string) =>
      ipcRenderer.invoke('workspace:loadTraceFile', { leftFile, rightFile }),
  },
  dialogs: {
    promptSaveFile: async (options) => ipcRenderer.invoke('dialog:promptSaveFile', options ?? {}),
  },
  document: {
    pickSource: async () => ipcRenderer.invoke('document:pickSource'),
  },
  unsavedChanges: {
    onCheckUnsavedChanges: (callback: () => void) => {
      ipcRenderer.on('app:checkUnsavedChanges', callback);
    },
    sendResponse: (response: UnsavedChangesResponse) => {
      ipcRenderer.send('app:unsavedChangesResponse', response);
    },
    notifySavedAndReadyToQuit: () => {
      ipcRenderer.send('app:savedAndReadyToQuit');
    },
  },
};


/**
 * @brief window.appとしてAPIを公開。
 * @details
 * contextIsolation有効時の安全なAPI公開。
 */
contextBridge.exposeInMainWorld('app', api);
