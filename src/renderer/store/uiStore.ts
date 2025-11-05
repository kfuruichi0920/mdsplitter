
/**
 * @file uiStore.ts
 * @brief UIテーマ・環境設定管理ストア。
 * @details
 * テーマモード（ライト/ダーク）の保持・切替・明示設定・リセットを提供。
 * Appコンポーネントから利用し、Tailwindのダークモード制御にも活用。
 * @author K.Furuichi
 * @date 2025-11-06
 * @version 0.2
 * @copyright MIT
 */

import { create } from 'zustand';

/**
 * @brief テーマモード種別。
 */
export type ThemeMode = 'light' | 'dark';

/**
 * @brief UI設定ストアの状態。
 * @details
 * テーマ・切替・明示設定・リセット操作を管理。
 */
export interface UiStoreState {
  theme: ThemeMode; ///< 現在のテーマモード。
  toggleTheme: () => void; ///< テーマをトグルする。
  setTheme: (mode: ThemeMode) => void; ///< テーマを明示的に設定する。
  reset: () => void; ///< テーマ状態を初期値に戻す。
}


/**
 * @brief デフォルトテーマモード。
 */
const DEFAULT_THEME: ThemeMode = 'dark';

/**
 * @brief UIストア本体。
 * @details
 * テーマ状態・切替・明示設定・リセットを管理。
 */
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

/**
 * @brief ストアを初期状態へリセット。
 */
export const resetUiStore = (): void => {
  useUiStore.getState().reset();
};
