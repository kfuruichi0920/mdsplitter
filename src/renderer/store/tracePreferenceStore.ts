import { create } from 'zustand';
import { TRACE_RELATION_KINDS, type TraceRelationKind } from '@/shared/traceability';

type RelationKindMap = Record<TraceRelationKind, boolean>;

const createInitialKindMap = (): RelationKindMap =>
  TRACE_RELATION_KINDS.reduce<RelationKindMap>((acc, kind) => ({ ...acc, [kind]: true }), {} as RelationKindMap);

interface TracePreferenceState {
  isVisible: boolean;
  focusSelectionOnly: boolean;
  enabledKinds: RelationKindMap;
  toggleVisibility: () => void;
  toggleFocusOnly: () => void;
  toggleRelationKind: (kind: TraceRelationKind) => void;
  setAllKinds: (value: boolean) => void;
}

export const useTracePreferenceStore = create<TracePreferenceState>()((set) => ({
  isVisible: true,
  focusSelectionOnly: false,
  enabledKinds: createInitialKindMap(),
  toggleVisibility: () => set((state) => ({ isVisible: !state.isVisible })),
  toggleFocusOnly: () => set((state) => ({ focusSelectionOnly: !state.focusSelectionOnly })),
  toggleRelationKind: (kind) =>
    set((state) => ({
      enabledKinds: {
        ...state.enabledKinds,
        [kind]: !state.enabledKinds[kind],
      },
    })),
  setAllKinds: (value) =>
    set(() => ({
      enabledKinds: TRACE_RELATION_KINDS.reduce<RelationKindMap>(
        (acc, kind) => ({ ...acc, [kind]: value }),
        {} as RelationKindMap,
      ),
    })),
}));

export const resetTracePreferenceStore = (): void => {
  useTracePreferenceStore.setState({
    isVisible: true,
    focusSelectionOnly: false,
    enabledKinds: createInitialKindMap(),
  });
};
