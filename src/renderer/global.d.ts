import type { AppSettings, AppSettingsPatch, LogLevel } from '@/shared/settings';

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
    };
  }
}
