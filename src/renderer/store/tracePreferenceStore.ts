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
  excludeSelfTrace: boolean;
  showOffscreenConnectors: boolean;
  creationRelationKind: TraceRelationKind;
  enabledKinds: RelationKindMap;
  fileVisibility: Record<string, boolean>;
  mutedCards: Record<string, boolean>;
  toggleVisibility: () => void;
  toggleExcludeSelfTrace: () => void;
  toggleOffscreenConnectors: () => void;
  setCreationRelationKind: (kind: TraceRelationKind) => void;
  toggleRelationKind: (kind: TraceRelationKind) => void;
  setAllKinds: (value: boolean) => void;
  isFileVisible: (fileName: string) => boolean;
  toggleFileVisibility: (fileName: string, cardIds: string[]) => void;
  isCardVisible: (fileName: string, cardId: string, side: TraceConnectorSide) => boolean;
  toggleCardVisibility: (fileName: string, cardId: string, side: TraceConnectorSide) => void;
  resetCardVisibilityForFile: (fileName: string) => void;
}

const applyFileConnectorVisibility = (
  currentMuted: Record<string, boolean>,
  fileName: string,
  cardIds: string[],
  visible: boolean,
): Record<string, boolean> => {
  if (cardIds.length === 0) {
    return currentMuted;
  }
  const nextMuted = { ...currentMuted };
  cardIds.forEach((cardId) => {
    (['left', 'right'] as TraceConnectorSide[]).forEach((side) => {
      const key = makeCardKey(fileName, cardId, side);
      if (visible) {
        delete nextMuted[key];
      } else {
        nextMuted[key] = false;
      }
    });
  });
  return nextMuted;
};

export const useTracePreferenceStore = create<TracePreferenceState>()((set, get) => ({
  isVisible: true,
  excludeSelfTrace: false,
  showOffscreenConnectors: false,
  creationRelationKind: 'trace',
  enabledKinds: createInitialKindMap(),
  fileVisibility: {},
  mutedCards: {},
  toggleVisibility: () => set((state) => ({ isVisible: !state.isVisible })),
  toggleExcludeSelfTrace: () => set((state) => ({ excludeSelfTrace: !state.excludeSelfTrace })),
  toggleOffscreenConnectors: () => set((state) => ({ showOffscreenConnectors: !state.showOffscreenConnectors })),
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
  toggleFileVisibility: (fileName, cardIds) =>
    set((state) => {
      const isCurrentlyVisible = state.fileVisibility[fileName] !== false;
      const nextVisible = !isCurrentlyVisible;
      return {
        fileVisibility: {
          ...state.fileVisibility,
          [fileName]: nextVisible,
        },
        mutedCards: applyFileConnectorVisibility(state.mutedCards, fileName, cardIds, nextVisible),
      };
    }),
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
    excludeSelfTrace: false,
    showOffscreenConnectors: false,
    creationRelationKind: 'trace',
    enabledKinds: createInitialKindMap(),
    fileVisibility: {},
    mutedCards: {},
  });
};

export { makeCardKey };
