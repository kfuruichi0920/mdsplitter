/**
 * @file nanoid.ts
 * @brief nanoid のモック実装。
 * @details
 * テスト環境で nanoid を使用可能にするため、シンプルなカウンタベースの ID 生成を提供する。
 * @author K.Furuichi
 * @date 2025-11-03
 * @version 0.1
 * @copyright MIT
 */

let counter = 0;

/**
 * @brief テスト用の一意なIDを生成する。
 * @return 一意な文字列ID。
 */
export const nanoid = (): string => {
  counter += 1;
  return `test-id-${counter}`;
};
