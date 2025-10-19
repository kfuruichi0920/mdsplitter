import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { FileWatcherService } from "./fileWatcherService";
import { SettingsService } from "./settingsService";

vi.mock("electron", () => {
  return {
    app: {
      getPath: vi.fn(() => tmpdir())
    }
  };
});

describe("FileWatcherService", () => {
  let tempDir: string;
  let service: SettingsService;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "file-watcher-"));
    service = new SettingsService({ configDir: tempDir });
    await service.init();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("reloads settings when config file changes", async () => {
    const watcher = new FileWatcherService(service);
    await watcher.init();

    const spy = vi.spyOn(service, "reload");
    const target = service.path;
    await writeFile(target, JSON.stringify({ ui: { theme: "dark" } }), "utf-8");

    await new Promise((resolve) => setTimeout(resolve, service.current.fileWatcher.debounceMs + 200));
    expect(spy).toHaveBeenCalled();

    await watcher.dispose();
  });
});
