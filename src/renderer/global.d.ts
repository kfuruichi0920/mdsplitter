import type { AppSettings, AppSettingsPatch } from '@/shared/settings';

export {};

declare global {
  interface Window {
    app: {
      ping: (message: string) => Promise<{ ok: boolean; timestamp: number }>;
      settings: {
        load: () => Promise<AppSettings>;
        update: (patch: AppSettingsPatch) => Promise<AppSettings>;
      };
    };
  }
}
