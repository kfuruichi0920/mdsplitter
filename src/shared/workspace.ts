/**
 * @file workspace.ts
 * @brief ワークスペース共有データモデルとユーティリティ。
 */

/** カードの表示種別。 */
export type CardKind = 'heading' | 'paragraph' | 'bullet' | 'figure' | 'table' | 'test' | 'qa';

/** カードのステータス。 */
export type CardStatus = 'draft' | 'review' | 'approved' | 'deprecated';

/** カード情報を表す構造体。 */
export interface Card {
  id: string;
  title: string;
  body: string;
  status: CardStatus;
  kind: CardKind;
  hasLeftTrace: boolean;
  hasRightTrace: boolean;
  updatedAt: string;
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
  const nextIndex = index === -1 ? 0 : (index + 1) % CARD_STATUS_SEQUENCE.length;
  return CARD_STATUS_SEQUENCE[nextIndex];
};

/** ワークスペース全体のスナップショット。 */
export interface WorkspaceSnapshot {
  cards: Card[];
  savedAt: string;
}
