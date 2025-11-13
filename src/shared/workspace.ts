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
  id: string;              ///< 一意ID（UUID）
  cardId?: string;         ///< ユーザー向け識別子（例: REQ-001, SPEC-042）
  title: string;           ///< タイトル
  body: string;            ///< 本文
  status: CardStatus;      ///< ステータス
  kind: CardKind;          ///< 種別
  hasLeftTrace: boolean;   ///< 左トレース有無
  hasRightTrace: boolean;  ///< 右トレース有無
  markdownPreviewEnabled: boolean; ///< Markdownプレビュー有無
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
      (target.cardId === undefined || typeof target.cardId === 'string') &&
      typeof target.title === 'string' &&
      typeof target.body === 'string' &&
      typeof target.status === 'string' &&
      typeof target.kind === 'string' &&
      typeof target.hasLeftTrace === 'boolean' &&
      typeof target.hasRightTrace === 'boolean' &&
      typeof target.markdownPreviewEnabled === 'boolean' &&
      typeof target.updatedAt === 'string' &&
      (target.parent_id === null || typeof target.parent_id === 'string') &&
      Array.isArray(target.child_ids) &&
      (target.prev_id === null || typeof target.prev_id === 'string') &&
      (target.next_id === null || typeof target.next_id === 'string') &&
      typeof target.level === 'number'
    );
  });
};

/**
 * @brief カードIDから接頭語と番号を抽出する。
 * @details
 * カードIDのフォーマット: "PREFIX-NNN" または "NNN"
 * @param cardId カードID（例: "REQ-001", "042"）
 * @return 接頭語と番号のオブジェクト、パース失敗時はnull
 * @throws なし
 */
export const parseCardId = (cardId: string): { prefix: string; number: number } | null => {
  if (!cardId) {
    return null;
  }

  const match = cardId.match(/^(.+?)-(\d+)$/);
  if (match) {
    const prefix = match[1];
    const number = parseInt(match[2], 10);
    if (!isNaN(number)) {
      return { prefix, number };
    }
  }

  // 接頭語なしの場合（数値のみ）
  const numberOnly = parseInt(cardId, 10);
  if (!isNaN(numberOnly)) {
    return { prefix: '', number: numberOnly };
  }

  return null;
};

/**
 * @brief 同じ接頭語を持つカードの最大番号を取得する。
 * @details
 * 指定された接頭語を持つカードIDから最大番号を抽出。
 * 接頭語が指定されない場合は、すべてのカードIDから最大番号を取得。
 * @param cards カード配列
 * @param prefix 接頭語（省略時はすべてのカードIDを対象）
 * @return 最大番号（該当するカードがない場合は0）
 * @throws なし
 */
export const findMaxCardNumber = (cards: Card[], prefix?: string): number => {
  let maxNumber = 0;

  for (const card of cards) {
    if (!card.cardId) {
      continue;
    }

    const parsed = parseCardId(card.cardId);
    if (!parsed) {
      continue;
    }

    // 接頭語が指定されている場合は、同じ接頭語のみを対象
    if (prefix !== undefined && parsed.prefix !== prefix) {
      continue;
    }

    if (parsed.number > maxNumber) {
      maxNumber = parsed.number;
    }
  }

  return maxNumber;
};

/**
 * @brief 既存カードから最も一般的な接頭語を取得する。
 * @details
 * カードID付きのカードから接頭語を抽出し、最も頻度の高いものを返す。
 * @param cards カード配列
 * @return 最も一般的な接頭語（カードIDがない場合は空文字）
 * @throws なし
 */
export const getMostCommonPrefix = (cards: Card[]): string => {
  const prefixCounts = new Map<string, number>();

  for (const card of cards) {
    if (!card.cardId) {
      continue;
    }

    const parsed = parseCardId(card.cardId);
    if (parsed) {
      const count = prefixCounts.get(parsed.prefix) ?? 0;
      prefixCounts.set(parsed.prefix, count + 1);
    }
  }

  if (prefixCounts.size === 0) {
    return '';
  }

  let mostCommonPrefix = '';
  let maxCount = 0;

  for (const [prefix, count] of prefixCounts.entries()) {
    if (count > maxCount) {
      mostCommonPrefix = prefix;
      maxCount = count;
    }
  }

  return mostCommonPrefix;
};

/**
 * @brief 次のカードIDを生成する。
 * @details
 * 既存カードのパターンを分析し、適切な次のIDを生成。
 * 接頭語が指定されている場合はそれを使用し、指定がない場合は最も一般的な接頭語を使用。
 * @param cards 既存カード配列
 * @param preferredPrefix 優先する接頭語（省略時は自動判定）
 * @param digits 桁数（ゼロパディング、デフォルト: 3）
 * @return 生成されたカードID（例: "REQ-001", "042"）
 * @throws なし
 */
export const generateNextCardId = (
  cards: Card[],
  preferredPrefix?: string,
  digits: number = 3,
): string => {
  // 接頭語の決定
  const prefix = preferredPrefix !== undefined ? preferredPrefix : getMostCommonPrefix(cards);

  // 最大番号を取得
  const maxNumber = findMaxCardNumber(cards, prefix);
  const nextNumber = maxNumber + 1;

  // IDを生成
  const paddedNumber = String(nextNumber).padStart(digits, '0');
  if (prefix) {
    return `${prefix}-${paddedNumber}`;
  }
  return paddedNumber;
};

/**
 * @brief カードID重複チェック。
 * @details
 * 指定されたカードIDが既存カードと重複していないかチェック。
 * excludeCardIdを指定すると、そのIDを持つカードは重複チェックから除外される（編集時に使用）。
 * @param cards カード配列
 * @param cardId チェック対象のカードID
 * @param excludeCardId チェックから除外するカードのID（編集時に自分自身を除外）
 * @return 重複している場合true
 * @throws なし
 */
export const isCardIdDuplicate = (
  cards: Card[],
  cardId: string,
  excludeCardId?: string,
): boolean => {
  if (!cardId) {
    return false;
  }

  return cards.some((card) => {
    if (excludeCardId && card.id === excludeCardId) {
      return false;
    }
    return card.cardId === cardId;
  });
};
