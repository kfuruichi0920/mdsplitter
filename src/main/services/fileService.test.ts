import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import * as Encoding from "encoding-japanese";

import { defaultSettings, type AppSettings } from "@shared";

import { FileService } from "./fileService";
import type { SettingsProvider } from "./logService";

vi.mock("electron", () => {
  return {
    app: {
      getPath: vi.fn(() => tmpdir())
    }
  };
});

class StubSettings implements SettingsProvider {
  current: AppSettings = structuredClone(defaultSettings);
  private listeners = new Set<(settings: AppSettings) => void>();

  subscribe(listener: (settings: AppSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

describe("FileService", () => {
  let tempDir: string;
  let service: FileService;
  let settings: StubSettings;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "file-service-"));
    settings = new StubSettings();
    service = new FileService(settings, { baseDir: tempDir });
    await service.ensureBaseDirs();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("decodes shift_jis text", async () => {
    const text = "こんにちは";
    const codePoints = Encoding.stringToCode(text);
    const sjisArray = Encoding.convert(codePoints, { to: "SJIS", type: "array" }) as number[];
    const buffer = Buffer.from(sjisArray);
    const filePath = path.join(tempDir, "sample_sjis.txt");
    await writeFile(filePath, buffer);

    settings.current = {
      ...settings.current,
      file: {
        ...settings.current.file,
        encodingFallback: "assume-sjis",
        normalizeNewline: true
      }
    };

    const result = await service.readTextFile(filePath);
    expect(result.text).toBe(text);
    expect(result.encoding).toBe("shift_jis");
  });

  it("writes json files with indentation", async () => {
    const target = path.join(service.outputDir, "sample.json");
    await service.writeJson(target, { hello: "world" });

    const content = await readFile(target, "utf-8");
    expect(content).toContain("hello");
    expect(content.trim().startsWith("{"));
  });

  it("copies files into input dir with unique name", async () => {
    const source = path.join(tempDir, "origin.txt");
    await writeFile(source, "data", "utf-8");

    const copiedPath = await service.copyToInputDir(source);
    expect(copiedPath.startsWith(service.inputDir)).toBe(true);
    const copiedContent = await readFile(copiedPath, "utf-8");
    expect(copiedContent).toBe("data");
  });
});
