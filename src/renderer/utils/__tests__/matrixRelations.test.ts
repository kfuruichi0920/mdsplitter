import { describe, expect, it } from '@jest/globals';

import type { TraceabilityRelation } from '@/shared/traceability';
import { changeRelationKind, toggleTraceRelation } from '../matrixRelations';

const sampleRelation: TraceabilityRelation = {
  id: 'rel-1',
  left_ids: ['L1'],
  right_ids: ['R1'],
  type: 'trace',
  directed: 'left_to_right',
};

describe('matrixRelations helpers', () => {
  it('creates a new relation when toggling empty cell', () => {
    const { next, isActive } = toggleTraceRelation([], 'A', 'B');
    expect(isActive).toBe(true);
    expect(next).toHaveLength(1);
    expect(next[0].left_ids).toEqual(['A']);
    expect(next[0].right_ids).toEqual(['B']);
  });

  it('removes relation when toggling existing pair', () => {
    const { next, isActive } = toggleTraceRelation([sampleRelation], 'L1', 'R1');
    expect(isActive).toBe(false);
    expect(next).toHaveLength(0);
  });

  it('changes relation kind for existing cell', () => {
    const updated = changeRelationKind([sampleRelation], 'L1', 'R1', 'tests');
    expect(updated[0].type).toBe('tests');
  });
});
