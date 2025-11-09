import type { ConverterStrategy } from '@/shared/settings';

import type {
  ConversionOptions,
  ConversionProgressEvent,
  ConversionResult,
  NormalizedDocument,
} from './types';
import { convertWithRuleEngine } from './ruleEngine';
import { getLlmAdapter } from './llmAdapter';

export interface ConversionPipelineOptions extends ConversionOptions {
  signal?: AbortSignal;
  onProgress?: (event: ConversionProgressEvent) => void;
}

const createAbortError = (): Error => {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('The operation was aborted', 'AbortError');
  }
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
};

const ensureNotAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    const reason = signal.reason;
    if (reason instanceof Error) {
      throw reason;
    }
    const error = createAbortError();
    if (reason) {
      (error as any).cause = reason;
    }
    throw error;
  }
};

export const convertDocument = async (
  document: NormalizedDocument,
  strategy: ConverterStrategy,
  options?: ConversionPipelineOptions,
): Promise<ConversionResult> => {
  const signal = options?.signal;
  const emitProgress = (event: ConversionProgressEvent) => options?.onProgress?.(event);
  ensureNotAborted(signal);
  emitProgress({ phase: 'prepare', percent: 5 });

  if (strategy === 'rule') {
    ensureNotAborted(signal);
    emitProgress({ phase: 'convert', percent: 40 });
    const cards = convertWithRuleEngine(document, options);
    emitProgress({ phase: 'complete', percent: 75 });
    return { cards, warnings: [] } satisfies ConversionResult;
  }

  const adapter = getLlmAdapter();
  ensureNotAborted(signal);
  emitProgress({ phase: 'convert', percent: 45 });
  const response = await adapter.convert({ document }, signal);
  emitProgress({ phase: 'complete', percent: 75 });
  return {
    cards: response.cards,
    warnings: response.warnings ?? [],
  } satisfies ConversionResult;
};
