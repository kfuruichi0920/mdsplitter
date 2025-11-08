import { act } from '@testing-library/react';
import { useTraceStore, resetTraceStore } from '../traceStore';

describe('traceStore.saveRelationsForPair', () => {
  beforeEach(() => {
    resetTraceStore();
    window.app = {
      workspace: {
        saveTraceFile: jest.fn().mockResolvedValue({
          fileName: 'trace_left__right.json',
          savedPath: '/tmp/trace_left__right.json',
          savedAt: new Date().toISOString(),
          header: {
            id: 'hdr',
            fileName: 'trace_left__right.json',
            leftFilePath: '/tmp/left.json',
            rightFilePath: '/tmp/right.json',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      },
    } as unknown as typeof window.app;
  });

  it('persists relations and refreshes the cache entry', async () => {
    await act(async () => {
      const entry = await useTraceStore.getState().saveRelationsForPair({
        leftFile: 'left.json',
        rightFile: 'right.json',
        relations: [
          {
            id: 'rel-test',
            left_ids: ['card-l'],
            right_ids: ['card-r'],
            type: 'trace',
            directed: 'left_to_right',
          },
        ],
      });

      expect(entry.leftFile).toBe('left.json');
      expect(entry.rightFile).toBe('right.json');
      expect(entry.relations).toHaveLength(1);
      expect(entry.counts.left['card-l']).toBe(1);
      expect(entry.counts.right['card-r']).toBe(1);
      expect(window.app.workspace.saveTraceFile).toHaveBeenCalledWith({
        fileName: undefined,
        header: undefined,
        leftFile: 'left.json',
        rightFile: 'right.json',
        relations: entry.relations,
      });
    });

    const cached = useTraceStore.getState().getCached('left.json', 'right.json');
    expect(cached?.relations).toHaveLength(1);
    expect(cached?.links).toHaveLength(1);
    expect(cached?.counts.left['card-l']).toBe(1);
    expect(cached?.counts.right['card-r']).toBe(1);

    const leftFileCounts = useTraceStore.getState().getCountsForFile('left.json');
    expect(leftFileCounts.right['card-l']).toBe(1);
    const rightFileCounts = useTraceStore.getState().getCountsForFile('right.json');
    expect(rightFileCounts.left['card-r']).toBe(1);
  });
});
