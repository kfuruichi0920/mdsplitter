
/**
 * @file logging.test.ts
 * @brief ログ関連ユーティリティのテスト。
 * @details
 * ログレベル判定、フォーマット、バイト変換の動作を検証します。
 * @author K.Furuichi
 * @date 2025-11-02
 * @version 0.1
 * @copyright MIT
 */

import { formatLogLevel, isLogLevelEnabled, toBytes } from './logging';

/**
 * @brief loggingユーティリティのテストケース群。
 */
describe('logging utilities', () => {
  /**
   * @brief ログレベルの有効判定を検証。
   * @details
   * error, warn, debug各レベルの有効/無効判定を確認します。
   */
  it('determines enabled log levels', () => {
    expect(isLogLevelEnabled('error', 'info')).toBe(true);
    expect(isLogLevelEnabled('warn', 'info')).toBe(true);
    expect(isLogLevelEnabled('debug', 'info')).toBe(false);
  });

  /**
   * @brief ログレベルの大文字変換を検証。
   */
  it('formats levels to uppercase', () => {
    expect(formatLogLevel('warn')).toBe('WARN');
  });

  /**
   * @brief メガバイトからバイトへの変換を検証。
   * @details
   * 0.5MB→524288バイト、0MB→1バイトの変換結果を確認します。
   */
  it('converts megabytes to bytes', () => {
    expect(toBytes(0.5)).toBe(524288);
    expect(toBytes(0)).toBe(1);
  });
});
