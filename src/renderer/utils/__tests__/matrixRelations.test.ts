import { describe, expect, it } from '@jest/globals';

import type { TraceabilityRelation } from '@/shared/traceability';
import { changeRelationKind, toggleTraceRelation, updateRelationDirection, updateRelationMemo } from '../matrixRelations';

const sampleRelation: TraceabilityRelation = {
  id: 'rel-1',
  left_ids: ['L1'],
  right_ids: ['R1'],
  type: 'trace',
  directed: 'left_to_right',
};

describe('matrixRelations helpers', () => {
  it('creates a new relation with provided defaults when toggling empty cell', () => {
    const { next, isActive } = toggleTraceRelation([], 'A', 'B', {
      defaultKind: 'tests',
      defaultDirection: 'right_to_left',
    });
    expect(isActive).toBe(true);
    expect(next).toHaveLength(1);
    expect(next[0].left_ids).toEqual(['A']);
    expect(next[0].right_ids).toEqual(['B']);
    expect(next[0].type).toBe('tests');
    expect(next[0].directed).toBe('right_to_left');
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

  it('updates memo and direction helpers', () => {
    const withMemo = updateRelationMemo([sampleRelation], 'rel-1', 'hello');
    expect(withMemo[0].memo).toBe('hello');
    const withDirection = updateRelationDirection(withMemo, 'rel-1', 'right_to_left');
    expect(withDirection[0].directed).toBe('right_to_left');
  });
});
