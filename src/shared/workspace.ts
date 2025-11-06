/**
 * @file workspace.ts
 * @brief ワークスペース共有データモデルとユーティリティ。
 * @details
 * カード情報・スナップショット・ステータス遷移等の型定義と判定関数を提供。
 * 制約: 型定義のみ、バリデーションは簡易。@todo 厳密な型検査・エラー処理追加。
 * @author K.Furuichi
 * @date 2025-11-02
 * @version 0.1
 * @copyright MIT
 */

/**
 * @brief ワークスペーススナップショットのファイル名定数。
 * @details
 * outputDir配下に保存されるJSONファイル名。
 * @since 0.1
 */
export const WORKSPACE_SNAPSHOT_FILENAME = 'workspace.snapshot.json';

/**
 * @brief カードの表示種別。
 * @details
 * Markdown構造やテスト・QAなどの分類。
 */
export type CardKind = 'heading' | 'paragraph' | 'bullet' | 'figure' | 'table' | 'test' | 'qa';

/**
 * @brief カードのステータス。
 * @details
 * ドラフト・レビュー・承認・廃止の4段階。
 */
export type CardStatus = 'draft' | 'review' | 'approved' | 'deprecated';

/**
 * @brief カード種別の列挙。
 * @details
 * CardKind型の全値を配列で保持。
 */
export const CARD_KIND_VALUES: readonly CardKind[] = [
  'heading',
  'paragraph',
  'bullet',
  'figure',
  'table',
  'test',
  'qa',
] as const;

/**
 * @brief カード情報を表す構造体。
 * @details
 * 1枚のカードの全属性を保持。
 * 階層構造はparent_id/child_idsで管理し、順序関係はprev_id/next_idの双方向リンクで管理。
 * @ingroup workspace
 */
export interface Card {
  id: string;              ///< 一意ID
  title: string;           ///< タイトル
  body: string;            ///< 本文
  status: CardStatus;      ///< ステータス
  kind: CardKind;          ///< 種別
  hasLeftTrace: boolean;   ///< 左トレース有無
  hasRightTrace: boolean;  ///< 右トレース有無
  updatedAt: string;       ///< 最終更新日時（ISO8601）
  parent_id: string | null;  ///< 親カードID（ルートの場合null）
  child_ids: string[];       ///< 子カード（1階層下）IDリスト
  prev_id: string | null;    ///< 兄弟の前のカードID（先頭の場合null）
  next_id: string | null;    ///< 兄弟の次のカードID（末尾の場合null）
  level: number;             ///< 階層レベル（0=ルート、1=第1階層、...）
}

/**
 * @brief カード更新用パッチ型。
 * @details
 * id以外の部分更新に利用。
 */
export type CardPatch = Partial<Omit<Card, 'id'>>;

/**
 * @brief ステータス遷移順序。
 * @details
 * draft→review→approved→deprecatedの順。
 */
export const CARD_STATUS_SEQUENCE: CardStatus[] = ['draft', 'review', 'approved', 'deprecated'];

/**
 * @brief カードステータスを次段に遷移させる。
 * @details
 * 現在値が見つからない場合は先頭に戻る。
 * @param current 現在のステータス。
 * @return 遷移後のステータス。
 * @throws なし
 */
export const getNextCardStatus = (current: CardStatus): CardStatus => {
  const index = CARD_STATUS_SEQUENCE.indexOf(current);
  //! index==-1なら先頭に戻る
  const nextIndex = index === -1 ? 0 : (index + 1) % CARD_STATUS_SEQUENCE.length;
  return CARD_STATUS_SEQUENCE[nextIndex];
};

/**
 * @brief ワークスペース全体のスナップショット。
 * @details
 * カード配列と保存日時を保持。
 * @ingroup workspace
 */
export interface WorkspaceSnapshot {
  cards: Card[];      ///< 全カード
  savedAt: string;    ///< 保存日時（ISO8601）
}

/**
 * @brief 値が WorkspaceSnapshot として妥当かを判定する。
 * @details
 * cards/savedAtの型・構造を検証。@todo 厳密な型検査・エラー詳細返却。
 * @param value チェック対象。
 * @return 判定結果（true:妥当, false:不正）。
 * @throws なし
 */
export const isWorkspaceSnapshot = (value: unknown): value is WorkspaceSnapshot => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const maybe = value as Partial<WorkspaceSnapshot>;
  if (!Array.isArray(maybe.cards) || typeof maybe.savedAt !== 'string') {
    return false;
  }
  //! 各カードの型検証
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
      typeof target.updatedAt === 'string' &&
      (target.parent_id === null || typeof target.parent_id === 'string') &&
      Array.isArray(target.child_ids) &&
      (target.prev_id === null || typeof target.prev_id === 'string') &&
      (target.next_id === null || typeof target.next_id === 'string') &&
      typeof target.level === 'number'
    );
  });
};
