/**
 * @file workspaceStore.test.ts
 * @brief ワークスペースストアの単体テスト。
 * @details
 * useWorkspaceStoreの初期化・カード選択・更新・ステータス遷移を検証。
 * @author K.Furuichi
 * @date 2025-11-03
 * @version 0.1
 * @copyright MIT
 */
import { act } from '@testing-library/react';

import {
  getNextCardStatus,
  resetWorkspaceStore,
  useWorkspaceStore,
  type CardStatus,
} from './workspaceStore';

describe('workspaceStore', () => {
  beforeEach(() => {
    resetWorkspaceStore();
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    resetWorkspaceStore();
  });

  /**
   * @brief workspaceStoreのテストスイート。
   */
  it('initializes cards and selected ID', () => {
    const state = useWorkspaceStore.getState();
    expect(state.cards).toHaveLength(3);
    expect(state.selectedCardId).toBe('card-001');
  });

  it('cycles the status of a card and updates timestamp', () => {
    const fixed = new Date('2025-11-02T12:34:56.000Z');
    jest.useFakeTimers().setSystemTime(fixed);

    let nextStatus: CardStatus | null = null;
    act(() => {
      nextStatus = useWorkspaceStore.getState().cycleCardStatus('card-001');
    });

    expect(nextStatus).toBe(getNextCardStatus('approved'));
    const updated = useWorkspaceStore.getState().cards.find((card) => card.id === 'card-001');
    expect(updated?.status).toBe('deprecated');
    expect(updated?.updatedAt).toBe(fixed.toISOString());
  });

  /**
   * @brief 初期カード配列と選択IDの初期値を検証。
   */
  it('updates card body content via updateCard', () => {
    const fixed = new Date('2025-11-02T13:00:00.000Z');
    jest.useFakeTimers().setSystemTime(fixed);

    act(() => {
      useWorkspaceStore.getState().updateCard('card-002', {
        body: '更新後の本文です。',
      });
    });

    const card = useWorkspaceStore.getState().cards.find((item) => item.id === 'card-002');
    expect(card?.body).toBe('更新後の本文です。');
    expect(card?.updatedAt).toBe(fixed.toISOString());
  });

  it('selects an existing card ID and ignores unknown IDs', () => {
    act(() => {
      useWorkspaceStore.getState().selectCard('card-002');
    });
    expect(useWorkspaceStore.getState().selectedCardId).toBe('card-002');

    act(() => {
      useWorkspaceStore.getState().selectCard('unknown-card');
    });
    expect(useWorkspaceStore.getState().selectedCardId).toBe('card-002');
  });
});
