import { create } from 'zustand';

import type { Card, CardStatus, CardKind } from '@/shared/workspace';
import type { TraceabilityRelation, TraceabilityHeader, TraceRelationKind } from '@/shared/traceability';
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
  rowTitleQuery: string;
  columnTitleQuery: string;
  statusRow: StatusMap;
  statusColumn: StatusMap;
  kindRow: Record<CardKind, boolean>;
  kindColumn: Record<CardKind, boolean>;
  columnTraceFocus: string | null; // right card id
  rowTraceFocus: string | null; // left card id
}

const createInitialStatusMap = (): StatusMap => ({
  draft: true,
  review: true,
  approved: true,
  deprecated: true,
});

const createInitialKindMap = (): Record<CardKind, boolean> => ({
  heading: true,
  paragraph: true,
  bullet: true,
  figure: true,
  table: true,
  test: true,
  qa: true,
});

const createInitialFilter = (): MatrixFilter => ({
  rowTitleQuery: '',
  columnTitleQuery: '',
  statusRow: createInitialStatusMap(),
  statusColumn: createInitialStatusMap(),
  kindRow: createInitialKindMap(),
  kindColumn: createInitialKindMap(),
  columnTraceFocus: null,
  rowTraceFocus: null,
});

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
  defaultRelationKind: TraceRelationKind;
  defaultDirection: TraceabilityRelation['directed'];
  confirmMemoDeletion: boolean;
  exportIncludeMemo: boolean;
  initializeFromPayload: (payload: MatrixInitPayload) => void;
  setTraceMetadata: (fileName: string | null, header: TraceabilityHeader | null) => void;
  setCards: (side: 'left' | 'right', cards: Card[]) => void;
  setRelations: (relations: TraceabilityRelation[]) => void;
  applyTraceChange: (event: TraceChangeEvent) => void;
  setHighlightedRowCardIds: (cardIds: string[]) => void;
  setHighlightedColumnCardIds: (cardIds: string[]) => void;
  setError: (message: string | null) => void;
  finishLoading: () => void;
  setFilterQuery: (field: 'rowTitleQuery' | 'columnTitleQuery', value: string) => void;
  toggleFilterStatus: (side: 'row' | 'column', status: CardStatus) => void;
  toggleFilterKind: (side: 'row' | 'column', kind: CardKind) => void;
  setTraceFocus: (side: 'row' | 'column', cardId: string | null) => void;
  resetFilter: () => void;
  setDefaultRelationKind: (kind: TraceRelationKind) => void;
  setDefaultDirection: (direction: TraceabilityRelation['directed']) => void;
  setConfirmMemoDeletion: (value: boolean) => void;
  setExportIncludeMemo: (value: boolean) => void;
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
  filter: createInitialFilter(),
  defaultRelationKind: 'trace',
  defaultDirection: 'left_to_right',
  confirmMemoDeletion: true,
  exportIncludeMemo: false,
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
  toggleFilterStatus: (side, status) =>
    set((state) => ({
      filter: {
        ...state.filter,
        statusRow:
          side === 'row'
            ? { ...state.filter.statusRow, [status]: !state.filter.statusRow[status] }
            : state.filter.statusRow,
        statusColumn:
          side === 'column'
            ? { ...state.filter.statusColumn, [status]: !state.filter.statusColumn[status] }
            : state.filter.statusColumn,
      },
    })),
  toggleFilterKind: (side, kind) =>
    set((state) => ({
      filter: {
        ...state.filter,
        kindRow:
          side === 'row'
            ? { ...state.filter.kindRow, [kind]: !state.filter.kindRow[kind] }
            : state.filter.kindRow,
        kindColumn:
          side === 'column'
            ? { ...state.filter.kindColumn, [kind]: !state.filter.kindColumn[kind] }
            : state.filter.kindColumn,
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
  resetFilter: () => set(() => ({ filter: createInitialFilter() })),
  setDefaultRelationKind: (kind) => set(() => ({ defaultRelationKind: kind })),
  setDefaultDirection: (direction) => set(() => ({ defaultDirection: direction })),
  setConfirmMemoDeletion: (value) => set(() => ({ confirmMemoDeletion: value })),
  setExportIncludeMemo: (value) => set(() => ({ exportIncludeMemo: value })),
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
      filter: createInitialFilter(),
      defaultRelationKind: 'trace',
      defaultDirection: 'left_to_right',
      confirmMemoDeletion: true,
      exportIncludeMemo: false,
    })),
}));
