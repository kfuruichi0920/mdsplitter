import { convertDocument } from '../pipeline';
import type { NormalizedDocument } from '../types';

describe('conversion pipeline', () => {
  const document: NormalizedDocument = {
    fileName: 'spec.md',
    baseName: 'spec',
    extension: '.md',
    content: '# Heading\n\n本文',
    isMarkdown: true,
  };

  it('emits progress events for rule strategy', async () => {
    const progress: Array<{ phase: string; percent: number }> = [];
    const result = await convertDocument(document, 'rule', {
      onProgress: (event) => progress.push(event),
    });
    expect(result.cards.length).toBeGreaterThan(0);
    expect(progress.length).toBeGreaterThan(0);
    expect(progress.some((event) => event.phase === 'prepare')).toBe(true);
  });

  it('throws when aborted before start', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      convertDocument(document, 'rule', {
        signal: controller.signal,
      }),
    ).rejects.toHaveProperty('name', 'AbortError');
  });
});
