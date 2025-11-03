/**
 * @file workspace.ts
 * @brief ワークスペース共有データモデルとユーティリティ。
 */

export const WORKSPACE_SNAPSHOT_FILENAME = 'workspace.snapshot.json';

/** カードの表示種別。 */
export type CardKind = 'heading' | 'paragraph' | 'bullet' | 'figure' | 'table' | 'test' | 'qa';

/** カードのステータス。 */
export type CardStatus = 'draft' | 'review' | 'approved' | 'deprecated';

/** カード種別の列挙。 */
export const CARD_KIND_VALUES: readonly CardKind[] = [
  'heading',
  'paragraph',
  'bullet',
  'figure',
  'table',
  'test',
  'qa',
] as const;

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

/**
 * @brief 値が WorkspaceSnapshot として妥当かを判定する。
 * @param value チェック対象。
 * @return 判定結果。
 */
export const isWorkspaceSnapshot = (value: unknown): value is WorkspaceSnapshot => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const maybe = value as Partial<WorkspaceSnapshot>;
  if (!Array.isArray(maybe.cards) || typeof maybe.savedAt !== 'string') {
    return false;
  }
  return maybe.cards.every((card) => {
    if (!card || typeof card !== 'object') {
      return false;
    }
    const target = card as Partial<Card>;
    return (
      typeof target.id === 'string' &&
      typeof target.title === 'string' &&
      typeof target.body === 'string' &&
      typeof target.status === 'string' &&
      typeof target.kind === 'string' &&
      typeof target.hasLeftTrace === 'boolean' &&
      typeof target.hasRightTrace === 'boolean' &&
      typeof target.updatedAt === 'string'
    );
  });
};
