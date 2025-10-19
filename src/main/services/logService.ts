import { app } from "electron";
import { mkdir, readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

import type { AppSettings } from "@shared";

export interface SettingsProvider {
  current: AppSettings;
  subscribe(listener: (settings: AppSettings) => void): () => void;
}

interface LogServiceOptions {
  baseDir?: string;
}

const LOG_DIR_NAME = "_logs";

export class LogService {
  private logger: winston.Logger | null = null;
  private unsubscribe?: () => void;
  private readonly baseDir: string;

  constructor(private readonly settings: SettingsProvider, options: LogServiceOptions = {}) {
    const userDataDir = options.baseDir ?? app.getPath("userData");
    this.baseDir = path.join(userDataDir, LOG_DIR_NAME);
  }

  get logDirectory(): string {
    return this.baseDir;
  }

  async init(): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
    this.createLogger(this.settings.current);
    this.unsubscribe = this.settings.subscribe((updated) => {
      this.createLogger(updated);
    });
  }

  dispose(): void {
    this.unsubscribe?.();
    this.logger?.close();
    this.logger = null;
  }

  info(message: string, meta?: winston.Logform.TransformableInfo): void {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: winston.Logform.TransformableInfo): void {
    this.log("warn", message, meta);
  }

  error(message: string, meta?: winston.Logform.TransformableInfo): void {
    this.log("error", message, meta);
  }

  debug(message: string, meta?: winston.Logform.TransformableInfo): void {
    this.log("debug", message, meta);
  }

  audit(message: string, meta?: winston.Logform.TransformableInfo): void {
    this.log("info", message, { ...meta, audit: true });
  }

  private log(level: winston.LoggerOptions["level"], message: string, meta?: winston.Logform.TransformableInfo) {
    if (!this.logger) {
      throw new Error("LogService has not been initialized");
    }

    this.logger.log(level, message, meta);
  }

  private createLogger(settings: AppSettings) {
    if (this.logger) {
      this.logger.close();
    }

    const rotation = settings.log.logRotation;
    const transports: winston.transport[] = [
      new winston.transports.Console({ level: settings.log.logLevel })
    ];

    transports.push(
      new DailyRotateFile({
        dirname: this.baseDir,
        filename: "app-%DATE%.log",
        datePattern: "YYYYMMDD",
        maxSize: `${rotation.maxFileSizeMB}m`,
        maxFiles: rotation.retentionDays > 0 ? `${rotation.retentionDays}d` : rotation.maxFiles,
        level: settings.log.logLevel,
        zippedArchive: false
      })
    );

    this.logger = winston.createLogger({
      level: settings.log.logLevel,
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.printf(({ level, message, timestamp, ...rest }) => {
          const extras = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : "";
          return `${timestamp} [${level}] ${message}${extras}`;
        })
      ),
      transports
    });

    void this.cleanupOldLogs(rotation.retentionDays, rotation.maxFiles).catch((error) => {
      console.error("Failed to cleanup old log files", error);
    });
  }

  private async cleanupOldLogs(retentionDays: number, maxFiles: number): Promise<void> {
    if (retentionDays <= 0 && maxFiles <= 0) {
      return;
    }

    const files = await readdir(this.baseDir);
    const logFiles = await Promise.all(
      files
        .filter((name) => name.endsWith(".log"))
        .map(async (name) => {
          const fullPath = path.join(this.baseDir, name);
          const stats = await stat(fullPath);
          return { name, fullPath, mtime: stats.mtimeMs };
        })
    );

    const now = Date.now();
    const expiry = retentionDays > 0 ? now - retentionDays * 24 * 60 * 60 * 1000 : 0;
    const toDelete = new Set<string>();

    if (retentionDays > 0) {
      for (const file of logFiles) {
        if (file.mtime < expiry) {
          toDelete.add(file.fullPath);
        }
      }
    }

    if (maxFiles > 0) {
      const survivors = logFiles
        .filter((file) => !toDelete.has(file.fullPath))
        .sort((a, b) => b.mtime - a.mtime);
      const excess = survivors.slice(maxFiles);
      excess.forEach((file) => toDelete.add(file.fullPath));
    }

    await Promise.all(
      Array.from(toDelete).map(async (filePath) => {
        try {
          await unlink(filePath);
        } catch (error) {
          console.error(`Failed to remove old log file: ${filePath}`, error);
        }
      })
    );
  }
}
