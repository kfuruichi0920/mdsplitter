/**
 * @file logger.ts
 * @brief アプリ全体で利用するファイルロガー。
 * @details
 * ファイルベースのロギング機能を提供します。ログローテーション、レベル制御、非同期書き込みに対応。
 * 制約: 初期化前の利用は例外。@todo ログフォーマットのカスタマイズ対応。
 * @author K.Furuichi
 * @date 2025-11-02
 * @version 0.1
 * @copyright MIT
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

/**
 * @brief ロガーの初期化状態を検証。
 * @details
 * 初期化されていない場合は例外を投げる。
 * @throws Error 初期化前に呼び出された場合。
 */
const ensureInitialized = () => {
  if (!workspacePaths || !currentSettings) {
    throw new Error('Logger is not initialized');
  }
};

/**
 * @brief ロガーを初期化する。
 * @details
 * 設定・パスを受け取り、ログファイルを生成する。既存ファイルがなければ新規作成。
 * @param settings アプリ設定。
 * @param paths ワークスペースパス。
 * @return なし。
 * @throws なし（ファイル生成失敗時はcatchで握りつぶす）。
 */
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

/**
 * @brief ログファイルのローテーションを必要に応じて実施。
 * @details
 * ファイルサイズ・世代数を監視し、上限超過時に古いログを削除。
 * @return なし。
 * @throws なし（失敗時は警告出力のみ）。
 */
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

/**
 * @brief ログ書き込みキューを非同期で処理。
 * @details
 * ログレベル判定・ローテーション・ファイル追記を逐次実行。
 * @return なし。
 * @throws なし（書き込み失敗時はエラー出力のみ）。
 */
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

/**
 * @brief ログメッセージをキューに追加し、非同期書き込みを開始。
 * @details
 * ログレベル・メッセージ・タイムスタンプを記録。
 * @param level ログレベル。
 * @param message ログ内容。
 * @return なし。
 * @throws Error 初期化前に呼び出された場合。
 */
export const logMessage = (level: LogLevel, message: string): void => {
  ensureInitialized();
  pendingQueue.push({ level, message, timestamp: new Date() });
  void dispatchQueue();
};

/**
 * @brief ロガー設定を更新。
 * @details
 * ログレベル等の変更は次回書き込みから反映。
 * @param settings 新しい設定。
 * @return なし。
 * @throws なし。
 */
export const updateLoggerSettings = (settings: AppSettings): void => {
  currentSettings = settings;
  // ログレベル変更等は次回書き込みから反映。
};
