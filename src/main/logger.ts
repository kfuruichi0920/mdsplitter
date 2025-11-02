/**
 * @file logger.ts
 * @brief アプリ全体で利用するファイルロガー。
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { formatLogLevel, isLogLevelEnabled, toBytes } from '../shared/logging';
import type { AppSettings, LogLevel } from '../shared/settings';
import type { WorkspacePaths } from './workspace';

const ACTIVE_LOG_NAME = 'app.log';

let currentSettings: AppSettings | null = null;
let workspacePaths: WorkspacePaths | null = null;
let activeLogFile = '';
let isWriting = false;
const pendingQueue: Array<{ level: LogLevel; message: string; timestamp: Date }> = [];

const ensureInitialized = () => {
  if (!workspacePaths || !currentSettings) {
    throw new Error('Logger is not initialized');
  }
};

export const initLogger = async (settings: AppSettings, paths: WorkspacePaths): Promise<void> => {
  currentSettings = settings;
  workspacePaths = paths;
  activeLogFile = path.join(paths.logsDir, ACTIVE_LOG_NAME);

  try {
    await fs.access(activeLogFile);
  } catch (error) {
    await fs.writeFile(activeLogFile, '', 'utf8');
  }
};

const rotateIfNeeded = async (): Promise<void> => {
  ensureInitialized();
  if (!currentSettings) {
    return;
  }

  try {
    const stats = await fs.stat(activeLogFile);
    if (stats.size < toBytes(currentSettings.logging.maxSizeMB)) {
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:]/g, '').replace(/\..+$/, '');
    const rotatedName = path.join(workspacePaths!.logsDir, `app-${timestamp}.log`);
    await fs.rename(activeLogFile, rotatedName);
    await fs.writeFile(activeLogFile, '', 'utf8');

    const files = await fs.readdir(workspacePaths!.logsDir);
    const rotated = files
      .filter((file) => file.startsWith('app-') && file.endsWith('.log'))
      .map(async (file) => {
        const fullPath = path.join(workspacePaths!.logsDir, file);
        const stat = await fs.stat(fullPath);
        return { file: fullPath, mtime: stat.mtimeMs };
      });

    const resolved = await Promise.all(rotated);
    resolved.sort((a, b) => b.mtime - a.mtime);

    const excess = resolved.slice(currentSettings.logging.maxFiles - 1);
    await Promise.all(excess.map((entry) => fs.unlink(entry.file).catch(() => {})));
  } catch (error) {
    console.warn('[logger] rotation check failed', error);
  }
};

const dispatchQueue = async () => {
  if (isWriting) {
    return;
  }
  isWriting = true;

  while (pendingQueue.length > 0) {
    const entry = pendingQueue.shift();
    if (!entry || !currentSettings || !workspacePaths) {
      continue;
    }

    if (!isLogLevelEnabled(entry.level, currentSettings.logging.level)) {
      continue;
    }

    const formatted = `[${entry.timestamp.toISOString()}] ${formatLogLevel(entry.level)}: ${entry.message}\n`;
    try {
      await rotateIfNeeded();
      await fs.appendFile(activeLogFile, formatted, 'utf8');
    } catch (error) {
      console.error('[logger] failed to write log', error);
    }
  }

  isWriting = false;
};

export const logMessage = (level: LogLevel, message: string): void => {
  ensureInitialized();
  pendingQueue.push({ level, message, timestamp: new Date() });
  void dispatchQueue();
};

export const updateLoggerSettings = (settings: AppSettings): void => {
  currentSettings = settings;
  // ログレベル変更等は次回書き込みから反映。
};
