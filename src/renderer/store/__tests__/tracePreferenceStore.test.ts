import { act } from '@testing-library/react';
import { resetTracePreferenceStore, useTracePreferenceStore } from '../tracePreferenceStore';

describe('tracePreferenceStore', () => {
  beforeEach(() => {
    resetTracePreferenceStore();
  });

  it('toggles visibility and focus flags', () => {
    act(() => {
      useTracePreferenceStore.getState().toggleVisibility();
      useTracePreferenceStore.getState().toggleFocusOnly();
    });

    const state = useTracePreferenceStore.getState();
    expect(state.isVisible).toBe(false);
    expect(state.focusSelectionOnly).toBe(true);
  });

  it('disables individual relation kinds', () => {
    act(() => {
      useTracePreferenceStore.getState().toggleRelationKind('trace');
    });

    const enabledKinds = useTracePreferenceStore.getState().enabledKinds;
    expect(enabledKinds.trace).toBe(false);

    act(() => {
      useTracePreferenceStore.getState().setAllKinds(true);
    });
    expect(useTracePreferenceStore.getState().enabledKinds.trace).toBe(true);
  });
});
