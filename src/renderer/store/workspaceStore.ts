
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
  type Card,
  type CardKind,
  type CardPatch,
  type CardStatus,
} from '@/shared/workspace';

export { CARD_STATUS_SEQUENCE, getNextCardStatus };
export type { Card, CardKind, CardPatch, CardStatus };

/**
 * @brief タブの状態。
 * @details
 * パネル内で開かれているカードファイルの状態を保持。
 */
export interface PanelTabState {
  id: string;
  leafId: string;
  fileName: string;
  title: string;
  cards: Card[];
  selectedCardIds: Set<string>; ///< 選択中のカードIDセット（複数選択対応）
  isDirty: boolean;
  lastSavedAt: string | null;
  expandedCardIds: Set<string>; ///< 展開状態のカードIDセット（子を持つカードのみ）
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
export interface WorkspaceStore {
  tabs: Record<string, PanelTabState>;
  leafs: Record<string, LeafWorkspaceState>;
  fileToLeaf: Record<string, string>;
  openTab: (leafId: string, fileName: string, cards: Card[], options?: { savedAt?: string; title?: string }) => OpenTabResult;
  closeTab: (leafId: string, tabId: string) => void;
  closeLeaf: (leafId: string) => void;
  setActiveTab: (leafId: string, tabId: string) => void;
  selectCard: (leafId: string, tabId: string, cardId: string, options?: { multi?: boolean; range?: boolean }) => void; ///< カード選択（単一/複数/範囲）
  clearSelection: (leafId: string, tabId: string) => void; ///< 選択をクリア
  toggleCardSelection: (leafId: string, tabId: string, cardId: string) => void; ///< カード選択をトグル（Ctrl+クリック）
  selectCardRange: (leafId: string, tabId: string, cardId: string) => void; ///< 範囲選択（Shift+クリック）
  updateCard: (leafId: string, tabId: string, cardId: string, patch: CardPatch) => void;
  cycleCardStatus: (leafId: string, tabId: string, cardId: string) => CardStatus | null;
  hydrateTab: (leafId: string, tabId: string, cards: Card[], options?: { savedAt?: string }) => void;
  markSaved: (tabId: string, savedAt: string) => void;
  toggleCardExpanded: (leafId: string, tabId: string, cardId: string) => void; ///< カードの展開/折畳をトグル
  expandAll: (leafId: string, tabId: string) => void; ///< 全カードを展開
  collapseAll: (leafId: string, tabId: string) => void; ///< 全カードを折畳
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
const initialState: Pick<WorkspaceStore, 'tabs' | 'leafs' | 'fileToLeaf'> = {
  tabs: {},
  leafs: {},
  fileToLeaf: {},
};

/**
 * @brief 分割パネル用ワークスペースストア定義。
 * @details
 * タブのオープン・クローズ・カード選択・更新・保存・リセット等を管理。
 */
export const useWorkspaceStore = create<WorkspaceStore>()((set, get) => ({
  ...initialState,

  openTab: (leafId, fileName, cards, options) => {
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
          Array.from(prevTab.expandedCardIds).filter((id) => cards.some((card) => card.id === id && card.child_ids.length > 0)),
        );
        //! 選択状態も維持しつつ、新しいカードで存在しないIDは削除
        const updatedSelectedIds = new Set<string>(
          Array.from(prevTab.selectedCardIds).filter((id) => cards.some((card) => card.id === id)),
        );
        const nextTab: PanelTabState = {
          ...prevTab,
          cards: [...cards],
          selectedCardIds: updatedSelectedIds.size > 0 ? updatedSelectedIds : new Set(cards[0]?.id ? [cards[0].id] : []),
          isDirty: false,
          lastSavedAt: options?.savedAt ?? prevTab.lastSavedAt,
          expandedCardIds: updatedExpandedIds,
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
        cards.filter((card) => card.child_ids && card.child_ids.length > 0).map((card) => card.id),
      );
      //! 初期選択は最初のカード
      const initialSelectedIds = new Set<string>(cards[0]?.id ? [cards[0].id] : []);
      const nextTab: PanelTabState = {
        id: tabId,
        leafId,
        fileName,
        title: options?.title ?? fileName,
        cards: [...cards],
        selectedCardIds: initialSelectedIds,
        isDirty: false,
        lastSavedAt: options?.savedAt ?? null,
        expandedCardIds: initialExpandedIds,
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

  closeTab: (leafId, tabId) => {
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

      const nextFileToLeaf = { ...state.fileToLeaf };
      if (tab) {
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
  },

  closeLeaf: (leafId) => {
    set((state) => {
      const leaf = state.leafs[leafId];
      if (!leaf) {
        return state;
      }

      const nextTabs = { ...state.tabs };
      const nextFileToLeaf = { ...state.fileToLeaf };

      leaf.tabIds.forEach((tabId) => {
        const tab = state.tabs[tabId];
        if (tab) {
          delete nextFileToLeaf[tab.fileName];
        }
        delete nextTabs[tabId];
      });

      const nextLeafs = { ...state.leafs };
      delete nextLeafs[leafId];

      return {
        tabs: nextTabs,
        leafs: nextLeafs,
        fileToLeaf: nextFileToLeaf,
      } satisfies Pick<WorkspaceStore, 'tabs' | 'leafs' | 'fileToLeaf'>;
    });
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

  updateCard: (leafId, tabId, cardId, patch) => {
    set((state) => {
      const tab = state.tabs[tabId];
      if (!tab || tab.leafId !== leafId) {
        return state;
      }

      const nextCards = tab.cards.map((card) => {
        if (card.id !== cardId) {
          return card;
        }
        const nextUpdatedAt = patch.updatedAt ?? new Date().toISOString();
        return { ...card, ...patch, updatedAt: nextUpdatedAt } satisfies Card;
      });

      return {
        ...state,
        tabs: {
          ...state.tabs,
          [tabId]: { ...tab, cards: nextCards, isDirty: true },
        },
      };
    });
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
    set((state) => {
      const tab = state.tabs[tabId];
      if (!tab || tab.leafId !== leafId) {
        return state;
      }

      //! 展開状態を維持しつつ、新しいカードで存在しないIDは削除
      const updatedExpandedIds = new Set<string>(
        Array.from(tab.expandedCardIds).filter((id) => cards.some((card) => card.id === id && card.child_ids.length > 0)),
      );
      //! 選択状態も維持しつつ、新しいカードで存在しないIDは削除
      const updatedSelectedIds = new Set<string>(
        Array.from(tab.selectedCardIds).filter((id) => cards.some((card) => card.id === id)),
      );

      return {
        ...state,
        tabs: {
          ...state.tabs,
          [tabId]: {
            ...tab,
            cards: [...cards],
            selectedCardIds: updatedSelectedIds.size > 0 ? updatedSelectedIds : new Set(cards[0]?.id ? [cards[0].id] : []),
            isDirty: false,
            lastSavedAt: options?.savedAt ?? tab.lastSavedAt,
            expandedCardIds: updatedExpandedIds,
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
          [tabId]: { ...tab, isDirty: false, lastSavedAt: savedAt },
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

  reset: () => {
    set(() => ({ ...initialState }));
  },
}));

/**
 * @brief ストアの状態を初期値へ戻すヘルパ。
 */
export const resetWorkspaceStore = (): void => {
  useWorkspaceStore.getState().reset();
};
