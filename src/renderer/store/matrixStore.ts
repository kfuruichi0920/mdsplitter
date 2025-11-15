import { create } from 'zustand';

import type { Card } from '@/shared/workspace';
import type { TraceabilityRelation, TraceabilityHeader } from '@/shared/traceability';
import type { MatrixInitPayload, TraceChangeEvent } from '@/shared/matrixProtocol';

const computeStats = (
  leftCards: Card[],
  rightCards: Card[],
  relations: TraceabilityRelation[],
): { totalTraces: number; untracedLeftCount: number; untracedRightCount: number } => {
  const tracedLeft = new Set<string>();
  const tracedRight = new Set<string>();

  relations.forEach((relation) => {
    relation.left_ids.forEach((id) => tracedLeft.add(id));
    relation.right_ids.forEach((id) => tracedRight.add(id));
  });

  return {
    totalTraces: relations.length,
    untracedLeftCount: leftCards.filter((card) => !tracedLeft.has(card.id)).length,
    untracedRightCount: rightCards.filter((card) => !tracedRight.has(card.id)).length,
  };
};

export interface MatrixState {
  windowId: string | null;
  leftFile: string | null;
  rightFile: string | null;
  traceFileName: string | null;
  traceHeader: TraceabilityHeader | null;
  leftCards: Card[];
  rightCards: Card[];
  relations: TraceabilityRelation[];
  highlightedCardIds: Set<string>;
  stats: {
    totalTraces: number;
    untracedLeftCount: number;
    untracedRightCount: number;
  };
  isLoading: boolean;
  error: string | null;
  initializeFromPayload: (payload: MatrixInitPayload) => void;
  setTraceMetadata: (fileName: string | null, header: TraceabilityHeader | null) => void;
  setCards: (side: 'left' | 'right', cards: Card[]) => void;
  setRelations: (relations: TraceabilityRelation[]) => void;
  applyTraceChange: (event: TraceChangeEvent) => void;
  setHighlightedCardIds: (cardIds: string[]) => void;
  setError: (message: string | null) => void;
  finishLoading: () => void;
  reset: () => void;
}

const initialStats = { totalTraces: 0, untracedLeftCount: 0, untracedRightCount: 0 } as const;

export const useMatrixStore = create<MatrixState>()((set, get) => ({
  windowId: null,
  leftFile: null,
  rightFile: null,
  traceFileName: null,
  traceHeader: null,
  leftCards: [],
  rightCards: [],
  relations: [],
  highlightedCardIds: new Set<string>(),
  stats: initialStats,
  isLoading: false,
  error: null,
  initializeFromPayload: (payload) =>
    set(() => ({
      windowId: payload.windowId,
      leftFile: payload.leftFile,
      rightFile: payload.rightFile,
      isLoading: true,
      error: null,
      highlightedCardIds: new Set<string>(),
    })),
  setTraceMetadata: (fileName, header) => set(() => ({ traceFileName: fileName, traceHeader: header ?? null })),
  setCards: (side, cards) =>
    set((state) => {
      const leftCards = side === 'left' ? cards : state.leftCards;
      const rightCards = side === 'right' ? cards : state.rightCards;
      return {
        leftCards,
        rightCards,
        stats: computeStats(leftCards, rightCards, state.relations),
      };
    }),
  setRelations: (relations) =>
    set((state) => ({
      relations,
      stats: computeStats(state.leftCards, state.rightCards, relations),
    })),
  applyTraceChange: (event) => {
    const { leftFile, rightFile } = get();
    if (leftFile !== event.leftFile || rightFile !== event.rightFile) {
      return;
    }
    get().setRelations(event.relations);
  },
  setHighlightedCardIds: (cardIds) =>
    set(() => ({ highlightedCardIds: new Set(cardIds) })),
  setError: (message) => set(() => ({ error: message })),
  finishLoading: () => set(() => ({ isLoading: false })),
  reset: () =>
    set(() => ({
      windowId: null,
      leftFile: null,
      rightFile: null,
      traceFileName: null,
      traceHeader: null,
      leftCards: [],
      rightCards: [],
      relations: [],
      highlightedCardIds: new Set<string>(),
      stats: initialStats,
      isLoading: false,
      error: null,
    })),
}));
