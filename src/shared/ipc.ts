import type { AppSettings } from "./settings/schema";

export const IPC_CHANNELS = {
  settings: {
    get: "settings:get",
    update: "settings:update",
    changed: "settings:changed"
  }
} as const;

export type SettingsUpdatePayload = Partial<AppSettings>;
