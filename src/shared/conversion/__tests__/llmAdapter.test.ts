import { getLlmAdapter, resetLlmAdapter } from '../llmAdapter';
import type { NormalizedDocument } from '../types';

describe('LLM adapter stub', () => {
  const document: NormalizedDocument = {
    fileName: 'sample.md',
    baseName: 'sample',
    extension: '.md',
    isMarkdown: true,
    content: '# Title\n\n本文',
  };

  afterEach(() => {
    resetLlmAdapter();
  });

  it('produces cards and usage statistics even without provider', async () => {
    const adapter = getLlmAdapter();
    const response = await adapter.convert({ document });
    expect(response.cards).toHaveLength(2);
    expect(response.cards[0].status).toBe('review');
    expect(response.usage?.promptTokens).toBeGreaterThan(0);
    expect(response.warnings?.[0]).toContain('スタブ');
  });

  it('respects abort signals', async () => {
    const adapter = getLlmAdapter();
    const controller = new AbortController();
    const promise = adapter.convert({ document }, controller.signal);
    controller.abort();
    await expect(promise).rejects.toHaveProperty('name', 'AbortError');
  });
});
