/**
 * @file vite-env.d.ts
 * @brief Vite 専用のグローバル型補完宣言。
 * @details
 * Vite が提供する `import.meta` などの補助型を有効化するための参照ディレクティブのみを保持する。
 * 実装ロジックや副作用は含まず、型定義専用として利用する。@todo 必要に応じて追加の型宣言を整理。
 * @author K.Furuichi
 * @date 2025-11-02
 * @version 0.2
 * @copyright MIT
 */
/// <reference types="vite/client" />
