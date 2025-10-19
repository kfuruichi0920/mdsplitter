import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // File operations (to be implemented in Phase 2)
  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (data: unknown) => ipcRenderer.invoke('file:save', data),
  saveFileAs: (data: unknown) => ipcRenderer.invoke('file:saveAs', data),

  // Platform info
  platform: process.platform,
});

// Type declaration for TypeScript (will be in shared/types.ts later)
export interface ElectronAPI {
  openFile: () => Promise<unknown>;
  saveFile: (data: unknown) => Promise<void>;
  saveFileAs: (data: unknown) => Promise<void>;
  platform: NodeJS.Platform;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
