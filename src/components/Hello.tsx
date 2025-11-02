/**
 * @file Hello.tsx
 * @brief 挨拶メッセージを表示するReactコンポーネント。
 * @details
 * nameプロパティに応じてメッセージを動的生成します。
 * @author K.Furuichi
 * @date 2025-11-02
 * @version 0.1
 * @copyright MIT
 */
import { FC } from 'react';

/**
 * @brief Helloコンポーネントのプロパティ型定義。
 * @param name 表示する名前。
 */
type HelloProps = {
  name: string;
};

/**
 * @brief 挨拶メッセージを表示するReactコンポーネント。
 * @param name 表示する名前。
 * @return JSX要素（挨拶メッセージ）。
 */
export const Hello: FC<HelloProps> = ({ name }) => {
  return <p role="status">こんにちは、{name}！</p>;
};
