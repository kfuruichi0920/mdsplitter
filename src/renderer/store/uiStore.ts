/**
 * @file uiStore.ts
 * @brief UI レベルの環境設定ストア。
 * @details
 * テーマモード（ライト/ダーク）の保持と切替アクションを提供する。App コンポーネントから
 * 利用し、ドキュメントルートへ class を付与することで Tailwind のダークモードを制御する。
 * 必要に応じて他の UI 設定も本ストアへ集約する想定。テストでは `resetUiStore` を利用して
 * 副作用をリセットできる。
 * @author K.Furuichi
 * @date 2025-11-02
 * @version 0.1
 * @copyright MIT
 */

import { create } from 'zustand';

/** テーマモード。 */
export type ThemeMode = 'light' | 'dark';

/** UI 設定ストアの状態。 */
export interface UiStoreState {
  theme: ThemeMode; ///< 現在のテーマモード。
  toggleTheme: () => void; ///< テーマをトグルする。
  setTheme: (mode: ThemeMode) => void; ///< テーマを明示的に設定する。
  reset: () => void; ///< テーマ状態を初期値に戻す。
}

const DEFAULT_THEME: ThemeMode = 'dark';

/** Zustand ストア定義。 */
export const useUiStore = create<UiStoreState>()((set) => ({
  theme: DEFAULT_THEME,
  /**
   * @brief テーマをトグルする。
   * @details
   * 現在のテーマがdarkならlight、lightならdarkに切り替え。
   */
  toggleTheme: () => {
    set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' }));
  },
  /**
   * @brief テーマを明示的に設定。
   * @param mode 新しいテーマモード。
   */
  setTheme: (mode: ThemeMode) => {
    set({ theme: mode });
  },
  /**
   * @brief テーマ状態を初期値にリセット。
   */
  reset: () => {
    set({ theme: DEFAULT_THEME });
  },
}));

/** ストアを初期状態へ戻す。 */
export const resetUiStore = (): void => {
  useUiStore.getState().reset();
};
