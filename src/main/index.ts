import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === "development";
const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? "";

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

  if (isDev && devServerUrl) {
    await window.loadURL(devServerUrl);
    window.webContents.openDevTools({ mode: "detach" });
  } else {
    await window.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  }
}

app.whenReady().then(() => {
  createWindow().catch((error) => {
    console.error("Failed to create main window", error);
  });

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
    app.quit();
  }
});
