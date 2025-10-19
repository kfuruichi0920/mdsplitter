import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { IPC_CHANNELS } from "@shared";
import type { SettingsUpdatePayload } from "@shared/ipc";

import { FileService } from "./services/fileService";
import { FileWatcherService } from "./services/fileWatcherService";
import { LogService } from "./services/logService";
import { SettingsService } from "./services/settingsService";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === "development";
const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? "";

const settingsService = new SettingsService();
const logService = new LogService(settingsService);
const fileService = new FileService(settingsService);
const fileWatcherService = new FileWatcherService(settingsService);

let mainWindow: BrowserWindow | null = null;
let rendererSettingsUnsubscribe: (() => void) | undefined;

function registerIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.settings.get, () => settingsService.current);
  ipcMain.handle(IPC_CHANNELS.settings.update, (_event, payload: SettingsUpdatePayload) =>
    settingsService.update(payload)
  );
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  rendererSettingsUnsubscribe?.();
  rendererSettingsUnsubscribe = settingsService.subscribe((settings) => {
    window.webContents.send(IPC_CHANNELS.settings.changed, settings);
  });

  window.on("closed", () => {
    rendererSettingsUnsubscribe?.();
    rendererSettingsUnsubscribe = undefined;
    mainWindow = null;
  });

  if (isDev && devServerUrl) {
    await window.loadURL(devServerUrl);
    window.webContents.openDevTools({ mode: "detach" });
  } else {
    await window.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  }

  window.webContents.once("did-finish-load", () => {
    window.webContents.send(IPC_CHANNELS.settings.changed, settingsService.current);
  });

  mainWindow = window;
}

app.whenReady().then(async () => {
  try {
    await settingsService.init();
    await logService.init();
    await fileService.ensureBaseDirs();
    await fileWatcherService.init();
    registerIpcHandlers();

    await createWindow();
  } catch (error) {
    console.error("Failed to initialize application", error);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch((error) => {
        console.error("Failed to recreate window", error);
      });
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    fileWatcherService.dispose().catch(() => undefined);
    logService.dispose();
    app.quit();
  }
});
