import { act } from '@testing-library/react';
import { resetTracePreferenceStore, useTracePreferenceStore } from '../tracePreferenceStore';

describe('tracePreferenceStore', () => {
  beforeEach(() => {
    resetTracePreferenceStore();
  });

  it('toggles visibility, exclude-self flag, and offscreen connectors flag', () => {
    act(() => {
      useTracePreferenceStore.getState().toggleVisibility();
      useTracePreferenceStore.getState().toggleExcludeSelfTrace();
      useTracePreferenceStore.getState().toggleOffscreenConnectors();
    });

    const state = useTracePreferenceStore.getState();
    expect(state.isVisible).toBe(false);
    expect(state.excludeSelfTrace).toBe(true);
    expect(state.showOffscreenConnectors).toBe(true);
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

  it('changes creation relation kind', () => {
    act(() => {
      useTracePreferenceStore.getState().setCreationRelationKind('tests');
    });
    expect(useTracePreferenceStore.getState().creationRelationKind).toBe('tests');
  });

  it('toggles file and card visibility', () => {
    expect(useTracePreferenceStore.getState().isFileVisible('spec.json')).toBe(true);
    act(() => {
      useTracePreferenceStore.getState().toggleFileVisibility('spec.json', ['card-1']);
    });
    expect(useTracePreferenceStore.getState().isFileVisible('spec.json')).toBe(false);
    expect(useTracePreferenceStore.getState().isCardVisible('spec.json', 'card-1', 'left')).toBe(false);
    expect(useTracePreferenceStore.getState().isCardVisible('spec.json', 'card-1', 'right')).toBe(false);

    act(() => {
      useTracePreferenceStore.getState().toggleFileVisibility('spec.json', ['card-1']);
    });
    expect(useTracePreferenceStore.getState().isFileVisible('spec.json')).toBe(true);
    expect(useTracePreferenceStore.getState().isCardVisible('spec.json', 'card-1', 'left')).toBe(true);

    act(() => {
      useTracePreferenceStore.getState().toggleCardVisibility('spec.json', 'card-1', 'left');
    });
    expect(useTracePreferenceStore.getState().isCardVisible('spec.json', 'card-1', 'left')).toBe(false);

    act(() => {
      useTracePreferenceStore.getState().resetCardVisibilityForFile('spec.json');
    });
    expect(useTracePreferenceStore.getState().isCardVisible('spec.json', 'card-1', 'left')).toBe(true);
  });
});
