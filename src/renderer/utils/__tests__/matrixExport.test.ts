import { describe, expect, it } from '@jest/globals';

import type { Card } from '@/shared/workspace';
import type { TraceabilityRelation } from '@/shared/traceability';
import { exportMatrixToCSV, exportMatrixToExcel } from '../matrixExport';

const cardsLeft: Card[] = [
  {
    id: 'L1',
    title: 'Left 1',
    body: '',
    status: 'draft',
    kind: 'heading',
    hasLeftTrace: false,
    hasRightTrace: false,
    markdownPreviewEnabled: true,
    updatedAt: '2025-11-15T00:00:00.000Z',
    parent_id: null,
    child_ids: [],
    prev_id: null,
    next_id: null,
    level: 0,
  },
];

const cardsRight: Card[] = [
  {
    id: 'R1',
    title: 'Right 1',
    body: '',
    status: 'draft',
    kind: 'heading',
    hasLeftTrace: false,
    hasRightTrace: false,
    markdownPreviewEnabled: true,
    updatedAt: '2025-11-15T00:00:00.000Z',
    parent_id: null,
    child_ids: [],
    prev_id: null,
    next_id: null,
    level: 0,
  },
];

const relations: TraceabilityRelation[] = [
  {
    id: 'rel-1',
    left_ids: ['L1'],
    right_ids: ['R1'],
    type: 'trace',
    directed: 'left_to_right',
  },
];

describe('matrixExport', () => {
  it('produces CSV text', () => {
    const csv = exportMatrixToCSV(cardsLeft, cardsRight, relations);
    expect(csv).toContain('L1');
    expect(csv).toContain('R1');
    expect(csv.endsWith('●')).toBe(true);
  });

  it('produces base64 Excel workbook', () => {
    const base64 = exportMatrixToExcel(cardsLeft, cardsRight, relations);
    expect(typeof base64).toBe('string');
    expect(base64.length).toBeGreaterThan(10);
  });
});
