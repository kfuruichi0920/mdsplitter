/**
 * @file traceability.ts
 * @brief トレーサビリティリンクの型定義とファイル永続化スキーマ。
 * @details
 * カード間のトレース関係（trace, refines, tests等）を定義し、
 * JSON形式での保存・読込・検証用の型ガードを提供。
 * スキーマバージョン管理により将来の拡張に対応。
 * 例:
 * @code
 * const link: TraceabilityLink = { id: '...', sourceCardId: 'card-0001', targetCardId: 'card-0042', relation: 'trace', direction: 'forward' };
 * const file: TraceabilityFile = { header: {...}, relations: [...] };
 * @endcode
 * @author K.Furuichi
 * @date 2025-11-16
 * @version 0.1
 * @copyright MIT
 * @see workspace.ts, matrixProtocol.ts
 */

/**
 * @brief トレース関係種別の定数配列。
 * @details
 * trace（追跡）、refines（詳細化）、tests（テスト）、duplicates（重複）、
 * satisfy（満足）、relate（関連）、specialize（特殊化）を定義。
 */
export const TRACE_RELATION_KINDS = [
  'trace',
  'refines',
  'tests',
  'duplicates',
  'satisfy',
  'relate',
  'specialize',
] as const;

/**
 * @brief トレーサビリティファイルのスキーマバージョン。
 * @details
 * 現在はバージョン1。将来の拡張に備えてスキーマ管理。
 */
export const TRACEABILITY_FILE_SCHEMA_VERSION = 1 as const;

/**
 * @brief トレース関係種別（ユニオン型）。
 */
export type TraceRelationKind = (typeof TRACE_RELATION_KINDS)[number];

/**
 * @brief トレース方向種別。
 * @details
 * forward（順方向）、backward（逆方向）、bidirectional（双方向）。
 */
export type TraceDirection = 'forward' | 'backward' | 'bidirectional';

/**
 * @brief トレースリンクを表す構造体（描画用）。
 * @details
 * 1つのRelationから複数のLinkが生成される（左右カードIDの直積）。
 */
export interface TraceabilityLink {
  id: string; ///< コネクタID（relationIdとカードIDの組み合わせ）
  relationId: string; ///< 元になった relation の ID。
  sourceCardId: string; ///< 左側カードID。
  targetCardId: string; ///< 右側カードID。
  relation: TraceRelationKind; ///< 関係種別。
  direction: TraceDirection; ///< 方向性。
  memo?: string; ///< 関連付けられたメモ（任意）
}

/**
 * @brief トレーサビリティファイルのヘッダ情報。
 * @details
 * ファイルID、左右ファイルパス、作成・更新日時、メモを保持。
 */
export interface TraceabilityHeader {
  id: string; ///< ヘッダーID（UUID等）。
  fileName: string; ///< トレーサビリティファイル名。
  leftFilePath: string; ///< 左側カードファイルパス。
  rightFilePath: string; ///< 右側カードファイルパス。
  createdAt: string; ///< 作成日時（ISO 8601形式）。
  updatedAt: string; ///< 更新日時（ISO 8601形式）。
  memo?: string; ///< メモ（任意）。
}

/**
 * @brief トレーサビリティ関係の生データ。
 * @details
 * 左右のカードIDリストと関係種別・方向性を保持。M:N関係を表現。
 */
export interface TraceabilityRelation {
  id: string; ///< 関係ID（UUID等）。
  left_ids: string[]; ///< 左側カードID配列。
  right_ids: string[]; ///< 右側カードID配列。
  type: TraceRelationKind; ///< 関係種別。
  directed: 'left_to_right' | 'right_to_left' | 'bidirectional'; ///< 方向性（ファイル上の表現）。
  memo?: string; ///< メモ（任意）。
}

/**
 * @brief トレーサビリティファイルの構造。
 * @details
 * スキーマバージョン、ヘッダー、左右ファイル名、関係配列を保持。
 */
export interface TraceabilityFile {
  schemaVersion: number; ///< スキーマバージョン。
  header?: TraceabilityHeader; ///< ヘッダー情報（任意）。
  left_file: string; ///< 左側カードファイル名。
  right_file: string; ///< 右側カードファイル名。
  relations: TraceabilityRelation[]; ///< 関係配列。
}

/**
 * @brief トレースファイル保存リクエスト。
 */
export interface TraceFileSaveRequest {
  fileName?: string | null; ///< 保存ファイル名（省略時は自動生成）。
  leftFile: string; ///< 左側カードファイル名。
  rightFile: string; ///< 右側カードファイル名。
  relations: TraceabilityRelation[]; ///< 関係配列。
  header?: TraceabilityHeader; ///< ヘッダー情報（任意）。
}

/**
 * @brief トレースファイル保存結果。
 */
export interface TraceFileSaveResult {
  fileName: string; ///< 保存されたファイル名。
  savedPath: string; ///< 保存先の絶対パス。
  savedAt: string; ///< 保存日時（ISO 8601形式）。
  header: TraceabilityHeader; ///< ヘッダー情報。
}

/**
 * @brief 読み込まれたトレーサビリティファイル。
 */
export interface LoadedTraceabilityFile {
  fileName: string; ///< ファイル名。
  payload: TraceabilityFile; ///< ファイル内容。
}

/**
 * @brief ファイル上の方向性表現を正規化。
 * @param directed ファイル上の方向性（left_to_right/right_to_left/bidirectional）。
 * @return 正規化後の方向性（forward/backward/bidirectional）。
 */
export const normalizeDirection = (directed: TraceabilityRelation['directed']): TraceDirection => {
  switch (directed) {
    case 'left_to_right':
      return 'forward';
    case 'right_to_left':
      return 'backward';
    default:
      return 'bidirectional';
  }
};

/**
 * @brief 方向性を反転。
 * @details
 * forward↔backward、bidirectionalはそのまま。
 * @param direction 元の方向性。
 * @return 反転後の方向性。
 */
export const invertDirection = (direction: TraceDirection): TraceDirection => {
  switch (direction) {
    case 'forward':
      return 'backward';
    case 'backward':
      return 'forward';
    default:
      return 'bidirectional';
  }
};

/**
 * @brief TraceabilityHeader型ガード。
 * @param value 未検証値。
 * @return TraceabilityHeaderであればtrue。
 */
export const isTraceabilityHeader = (value: unknown): value is TraceabilityHeader => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<TraceabilityHeader>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.fileName === 'string' &&
    typeof candidate.leftFilePath === 'string' &&
    typeof candidate.rightFilePath === 'string' &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.updatedAt === 'string'
  );
};

/**
 * @brief TraceabilityRelation型ガード。
 * @param value 未検証値。
 * @return TraceabilityRelationであればtrue。
 */
export const isTraceabilityRelation = (value: unknown): value is TraceabilityRelation => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<TraceabilityRelation>;
  return (
    typeof candidate.id === 'string' &&
    Array.isArray(candidate.left_ids) &&
    Array.isArray(candidate.right_ids) &&
    typeof candidate.type === 'string' &&
    typeof candidate.directed === 'string' &&
    (candidate.memo === undefined || typeof candidate.memo === 'string')
  );
};

/**
 * @brief TraceabilityFile型ガード。
 * @details
 * スキーマバージョン、ファイル名、関係配列、ヘッダー（任意）を検証。
 * @param value 未検証値。
 * @return TraceabilityFileであればtrue。
 */
export const isTraceabilityFile = (value: unknown): value is TraceabilityFile => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<TraceabilityFile>;
  if (
    typeof candidate.schemaVersion !== 'number' ||
    typeof candidate.left_file !== 'string' ||
    typeof candidate.right_file !== 'string' ||
    !Array.isArray(candidate.relations)
  ) {
    return false;
  }
  if (candidate.header && !isTraceabilityHeader(candidate.header)) {
    return false;
  }
  return candidate.relations.every((relation) => isTraceabilityRelation(relation));
};

/**
 * @brief Relation→Link変換オプション。
 */
interface RelationToLinkOptions {
  swapOrientation?: boolean; ///< 左右を入れ替えるか（デフォルト: false）。
}

/**
 * @brief relationから描画用リンクを展開する。
 * @details
 * 左右カードIDの直積を計算し、リンク配列を生成。計算量O(M×N)（M: 左側ID数、N: 右側ID数）。
 * @param relation トレーサビリティ関係。
 * @param options 変換オプション（左右入れ替え等）。
 * @return リンク配列。
 */
export const relationToLinks = (
  relation: TraceabilityRelation,
  options: RelationToLinkOptions = {},
): TraceabilityLink[] => {
  const leftIds = options.swapOrientation ? relation.right_ids : relation.left_ids;
  const rightIds = options.swapOrientation ? relation.left_ids : relation.right_ids;
  const baseDirection = normalizeDirection(relation.directed);
  const direction = options.swapOrientation ? invertDirection(baseDirection) : baseDirection;

  const links: TraceabilityLink[] = [];
  leftIds.forEach((leftId) => {
    rightIds.forEach((rightId) => {
      links.push({
        id: `${relation.id}:${leftId}->${rightId}`,
        relationId: relation.id,
        sourceCardId: leftId,
        targetCardId: rightId,
        relation: relation.type,
        direction,
        memo: relation.memo,
      });
    });
  });

  return links;
};

/**
 * @brief relation配列からリンク配列へ変換する。
 * @details
 * 各relationをrelationToLinksで展開し、平坦化。計算量O(K×M×N)（K: relation数）。
 * @param relations トレーサビリティ関係配列。
 * @param options 変換オプション。
 * @return リンク配列。
 */
export const relationsToLinks = (
  relations: TraceabilityRelation[],
  options: RelationToLinkOptions = {},
): TraceabilityLink[] => relations.flatMap((relation) => relationToLinks(relation, options));

/**
 * @brief スタブトレーサビリティリンク（開発・テスト用）。
 */
const TRACEABILITY_STUBS: TraceabilityLink[] = [
  {
    id: 'trace-link-001',
    relationId: 'stub-relation-001',
    sourceCardId: 'card-001',
    targetCardId: 'card-002',
    relation: 'trace',
    direction: 'forward',
  },
  {
    id: 'trace-link-002',
    relationId: 'stub-relation-002',
    sourceCardId: 'card-002',
    targetCardId: 'card-003',
    relation: 'tests',
    direction: 'bidirectional',
  },
  {
    id: 'trace-link-003',
    relationId: 'stub-relation-003',
    sourceCardId: 'card-003',
    targetCardId: 'card-001',
    relation: 'duplicates',
    direction: 'backward',
  },
];

/**
 * @brief コネクタ描画用のスタブデータを返す。
 * @details
 * 開発・テスト用の固定リンク配列。
 * @return スタブリンク配列。
 */
export const getTraceabilityStubs = (): TraceabilityLink[] => TRACEABILITY_STUBS;
