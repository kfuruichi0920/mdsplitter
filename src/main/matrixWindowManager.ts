import path from 'node:path';

import { BrowserWindow } from 'electron';
import { nanoid } from 'nanoid';

import type { CardSelectionChangeEvent, MatrixInitPayload, MatrixOpenRequest, TraceChangeEvent } from '@/shared/matrixProtocol';

type MatrixWindowContext = {
  window: BrowserWindow;
  leftFile: string;
  rightFile: string;
};

const resolveMatrixRendererPath = (): string => path.resolve(__dirname, '../renderer/index.html');
const resolvePreloadPath = (): string => path.join(__dirname, 'preload.js');

export class MatrixWindowManager {
  private readonly windows = new Map<string, MatrixWindowContext>();

  createMatrixWindow(leftFile: string, rightFile: string): string {
    const windowId = nanoid();
    const browserWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 960,
      minHeight: 600,
      show: false,
      title: 'Trace Matrix',
      webPreferences: {
        preload: resolvePreloadPath(),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    const payload: MatrixInitPayload = { windowId, leftFile, rightFile };

    browserWindow.once('ready-to-show', () => browserWindow.show());
    browserWindow.loadFile(resolveMatrixRendererPath(), { hash: 'matrix' }).catch((error) => {
      console.error('[MatrixWindowManager] failed to load renderer', error);
    });

    browserWindow.webContents.once('did-finish-load', () => {
      browserWindow.webContents.send('matrix:init', payload);
    });

    browserWindow.on('closed', () => {
      this.windows.delete(windowId);
    });

    this.windows.set(windowId, { window: browserWindow, leftFile, rightFile });
    return windowId;
  }

  closeMatrixWindow(windowId: string): void {
    const context = this.windows.get(windowId);
    context?.window.close();
    this.windows.delete(windowId);
  }

  openFromRequest(request: MatrixOpenRequest): string {
    if (!request.leftFile || !request.rightFile) {
      throw new Error('Matrix open request requires both leftFile and rightFile');
    }
    return this.createMatrixWindow(request.leftFile, request.rightFile);
  }

  broadcastTraceChange(event: TraceChangeEvent): void {
    this.windows.forEach(({ window }) => {
      window.webContents.send('matrix:trace-changed', event);
    });
  }

  broadcastCardSelection(event: CardSelectionChangeEvent, options?: { excludeWindowId?: string }): void {
    this.windows.forEach(({ window }, windowId) => {
      if (options?.excludeWindowId && options.excludeWindowId === windowId) {
        return;
      }
      window.webContents.send('matrix:card-selection', event);
    });
  }

  getWindowIdByWebContentsId(webContentsId: number): string | undefined {
    for (const [windowId, context] of this.windows.entries()) {
      if (context.window.webContents.id === webContentsId) {
        return windowId;
      }
    }
    return undefined;
  }
}
