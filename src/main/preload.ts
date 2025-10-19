import { contextBridge, ipcRenderer } from "electron";

import type { AppSettings } from "@shared";
import { IPC_CHANNELS } from "@shared";
import type { SettingsUpdatePayload } from "@shared/ipc";

contextBridge.exposeInMainWorld("mdsplitter", {
  version: "0.1.0",
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.settings.get),
    update: (payload: SettingsUpdatePayload) => ipcRenderer.invoke(IPC_CHANNELS.settings.update, payload),
    onChange: (listener: (settings: AppSettings) => void) => {
      const handler = (_event: unknown, settings: AppSettings) => listener(settings);
      ipcRenderer.on(IPC_CHANNELS.settings.changed, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.settings.changed, handler);
    }
  }
});
