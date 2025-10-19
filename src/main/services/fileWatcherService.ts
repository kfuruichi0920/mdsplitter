import chokidar, { type FSWatcher } from "chokidar";

import type { AppSettings } from "@shared";

import { SettingsService } from "./settingsService";

export class FileWatcherService {
  private watcher: FSWatcher | null = null;
  private unsubscribe?: () => void;

  constructor(private readonly settingsService: SettingsService) {}

  async init(): Promise<void> {
    this.applyWatcher(this.settingsService.current);
    this.unsubscribe = this.settingsService.subscribe((next) => {
      this.applyWatcher(next);
    });
  }

  async dispose(): Promise<void> {
    await this.watcher?.close();
    this.unsubscribe?.();
    this.watcher = null;
  }

  private applyWatcher(settings: AppSettings): void {
    void this.watcher?.close();
    this.watcher = null;

    if (!settings.fileWatcher.enabled) {
      return;
    }

    const debounceMs = Math.max(settings.fileWatcher.debounceMs, 100);
    this.watcher = chokidar.watch(this.settingsService.path, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: debounceMs,
        pollInterval: Math.min(debounceMs / 2, 100)
      }
    });

    this.watcher.on("change", () => {
      this.settingsService.reload().catch((error) => {
        console.error("Failed to reload settings after external change", error);
      });
    });
  }
}
