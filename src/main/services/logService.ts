import { app } from "electron";
import { mkdir } from "node:fs/promises";
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
        datePattern: "YYYYMMDD_HHmm",
        maxSize: `${rotation.maxFileSizeMB}m`,
        maxFiles: rotation.maxFiles,
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
  }
}
