/**
 * @file traceability.test.ts
 * @brief トレーサビリティデータモデルのユーティリティテスト。
 */

import {
  isTraceabilityFile,
  normalizeDirection,
  relationToLinks,
  relationsToLinks,
  type TraceabilityRelation,
} from './traceability';

describe('traceability schema utilities', () => {
  const baseRelation: TraceabilityRelation = {
    id: 'rel-001',
    left_ids: ['card-l1', 'card-l2'],
    right_ids: ['card-r1'],
    type: 'trace',
    directed: 'left_to_right',
  };

  it('accepts valid traceability files with header information', () => {
    const now = new Date().toISOString();
    const file = {
      schemaVersion: 1,
      header: {
        id: 'hdr-001',
        fileName: 'trace_sample.json',
        leftFilePath: '/tmp/left.json',
        rightFilePath: '/tmp/right.json',
        createdAt: now,
        updatedAt: now,
      },
      left_file: 'left.json',
      right_file: 'right.json',
      relations: [baseRelation],
    };

    expect(isTraceabilityFile(file)).toBe(true);
  });

  it('rejects files with malformed relations', () => {
    const invalidFile = {
      schemaVersion: 1,
      left_file: 'left.json',
      right_file: 'right.json',
      relations: [
        {
          id: 'broken',
          left_ids: null,
          right_ids: ['card-r1'],
          type: 'trace',
          directed: 'left_to_right',
        },
      ],
    };

    expect(isTraceabilityFile(invalidFile)).toBe(false);
  });

  it('expands relations into directional links', () => {
    const links = relationToLinks(baseRelation);
    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({
      relationId: 'rel-001',
      direction: 'forward',
    });
  });

  it('swaps orientation when requested', () => {
    const swapped = relationsToLinks([baseRelation], { swapOrientation: true });
    expect(swapped).toHaveLength(2);
    expect(swapped[0].direction).toBe('backward');
    expect(swapped[0].sourceCardId.startsWith('card-l')).toBe(false);
  });

  it('normalizes explicit direction tokens', () => {
    expect(normalizeDirection('left_to_right')).toBe('forward');
    expect(normalizeDirection('right_to_left')).toBe('backward');
    expect(normalizeDirection('bidirectional')).toBe('bidirectional');
  });
});
