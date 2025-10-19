import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

let logger: winston.Logger | null = null;
let logsDir: string = '';

/**
 * Initialize logger with configuration
 */
export function initLogger(workDir?: string): winston.Logger {
  // Determine logs directory
  logsDir = workDir ? path.join(workDir, '_logs') : path.join(app.getPath('userData'), 'logs');

  // Create logs directory if not exists
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Generate log filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const timeStr = new Date()
    .toISOString()
    .split('T')[1]
    .replace(/[:.]/g, '')
    .substring(0, 6);
  const logFileName = `${timestamp}_${timeStr}.log`;
  const logFilePath = path.join(logsDir, logFileName);

  // Custom format
  const customFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
      const ts = timestamp || new Date().toISOString();
      let log = `[${ts}] ${level.toUpperCase()}: ${message}`;
      if (stack) {
        log += `\n${stack}`;
      }
      return log;
    })
  );

  // Create logger
  logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: customFormat,
    transports: [
      // Console transport
      new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), customFormat),
      }),
      //  File transport with rotation (temporarily disabled)
      // new winston.transports.File({
      //   filename: logFilePath,
      //   maxsize: 10 * 1024 * 1024, // 10MB
      //   maxFiles: 10, // Keep 10 files
      // }),
    ],
  });

  logger.info('Logger initialized', { logsDir, logFileName });

  return logger;
}

/**
 * Get logger instance
 */
export function getLogger(): winston.Logger {
  if (!logger) {
    logger = initLogger();
  }
  return logger;
}

/**
 * Log info message
 */
export function logInfo(message: string, meta?: Record<string, unknown>): void {
  getLogger().info(message, meta);
}

/**
 * Log warning message
 */
export function logWarn(message: string, meta?: Record<string, unknown>): void {
  getLogger().warn(message, meta);
}

/**
 * Log error message
 */
export function logError(message: string, error?: Error | unknown): void {
  if (error instanceof Error) {
    getLogger().error(message, { error: error.message, stack: error.stack });
  } else {
    getLogger().error(message, { error });
  }
}

/**
 * Log debug message
 */
export function logDebug(message: string, meta?: Record<string, unknown>): void {
  getLogger().debug(message, meta);
}

/**
 * Set log level
 */
export function setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
  getLogger().level = level;
  logInfo(`Log level changed to: ${level}`);
}

/**
 * Get logs directory path
 */
export function getLogsDir(): string {
  return logsDir;
}

/**
 * Clean old log files (older than specified days)
 */
export async function cleanOldLogs(daysToKeep: number = 30): Promise<void> {
  if (!logsDir || !fs.existsSync(logsDir)) {
    return;
  }

  const now = Date.now();
  const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

  const files = fs.readdirSync(logsDir);

  for (const file of files) {
    if (!file.endsWith('.log')) continue;

    const filePath = path.join(logsDir, file);
    const stat = fs.statSync(filePath);
    const age = now - stat.mtimeMs;

    if (age > maxAge) {
      fs.unlinkSync(filePath);
      logInfo(`Deleted old log file: ${file}`);
    }
  }
}
