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

  it('sets theme explicitly', () => {
    act(() => {
      useUiStore.getState().setTheme('light');
    });
    expect(useUiStore.getState().theme).toBe('light');
  });
});
