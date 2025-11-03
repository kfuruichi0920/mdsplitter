/**
 * @file traceability.ts
 * @brief トレーサビリティコネクタのスタブデータと型定義。
 */

export type TraceRelationKind = 'trace' | 'refines' | 'tests' | 'duplicates';
export type TraceDirection = 'forward' | 'backward' | 'bidirectional';

export interface TraceabilityLink {
  id: string;
  sourceCardId: string;
  targetCardId: string;
  relation: TraceRelationKind;
  direction: TraceDirection;
}

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
