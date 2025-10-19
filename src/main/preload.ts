import { contextBridge, ipcRenderer } from 'electron';
import { FileOpenResult, FileSaveResult, AppSettings, CardFile } from '../shared/types';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // File operations
  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('file:save', { filePath, content }),
  saveFileAs: (content: string, defaultPath?: string) =>
    ipcRenderer.invoke('file:saveAs', { content, defaultPath }),
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),

  // Settings operations
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (updates: Partial<AppSettings>) =>
    ipcRenderer.invoke('settings:update', updates),

  // Log operations
  logInfo: (message: string, meta?: Record<string, unknown>) =>
    ipcRenderer.invoke('log:info', message, meta),
  logWarn: (message: string, meta?: Record<string, unknown>) =>
    ipcRenderer.invoke('log:warn', message, meta),
  logError: (message: string, error?: unknown) =>
    ipcRenderer.invoke('log:error', message, error),
  logDebug: (message: string, meta?: Record<string, unknown>) =>
    ipcRenderer.invoke('log:debug', message, meta),

  // Converter operations
  convertToCards: (params: {
    content: string;
    inputFilePath: string;
    copiedInputFilePath: string;
    fileName: string;
    fileExtension: string;
  }) => ipcRenderer.invoke('converter:convert', params),

  // Platform info
  platform: process.platform,
});

// Type declaration for TypeScript
export interface ElectronAPI {
  openFile: () => Promise<FileOpenResult>;
  saveFile: (filePath: string, content: string) => Promise<FileSaveResult>;
  saveFileAs: (content: string, defaultPath?: string) => Promise<FileSaveResult>;
  readFile: (filePath: string) => Promise<FileOpenResult>;
  getSettings: () => Promise<AppSettings>;
  updateSettings: (updates: Partial<AppSettings>) => Promise<AppSettings>;
  logInfo: (message: string, meta?: Record<string, unknown>) => Promise<void>;
  logWarn: (message: string, meta?: Record<string, unknown>) => Promise<void>;
  logError: (message: string, error?: unknown) => Promise<void>;
  logDebug: (message: string, meta?: Record<string, unknown>) => Promise<void>;
  convertToCards: (params: {
    content: string;
    inputFilePath: string;
    copiedInputFilePath: string;
    fileName: string;
    fileExtension: string;
  }) => Promise<CardFile>;
  platform: NodeJS.Platform;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
