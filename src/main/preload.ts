import { contextBridge, ipcRenderer } from 'electron';
import {
  FileOpenResult,
  FileSaveResult,
  AppSettings,
  CardFile,
  TraceFile,
  LLMResponse,
  LLMConfigValidation,
} from '../shared/types';

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
    strategy?: 'rule' | 'llm';
  }) => ipcRenderer.invoke('converter:convert', params),

  // LLM operations
  generateLLMCompletion: (request: {
    prompt: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
  }) => ipcRenderer.invoke('llm:generateCompletion', request),
  validateLLMConfig: () => ipcRenderer.invoke('llm:validateConfig'),

  // Card file operations
  copyInputFile: (params: { originalPath: string; content: string }) =>
    ipcRenderer.invoke('cardFile:copy', params),
  saveCardFile: (params: { cardFile: CardFile; label?: string }) =>
    ipcRenderer.invoke('cardFile:save', params),
  loadCardFile: (filePath: string) => ipcRenderer.invoke('cardFile:load', filePath),

  // Trace file operations
  saveTraceFile: (params: { traceFile: TraceFile }) =>
    ipcRenderer.invoke('traceFile:save', params),
  loadTraceFile: (filePath: string) => ipcRenderer.invoke('traceFile:load', filePath),

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
    strategy?: 'rule' | 'llm';
  }) => Promise<CardFile>;
  generateLLMCompletion: (request: {
    prompt: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
  }) => Promise<LLMResponse>;
  validateLLMConfig: () => Promise<LLMConfigValidation>;
  copyInputFile: (params: { originalPath: string; content: string }) => Promise<{
    success: boolean;
    copiedPath?: string;
    error?: string;
  }>;
  saveCardFile: (params: { cardFile: CardFile; label?: string }) => Promise<{
    success: boolean;
    savedPath?: string;
    error?: string;
  }>;
  loadCardFile: (filePath: string) => Promise<{
    success: boolean;
    cardFile?: CardFile;
    error?: string;
  }>;
  saveTraceFile: (params: { traceFile: TraceFile }) => Promise<{
    success: boolean;
    savedPath?: string;
    error?: string;
  }>;
  loadTraceFile: (filePath: string) => Promise<{
    success: boolean;
    traceFile?: TraceFile;
    error?: string;
  }>;
  platform: NodeJS.Platform;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
