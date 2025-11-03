import type { AppSettings, AppSettingsPatch, LogLevel } from '@/shared/settings';
import type { WorkspaceSnapshot } from '@/shared/workspace';

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
        load: () => Promise<WorkspaceSnapshot | null>;
        listCardFiles: () => Promise<string[]>;
        loadCardFile: (fileName: string) => Promise<WorkspaceSnapshot | null>;
      };
    };
  }
}
