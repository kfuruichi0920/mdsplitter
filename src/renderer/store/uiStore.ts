
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
export type ThemeMode = 'light' | 'dark' | 'konjo' | 'asagi' | 'sumire' | 'kurikawa' | 'tsutsuji';

/**
 * @brief カード表示モード種別。
 */
export type CardDisplayMode = 'detailed' | 'compact';

/**
 * @brief UI設定ストアの状態。
 * @details
 * テーマ・切替・明示設定・リセット操作を管理。
 */
export interface UiStoreState {
  theme: ThemeMode; ///< 現在のテーマモード。
  cardDisplayMode: CardDisplayMode; ///< カード表示モード（詳細/コンパクト）。
  markdownPreviewGlobalEnabled: boolean; ///< Markdownプレビューを一括で許可するか。
  toggleTheme: () => void; ///< テーマをトグルする。
  setTheme: (mode: ThemeMode) => void; ///< テーマを明示的に設定する。
  toggleCardDisplayMode: () => void; ///< カード表示モードをトグルする。
  setCardDisplayMode: (mode: CardDisplayMode) => void; ///< カード表示モードを明示的に設定する。
  toggleMarkdownPreviewGlobal: () => void; ///< Markdownプレビューを一括で切り替える。
  reset: () => void; ///< テーマ状態を初期値に戻す。
}


/**
 * @brief デフォルトテーマモード。
 */
const DEFAULT_THEME: ThemeMode = 'dark';

/**
 * @brief デフォルトカード表示モード。
 */
const DEFAULT_CARD_DISPLAY_MODE: CardDisplayMode = 'detailed';
const DEFAULT_MARKDOWN_PREVIEW_GLOBAL = true;

/**
 * @brief UIストア本体。
 * @details
 * テーマ状態・切替・明示設定・リセットを管理。
 */
export const useUiStore = create<UiStoreState>()((set) => ({
  theme: DEFAULT_THEME,
  cardDisplayMode: DEFAULT_CARD_DISPLAY_MODE,
  markdownPreviewGlobalEnabled: DEFAULT_MARKDOWN_PREVIEW_GLOBAL,
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
   * @brief カード表示モードをトグルする。
   * @details
   * 現在のモードがdetailedならcompact、compactならdetailedに切り替え。
   */
  toggleCardDisplayMode: () => {
    set((state) => ({ cardDisplayMode: state.cardDisplayMode === 'detailed' ? 'compact' : 'detailed' }));
  },
  /**
   * @brief カード表示モードを明示的に設定。
   * @param mode 新しいカード表示モード。
   */
  setCardDisplayMode: (mode: CardDisplayMode) => {
    set({ cardDisplayMode: mode });
  },
  toggleMarkdownPreviewGlobal: () => {
    set((state) => ({ markdownPreviewGlobalEnabled: !state.markdownPreviewGlobalEnabled }));
  },
  /**
   * @brief テーマ状態を初期値にリセット。
   */
  reset: () => {
    set({ theme: DEFAULT_THEME, cardDisplayMode: DEFAULT_CARD_DISPLAY_MODE, markdownPreviewGlobalEnabled: DEFAULT_MARKDOWN_PREVIEW_GLOBAL });
  },
}));

/**
 * @brief ストアを初期状態へリセット。
 */
export const resetUiStore = (): void => {
  useUiStore.getState().reset();
};
