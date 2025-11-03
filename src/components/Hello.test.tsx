/**
 * @file Hello.test.tsx
 * @brief Helloコンポーネントのテスト。
 * @details
 * 挨拶メッセージの表示を検証します。
 * @author K.Furuichi
 * @date 2025-11-02
 * @version 0.1
 * @copyright MIT
 */


/**
 * @file Hello.test.tsx
 * @brief Helloコンポーネントのテスト。
 * @details
 * 挨拶メッセージの表示を検証します。
 * @author K.Furuichi
 * @date 2025-11-02
 * @version 0.1
 * @copyright MIT
 */

import { render, screen } from '@testing-library/react';
import { Hello } from './Hello';

/**
 * @brief Helloコンポーネントのテストケース群。
 */
describe('<Hello />', () => {
  /**
   * @brief 挨拶メッセージが正しく表示されることを検証。
   * @details
   * nameプロパティに"世界"を渡した場合、"こんにちは、世界！"がstatusロール要素に表示されることを確認します。
   * @param なし
   * @return なし
   */
  it('renders greeting message', () => {
    render(<Hello name="世界" />);
    expect(screen.getByRole('status')).toHaveTextContent('こんにちは、世界！');
  });
});
