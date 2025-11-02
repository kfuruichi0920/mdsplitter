import { act } from '@testing-library/react';

import { useNotificationStore } from './notificationStore';

describe('notificationStore', () => {
  beforeEach(() => {
    useNotificationStore.getState().clear();
    jest.useRealTimers();
  });

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
