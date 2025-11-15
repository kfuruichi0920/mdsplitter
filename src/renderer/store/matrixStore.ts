import { create } from 'zustand';

import type { Card, CardStatus } from '@/shared/workspace';
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

type StatusMap = Record<CardStatus, boolean>;

const CARD_STATUSES: CardStatus[] = ['draft', 'review', 'approved', 'deprecated'];

export interface MatrixFilter {
  cardIdQuery: string;
  titleQuery: string;
  status: StatusMap;
  columnTraceFocus: string | null; // right card id
  rowTraceFocus: string | null; // left card id
}

const createInitialStatusMap = (): StatusMap => ({
  draft: true,
  review: true,
  approved: true,
  deprecated: true,
});

const initialFilter: MatrixFilter = {
  cardIdQuery: '',
  titleQuery: '',
  status: createInitialStatusMap(),
  columnTraceFocus: null,
  rowTraceFocus: null,
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
  highlightedRowCardIds: Set<string>;
  highlightedColumnCardIds: Set<string>;
  stats: {
    totalTraces: number;
    untracedLeftCount: number;
    untracedRightCount: number;
  };
  isLoading: boolean;
  error: string | null;
  filter: MatrixFilter;
  initializeFromPayload: (payload: MatrixInitPayload) => void;
  setTraceMetadata: (fileName: string | null, header: TraceabilityHeader | null) => void;
  setCards: (side: 'left' | 'right', cards: Card[]) => void;
  setRelations: (relations: TraceabilityRelation[]) => void;
  applyTraceChange: (event: TraceChangeEvent) => void;
  setHighlightedRowCardIds: (cardIds: string[]) => void;
  setHighlightedColumnCardIds: (cardIds: string[]) => void;
  setError: (message: string | null) => void;
  finishLoading: () => void;
  setFilterQuery: (field: 'cardIdQuery' | 'titleQuery', value: string) => void;
  toggleFilterStatus: (status: CardStatus) => void;
  setTraceFocus: (side: 'row' | 'column', cardId: string | null) => void;
  resetFilter: () => void;
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
  highlightedRowCardIds: new Set<string>(),
  highlightedColumnCardIds: new Set<string>(),
  stats: initialStats,
  isLoading: false,
  error: null,
  filter: initialFilter,
  initializeFromPayload: (payload) =>
    set(() => ({
      windowId: payload.windowId,
      leftFile: payload.leftFile,
      rightFile: payload.rightFile,
      isLoading: true,
      error: null,
      highlightedRowCardIds: new Set<string>(),
      highlightedColumnCardIds: new Set<string>(),
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
  setHighlightedRowCardIds: (cardIds) =>
    set(() => ({ highlightedRowCardIds: new Set(cardIds) })),
  setHighlightedColumnCardIds: (cardIds) =>
    set(() => ({ highlightedColumnCardIds: new Set(cardIds) })),
  setError: (message) => set(() => ({ error: message })),
  finishLoading: () => set(() => ({ isLoading: false })),
  setFilterQuery: (field, value) =>
    set((state) => ({ filter: { ...state.filter, [field]: value } })),
  toggleFilterStatus: (status) =>
    set((state) => ({
      filter: {
        ...state.filter,
        status: { ...state.filter.status, [status]: !state.filter.status[status] },
      },
    })),
  setTraceFocus: (side, cardId) =>
    set((state) => ({
      filter: {
        ...state.filter,
        columnTraceFocus: side === 'column' ? cardId : state.filter.columnTraceFocus,
        rowTraceFocus: side === 'row' ? cardId : state.filter.rowTraceFocus,
      },
    })),
  resetFilter: () => set(() => ({ filter: initialFilter })),
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
      highlightedRowCardIds: new Set<string>(),
      highlightedColumnCardIds: new Set<string>(),
      stats: initialStats,
      isLoading: false,
      error: null,
      filter: initialFilter,
    })),
}));
