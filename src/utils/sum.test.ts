/**
 * @file sum.test.ts
 * @brief sum関数の単体テスト。
 * @details
 * sum.ts の加算処理について、代表的な正常系シナリオを検証します。
 * @author K.Furuichi
 * @date 2025-11-02
 * @version 0.1
 * @copyright MIT
 */

import { sum } from './sum';

/**
 * @brief sum関数の正常系挙動を検証するテストスイート。
 * @details
 * 正の整数と負数を組み合わせた代表的なケースで、加算結果が期待通りになることを確認します。
 */
describe('sum', () => {
  //! 正の整数同士の加算は算術的な和になる
  it('returns the arithmetic sum for positive integers', () => {
    expect(sum(2, 3)).toBe(5);
  });

  //! 負数を含む場合でも算術的な和を返す
  it('handles negative operands', () => {
    expect(sum(-2, 5)).toBe(3);
  });
});
