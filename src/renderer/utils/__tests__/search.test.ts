import { runSearch, type SearchDataset, type SearchRequest } from '../search';
import type { Card } from '@/shared/workspace';

const createCard = (partial: Partial<Card>): Card => ({
  id: partial.id ?? 'card-x',
  cardId: partial.cardId,
  title: partial.title ?? '',
  body: partial.body ?? '',
  status: partial.status ?? 'draft',
  kind: partial.kind ?? 'paragraph',
  hasLeftTrace: partial.hasLeftTrace ?? false,
  hasRightTrace: partial.hasRightTrace ?? false,
  markdownPreviewEnabled: partial.markdownPreviewEnabled ?? true,
  createdAt: partial.createdAt,
  updatedAt: partial.updatedAt ?? new Date().toISOString(),
  parent_id: partial.parent_id ?? null,
  child_ids: partial.child_ids ?? [],
  prev_id: partial.prev_id ?? null,
  next_id: partial.next_id ?? null,
  level: partial.level ?? 0,
});

const sampleDataset: SearchDataset[] = [
  {
    source: 'open',
    fileName: 'spec.json',
    tabId: 'tab-1',
    leafId: 'leaf-1',
    cards: [
      createCard({
        id: 'c1',
        cardId: 'REQ-001',
        title: 'プロジェクト概要',
        body: 'システム全体の概要と目的を記載する。',
        status: 'approved',
        kind: 'heading',
      }),
      createCard({
        id: 'c2',
        cardId: 'REQ-002',
        title: '詳細設計',
        body: '検索ダイアログの要件を整理する。',
        status: 'review',
        kind: 'paragraph',
      }),
      createCard({
        id: 'c3',
        cardId: 'DES-010',
        title: 'UI スケッチ',
        body: '検索結果タブとハイライト表示。',
        status: 'draft',
        kind: 'bullet',
      }),
    ],
  },
];

describe('runSearch', () => {
  it('matches title/body by text mode', async () => {
    const request: SearchRequest = { id: 's1', scope: 'open', mode: 'text', text: '概要' };
    const { results } = await runSearch(request, sampleDataset);
    expect(results).toHaveLength(1);
    expect(results[0].cardId).toBe('c1');
    expect(results[0].matchCount).toBeGreaterThan(0);
  });

  it('matches by cardId in id mode', async () => {
    const request: SearchRequest = { id: 's2', scope: 'open', mode: 'id', text: 'REQ-002' };
    const { results } = await runSearch(request, sampleDataset);
    expect(results.map((r) => r.cardId)).toContain('c2');
  });

  it('evaluates advanced AND/OR conditions', async () => {
    const request: SearchRequest = {
      id: 's3',
      scope: 'open',
      mode: 'advanced',
      advanced: {
        combinator: 'AND',
        conditions: [
          { field: 'status', operator: 'equals', value: 'approved' },
          { field: 'kind', operator: 'equals', value: 'heading' },
        ],
      },
    };
    const { results } = await runSearch(request, sampleDataset);
    expect(results).toHaveLength(1);
    expect(results[0].cardId).toBe('c1');

    const orRequest: SearchRequest = {
      ...request,
      id: 's3-or',
      advanced: {
        combinator: 'OR',
        conditions: [
          { field: 'status', operator: 'equals', value: 'review' },
          { field: 'cardId', operator: 'regex', value: '^DES' },
        ],
      },
    };
    const { results: orResults } = await runSearch(orRequest, sampleDataset);
    expect(orResults.map((r) => r.cardId)).toEqual(expect.arrayContaining(['c2', 'c3']));
  });

  it('executes trace search using traceResolver and depth', async () => {
    const traceResolver = jest.fn(async (seeds, depth) => {
      expect(depth).toBe(2);
      expect(seeds).toEqual([{ fileName: 'spec.json', cardId: 'REQ-001' }]);
      return { 'spec.json': new Set<string>(['REQ-002']) };
    });

    const request: SearchRequest = {
      id: 's4',
      scope: 'open',
      mode: 'trace',
      text: 'REQ-001',
      trace: { depth: 2 },
    };

    const { results } = await runSearch(request, sampleDataset, { traceResolver });
    expect(results.map((r) => r.cardId)).toContain('c2');
    expect(traceResolver).toHaveBeenCalledTimes(1);
  });
});
