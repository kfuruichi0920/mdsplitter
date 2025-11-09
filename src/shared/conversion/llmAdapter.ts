import type { LlmProvider } from '@/shared/settings';
import type { Card } from '@/shared/workspace';

import type { NormalizedDocument } from './types';
import { convertWithRuleEngine } from './ruleEngine';

export interface LlmConversionUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface LlmConversionRequest {
  document: NormalizedDocument;
  temperature?: number;
  maxDepth?: number;
}

export interface LlmConversionResponse {
  cards: Card[];
  usage?: LlmConversionUsage;
  warnings?: string[];
}

export interface LlmAdapter {
  provider: LlmProvider;
  convert: (request: LlmConversionRequest, signal?: AbortSignal) => Promise<LlmConversionResponse>;
}

class StubLlmAdapter implements LlmAdapter {
  public provider: LlmProvider = 'none';

  async convert(request: LlmConversionRequest, signal?: AbortSignal): Promise<LlmConversionResponse> {
    const ensureNotAborted = () => {
      if (signal?.aborted) {
        const reason = signal.reason;
        if (reason instanceof Error) {
          throw reason;
        }
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        throw error;
      }
    };

    ensureNotAborted();
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 20);
      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timeout);
            resolve();
          },
          { once: true },
        );
      }
    });
    ensureNotAborted();

    const cards = convertWithRuleEngine(request.document, { now: new Date() }).map((card): Card => ({
      ...card,
      status: 'review',
    }));

    const promptTokens = Math.max(1, Math.round(request.document.content.length / 4));
    const completionTokens = cards.length * 32;

    return {
      cards,
      usage: { promptTokens, completionTokens },
      warnings: ['LLMスタブ: 実際のAPI呼び出しは行われていません。'],
    } satisfies LlmConversionResponse;
  }
}

let activeAdapter: LlmAdapter = new StubLlmAdapter();

export const setLlmAdapter = (adapter: LlmAdapter): void => {
  activeAdapter = adapter;
};

export const getLlmAdapter = (): LlmAdapter => activeAdapter;

export const resetLlmAdapter = (): void => {
  activeAdapter = new StubLlmAdapter();
};
