import { app } from "electron";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import chardet from "chardet";
import { TextDecoder } from "node:util";

import type { SettingsProvider } from "./logService";

interface FileServiceOptions {
  baseDir?: string;
}

const INPUT_DIR = "_input";
const OUTPUT_DIR = "_out";
const LOG_DIR = "_logs";

export class FileService {
  private readonly baseDir: string;

  constructor(private readonly settings: SettingsProvider, options: FileServiceOptions = {}) {
    const userDataDir = options.baseDir ?? app.getPath("userData");
    this.baseDir = userDataDir;
  }

  get inputDir(): string {
    return path.join(this.baseDir, INPUT_DIR);
  }

  get outputDir(): string {
    return path.join(this.baseDir, OUTPUT_DIR);
  }

  get logDir(): string {
    return path.join(this.baseDir, LOG_DIR);
  }

  async ensureBaseDirs(): Promise<void> {
    await Promise.all([
      mkdir(this.inputDir, { recursive: true }),
      mkdir(this.outputDir, { recursive: true }),
      mkdir(this.logDir, { recursive: true })
    ]);
  }

  async readTextFile(filePath: string): Promise<{ text: string; encoding: string }> {
    const buffer = await readFile(filePath);
    const detected = chardet.detect(buffer)?.toString();
    let encoding = normalizeEncoding(detected);

    if (!encoding) {
      const fallback = this.settings.current.file.encodingFallback;
      if (fallback === "reject") {
        throw new Error(`Unable to detect encoding for ${filePath}`);
      }
      encoding = fallback === "assume-sjis" ? "shift_jis" : "utf-8";
    }

    const decoderEncoding = mapToTextDecoderEncoding(encoding);
    const decoder = new TextDecoder(decoderEncoding as unknown as string);
    const text = decoder.decode(buffer);
    return { text, encoding };
  }

  async writeJson(filePath: string, data: unknown): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
    const payload = JSON.stringify(data, null, 2);
    await writeFile(filePath, payload, "utf-8");
  }

  async copyToInputDir(sourcePath: string): Promise<string> {
    await this.ensureBaseDirs();
    const originalName = path.basename(sourcePath);
    const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const uniqueSuffix = crypto.randomUUID().split("-")[0];
    const targetName = `${timestamp}_${uniqueSuffix}_${originalName}`;
    const targetPath = path.join(this.inputDir, targetName);

    await copyFile(sourcePath, targetPath);
    return targetPath;
  }

  async isWithinManagedDir(candidate: string): Promise<boolean> {
    const dirs = [this.inputDir, this.outputDir, this.logDir];
    const realCandidate = path.resolve(candidate);
    for (const dir of dirs) {
      const realDir = path.resolve(dir);
      if (isPathInside(realCandidate, realDir)) {
        return true;
      }
    }
    return false;
  }
}

function normalizeEncoding(detected?: string | null): string | undefined {
  if (!detected) {
    return undefined;
  }

  const lowered = detected.toLowerCase();
  if (lowered.includes("utf")) {
    return "utf-8";
  }
  if (lowered.includes("shift_jis") || lowered.includes("sjis") || lowered.includes("cp932")) {
    return "shift_jis";
  }
  if (lowered.includes("euc-jp")) {
    return "euc-jp";
  }
  return undefined;
}

function mapToTextDecoderEncoding(encoding: string): string {
  const aliases: Record<string, string> = {
    "shift_jis": "shift_jis",
    "sjis": "shift_jis",
    "cp932": "shift_jis",
    "euc-jp": "euc-jp"
  };

  return aliases[encoding] ?? "utf-8";
}

function isPathInside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return relative !== "" && !relative.startsWith("..");
}
