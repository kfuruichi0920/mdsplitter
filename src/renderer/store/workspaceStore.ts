
/**
 * @file workspaceStore.ts
 * @brief 分割パネルごとのカードファイル・タブ管理ストア。
 * @details
 * 各分割パネル（葉ノード）に紐づくタブとカードデータを管理。
 * ファイル単位でタブを一意にし、同一ファイルの複数パネル同時表示を禁止。
 * @author K.Furuichi
 * @date 2025-11-06
 * @version 0.1
 * @copyright MIT
 */

import { create } from 'zustand';
import { nanoid } from 'nanoid';

import {
  CARD_STATUS_SEQUENCE,
  getNextCardStatus,
  generateNextCardId,
  type Card,
  type CardKind,
  type CardPatch,
  type CardStatus,
} from '@/shared/workspace';
import type { AppendCardHistoryRequest, CardHistoryOperation, CardVersionDiff } from '@/shared/history';
import { useHistoryStore } from './historyStore';
import type { CardDisplayMode } from './uiStore';

export { CARD_STATUS_SEQUENCE, getNextCardStatus };
export type { Card, CardKind, CardPatch, CardStatus };

/**
 * @brief Undo/Redoスタックのエントリー。
 * @details
 * カードの変更履歴を保持し、Undo/Redoを実現する。
 */
export interface UndoRedoEntry {
  type: 'update' | 'move' | 'add' | 'delete' | 'paste'; ///< 操作種別
  tabId: string; ///< 対象タブID
  cards: Card[]; ///< 変更前のカード配列
  description: string; ///< 操作の説明（ログ用）
}

/**
 * @brief クリップボードに格納するカード情報。
 */
interface ClipboardCardData {
  title: string;
  body: string;
  status: CardStatus;
  kind: CardKind;
  hasLeftTrace: boolean;
  hasRightTrace: boolean;
  markdownPreviewEnabled: boolean;
}

/**
 * @brief クリップボード用カードツリー。
 */
interface ClipboardCardNode {
  data: ClipboardCardData;
  children: ClipboardCardNode[];
}

/**
 * @brief 直近の挿入位置ハイライト情報。
 */
interface InsertPreview {
  leafId: string;
  tabId: string;
  cardId: string | null;
  position: InsertPosition;
  highlightIds: string[];
  timestamp: number;
}

const snapshotCard = (card: Card): Card => JSON.parse(JSON.stringify(card));

const cloneDiff = (diff?: CardVersionDiff): CardVersionDiff | undefined => {
  if (!diff) {
    return undefined;
  }
  return {
    before: diff.before ? JSON.parse(JSON.stringify(diff.before)) : undefined,
    after: diff.after ? JSON.parse(JSON.stringify(diff.after)) : undefined,
  } satisfies CardVersionDiff;
};

type PendingHistoryEntry = Omit<AppendCardHistoryRequest, 'fileName'>;

const pendingHistoryByTab = new Map<string, PendingHistoryEntry[]>();

const enqueuePendingHistory = (tabId: string, entry: PendingHistoryEntry): void => {
  const queue = pendingHistoryByTab.get(tabId) ?? [];
  queue.push(entry);
  pendingHistoryByTab.set(tabId, queue);
};

const persistHistoryEntry = (fileName: string, entry: PendingHistoryEntry): void => {
  try {
    void useHistoryStore.getState().appendVersion({
      fileName,
      cardId: entry.cardId,
      version: entry.version,
    });
  } catch (error) {
    console.warn('[workspaceStore] failed to append card history', error);
  }
};

const flushPendingHistory = (tabId: string, fileName: string): void => {
  const queue = pendingHistoryByTab.get(tabId);
  if (!queue?.length) {
    return;
  }
  pendingHistoryByTab.delete(tabId);
  queue.forEach((entry) => {
    persistHistoryEntry(fileName, entry);
  });
};

const discardPendingHistory = (tabId: string): void => {
  pendingHistoryByTab.delete(tabId);
};

const recordCardHistory = (
  tabId: string,
  fileName: string | null | undefined,
  card: Card | null,
  operation: CardHistoryOperation,
  diff?: CardVersionDiff,
  context?: HistoryContext,
): void => {
  if (!card) {
    return;
  }
  const entry: PendingHistoryEntry = {
    cardId: card.cardId ?? card.id,
    version: {
      versionId: nanoid(),
      timestamp: new Date().toISOString(),
      operation,
      card: snapshotCard(card),
      diff: cloneDiff(diff),
      restoredFromVersionId: context?.restoredFromVersionId,
      restoredFromTimestamp: context?.restoredFromTimestamp,
    },
  } satisfies PendingHistoryEntry;

  if (!fileName) {
    enqueuePendingHistory(tabId, entry);
    return;
  }

  flushPendingHistory(tabId, fileName);
  persistHistoryEntry(fileName, entry);
};

/**
 * @brief タブの状態。
 * @details
 * パネル内で開かれているカードファイルの状態を保持。
 */
export interface PanelTabState {
  id: string;
  leafId: string;
  fileName: string | null;
  title: string;
  cards: Card[];
  selectedCardIds: Set<string>; ///< 選択中のカードIDセット（複数選択対応）
  isDirty: boolean;
  lastSavedAt: string | null;
  expandedCardIds: Set<string>; ///< 展開状態のカードIDセット（子を持つカードのみ）
  editingCardId: string | null; ///< 編集中のカードID（インライン編集時）
  dirtyCardIds: Set<string>; ///< 未保存編集のカードID集合。
  displayMode: CardDisplayMode; ///< カード表示モード（詳細/コンパクト）
}

/**
 * @brief 葉ノード単位のタブ集合。
 * @details
 * パネルごとに開かれているタブID・アクティブタブIDを管理。
 */
export interface LeafWorkspaceState {
  leafId: string;
  tabIds: string[];
  activeTabId: string | null;
}

/**
 * @brief タブオープン時の戻り値。
 * @details
 * 新規・再アクティブ・拒否（競合）を区別。
 */
export type OpenTabResult =
  | { status: 'opened'; tabId: string; leafId: string }
  | { status: 'activated'; tabId: string; leafId: string }
  | { status: 'denied'; tabId: null; leafId: string; reason: string; conflictLeafId: string | null };

/**
 * @brief ストア全体の状態とアクション。
 * @details
 * タブ・パネル・ファイルの紐付けと各種操作を管理。
 */
export type InsertPosition = 'before' | 'after' | 'child';

export interface MergeCardsOptions {
  title: string;
  body: string;
  status: CardStatus;
  kind: CardKind;
  cardId?: string | null;
  removeOriginals: boolean;
  inheritTraces: boolean;
}

export interface MergeCardsResult {
  mergedCard: Card;
  removedCardIds: string[];
}

interface HistoryContext {
  restoredFromVersionId?: string;
  restoredFromTimestamp?: string;
}

export interface WorkspaceStore {
  tabs: Record<string, PanelTabState>;
  leafs: Record<string, LeafWorkspaceState>;
  fileToLeaf: Record<string, string>;
  nextUntitledIndex: number;
  undoStack: UndoRedoEntry[]; ///< Undoスタック（最大100件）
  redoStack: UndoRedoEntry[]; ///< Redoスタック（最大100件）
  clipboard: ClipboardCardNode[] | null; ///< コピー済みカードツリー
  lastInsertPreview: InsertPreview | null; ///< 直近の挿入ハイライト
  openTab: (leafId: string, fileName: string, cards: Card[], options?: { savedAt?: string; title?: string }) => OpenTabResult;
  createUntitledTab: (leafId: string, options?: { title?: string; cards?: Card[] }) => PanelTabState | null;
  closeTab: (leafId: string, tabId: string) => void;
  closeLeaf: (leafId: string) => void;
  setActiveTab: (leafId: string, tabId: string) => void;
  selectCard: (leafId: string, tabId: string, cardId: string, options?: { multi?: boolean; range?: boolean }) => void; ///< カード選択（単一/複数/範囲）
  clearSelection: (leafId: string, tabId: string) => void; ///< 選択をクリア
  toggleCardSelection: (leafId: string, tabId: string, cardId: string) => void; ///< カード選択をトグル（Ctrl+クリック）
  selectCardRange: (leafId: string, tabId: string, cardId: string) => void; ///< 範囲選択（Shift+クリック）
  addCard: (leafId: string, tabId: string, options?: { anchorCardId?: string | null; position?: InsertPosition }) => Card | null; ///< 挿入位置を指定してカードを追加
  deleteCards: (leafId: string, tabId: string, cardIds?: string[]) => number; ///< 指定または選択中カードを削除
  updateCard: (leafId: string, tabId: string, cardId: string, patch: CardPatch, options?: { historyOperation?: CardHistoryOperation; historyContext?: HistoryContext }) => void;
  cycleCardStatus: (leafId: string, tabId: string, cardId: string) => CardStatus | null;
  hydrateTab: (leafId: string, tabId: string, cards: Card[], options?: { savedAt?: string }) => void;
  markSaved: (tabId: string, savedAt: string) => void;
  toggleCardExpanded: (leafId: string, tabId: string, cardId: string) => void; ///< カードの展開/折畳をトグル
  expandAll: (leafId: string, tabId: string) => void; ///< 全カードを展開
  collapseAll: (leafId: string, tabId: string) => void; ///< 全カードを折畳
  toggleCardMarkdownPreview: (leafId: string, tabId: string, cardId: string) => void; ///< MarkdownプレビューのON/OFF
  moveCards: (leafId: string, tabId: string, cardIds: string[], targetCardId: string, position: 'before' | 'after' | 'child') => boolean; ///< カード移動（階層構造を維持）
  setEditingCard: (leafId: string, tabId: string, cardId: string | null) => void; ///< 編集中カードを設定
  copySelection: (leafId: string, tabId: string) => number; ///< 選択カードをコピー
  pasteClipboard: (leafId: string, tabId: string, options?: { position?: InsertPosition; anchorCardId?: string | null }) => { inserted: number; insertedIds: string[]; anchorId: string | null; position: InsertPosition } | null; ///< クリップボードのカードを貼り付け
  hasClipboard: () => boolean; ///< クリップボードにカードがあるか
  renameTabFile: (tabId: string, fileName: string) => void; ///< タブに紐づくファイル名を変更
  setCardTraceFlags: (fileName: string, updates: Record<string, Partial<Pick<Card, 'hasLeftTrace' | 'hasRightTrace'>>>) => void; ///< トレースフラグを更新
  mergeCards: (leafId: string, tabId: string, cardIds: string[], options: MergeCardsOptions) => MergeCardsResult | null; ///< カード統合
  undo: () => boolean; ///< Undo実行（成功時true）
  redo: () => boolean; ///< Redo実行（成功時true）
  canUndo: () => boolean; ///< Undo可能か判定
  canRedo: () => boolean; ///< Redo可能か判定
  toggleTabDisplayMode: (tabId: string) => void; ///< タブのカード表示モードをトグル
  reset: () => void;
}

/**
 * @brief 空の葉ステートを生成。
 * @param leafId 葉ノードID。
 * @return 新規LeafWorkspaceState。
 */
const createLeafState = (leafId: string): LeafWorkspaceState => ({ leafId, tabIds: [], activeTabId: null });

/**
 * @brief 初期ストア状態。
 */
const initialState: Pick<WorkspaceStore, 'tabs' | 'leafs' | 'fileToLeaf' | 'undoStack' | 'redoStack' | 'clipboard' | 'lastInsertPreview' | 'nextUntitledIndex'> = {
  tabs: {},
  leafs: {},
  fileToLeaf: {},
  nextUntitledIndex: 1,
  undoStack: [],
  redoStack: [],
  clipboard: null,
  lastInsertPreview: null,
};

/**
 * @brief 分割パネル用ワークスペースストア定義。
 * @details
 * タブのオープン・クローズ・カード選択・更新・保存・リセット等を管理。
 */
export const useWorkspaceStore = create<WorkspaceStore>()((set, get) => ({
  ...initialState,

  openTab: (leafId, fileName, cards, options) => {
    const normalizedCards = normalizeCardOrder(cards);
    let outcome: OpenTabResult = { status: 'denied', tabId: null, leafId, reason: 'unknown', conflictLeafId: null };

    set((state) => {
      const existingLeafId = state.fileToLeaf[fileName];
      if (existingLeafId && existingLeafId !== leafId) {
        outcome = {
          status: 'denied',
          tabId: null,
          leafId,
          reason: `ファイル "${fileName}" は別パネルで開かれています。`,
          conflictLeafId: existingLeafId,
        } satisfies OpenTabResult;
        return state;
      }

      const currentLeaf = state.leafs[leafId] ?? createLeafState(leafId);
      const existingTabId = currentLeaf.tabIds.find((id) => state.tabs[id]?.fileName === fileName);

      if (existingTabId) {
        //! 同一パネル内で開いている場合は再アクティブ化し、内容を最新化する
        const prevTab = state.tabs[existingTabId];
        //! 展開状態を維持しつつ、新しいカードで存在しないIDは削除
        const updatedExpandedIds = new Set<string>(
          Array.from(prevTab.expandedCardIds).filter((id) => normalizedCards.some((card) => card.id === id && card.child_ids.length > 0)),
        );
        //! 選択状態も維持しつつ、新しいカードで存在しないIDは削除
        const updatedSelectedIds = new Set<string>(
          Array.from(prevTab.selectedCardIds).filter((id) => normalizedCards.some((card) => card.id === id)),
        );
        const nextTab: PanelTabState = {
          ...prevTab,
          cards: [...normalizedCards],
          selectedCardIds: updatedSelectedIds.size > 0 ? updatedSelectedIds : new Set(normalizedCards[0]?.id ? [normalizedCards[0].id] : []),
          isDirty: false,
          lastSavedAt: options?.savedAt ?? prevTab.lastSavedAt,
          expandedCardIds: updatedExpandedIds,
          editingCardId: null,
          dirtyCardIds: new Set<string>(),
          displayMode: prevTab.displayMode ?? 'detailed', //! displayModeを維持
        } satisfies PanelTabState;

        outcome = { status: 'activated', tabId: existingTabId, leafId } satisfies OpenTabResult;

        return {
          ...state,
          tabs: { ...state.tabs, [existingTabId]: nextTab },
          leafs: {
            ...state.leafs,
            [leafId]: { ...currentLeaf, activeTabId: existingTabId },
          },
        } satisfies Pick<WorkspaceStore, 'tabs' | 'leafs' | 'fileToLeaf'>;
      }

      const tabId = nanoid();
      //! 初期状態では子を持つカードをすべて展開
      const initialExpandedIds = new Set<string>(
        normalizedCards.filter((card) => card.child_ids && card.child_ids.length > 0).map((card) => card.id),
      );
      //! 初期選択は最初のカード
      const initialSelectedIds = new Set<string>(normalizedCards[0]?.id ? [normalizedCards[0].id] : []);
      const nextTab: PanelTabState = {
        id: tabId,
        leafId,
        fileName,
        title: options?.title ?? fileName,
        cards: [...normalizedCards],
        selectedCardIds: initialSelectedIds,
        isDirty: false,
        lastSavedAt: options?.savedAt ?? null,
        expandedCardIds: initialExpandedIds,
        editingCardId: null,
        dirtyCardIds: new Set<string>(),
        displayMode: 'detailed', //! デフォルトは詳細表示
      } satisfies PanelTabState;

      const nextLeaf: LeafWorkspaceState = {
        leafId,
        tabIds: [...currentLeaf.tabIds, tabId],
        activeTabId: tabId,
      } satisfies LeafWorkspaceState;

      outcome = { status: 'opened', tabId, leafId } satisfies OpenTabResult;

      return {
        tabs: { ...state.tabs, [tabId]: nextTab },
        leafs: { ...state.leafs, [leafId]: nextLeaf },
        fileToLeaf: { ...state.fileToLeaf, [fileName]: leafId },
      } satisfies Pick<WorkspaceStore, 'tabs' | 'leafs' | 'fileToLeaf'>;
    });

    return outcome;
  },

  createUntitledTab: (leafId, options) => {
    let createdTab: PanelTabState | null = null;

    set((state) => {
      const currentLeaf = state.leafs[leafId] ?? createLeafState(leafId);
      const normalizedCards = options?.cards ? normalizeCardOrder(options.cards) : [];
      const tabId = nanoid();
      const title = options?.title ?? `新規ファイル ${state.nextUntitledIndex}`;
      const initialExpandedIds = new Set<string>(
        normalizedCards.filter((card) => card.child_ids && card.child_ids.length > 0).map((card) => card.id),
      );
      const initialSelectedIds = new Set<string>(normalizedCards[0]?.id ? [normalizedCards[0].id] : []);

      const nextTab: PanelTabState = {
        id: tabId,
        leafId,
        fileName: null,
        title,
        cards: [...normalizedCards],
        selectedCardIds: initialSelectedIds,
        isDirty: true,
        lastSavedAt: null,
        expandedCardIds: initialExpandedIds,
        editingCardId: null,
        dirtyCardIds: new Set<string>(normalizedCards.map((card) => card.id)),
        displayMode: 'detailed', //! デフォルトは詳細表示
      } satisfies PanelTabState;

      createdTab = nextTab;

      const nextLeaf: LeafWorkspaceState = {
        leafId,
        tabIds: [...currentLeaf.tabIds, tabId],
        activeTabId: tabId,
      } satisfies LeafWorkspaceState;

      return {
        ...state,
        tabs: { ...state.tabs, [tabId]: nextTab },
        leafs: { ...state.leafs, [leafId]: nextLeaf },
        nextUntitledIndex: state.nextUntitledIndex + 1,
      } satisfies Pick<WorkspaceStore, 'tabs' | 'leafs' | 'nextUntitledIndex'>;
    });

    return createdTab;
  },

  closeTab: (leafId, tabId) => {
    let removedTabId: string | null = null;
    set((state) => {
      const leaf = state.leafs[leafId];
      const tab = state.tabs[tabId];
      if (!leaf || !leaf.tabIds.includes(tabId)) {
        return state;
      }

      const nextTabIds = leaf.tabIds.filter((id) => id !== tabId);
      let nextActive = leaf.activeTabId;

      if (leaf.activeTabId === tabId) {
        if (nextTabIds.length === 0) {
          nextActive = null;
        } else {
          const removedIndex = leaf.tabIds.indexOf(tabId);
          const fallbackIndex = removedIndex >= nextTabIds.length ? nextTabIds.length - 1 : removedIndex;
          nextActive = nextTabIds[fallbackIndex];
        }
      }

      const nextTabs = { ...state.tabs };
      delete nextTabs[tabId];
      removedTabId = tabId;

      const nextFileToLeaf = { ...state.fileToLeaf };
      if (tab?.fileName) {
        delete nextFileToLeaf[tab.fileName];
      }

      return {
        tabs: nextTabs,
        leafs: {
          ...state.leafs,
          [leafId]: { ...leaf, tabIds: nextTabIds, activeTabId: nextActive },
        },
        fileToLeaf: nextFileToLeaf,
      } satisfies Pick<WorkspaceStore, 'tabs' | 'leafs' | 'fileToLeaf'>;
    });

    if (removedTabId) {
      discardPendingHistory(removedTabId);
    }
  },

  closeLeaf: (leafId) => {
    const removedTabIds: string[] = [];
    set((state) => {
      const leaf = state.leafs[leafId];
      if (!leaf) {
        return state;
      }

      const nextTabs = { ...state.tabs };
      const nextFileToLeaf = { ...state.fileToLeaf };

      leaf.tabIds.forEach((tabId) => {
        const tab = state.tabs[tabId];
        if (tab?.fileName) {
          delete nextFileToLeaf[tab.fileName];
        }
        delete nextTabs[tabId];
        removedTabIds.push(tabId);
      });

      const nextLeafs = { ...state.leafs };
      delete nextLeafs[leafId];

      return {
        tabs: nextTabs,
        leafs: nextLeafs,
        fileToLeaf: nextFileToLeaf,
      } satisfies Pick<WorkspaceStore, 'tabs' | 'leafs' | 'fileToLeaf'>;
    });

    if (removedTabIds.length > 0) {
      removedTabIds.forEach((tabId) => {
        discardPendingHistory(tabId);
      });
    }
  },

  setActiveTab: (leafId, tabId) => {
    set((state) => {
      const leaf = state.leafs[leafId];
      if (!leaf || !leaf.tabIds.includes(tabId)) {
        return state;
      }

      return {
        ...state,
        leafs: { ...state.leafs, [leafId]: { ...leaf, activeTabId: tabId } },
      };
    });
  },

  selectCard: (leafId, tabId, cardId, options) => {
    set((state) => {
      const tab = state.tabs[tabId];
      if (!tab || tab.leafId !== leafId) {
        return state;
      }

      if (!tab.cards.some((card) => card.id === cardId)) {
        return state;
      }

      //! multi/rangeオプションがある場合は専用の処理を呼び出す
      if (options?.multi) {
        const nextSelectedIds = new Set(tab.selectedCardIds);
        if (nextSelectedIds.has(cardId)) {
          nextSelectedIds.delete(cardId);
        } else {
          nextSelectedIds.add(cardId);
        }
        return {
          ...state,
          tabs: {
            ...state.tabs,
            [tabId]: { ...tab, selectedCardIds: nextSelectedIds },
          },
        };
      }

      if (options?.range) {
        const visibleCardIds = tab.cards.map((c) => c.id);
        const lastSelected = Array.from(tab.selectedCardIds).pop();
        if (!lastSelected) {
          return {
            ...state,
            tabs: {
              ...state.tabs,
              [tabId]: { ...tab, selectedCardIds: new Set([cardId]) },
            },
          };
        }
        const startIndex = visibleCardIds.indexOf(lastSelected);
        const endIndex = visibleCardIds.indexOf(cardId);
        if (startIndex === -1 || endIndex === -1) {
          return state;
        }
        const [minIndex, maxIndex] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
        const rangeIds = visibleCardIds.slice(minIndex, maxIndex + 1);
        return {
          ...state,
          tabs: {
            ...state.tabs,
            [tabId]: { ...tab, selectedCardIds: new Set(rangeIds) },
          },
        };
      }

      //! 通常の単一選択
      return {
        ...state,
        tabs: {
          ...state.tabs,
          [tabId]: { ...tab, selectedCardIds: new Set([cardId]) },
        },
      };
    });
  },

  clearSelection: (leafId, tabId) => {
    set((state) => {
      const tab = state.tabs[tabId];
      if (!tab || tab.leafId !== leafId) {
        return state;
      }

      return {
        ...state,
        tabs: {
          ...state.tabs,
          [tabId]: { ...tab, selectedCardIds: new Set<string>() },
        },
      };
    });
  },

  toggleCardSelection: (leafId, tabId, cardId) => {
    set((state) => {
      const tab = state.tabs[tabId];
      if (!tab || tab.leafId !== leafId) {
        return state;
      }

      if (!tab.cards.some((card) => card.id === cardId)) {
        return state;
      }

      const nextSelectedIds = new Set(tab.selectedCardIds);
      if (nextSelectedIds.has(cardId)) {
        nextSelectedIds.delete(cardId);
      } else {
        nextSelectedIds.add(cardId);
      }

      return {
        ...state,
        tabs: {
          ...state.tabs,
          [tabId]: { ...tab, selectedCardIds: nextSelectedIds },
        },
      };
    });
  },

  selectCardRange: (leafId, tabId, cardId) => {
    set((state) => {
      const tab = state.tabs[tabId];
      if (!tab || tab.leafId !== leafId) {
        return state;
      }

      const visibleCardIds = tab.cards.map((c) => c.id);
      const lastSelected = Array.from(tab.selectedCardIds).pop();

      if (!lastSelected) {
        return {
          ...state,
          tabs: {
            ...state.tabs,
            [tabId]: { ...tab, selectedCardIds: new Set([cardId]) },
          },
        };
      }

      const startIndex = visibleCardIds.indexOf(lastSelected);
      const endIndex = visibleCardIds.indexOf(cardId);

      if (startIndex === -1 || endIndex === -1) {
        return state;
      }

      const [minIndex, maxIndex] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
      const rangeIds = visibleCardIds.slice(minIndex, maxIndex + 1);

      return {
        ...state,
        tabs: {
          ...state.tabs,
          [tabId]: { ...tab, selectedCardIds: new Set(rangeIds) },
        },
      };
    });
  },

  addCard: (leafId, tabId, options) => {
    let createdCard: Card | null = null;
    let historyFileName: string | null = null;

    set((state) => {
      const tab = state.tabs[tabId];
      if (!tab || tab.leafId !== leafId) {
        return state;
      }
      historyFileName = tab.fileName ?? null;

      const position: InsertPosition = options?.position ?? 'after';

      const undoEntry: UndoRedoEntry = {
        type: 'add',
        tabId,
        cards: [...tab.cards],
        description: `カードを${position === 'before' ? '前' : position === 'child' ? '子' : '後'}に追加`,
      };

      const nextUndoStack = [...state.undoStack, undoEntry];
      const trimmedUndoStack = nextUndoStack.length > 100 ? nextUndoStack.slice(-100) : nextUndoStack;

      const selectionOrder = Array.from(tab.selectedCardIds);
      const fallbackAnchorId = tab.cards[tab.cards.length - 1]?.id ?? null;
      const anchorId = options?.anchorCardId ?? selectionOrder[selectionOrder.length - 1] ?? fallbackAnchorId;
      const anchorCard = anchorId ? tab.cards.find((card) => card.id === anchorId) ?? null : null;

      let parentId: string | null = anchorCard?.parent_id ?? null;
      let insertIndex = tab.cards.length;
      let newLevel = anchorCard?.level ?? 0;

      if (anchorCard) {
        const anchorIndex = tab.cards.findIndex((card) => card.id === anchorCard.id);
        if (anchorIndex !== -1) {
          const subtreeEndIndex = getSubtreeEndIndex(tab.cards, anchorIndex);
          switch (position) {
            case 'before':
              insertIndex = anchorIndex;
              parentId = anchorCard.parent_id ?? null;
              newLevel = anchorCard.level;
              break;
            case 'child':
              insertIndex = subtreeEndIndex;
              parentId = anchorCard.id;
              newLevel = anchorCard.level + 1;
              break;
            case 'after':
            default:
              insertIndex = subtreeEndIndex;
              parentId = anchorCard.parent_id ?? null;
              newLevel = anchorCard.level;
              break;
          }
        }
      } else {
        parentId = null;
        insertIndex = tab.cards.length;
        newLevel = 0;
      }

      // 既存カードから次のカードIDを生成
      const cardId = generateNextCardId(tab.cards);
      const timestamp = new Date().toISOString();

      const newCard: Card = {
        id: nanoid(),
        cardId: cardId || undefined, // 空文字の場合はundefined
        title: '新規カード',
        body: '',
        status: 'draft',
        kind: 'paragraph',
        hasLeftTrace: false,
        hasRightTrace: false,
        markdownPreviewEnabled: true,
        createdAt: timestamp,
        updatedAt: timestamp,
        parent_id: parentId,
        child_ids: [],
        prev_id: null,
        next_id: null,
        level: newLevel,
      } satisfies Card;

      const insertedCards = [
        ...tab.cards.slice(0, insertIndex),
        newCard,
        ...tab.cards.slice(insertIndex),
      ];
      const rebuiltCards = rebuildSiblingLinks(insertedCards);

      const resolvedNewCard = rebuiltCards.find((card) => card.id === newCard.id) ?? newCard;
      createdCard = resolvedNewCard;

      const nextExpandedIds = new Set(tab.expandedCardIds);
      if (position === 'child' && anchorCard) {
        nextExpandedIds.add(anchorCard.id);
      } else if (parentId) {
        nextExpandedIds.add(parentId);
      }

      const nextDirtyIds = new Set(tab.dirtyCardIds);
      nextDirtyIds.add(resolvedNewCard.id);

      return {
        ...state,
        tabs: {
          ...state.tabs,
          [tabId]: {
            ...tab,
            cards: rebuiltCards,
            selectedCardIds: new Set<string>([resolvedNewCard.id]),
            expandedCardIds: nextExpandedIds,
            isDirty: true,
            dirtyCardIds: nextDirtyIds,
          },
        },
        undoStack: trimmedUndoStack,
        redoStack: [],
        lastInsertPreview: {
          leafId,
          tabId,
          cardId: anchorCard?.id ?? resolvedNewCard.id,
          position,
          highlightIds: [resolvedNewCard.id],
          timestamp: Date.now(),
        },
      } satisfies Pick<WorkspaceStore, 'tabs' | 'undoStack' | 'redoStack' | 'lastInsertPreview'>;
    });

    if (createdCard) {
      emitCardLayoutChanged();
      recordCardHistory(tabId, historyFileName, createdCard, 'create', { after: createdCard });
    }

    return createdCard;
  },

  deleteCards: (leafId, tabId, cardIds) => {
    let deletedCount = 0;
    let historyFileName: string | null = null;
    const deletedSnapshots: Card[] = [];

    set((state) => {
      const tab = state.tabs[tabId];
      if (!tab || tab.leafId !== leafId) {
        return state;
      }
      historyFileName = tab.fileName ?? null;

      const candidates = (cardIds && cardIds.length > 0 ? cardIds : Array.from(tab.selectedCardIds)).filter((id) =>
        tab.cards.some((card) => card.id === id),
      );

      if (candidates.length === 0) {
        return state;
      }

      const undoEntry: UndoRedoEntry = {
        type: 'delete',
        tabId,
        cards: [...tab.cards],
        description: `${candidates.length}件のカードを削除`,
      } satisfies UndoRedoEntry;

      const nextUndoStack = [...state.undoStack, undoEntry];
      const trimmedUndoStack = nextUndoStack.length > 100 ? nextUndoStack.slice(-100) : nextUndoStack;

      const cardMap = new Map<string, Card>(tab.cards.map((card) => [card.id, card]));
      const allDeleteIds = new Set<string>();

      const collectDescendants = (currentId: string) => {
        if (allDeleteIds.has(currentId)) {
          return;
        }
        allDeleteIds.add(currentId);
        const current = cardMap.get(currentId);
        if (!current) {
          return;
        }
        deletedSnapshots.push(current);
        current.child_ids.forEach((childId) => collectDescendants(childId));
      };

      candidates.forEach((id) => collectDescendants(id));

      if (allDeleteIds.size === 0) {
        return state;
      }

      deletedCount = allDeleteIds.size;

      const remainingCards = tab.cards.filter((card) => !allDeleteIds.has(card.id));
      const rebuiltCards = rebuildSiblingLinks(remainingCards);

      const deletedIndices = tab.cards.reduce<number[]>((indices, card, index) => {
        if (allDeleteIds.has(card.id)) {
          indices.push(index);
        }
        return indices;
      }, []);
      const pivotIndex = deletedIndices.length > 0 ? Math.min(...deletedIndices) : 0;

      const nextSelectedIds = new Set<string>();
      if (rebuiltCards.length > 0) {
        const fallbackIndex = Math.min(pivotIndex, rebuiltCards.length - 1);
        nextSelectedIds.add(rebuiltCards[fallbackIndex].id);
      }

      const nextExpandedIds = new Set(Array.from(tab.expandedCardIds).filter((id) => !allDeleteIds.has(id)));
      const nextEditingCardId = tab.editingCardId && allDeleteIds.has(tab.editingCardId) ? null : tab.editingCardId;
      const nextDirtyIds = new Set(tab.dirtyCardIds);
      allDeleteIds.forEach((id) => nextDirtyIds.delete(id));

      return {
        ...state,
        tabs: {
          ...state.tabs,
          [tabId]: {
            ...tab,
            cards: rebuiltCards,
            selectedCardIds: nextSelectedIds,
            expandedCardIds: nextExpandedIds,
            editingCardId: nextEditingCardId,
            dirtyCardIds: nextDirtyIds,
            isDirty: true,
          },
        },
        undoStack: trimmedUndoStack,
        redoStack: [],
        lastInsertPreview: null,
      } satisfies Pick<WorkspaceStore, 'tabs' | 'undoStack' | 'redoStack' | 'lastInsertPreview'>;
    });

    if (deletedCount > 0) {
      emitCardLayoutChanged();
      deletedSnapshots.forEach((card) => {
        recordCardHistory(tabId, historyFileName, card, 'delete', { before: card });
      });
    }

    return deletedCount;
  },

  updateCard: (leafId, tabId, cardId, patch, options) => {
    let historyFileName: string | null = null;
    let beforeSnapshot: Card | null = null;
    let afterSnapshot: Card | null = null;
    set((state) => {
      const tab = state.tabs[tabId];
      if (!tab || tab.leafId !== leafId) {
        return state;
      }
      historyFileName = tab.fileName ?? null;

      //! Undoスタックに現在の状態を保存
      const undoEntry: UndoRedoEntry = {
        type: 'update',
        tabId,
        cards: [...tab.cards],
        description: `カード「${tab.cards.find((c) => c.id === cardId)?.title ?? cardId}」を編集`,
      };

      const nextUndoStack = [...state.undoStack, undoEntry];
      //! Undoスタックは最大100件
      const trimmedUndoStack = nextUndoStack.length > 100 ? nextUndoStack.slice(-100) : nextUndoStack;

      const nextCards = tab.cards.map((card) => {
        if (card.id !== cardId) {
          return card;
        }
        const nextUpdatedAt = patch.updatedAt ?? new Date().toISOString();
        // タイトルが変更される場合、最大文字数で切り捨てる
        let processedPatch = patch;
        if (patch.title !== undefined) {
          const maxTitleLength = 20; // TODO: 設定から取得
          const truncatedTitle = patch.title.length > maxTitleLength
            ? `${patch.title.slice(0, maxTitleLength - 1)}…`
            : patch.title;
          processedPatch = { ...patch, title: truncatedTitle };
        }
        const nextCard = { ...card, ...processedPatch, updatedAt: nextUpdatedAt } satisfies Card;
        beforeSnapshot = card;
        afterSnapshot = nextCard;
        return nextCard;
      });

      const nextDirtyIds = new Set(tab.dirtyCardIds);
      nextDirtyIds.add(cardId);

      return {
        ...state,
        tabs: {
          ...state.tabs,
          [tabId]: { ...tab, cards: nextCards, isDirty: true, dirtyCardIds: nextDirtyIds },
        },
        undoStack: trimmedUndoStack,
        redoStack: [], //! 新しい操作を行った場合、Redoスタックはクリア
      };
    });

    if (beforeSnapshot && afterSnapshot) {
      const historyOperation = options?.historyOperation ?? 'update';
      recordCardHistory(tabId, historyFileName, afterSnapshot, historyOperation, {
        before: beforeSnapshot,
        after: afterSnapshot,
      }, options?.historyContext);
    }
  },

  setCardTraceFlags: (fileName, updates) => {
    if (!fileName || Object.keys(updates).length === 0) {
      return;
    }
    set((state) => {
      const leafId = state.fileToLeaf[fileName];
      if (!leafId) {
        return state;
      }
      const leaf = state.leafs[leafId];
      if (!leaf) {
        return state;
      }
      const tabId = leaf.tabIds.find((id) => state.tabs[id]?.fileName === fileName) ?? leaf.activeTabId;
      if (!tabId) {
        return state;
      }
      const tab = state.tabs[tabId];
      if (!tab) {
        return state;
      }

      let changed = false;
      const nextCards = tab.cards.map((card) => {
        const patch = updates[card.id];
        if (!patch) {
          return card;
        }
        const nextCard = {
          ...card,
          hasLeftTrace: patch.hasLeftTrace ?? card.hasLeftTrace,
          hasRightTrace: patch.hasRightTrace ?? card.hasRightTrace,
        } satisfies Card;
        if (nextCard.hasLeftTrace !== card.hasLeftTrace || nextCard.hasRightTrace !== card.hasRightTrace) {
          changed = true;
        }
        return nextCard;
      });

      if (!changed) {
        return state;
      }

      return {
        ...state,
        tabs: {
          ...state.tabs,
          [tabId]: { ...tab, cards: nextCards, isDirty: true },
        },
      } satisfies Pick<WorkspaceStore, 'tabs'>;
    });
  },

  mergeCards: (leafId, tabId, cardIds, options) => {
    let mergeResult: MergeCardsResult | null = null;
    let historyFileName: string | null = null;
    let removedSnapshots: Card[] = [];
    let mergedSnapshot: Card | null = null;

    set((state) => {
      const tab = state.tabs[tabId];
      if (!tab || tab.leafId !== leafId) {
        return state;
      }
      historyFileName = tab.fileName ?? null;

      const uniqueIds = Array.from(new Set(cardIds)).filter(Boolean);
      if (uniqueIds.length < 2) {
        return state;
      }

      const selectionSet = new Set(uniqueIds);
      const selectedEntries: { card: Card; index: number }[] = [];
      tab.cards.forEach((card, index) => {
        if (selectionSet.has(card.id)) {
          selectedEntries.push({ card, index });
        }
      });

      if (selectedEntries.length < 2) {
        return state;
      }

      const baseParentId = selectedEntries[0].card.parent_id ?? null;
      const baseLevel = selectedEntries[0].card.level;
      const hasInvalidParent = selectedEntries.some((entry) => (entry.card.parent_id ?? null) !== baseParentId);
      const hasInvalidLevel = selectedEntries.some((entry) => entry.card.level !== baseLevel);
      const hasChildren = selectedEntries.some((entry) => entry.card.child_ids.length > 0);
      const nonContiguous = selectedEntries.some((entry, idx) => idx > 0 && entry.index !== selectedEntries[idx - 1].index + 1);
      if (hasInvalidParent || hasInvalidLevel || hasChildren || nonContiguous) {
        return state;
      }

      const undoEntry: UndoRedoEntry = {
        type: 'update',
        tabId,
        cards: [...tab.cards],
        description: `${selectedEntries.length}件のカードを統合`,
      } satisfies UndoRedoEntry;
      const nextUndoStack = [...state.undoStack, undoEntry];
      const trimmedUndoStack = nextUndoStack.length > 100 ? nextUndoStack.slice(-100) : nextUndoStack;

      removedSnapshots = selectedEntries.map((entry) => entry.card);
      const removalSet = options.removeOriginals ? new Set(selectedEntries.map((entry) => entry.card.id)) : new Set<string>();
      const removedCardIds = Array.from(removalSet);
      const baseCards = removalSet.size > 0 ? tab.cards.filter((card) => !removalSet.has(card.id)) : [...tab.cards];
      const firstIndex = selectedEntries[0].index;
      const insertIndex = Math.min(firstIndex, baseCards.length);

      const timestamp = new Date().toISOString();
      let earliestCreatedAt: string | null = null;
      selectedEntries.forEach((entry) => {
        if (!entry.card.createdAt) {
          return;
        }
        if (!earliestCreatedAt || entry.card.createdAt < earliestCreatedAt) {
          earliestCreatedAt = entry.card.createdAt;
        }
      });

      const mergedCard: Card = {
        id: nanoid(),
        cardId: options.cardId?.trim() ? options.cardId.trim() : undefined,
        title: options.title.trim() || selectedEntries[0].card.title,
        body: options.body,
        status: options.status,
        kind: options.kind,
        hasLeftTrace: options.inheritTraces
          ? selectedEntries.some((entry) => entry.card.hasLeftTrace)
          : selectedEntries[0].card.hasLeftTrace,
        hasRightTrace: options.inheritTraces
          ? selectedEntries.some((entry) => entry.card.hasRightTrace)
          : selectedEntries[0].card.hasRightTrace,
        markdownPreviewEnabled: selectedEntries[0].card.markdownPreviewEnabled,
        createdAt: earliestCreatedAt ?? timestamp,
        updatedAt: timestamp,
        parent_id: baseParentId,
        child_ids: [],
        prev_id: null,
        next_id: null,
        level: baseLevel,
      } satisfies Card;
      mergedSnapshot = mergedCard;

      const nextCards = [
        ...baseCards.slice(0, insertIndex),
        mergedCard,
        ...baseCards.slice(insertIndex),
      ];
      const rebuiltCards = rebuildSiblingLinks(nextCards);

      const nextSelected = new Set<string>([mergedCard.id]);
      const nextDirtyIds = new Set(tab.dirtyCardIds);
      removedCardIds.forEach((id) => nextDirtyIds.delete(id));
      nextDirtyIds.add(mergedCard.id);

      mergeResult = {
        mergedCard,
        removedCardIds,
      } satisfies MergeCardsResult;

      return {
        ...state,
        tabs: {
          ...state.tabs,
          [tabId]: {
            ...tab,
            cards: rebuiltCards,
            selectedCardIds: nextSelected,
            dirtyCardIds: nextDirtyIds,
            isDirty: true,
          },
        },
        undoStack: trimmedUndoStack,
        redoStack: [],
      } satisfies Pick<WorkspaceStore, 'tabs' | 'undoStack' | 'redoStack'>;
    });

    if (mergeResult) {
      emitCardLayoutChanged();
      if (mergedSnapshot) {
        recordCardHistory(tabId, historyFileName, mergedSnapshot, 'merge', { after: mergedSnapshot });
      }
      if (options.removeOriginals) {
        removedSnapshots.forEach((card) => {
          recordCardHistory(tabId, historyFileName, card, 'delete', { before: card });
        });
      }
    }

    return mergeResult;
  },

  cycleCardStatus: (leafId, tabId, cardId) => {
    let nextStatus: CardStatus | null = null;
    set((state) => {
      const tab = state.tabs[tabId];
      if (!tab || tab.leafId !== leafId) {
        return state;
      }

      const nextCards = tab.cards.map((card) => {
        if (card.id !== cardId) {
          return card;
        }
        nextStatus = getNextCardStatus(card.status);
        return {
          ...card,
          status: nextStatus,
          updatedAt: new Date().toISOString(),
        } satisfies Card;
      });

      if (!nextStatus) {
        return state;
      }

      return {
        ...state,
        tabs: {
          ...state.tabs,
          [tabId]: { ...tab, cards: nextCards, isDirty: true },
        },
      };
    });

    return nextStatus;
  },

  hydrateTab: (leafId, tabId, cards, options) => {
    const normalizedCards = normalizeCardOrder(cards);
    set((state) => {
      const tab = state.tabs[tabId];
      if (!tab || tab.leafId !== leafId) {
        return state;
      }

      //! 展開状態を維持しつつ、新しいカードで存在しないIDは削除
      const updatedExpandedIds = new Set<string>(
        Array.from(tab.expandedCardIds).filter((id) => normalizedCards.some((card) => card.id === id && card.child_ids.length > 0)),
      );
      //! 選択状態も維持しつつ、新しいカードで存在しないIDは削除
      const updatedSelectedIds = new Set<string>(
        Array.from(tab.selectedCardIds).filter((id) => normalizedCards.some((card) => card.id === id)),
      );

      return {
        ...state,
        tabs: {
          ...state.tabs,
          [tabId]: {
            ...tab,
            cards: [...normalizedCards],
            selectedCardIds: updatedSelectedIds.size > 0 ? updatedSelectedIds : new Set(normalizedCards[0]?.id ? [normalizedCards[0].id] : []),
            isDirty: false,
            lastSavedAt: options?.savedAt ?? tab.lastSavedAt,
            expandedCardIds: updatedExpandedIds,
            dirtyCardIds: new Set<string>(),
            displayMode: tab.displayMode ?? 'detailed', //! displayModeを維持
          },
        },
      };
    });
  },

  markSaved: (tabId, savedAt) => {
    set((state) => {
      const tab = state.tabs[tabId];
      if (!tab) {
        return state;
      }

      return {
        ...state,
        tabs: {
          ...state.tabs,
          [tabId]: { ...tab, isDirty: false, lastSavedAt: savedAt, dirtyCardIds: new Set<string>() },
        },
      };
    });
  },

  toggleCardExpanded: (leafId, tabId, cardId) => {
    set((state) => {
      const tab = state.tabs[tabId];
      if (!tab || tab.leafId !== leafId) {
        return state;
      }

      const card = tab.cards.find((c) => c.id === cardId);
      if (!card || !card.child_ids || card.child_ids.length === 0) {
        return state; //! 子を持たないカードは展開/折畳対象外
      }

      const nextExpandedIds = new Set(tab.expandedCardIds);
      if (nextExpandedIds.has(cardId)) {
        nextExpandedIds.delete(cardId);
      } else {
        nextExpandedIds.add(cardId);
      }

      return {
        ...state,
        tabs: {
          ...state.tabs,
          [tabId]: { ...tab, expandedCardIds: nextExpandedIds },
        },
      };
    });
  },

  toggleCardMarkdownPreview: (leafId, tabId, cardId) => {
    set((state) => {
      const tab = state.tabs[tabId];
      if (!tab || tab.leafId !== leafId) {
        return state;
      }

      const cards = tab.cards.map((card) => {
        if (card.id !== cardId) {
          return card;
        }
        return {
          ...card,
          markdownPreviewEnabled: !card.markdownPreviewEnabled,
          updatedAt: new Date().toISOString(),
        } satisfies Card;
      });

      const nextDirtyIds = new Set(tab.dirtyCardIds);
      nextDirtyIds.add(cardId);

      return {
        ...state,
        tabs: {
          ...state.tabs,
          [tabId]: {
            ...tab,
            cards,
            dirtyCardIds: nextDirtyIds,
            isDirty: true,
          },
        },
      } satisfies Pick<WorkspaceStore, 'tabs'>;
    });
  },

  expandAll: (leafId, tabId) => {
    set((state) => {
      const tab = state.tabs[tabId];
      if (!tab || tab.leafId !== leafId) {
        return state;
      }

      const allExpandableIds = new Set<string>(
        tab.cards.filter((card) => card.child_ids && card.child_ids.length > 0).map((card) => card.id),
      );

      return {
        ...state,
        tabs: {
          ...state.tabs,
          [tabId]: { ...tab, expandedCardIds: allExpandableIds },
        },
      };
    });
  },

  collapseAll: (leafId, tabId) => {
    set((state) => {
      const tab = state.tabs[tabId];
      if (!tab || tab.leafId !== leafId) {
        return state;
      }

      return {
        ...state,
        tabs: {
          ...state.tabs,
          [tabId]: { ...tab, expandedCardIds: new Set<string>() },
        },
      };
    });
  },

  moveCards: (leafId, tabId, cardIds, targetCardId, position) => {
    let success = false;

    set((state) => {
      const tab = state.tabs[tabId];
      if (!tab || tab.leafId !== leafId) {
        return state;
      }

      //! 移動対象カードと移動先カードの検証
      if (cardIds.length === 0 || !targetCardId) {
        return state;
      }

      const cardMap = new Map(tab.cards.map((c) => [c.id, c]));
      const targetCard = cardMap.get(targetCardId);
      if (!targetCard) {
        return state;
      }

      //! Undoスタックに現在の状態を保存
      const undoEntry: UndoRedoEntry = {
        type: 'move',
        tabId,
        cards: [...tab.cards],
        description: `${cardIds.length}件のカードを移動`,
      };

      const nextUndoStack = [...state.undoStack, undoEntry];
      //! Undoスタックは最大100件
      const trimmedUndoStack = nextUndoStack.length > 100 ? nextUndoStack.slice(-100) : nextUndoStack;

      //! 移動対象カードのバリデーション
      const rootMoveIds = new Set(cardIds);
      for (const cardId of cardIds) {
        const card = cardMap.get(cardId);
        if (!card) {
          return state; //! 存在しないカードは移動不可
        }
        if (targetCard.id === cardId) {
          return state; //! 自分自身へは移動不可
        }
        //! ターゲットが移動対象カードの子孫である場合は移動不可（循環参照防止）
        if (isDescendant(card, targetCard, cardMap)) {
          return state;
        }
      }

      //! カードの移動処理
      const nextCards = [...tab.cards];

      //! 移動対象カードとその子孫を収集
      const collectDescendants = (cardId: string): string[] => {
        const result = [cardId];
        const card = cardMap.get(cardId);
        if (card && card.child_ids) {
          card.child_ids.forEach((childId) => {
            result.push(...collectDescendants(childId));
          });
        }
        return result;
      };

      const allMovedIds = new Set<string>();
      cardIds.forEach((cardId) => {
        collectDescendants(cardId).forEach((id) => allMovedIds.add(id));
      });

      //! 移動対象カードを元の位置から削除（階層構造も更新）
      const cardsToMove = nextCards.filter((c) => allMovedIds.has(c.id));
      const remainingCards = nextCards.filter((c) => !allMovedIds.has(c.id));

      //! 新しい親と位置の決定
      let newParentId: string | null = null;
      let insertIndex = 0;

      const targetIndex = remainingCards.findIndex((c) => c.id === targetCardId);
      if (targetIndex === -1) {
        return state;
      }

      if (position === 'child') {
        newParentId = targetCardId;
        insertIndex = getSubtreeEndIndex(remainingCards, targetIndex);
      } else {
        newParentId = targetCard.parent_id;
        insertIndex = position === 'before'
          ? targetIndex
          : getSubtreeEndIndex(remainingCards, targetIndex);
      }

      //! 移動対象カードの階層情報を更新
      const updatedMovedCards = cardsToMove.map((card) => {
        if (rootMoveIds.has(card.id)) {
          //! 直接移動するカード
          const newLevel = newParentId ? (cardMap.get(newParentId)?.level ?? 0) + 1 : 0;
          return { ...card, parent_id: newParentId, level: newLevel };
        }
        //! 子孫カード（相対的なレベルを維持）
        const rootMoveCard = cardsToMove.find((c) => rootMoveIds.has(c.id) && isAncestor(c, card, cardMap));
        if (rootMoveCard) {
          const levelDiff = card.level - rootMoveCard.level;
          const newRootLevel = newParentId ? (cardMap.get(newParentId)?.level ?? 0) + 1 : 0;
          return { ...card, level: newRootLevel + levelDiff };
        }
        return card;
      });

      //! カードを挿入
      const finalCards = [
        ...remainingCards.slice(0, insertIndex),
        ...updatedMovedCards,
        ...remainingCards.slice(insertIndex),
      ];

      //! prev_id/next_idの再計算（簡易実装: 同じ親を持つ兄弟間でリンク）
      const rebuiltCards = rebuildSiblingLinks(finalCards);

      success = true;

      return {
        ...state,
        tabs: {
          ...state.tabs,
          [tabId]: { ...tab, cards: rebuiltCards, isDirty: true },
        },
        undoStack: trimmedUndoStack,
        redoStack: [], //! 新しい操作を行った場合、Redoスタックはクリア
        lastInsertPreview: null,
      };
    });

    if (success) {
      emitCardLayoutChanged();
    }

    return success;
  },

  setEditingCard: (leafId, tabId, cardId) => {
    set((state) => {
      const tab = state.tabs[tabId];
      if (!tab || tab.leafId !== leafId) {
        return state;
      }

      return {
        ...state,
        tabs: {
          ...state.tabs,
          [tabId]: { ...tab, editingCardId: cardId },
        },
      };
    });
  },

  copySelection: (leafId, tabId) => {
    let copied = 0;

    set((state) => {
      const tab = state.tabs[tabId];
      if (!tab || tab.leafId !== leafId) {
        return state;
      }

      const rootIds = getRootSelection(tab.selectedCardIds, tab.cards);
      if (rootIds.length === 0) {
        return state;
      }

      const cardMap = new Map<string, Card>(tab.cards.map((card) => [card.id, card]));
      const clipboardNodes = rootIds.map((id) => buildClipboardTree(id, cardMap));
      copied = clipboardNodes.length;

      return {
        ...state,
        clipboard: clipboardNodes,
      } satisfies Pick<WorkspaceStore, 'clipboard'>;
    });

    return copied;
  },

  pasteClipboard: (leafId, tabId, options) => {
    let outcome: { inserted: number; insertedIds: string[]; anchorId: string | null; position: InsertPosition } | null = null;

    set((state) => {
      const tab = state.tabs[tabId];
      if (!tab || tab.leafId !== leafId) {
        return state;
      }

      const clipboard = state.clipboard;
      if (!clipboard || clipboard.length === 0) {
        return state;
      }

      const position: InsertPosition = options?.position ?? 'after';
      const selectionOrder = Array.from(tab.selectedCardIds);
      const fallbackAnchorId = tab.cards[tab.cards.length - 1]?.id ?? null;
      const anchorId = options?.anchorCardId ?? selectionOrder[selectionOrder.length - 1] ?? fallbackAnchorId;
      const cardMap = new Map<string, Card>(tab.cards.map((card) => [card.id, card]));
      const anchorCard = anchorId ? cardMap.get(anchorId) ?? null : null;

      const { insertIndex, parentId, level } = determineInsertPoint(tab.cards, anchorCard, position);

      const newCards: Card[] = [];
      const newRootIds: string[] = [];
      clipboard.forEach((node) => {
        const materialized = materializeClipboardNode(node, parentId, level);
        newRootIds.push(materialized.rootId);
        newCards.push(...materialized.cards);
      });

      if (newCards.length === 0) {
        return state;
      }

      // 貼り付けられたカードにIDを自動付与
      // 既存カードと貼り付けられたカードを合わせて最大番号を計算
      const allCards = [...tab.cards, ...newCards];
      newCards.forEach((card, index) => {
        // 既に処理済みのカードも含めて番号を計算
        const currentAllCards = [...tab.cards, ...newCards.slice(0, index)];
        const cardId = generateNextCardId(currentAllCards);
        if (cardId) {
          newCards[index] = { ...card, cardId };
        }
      });

      const undoEntry: UndoRedoEntry = {
        type: 'paste',
        tabId,
        cards: [...tab.cards],
        description: `${newRootIds.length}件のカードを貼り付け`,
      } satisfies UndoRedoEntry;

      const nextUndoStack = [...state.undoStack, undoEntry];
      const trimmedUndoStack = nextUndoStack.length > 100 ? nextUndoStack.slice(-100) : nextUndoStack;

      const insertedCards = [...tab.cards.slice(0, insertIndex), ...newCards, ...tab.cards.slice(insertIndex)];
      const rebuiltCards = rebuildSiblingLinks(insertedCards);

      const nextExpandedIds = new Set(tab.expandedCardIds);
      if (position === 'child' && anchorCard) {
        nextExpandedIds.add(anchorCard.id);
      } else if (parentId) {
        nextExpandedIds.add(parentId);
      }

      outcome = { inserted: newRootIds.length, insertedIds: newRootIds, anchorId: anchorCard?.id ?? null, position };

      const nextDirtyIds = new Set(tab.dirtyCardIds);
      newRootIds.forEach((id) => nextDirtyIds.add(id));

      return {
        ...state,
        tabs: {
          ...state.tabs,
          [tabId]: {
            ...tab,
            cards: rebuiltCards,
            selectedCardIds: new Set(newRootIds),
            expandedCardIds: nextExpandedIds,
            isDirty: true,
            dirtyCardIds: nextDirtyIds,
          },
        },
        undoStack: trimmedUndoStack,
        redoStack: [],
        lastInsertPreview: {
          leafId,
          tabId,
          cardId: anchorCard?.id ?? (newRootIds[0] ?? null),
          position,
          highlightIds: newRootIds,
          timestamp: Date.now(),
        },
      } satisfies Pick<WorkspaceStore, 'tabs' | 'undoStack' | 'redoStack' | 'lastInsertPreview'>;
    });

    if (outcome) {
      emitCardLayoutChanged();
    }

    return outcome;
  },

  hasClipboard: () => {
    const clipboard = get().clipboard;
    return Boolean(clipboard && clipboard.length > 0);
  },

  renameTabFile: (tabId, fileName) => {
    if (!fileName) {
      return;
    }
    let shouldFlushPending = false;
    set((state) => {
      const tab = state.tabs[tabId];
      if (!tab || tab.fileName === fileName) {
        return state;
      }

      if (!tab.fileName) {
        shouldFlushPending = true;
      }

      const nextTabs = {
        ...state.tabs,
        [tabId]: {
          ...tab,
          fileName,
          title: fileName,
        },
      } satisfies WorkspaceStore['tabs'];

      const nextFileToLeaf = { ...state.fileToLeaf } as WorkspaceStore['fileToLeaf'];
      if (tab.fileName && nextFileToLeaf[tab.fileName] === tab.leafId) {
        delete nextFileToLeaf[tab.fileName];
      }
      nextFileToLeaf[fileName] = tab.leafId;

      return {
        ...state,
        tabs: nextTabs,
        fileToLeaf: nextFileToLeaf,
      } satisfies Pick<WorkspaceStore, 'tabs' | 'fileToLeaf'>;
    });

    if (shouldFlushPending) {
      flushPendingHistory(tabId, fileName);
    }
  },

  undo: () => {
    let success = false;

    set((state) => {
      if (state.undoStack.length === 0) {
        return state;
      }

      const entry = state.undoStack[state.undoStack.length - 1];
      const tab = state.tabs[entry.tabId];

      if (!tab) {
        return state;
      }

      //! 現在の状態をRedoスタックに保存
      const redoEntry: UndoRedoEntry = {
        type: entry.type,
        tabId: entry.tabId,
        cards: [...tab.cards],
        description: `Redo: ${entry.description}`,
      };

      const nextRedoStack = [...state.redoStack, redoEntry];
      //! Redoスタックは最大100件
      const trimmedRedoStack = nextRedoStack.length > 100 ? nextRedoStack.slice(-100) : nextRedoStack;

      //! Undoスタックから取り出した状態に戻す
      const nextUndoStack = state.undoStack.slice(0, -1);

      success = true;

      return {
        ...state,
        tabs: {
          ...state.tabs,
          [entry.tabId]: { ...tab, cards: [...entry.cards], isDirty: true },
        },
        undoStack: nextUndoStack,
        redoStack: trimmedRedoStack,
        lastInsertPreview: null,
      };
    });

    return success;
  },

  redo: () => {
    let success = false;

    set((state) => {
      if (state.redoStack.length === 0) {
        return state;
      }

      const entry = state.redoStack[state.redoStack.length - 1];
      const tab = state.tabs[entry.tabId];

      if (!tab) {
        return state;
      }

      //! 現在の状態をUndoスタックに保存
      const undoEntry: UndoRedoEntry = {
        type: entry.type,
        tabId: entry.tabId,
        cards: [...tab.cards],
        description: `Undo: ${entry.description}`,
      };

      const nextUndoStack = [...state.undoStack, undoEntry];
      //! Undoスタックは最大100件
      const trimmedUndoStack = nextUndoStack.length > 100 ? nextUndoStack.slice(-100) : nextUndoStack;

      //! Redoスタックから取り出した状態に戻す
      const nextRedoStack = state.redoStack.slice(0, -1);

      success = true;

      return {
        ...state,
        tabs: {
          ...state.tabs,
          [entry.tabId]: { ...tab, cards: [...entry.cards], isDirty: true },
        },
        undoStack: trimmedUndoStack,
        redoStack: nextRedoStack,
        lastInsertPreview: null,
      };
    });

    return success;
  },

  canUndo: () => {
    const state = get();
    return state.undoStack.length > 0;
  },

  canRedo: () => {
    const state = get();
    return state.redoStack.length > 0;
  },

  toggleTabDisplayMode: (tabId) => {
    set((state) => {
      const tab = state.tabs[tabId];
      if (!tab) {
        return state;
      }

      const nextDisplayMode: CardDisplayMode = tab.displayMode === 'detailed' ? 'compact' : 'detailed';

      return {
        ...state,
        tabs: {
          ...state.tabs,
          [tabId]: { ...tab, displayMode: nextDisplayMode },
        },
      };
    });
  },

  reset: () => {
    set(() => ({ ...initialState }));
  },
}));

/**
 * @brief カードAがカードBの子孫かどうかを判定。
 * @param ancestor 祖先候補カード。
 * @param descendant 子孫候補カード。
 * @param cardMap カードIDマップ。
 * @return 子孫である場合true。
 */
function isDescendant(ancestor: Card, descendant: Card, cardMap: Map<string, Card>): boolean {
  let current = descendant;
  while (current.parent_id) {
    if (current.parent_id === ancestor.id) {
      return true;
    }
    const parent = cardMap.get(current.parent_id);
    if (!parent) {
      break;
    }
    current = parent;
  }
  return false;
}

/**
 * @brief カードAがカードBの祖先かどうかを判定。
 * @param ancestor 祖先候補カード。
 * @param descendant 子孫候補カード。
 * @param cardMap カードIDマップ。
 * @return 祖先である場合true。
 */
function isAncestor(ancestor: Card, descendant: Card, cardMap: Map<string, Card>): boolean {
  return isDescendant(ancestor, descendant, cardMap);
}

/**
 * @brief 兄弟リンク（prev_id/next_id）を再構築。
 * @param cards カードリスト。
 * @return リンク再構築後のカードリスト。
 */
function rebuildSiblingLinks(cards: Card[]): Card[] {
  //! 親ごとにグループ化
  const groupedByParent = new Map<string | null, Card[]>();
  cards.forEach((card) => {
    const parentId = card.parent_id;
    if (!groupedByParent.has(parentId)) {
      groupedByParent.set(parentId, []);
    }
    groupedByParent.get(parentId)!.push(card);
  });

  //! 各グループ内でprev_id/next_idを設定
  const updatedCards = cards.map((card) => {
    const siblings = groupedByParent.get(card.parent_id) ?? [];
    const index = siblings.findIndex((c) => c.id === card.id);
    if (index === -1) {
      return card;
    }
    const prev_id = index > 0 ? siblings[index - 1].id : null;
    const next_id = index < siblings.length - 1 ? siblings[index + 1].id : null;
    return { ...card, prev_id, next_id };
  });

  //! parent.child_idsも更新
  const finalCards = updatedCards.map((card) => {
    const children = updatedCards.filter((c) => c.parent_id === card.id);
    const child_ids = children.map((c) => c.id);
    return { ...card, child_ids };
  });

  return finalCards;
}

/**
 * @brief 指定カードのサブツリー終端インデックスを取得。
 * @param cards カードリスト。
 * @param startIndex サブツリーの先頭インデックス。
 * @return サブツリー終端（末尾の次）インデックス。
 */
function getSubtreeEndIndex(cards: Card[], startIndex: number): number {
  if (startIndex < 0 || startIndex >= cards.length) {
    return cards.length;
  }
  const baseLevel = cards[startIndex].level;
  let index = startIndex + 1;
  while (index < cards.length && cards[index].level > baseLevel) {
    index += 1;
  }
  return index;
}

/**
 * @brief ストアの状態を初期値へ戻すヘルパ。
 */
export const resetWorkspaceStore = (): void => {
  useWorkspaceStore.getState().reset();
};

const emitCardLayoutChanged = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent('mdsplitter:card-layout-changed'));
};

function getRootSelection(selectedIds: Set<string>, cards: Card[]): string[] {
  if (selectedIds.size === 0) {
    return [];
  }
  const roots: string[] = [];
  cards.forEach((card) => {
    if (!selectedIds.has(card.id)) {
      return;
    }
    if (card.parent_id && selectedIds.has(card.parent_id)) {
      return;
    }
    roots.push(card.id);
  });
  return roots;
}

function buildClipboardTree(cardId: string, cardMap: Map<string, Card>): ClipboardCardNode {
  const card = cardMap.get(cardId);
  if (!card) {
    throw new Error(`Card ${cardId} not found`);
  }

  return {
    data: {
      title: card.title,
      body: card.body,
      status: card.status,
      kind: card.kind,
      hasLeftTrace: card.hasLeftTrace,
      hasRightTrace: card.hasRightTrace,
      markdownPreviewEnabled: card.markdownPreviewEnabled,
    },
    children: card.child_ids.map((childId) => buildClipboardTree(childId, cardMap)),
  } satisfies ClipboardCardNode;
}

function normalizeCardOrder(cards: Card[]): Card[] {
  if (cards.length === 0) {
    return [];
  }

  const cardsWithDefaults = cards.map((card) => ensureCardDefaults(card));

  const cardMap = new Map<string, Card>(cardsWithDefaults.map((card) => [card.id, card]));
  const indexMap = new Map<string, number>();
  cardsWithDefaults.forEach((card, index) => {
    indexMap.set(card.id, index);
  });

  const childrenByParent = new Map<string, string[]>();
  cardsWithDefaults.forEach((card) => {
    if (card.parent_id) {
      if (!childrenByParent.has(card.parent_id)) {
        childrenByParent.set(card.parent_id, []);
      }
      childrenByParent.get(card.parent_id)!.push(card.id);
    }
  });

  const getChildIds = (card: Card): string[] => {
    const fromChildIds = Array.isArray(card.child_ids) ? [...card.child_ids] : [];
    const ordered = fromChildIds.filter((id) => cardMap.has(id));
    const fallback = (childrenByParent.get(card.id) ?? []).filter((id) => !ordered.includes(id));
    fallback.sort((a, b) => (indexMap.get(a) ?? Number.MAX_SAFE_INTEGER) - (indexMap.get(b) ?? Number.MAX_SAFE_INTEGER));
    return [...ordered, ...fallback];
  };

  const result: Card[] = [];
  const visited = new Set<string>();
  const levelMap = new Map<string, number>();

  const visit = (card: Card, level: number) => {
    if (visited.has(card.id)) {
      return;
    }
    visited.add(card.id);
    const copy: Card = { ...ensureCardDefaults(card), level };
    result.push(copy);
    levelMap.set(card.id, level);
    const children = getChildIds(card);
    children.forEach((childId) => {
      const child = cardMap.get(childId);
      if (child) {
        visit(child, level + 1);
      }
    });
  };

  const roots = cards
    .filter((card) => !card.parent_id || !cardMap.has(card.parent_id))
    .sort((a, b) => (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0));

  roots.forEach((root) => visit(root, 0));

  cards.forEach((card) => {
    if (!visited.has(card.id)) {
      const parentLevel = card.parent_id && levelMap.has(card.parent_id) ? (levelMap.get(card.parent_id) ?? -1) + 1 : 0;
      visit(card, Math.max(parentLevel, 0));
    }
  });

  return rebuildSiblingLinks(result);
}

function materializeClipboardNode(node: ClipboardCardNode, parentId: string | null, level: number): { cards: Card[]; rootId: string } {
  const newId = nanoid();
  const now = new Date().toISOString();
  const current: Card = {
    id: newId,
    title: node.data.title,
    body: node.data.body,
    status: node.data.status,
    kind: node.data.kind,
    hasLeftTrace: node.data.hasLeftTrace,
    hasRightTrace: node.data.hasRightTrace,
    markdownPreviewEnabled: node.data.markdownPreviewEnabled,
    createdAt: now,
    updatedAt: now,
    parent_id: parentId,
    child_ids: [],
    prev_id: null,
    next_id: null,
    level,
  } satisfies Card;

  const childResults = node.children.map((child) => materializeClipboardNode(child, newId, level + 1));
  const childCards = childResults.flatMap((result) => result.cards);

  return {
    cards: [current, ...childCards],
    rootId: newId,
  };
}

function ensureCardDefaults(card: Card): Card {
  return {
    ...card,
    markdownPreviewEnabled: card.markdownPreviewEnabled ?? true,
  } satisfies Card;
}

function determineInsertPoint(cards: Card[], anchorCard: Card | null, position: InsertPosition): { insertIndex: number; parentId: string | null; level: number } {
  if (!anchorCard) {
    return {
      insertIndex: cards.length,
      parentId: null,
      level: 0,
    };
  }

  const anchorIndex = cards.findIndex((card) => card.id === anchorCard.id);
  if (anchorIndex === -1) {
    return {
      insertIndex: cards.length,
      parentId: null,
      level: 0,
    };
  }

  const subtreeEndIndex = getSubtreeEndIndex(cards, anchorIndex);

  switch (position) {
    case 'before':
      return {
        insertIndex: anchorIndex,
        parentId: anchorCard.parent_id ?? null,
        level: anchorCard.level,
      };
    case 'child':
      return {
        insertIndex: subtreeEndIndex,
        parentId: anchorCard.id,
        level: anchorCard.level + 1,
      };
    case 'after':
    default:
      return {
        insertIndex: subtreeEndIndex,
        parentId: anchorCard.parent_id ?? null,
        level: anchorCard.level,
      };
  }
}
