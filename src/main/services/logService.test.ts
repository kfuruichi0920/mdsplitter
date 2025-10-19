import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { defaultSettings } from "@shared";

import { LogService, type SettingsProvider } from "./logService";

vi.mock("electron", () => {
  return {
    app: {
      getPath: vi.fn(() => tmpdir())
    }
  };
});

class StubSettings implements SettingsProvider {
  current = structuredClone(defaultSettings);
  private listeners = new Set<(settings: typeof defaultSettings) => void>();

  subscribe(listener: (settings: typeof defaultSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  updateLevel(level: "info" | "warn" | "error" | "debug") {
    this.current = {
      ...this.current,
      log: {
        ...this.current.log,
        logLevel: level
      }
    };
    for (const listener of this.listeners) {
      listener(this.current);
    }
  }
}

describe("LogService", () => {
  let tempDir: string;
  let settings: StubSettings;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "log-service-"));
    settings = new StubSettings();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("writes logs to rotating files", async () => {
    const service = new LogService(settings, { baseDir: tempDir });
    await service.init();

    service.info("test message", { foo: "bar" });

    await new Promise((resolve) => setTimeout(resolve, 200));

    const files = await readdir(path.join(tempDir, "_logs"));
    const logFileName = files.find((file) => file.endsWith(".log"));
    expect(logFileName).toBeTruthy();

    const logFile = path.join(tempDir, "_logs", logFileName!);
    const content = await readFile(logFile, "utf-8");
    expect(content).toContain("test message");
    expect(content).toContain("foo");

    service.dispose();
  });

  it("applies updated log level", async () => {
    const service = new LogService(settings, { baseDir: tempDir });
    await service.init();

    settings.updateLevel("error");
    service.debug("invisible");
    service.error("visible");

    await new Promise((resolve) => setTimeout(resolve, 200));
    const files = await readdir(path.join(tempDir, "_logs"));
    const logFileName = files.find((file) => file.endsWith(".log"));
    expect(logFileName).toBeTruthy();
    const logFile = path.join(tempDir, "_logs", logFileName!);
    const content = await readFile(logFile, "utf-8");
    expect(content).toContain("visible");

    service.dispose();
  });
});
