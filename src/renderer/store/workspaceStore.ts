
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
  selectedCardId: string | null;
  isDirty: boolean;
  lastSavedAt: string | null;
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
  selectCard: (leafId: string, tabId: string, cardId: string) => void;
  updateCard: (leafId: string, tabId: string, cardId: string, patch: CardPatch) => void;
  cycleCardStatus: (leafId: string, tabId: string, cardId: string) => CardStatus | null;
  hydrateTab: (leafId: string, tabId: string, cards: Card[], options?: { savedAt?: string }) => void;
  markSaved: (tabId: string, savedAt: string) => void;
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
        const nextTab: PanelTabState = {
          ...prevTab,
          cards: [...cards],
          selectedCardId: cards[0]?.id ?? null,
          isDirty: false,
          lastSavedAt: options?.savedAt ?? prevTab.lastSavedAt,
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
      const nextTab: PanelTabState = {
        id: tabId,
        leafId,
        fileName,
        title: options?.title ?? fileName,
        cards: [...cards],
        selectedCardId: cards[0]?.id ?? null,
        isDirty: false,
        lastSavedAt: options?.savedAt ?? null,
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

  selectCard: (leafId, tabId, cardId) => {
    set((state) => {
      const tab = state.tabs[tabId];
      if (!tab || tab.leafId !== leafId) {
        return state;
      }

      if (!tab.cards.some((card) => card.id === cardId)) {
        return state;
      }

      return {
        ...state,
        tabs: {
          ...state.tabs,
          [tabId]: { ...tab, selectedCardId: cardId },
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

      return {
        ...state,
        tabs: {
          ...state.tabs,
          [tabId]: {
            ...tab,
            cards: [...cards],
            selectedCardId: cards[0]?.id ?? null,
            isDirty: false,
            lastSavedAt: options?.savedAt ?? tab.lastSavedAt,
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
