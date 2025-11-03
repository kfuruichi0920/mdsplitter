/**
 * @file traceability.ts
 * @brief トレーサビリティコネクタのスタブデータと型定義。
 */

export type TraceRelationKind =
  | 'trace'
  | 'refines'
  | 'tests'
  | 'duplicates'
  | 'satisfy'
  | 'relate'
  | 'specialize';
export type TraceDirection = 'forward' | 'backward' | 'bidirectional';

export interface TraceabilityLink {
  id: string;
  sourceCardId: string;
  targetCardId: string;
  relation: TraceRelationKind;
  direction: TraceDirection;
}

export interface TraceabilityRelation {
  left_ids: string[];
  right_ids: string[];
  type: TraceRelationKind;
  directed: 'left_to_right' | 'right_to_left' | 'bidirectional';
  memo?: string;
}

export interface TraceabilityFile {
  schemaVersion: number;
  updatedAt?: string;
  left_file: string;
  right_file: string;
  relations: TraceabilityRelation[];
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
  return candidate.relations.every((relation) => {
    if (!relation || typeof relation !== 'object') {
      return false;
    }
    const r = relation as TraceabilityRelation;
    return (
      Array.isArray(r.left_ids) &&
      Array.isArray(r.right_ids) &&
      typeof r.type === 'string' &&
      typeof r.directed === 'string'
    );
  });
};

const TRACEABILITY_STUBS: TraceabilityLink[] = [
  {
    id: 'trace-link-001',
    sourceCardId: 'card-001',
    targetCardId: 'card-002',
    relation: 'trace',
    direction: 'forward',
  },
  {
    id: 'trace-link-002',
    sourceCardId: 'card-002',
    targetCardId: 'card-003',
    relation: 'tests',
    direction: 'bidirectional',
  },
  {
    id: 'trace-link-003',
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
