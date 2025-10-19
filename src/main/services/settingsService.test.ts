import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { SettingsService } from "./settingsService";

// Electronのapp.getPathをモック
vi.mock("electron", () => {
  return {
    app: {
      getPath: vi.fn(() => tmpdir())
    }
  };
});

describe("SettingsService", () => {
  let configDir: string;

  beforeEach(async () => {
    configDir = await mkdtemp(path.join(tmpdir(), "settings-service-"));
  });

  afterEach(async () => {
    await rm(configDir, { recursive: true, force: true });
  });

  it("initializes with default settings when file is absent", async () => {
    const service = new SettingsService({ configDir });
    const settings = await service.init();

    expect(settings.input.maxWarnSizeMB).toBe(10);
    const saved = JSON.parse(await readFile(path.join(configDir, "config", "settings.json"), "utf-8"));
    expect(saved.input.maxWarnSizeMB).toBe(10);
  });

  it("updates nested values and persists them", async () => {
    const service = new SettingsService({ configDir });
    await service.init();

    const updated = await service.update({
      ui: { theme: "dark", autoSave: { enabled: true, intervalMs: 60000 } }
    });

    expect(updated.ui.theme).toBe("dark");
    expect(updated.ui.autoSave.intervalMs).toBe(60000);

    const disk = JSON.parse(await readFile(path.join(configDir, "config", "settings.json"), "utf-8"));
    expect(disk.ui.theme).toBe("dark");
  });

  it("recovers from corrupted json by restoring defaults", async () => {
    const service = new SettingsService({ configDir });
    await service.init();

    const filePath = path.join(configDir, "config", "settings.json");
    await writeFile(filePath, "{invalid json", "utf-8");

    const reloaded = await service.reload();
    expect(reloaded.converter.strategy).toBe("rule");
  });
});

