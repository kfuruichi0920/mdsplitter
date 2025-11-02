import { contextBridge, ipcRenderer } from 'electron';

type AppAPI = {
  ping: (message: string) => Promise<{ ok: boolean; timestamp: number }>;
};

const api: AppAPI = {
  ping: async (message: string) => ipcRenderer.invoke('app:ping', message)
};

contextBridge.exposeInMainWorld('app', api);
