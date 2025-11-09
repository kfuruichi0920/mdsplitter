import type { ConverterStrategy } from '@/shared/settings';

import type { ConversionOptions, ConversionResult, NormalizedDocument } from './types';
import { convertWithRuleEngine } from './ruleEngine';
import { getLlmAdapter } from './llmAdapter';

export interface ConversionPipelineOptions extends ConversionOptions {}

export const convertDocument = async (
  document: NormalizedDocument,
  strategy: ConverterStrategy,
  options?: ConversionPipelineOptions,
): Promise<ConversionResult> => {
  if (strategy === 'rule') {
    return { cards: convertWithRuleEngine(document, options), warnings: [] } satisfies ConversionResult;
  }

  const adapter = getLlmAdapter();
  const response = await adapter.convert({ document });
  return {
    cards: response.cards,
    warnings: response.warnings ?? [],
  } satisfies ConversionResult;
};
