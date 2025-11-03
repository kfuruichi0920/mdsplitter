/**
 * @file workspaceStore.ts
 * @brief ワークスペース全体で共有するカード状態ストア。
 * @details
 * Zustand を利用してカード一覧・選択状態・更新アクションを管理する。UI からは
 * `useWorkspaceStore` を介して状態とアクションを取得し、カードのステータス更新や
 * コンテンツ変更を行う。テストからのリセット用途に `resetWorkspaceStore` も提供する。
 * @author K.Furuichi
 * @date 2025-11-02
 * @version 0.1
 * @copyright MIT
 */

import { create } from 'zustand';

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

/** ワークスペースストアの状態とアクション。 */
export interface WorkspaceStore {
  cards: Card[]; ///< 表示中のカードコレクション。
  selectedCardId: string | null; ///< 選択中カードのID。
  selectCard: (id: string) => void; ///< カードを選択する。
  updateCard: (id: string, patch: CardPatch) => void; ///< カード内容を更新する。
  cycleCardStatus: (id: string) => CardStatus | null; ///< ステータスを次段へ遷移させる。
  hydrate: (cards: Card[]) => void; ///< 外部スナップショットからワークスペースを読み込む。
  reset: () => void; ///< 初期状態へリセットする。
}

/**
 * @brief ダミーカードの初期配列を生成する。
 * @return カード配列。
 */
const createInitialCards = (): Card[] => [
  {
    id: 'card-001',
    title: 'プロジェクト概要',
    body: 'アプリケーションの目的と主要ユースケースを記述します。',
    status: 'approved',
    kind: 'heading',
    hasLeftTrace: true,
    hasRightTrace: true,
    updatedAt: '2025-10-19T05:30:00.000Z',
  },
  {
    id: 'card-002',
    title: '詳細設計の棚卸し',
    body: 'ユースケース一覧と詳細設計の整備方針をまとめます。',
    status: 'draft',
    kind: 'paragraph',
    hasLeftTrace: false,
    hasRightTrace: true,
    updatedAt: '2025-10-18T00:15:00.000Z',
  },
  {
    id: 'card-003',
    title: 'リスクアセスメント概要',
    body: '既知の運用リスクと緩和策を列挙します。',
    status: 'review',
    kind: 'bullet',
    hasLeftTrace: true,
    hasRightTrace: false,
    updatedAt: '2025-10-17T11:05:00.000Z',
  },
];

/**
 * @brief ストアの基礎状態を生成する。
 * @return カード配列と選択IDを含む基礎状態。
 */
const createBaseState = () => {
  const cards = createInitialCards();
  return {
    cards,
    selectedCardId: cards[0]?.id ?? null,
  } satisfies Pick<WorkspaceStore, 'cards' | 'selectedCardId'>;
};

/** Zustand ストア本体。 */
export const useWorkspaceStore = create<WorkspaceStore>()((set, get) => ({
  ...createBaseState(),
  selectCard: (id: string) => {
    const exists = get().cards.some((card) => card.id === id);
    if (!exists) {
      return;
    }
    set({ selectedCardId: id });
  },
  updateCard: (id: string, patch: CardPatch) => {
    set((state) => ({
      cards: state.cards.map((card) => {
        if (card.id !== id) {
          return card;
        }
        //! 更新日時のパッチが指定されない場合は現在時刻を設定する
        const nextUpdatedAt = patch.updatedAt ?? new Date().toISOString();
        return { ...card, ...patch, updatedAt: nextUpdatedAt } satisfies Card;
      }),
    }));
  },
  cycleCardStatus: (id: string) => {
    let nextStatus: CardStatus | null = null;
    set((state) => ({
      cards: state.cards.map((card) => {
        if (card.id !== id) {
          return card;
        }
        nextStatus = getNextCardStatus(card.status);
        return {
          ...card,
          status: nextStatus,
          updatedAt: new Date().toISOString(),
        } satisfies Card;
      }),
    }));
    return nextStatus;
  },
  hydrate: (cards: Card[]) => {
    set({
      cards,
      selectedCardId: cards[0]?.id ?? null,
    });
  },
  reset: () => {
    const base = createBaseState();
    set((state) => ({
      ...state,
      ...base,
    }));
  },
}));

/**
 * @brief ストアを初期状態へリセットするユーティリティ。
 * @details
 * テストで副作用を残さないために使用する。
 */
export const resetWorkspaceStore = (): void => {
  useWorkspaceStore.getState().reset();
};
