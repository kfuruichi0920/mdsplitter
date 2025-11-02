/**
 * @file logging.ts
 * @brief ログレベルに関する共通ユーティリティ。
 */

import type { LogLevel } from './settings';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

/**
 * @brief 指定したログレベルが現在の設定で出力対象か判定する。
 * @param level 出力したいログレベル。
 * @param threshold 設定で有効な最小レベル。
 * @return 出力してよい場合は true。
 */
export const isLogLevelEnabled = (level: LogLevel, threshold: LogLevel): boolean => {
  return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[threshold];
};

/**
 * @brief ログレベルを大文字表記にフォーマットする。
 * @param level ログレベル。
 */
export const formatLogLevel = (level: LogLevel): string => level.toUpperCase();

/**
 * @brief ローテーション対象とするファイルサイズ（バイト単位）を算出。
 * @param sizeMB メガバイト設定値。
 */
export const toBytes = (sizeMB: number): number => Math.max(1, Math.floor(sizeMB * 1024 * 1024));
