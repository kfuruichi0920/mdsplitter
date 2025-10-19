import { app } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AppSettings } from "@shared";
import { defaultSettings, parseSettings } from "@shared";

type SettingsListener = (settings: AppSettings) => void;

interface SettingsServiceOptions {
  configDir?: string;
  fileName?: string;
}

const DEFAULT_FILE_NAME = "settings.json";

export class SettingsService {
  private settings: AppSettings = structuredClone(defaultSettings);
  private readonly listeners = new Set<SettingsListener>();
  private readonly filePath: string;

  constructor(options: SettingsServiceOptions = {}) {
    const userDataDir = options.configDir ?? app.getPath("userData");
    const configDir = path.join(userDataDir, "config");
    this.filePath = path.join(configDir, options.fileName ?? DEFAULT_FILE_NAME);
  }

  async init(): Promise<AppSettings> {
    await this.ensureConfigDir();
    this.settings = await this.loadFromDisk();
    return this.settings;
  }

  get current(): AppSettings {
    return this.settings;
  }

  subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async update(partial: Partial<AppSettings>): Promise<AppSettings> {
    const merged = deepMerge(this.settings, partial);
    this.settings = parseSettings(merged);
    await this.persist();
    this.notify();
    return this.settings;
  }

  async reload(): Promise<AppSettings> {
    this.settings = await this.loadFromDisk();
    this.notify();
    return this.settings;
  }

  private async ensureConfigDir(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await mkdir(dir, { recursive: true });
  }

  private async loadFromDisk(): Promise<AppSettings> {
    try {
      const data = await readFile(this.filePath, "utf-8");
      const json = JSON.parse(data);
      return parseSettings(json);
    } catch (error) {
      // 既存ファイルが存在しない / 破損時は既定値で再生成
      await this.persist();
      return structuredClone(defaultSettings);
    }
  }

  private async persist(): Promise<void> {
    await this.ensureConfigDir();
    const serialized = JSON.stringify(this.settings, null, 2);
    await writeFile(this.filePath, serialized, "utf-8");
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.settings);
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge<T>(target: T, source: Partial<T>): T {
  if (!isPlainObject(target) || !isPlainObject(source)) {
    return source as T;
  }

  const result: Record<string, unknown> = { ...target };

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) {
      continue;
    }

    const existing = (result as Record<string, unknown>)[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      (result as Record<string, unknown>)[key] = deepMerge(existing, value);
    } else {
      (result as Record<string, unknown>)[key] = value;
    }
  }

  return result as T;
}

