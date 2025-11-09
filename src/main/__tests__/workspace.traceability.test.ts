/**
 * @file workspace.traceability.test.ts
 * @brief トレーサビリティファイルの読み書きを検証する統合テスト。
 */

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { app } from 'electron';

import { initializeWorkspace, loadTraceFile, saveTraceFile } from '../workspace';

import type { TraceFileSaveRequest } from '../../shared/traceability';

jest.mock('electron', () => ({
  app: {
    getAppPath: jest.fn(),
  },
}));

describe('workspace traceability persistence', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = path.join(os.tmpdir(), `mdsplitter-trace-${Date.now()}`);
    (app.getAppPath as jest.Mock).mockReturnValue(tempDir);
  });

  beforeEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    await fs.mkdir(tempDir, { recursive: true });
    await initializeWorkspace();
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it('writes trace files and reloads them with hydrated headers', async () => {
    const payload: TraceFileSaveRequest = {
      leftFile: 'left-cards.json',
      rightFile: 'right-cards.json',
      relations: [
        {
          id: 'rel-save-1',
          left_ids: ['card-left-1'],
          right_ids: ['card-right-1'],
          type: 'trace',
          directed: 'left_to_right',
        },
      ],
    };

    const result = await saveTraceFile(payload);
    expect(result.fileName).toMatch(/trace_/);

    const savedPath = path.join(tempDir, '_out', result.fileName);
    await expect(fs.access(savedPath)).resolves.toBeUndefined();

    const loaded = await loadTraceFile('left-cards.json', 'right-cards.json');
    expect(loaded).not.toBeNull();
    expect(loaded?.payload.header?.fileName).toBe(result.fileName);
    expect(loaded?.payload.relations[0].id).toBe('rel-save-1');
  });

  it('locates trace files saved with opposite orientation', async () => {
    await saveTraceFile({
      leftFile: 'right-cards.json',
      rightFile: 'left-cards.json',
      relations: [
        {
          id: 'rel-swap',
          left_ids: ['card-right-1'],
          right_ids: ['card-left-1'],
          type: 'trace',
          directed: 'left_to_right',
        },
      ],
    });

    const loaded = await loadTraceFile('left-cards.json', 'right-cards.json');
    expect(loaded).not.toBeNull();
    expect(loaded?.payload.left_file).toBe('right-cards.json');
    expect(loaded?.payload.right_file).toBe('left-cards.json');
  });
});
