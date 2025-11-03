/**
 * @file notificationStore.test.ts
 * @brief 通知ストアの単体テスト。
 * @details
 * useNotificationStoreのadd/remove/clear動作を検証する。
 * @author K.Furuichi
 * @date 2025-11-03
 * @version 0.1
 * @copyright MIT
 */
import { act } from '@testing-library/react';

import { useNotificationStore } from './notificationStore';

describe('notificationStore', () => {
  beforeEach(() => {
    useNotificationStore.getState().clear();
    jest.useRealTimers();
  });

  /**
   * @brief notificationStoreのテストスイート。
   */
  it('adds and removes notifications', () => {
    const { add, remove } = useNotificationStore.getState();
    add('info', 'test', 1000);
    const id = useNotificationStore.getState().items[0]?.id;
    expect(useNotificationStore.getState().items).toHaveLength(1);
    act(() => {
      remove(id!);
    });
    expect(useNotificationStore.getState().items).toHaveLength(0);
  });
});
