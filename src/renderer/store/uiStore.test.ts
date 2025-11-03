/**
 * @file uiStore.test.ts
 * @brief UIストアの単体テスト。
 * @details
 * useUiStoreのテーマ切替・明示設定・リセット動作を検証。
 * @author K.Furuichi
 * @date 2025-11-03
 * @version 0.1
 * @copyright MIT
 */
import { act } from '@testing-library/react';

import { resetUiStore, useUiStore } from './uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    act(() => {
      resetUiStore();
    });
  });

  afterEach(() => {
    act(() => {
      resetUiStore();
    });
  });

  /**
   * @brief uiStoreのテストスイート。
   */
  it('initializes with default theme', () => {
    expect(useUiStore.getState().theme).toBe('dark');
  });

  it('toggles between light and dark mode', () => {
    act(() => {
      useUiStore.getState().toggleTheme();
    });
    expect(useUiStore.getState().theme).toBe('light');

    act(() => {
      useUiStore.getState().toggleTheme();
    });
    expect(useUiStore.getState().theme).toBe('dark');
  });

  /**
   * @brief 明示的なテーマ設定を検証。
   */
  it('sets theme explicitly', () => {
    act(() => {
      useUiStore.getState().setTheme('light');
    });
    expect(useUiStore.getState().theme).toBe('light');
  });
});
