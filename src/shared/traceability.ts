/**
 * @file traceability.ts
 * @brief トレーサビリティコネクタの型定義と補助ユーティリティ。
 */

/**
 * @brief トレース関係種別の定数配列。
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

export const TRACEABILITY_FILE_SCHEMA_VERSION = 1 as const;

export type TraceRelationKind = (typeof TRACE_RELATION_KINDS)[number];
export type TraceDirection = 'forward' | 'backward' | 'bidirectional';

/**
 * @brief トレースリンクを表す構造体。
 */
export interface TraceabilityLink {
  id: string; ///< コネクタID（relationIdとカードIDの組み合わせ）
  relationId: string; ///< 元になった relation の ID。
  sourceCardId: string; ///< 左側カードID。
  targetCardId: string; ///< 右側カードID。
  relation: TraceRelationKind; ///< 関係種別。
  direction: TraceDirection; ///< 方向性。
}

/**
 * @brief トレーサビリティファイルのヘッダ情報。
 */
export interface TraceabilityHeader {
  id: string;
  fileName: string;
  leftFilePath: string;
  rightFilePath: string;
  createdAt: string;
  updatedAt: string;
  memo?: string;
}

/**
 * @brief トレーサビリティ関係の生データ。
 */
export interface TraceabilityRelation {
  id: string;
  left_ids: string[];
  right_ids: string[];
  type: TraceRelationKind;
  directed: 'left_to_right' | 'right_to_left' | 'bidirectional';
  memo?: string;
}

/**
 * @brief トレーサビリティファイルの構造。
 */
export interface TraceabilityFile {
  schemaVersion: number;
  header?: TraceabilityHeader;
  left_file: string;
  right_file: string;
  relations: TraceabilityRelation[];
}

export interface TraceFileSaveRequest {
  fileName?: string | null;
  leftFile: string;
  rightFile: string;
  relations: TraceabilityRelation[];
  header?: TraceabilityHeader;
}

export interface TraceFileSaveResult {
  fileName: string;
  savedPath: string;
  savedAt: string;
  header: TraceabilityHeader;
}

export interface LoadedTraceabilityFile {
  fileName: string;
  payload: TraceabilityFile;
}

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
    typeof candidate.directed === 'string'
  );
};

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

interface RelationToLinkOptions {
  swapOrientation?: boolean;
}

/**
 * @brief relationから描画用リンクを展開する。
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
      });
    });
  });

  return links;
};

/**
 * @brief relation配列からリンク配列へ変換する。
 */
export const relationsToLinks = (
  relations: TraceabilityRelation[],
  options: RelationToLinkOptions = {},
): TraceabilityLink[] => relations.flatMap((relation) => relationToLinks(relation, options));

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
 */
export const getTraceabilityStubs = (): TraceabilityLink[] => TRACEABILITY_STUBS;
