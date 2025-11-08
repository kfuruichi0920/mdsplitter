/**
 * @file global.d.ts
 * @brief レンダラープロセス用のグローバル型定義。
 * @details
 * window.appで公開されるAPI型を宣言。Electron contextBridge経由で利用。
 * 制約: 型定義のみ、実装はpreload.ts参照。@todo API拡張時はここも更新。
 * @author K.Furuichi
 * @date 2025-11-02
 * @version 0.1
 * @copyright MIT
 */
import type { AppSettings, AppSettingsPatch, LogLevel } from '@/shared/settings';
import type { WorkspaceSnapshot } from '@/shared/workspace';
import type { LoadedTraceabilityFile } from '@/shared/traceability';

export {};

declare global {
  interface Window {
    app: {
      ping: (message: string) => Promise<{ ok: boolean; timestamp: number }>;
      settings: {
        load: () => Promise<AppSettings>;
        update: (patch: AppSettingsPatch) => Promise<AppSettings>;
      };
      log: (level: LogLevel, message: string) => Promise<void>;
      workspace: {
        save: (snapshot: WorkspaceSnapshot) => Promise<{ path: string }>;
        saveCardFile: (fileName: string, snapshot: WorkspaceSnapshot) => Promise<{ path: string }>;
        load: () => Promise<WorkspaceSnapshot | null>;
        listCardFiles: () => Promise<string[]>;
        listOutputFiles: () => Promise<string[]>;
        loadCardFile: (fileName: string) => Promise<WorkspaceSnapshot | null>;
        loadTraceFile: (leftFile: string, rightFile: string) => Promise<LoadedTraceabilityFile | null>;
      };
    };
  }
}
