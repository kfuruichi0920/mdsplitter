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

/** カードの表示種別。 */
export type CardKind = 'heading' | 'paragraph' | 'bullet' | 'figure' | 'table' | 'test' | 'qa';

/** カードのステータス。 */
export type CardStatus = 'draft' | 'review' | 'approved' | 'deprecated';

/** カード情報を表す構造体。 */
export interface Card {
  id: string; ///< 一意識別子。
  title: string; ///< タイトルもしくは先頭行。
  body: string; ///< 本文。
  status: CardStatus; ///< 現在のステータス。
  kind: CardKind; ///< 表示種別。
  hasLeftTrace: boolean; ///< 左接合点のトレース有無。
  hasRightTrace: boolean; ///< 右接合点のトレース有無。
  updatedAt: string; ///< 最終更新日時 (ISO8601)。
}

/** カード更新用パッチ。 */
export type CardPatch = Partial<Omit<Card, 'id'>>;

/** ステータス遷移順序。 */
export const CARD_STATUS_SEQUENCE: CardStatus[] = ['draft', 'review', 'approved', 'deprecated'];

/**
 * @brief カードステータスを次段に遷移させる。
 * @param current 現在のステータス。
 * @return 遷移後のステータス。
 */
export const getNextCardStatus = (current: CardStatus): CardStatus => {
  const index = CARD_STATUS_SEQUENCE.indexOf(current);
  //! 未定義ステータスの場合も循環列の先頭にフォールバックする
  const nextIndex = index === -1 ? 0 : (index + 1) % CARD_STATUS_SEQUENCE.length;
  return CARD_STATUS_SEQUENCE[nextIndex];
};

/** ワークスペースストアの状態とアクション。 */
export interface WorkspaceStore {
  cards: Card[]; ///< 表示中のカードコレクション。
  selectedCardId: string | null; ///< 選択中カードのID。
  selectCard: (id: string) => void; ///< カードを選択する。
  updateCard: (id: string, patch: CardPatch) => void; ///< カード内容を更新する。
  cycleCardStatus: (id: string) => CardStatus | null; ///< ステータスを次段へ遷移させる。
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
