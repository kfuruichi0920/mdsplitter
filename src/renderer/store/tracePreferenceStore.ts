import { create } from 'zustand';
import { TRACE_RELATION_KINDS, type TraceRelationKind } from '@/shared/traceability';

export type TraceConnectorSide = 'left' | 'right';

type RelationKindMap = Record<TraceRelationKind, boolean>;

const createInitialKindMap = (): RelationKindMap =>
  TRACE_RELATION_KINDS.reduce<RelationKindMap>((acc, kind) => ({ ...acc, [kind]: true }), {} as RelationKindMap);

const makeCardKey = (fileName: string, cardId: string, side: TraceConnectorSide): string =>
  `${fileName}::${cardId}::${side}`;

interface TracePreferenceState {
  isVisible: boolean;
  focusSelectionOnly: boolean;
  creationRelationKind: TraceRelationKind;
  enabledKinds: RelationKindMap;
  fileVisibility: Record<string, boolean>;
  mutedCards: Record<string, boolean>;
  toggleVisibility: () => void;
  toggleFocusOnly: () => void;
  setCreationRelationKind: (kind: TraceRelationKind) => void;
  toggleRelationKind: (kind: TraceRelationKind) => void;
  setAllKinds: (value: boolean) => void;
  isFileVisible: (fileName: string) => boolean;
  toggleFileVisibility: (fileName: string) => void;
  isCardVisible: (fileName: string, cardId: string, side: TraceConnectorSide) => boolean;
  toggleCardVisibility: (fileName: string, cardId: string, side: TraceConnectorSide) => void;
  resetCardVisibilityForFile: (fileName: string) => void;
}

export const useTracePreferenceStore = create<TracePreferenceState>()((set, get) => ({
  isVisible: true,
  focusSelectionOnly: false,
  creationRelationKind: 'trace',
  enabledKinds: createInitialKindMap(),
  fileVisibility: {},
  mutedCards: {},
  toggleVisibility: () => set((state) => ({ isVisible: !state.isVisible })),
  toggleFocusOnly: () => set((state) => ({ focusSelectionOnly: !state.focusSelectionOnly })),
  setCreationRelationKind: (kind) => set(() => ({ creationRelationKind: kind })),
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
  isFileVisible: (fileName) => get().fileVisibility[fileName] !== false,
  toggleFileVisibility: (fileName) =>
    set((state) => ({
      fileVisibility: {
        ...state.fileVisibility,
        [fileName]: state.fileVisibility[fileName] === false,
      },
    })),
  isCardVisible: (fileName, cardId, side) => {
    const key = makeCardKey(fileName, cardId, side);
    return get().mutedCards[key] !== false;
  },
  toggleCardVisibility: (fileName, cardId, side) =>
    set((state) => {
      const key = makeCardKey(fileName, cardId, side);
      const current = state.mutedCards[key];
      return {
        mutedCards: {
          ...state.mutedCards,
          [key]: current === false,
        },
      };
    }),
  resetCardVisibilityForFile: (fileName) =>
    set((state) => {
      const nextMuted = { ...state.mutedCards };
      Object.keys(nextMuted).forEach((key) => {
        if (key.startsWith(`${fileName}::`)) {
          delete nextMuted[key];
        }
      });
      return { mutedCards: nextMuted };
    }),
}));

export const resetTracePreferenceStore = (): void => {
  useTracePreferenceStore.setState({
    isVisible: true,
    focusSelectionOnly: false,
    creationRelationKind: 'trace',
    enabledKinds: createInitialKindMap(),
    fileVisibility: {},
    mutedCards: {},
  });
};

export { makeCardKey };
