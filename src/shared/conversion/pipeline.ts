import type { ConverterStrategy } from '@/shared/settings';

import type {
  ConversionOptions,
  ConversionProgressEvent,
  ConversionResult,
  NormalizedDocument,
} from './types';
import { convertWithRuleEngine } from './ruleEngine';
import { getLlmAdapter } from './llmAdapter';

export type CardIdAssignmentRule = 'all' | 'heading' | 'manual';

export interface CardIdOptions {
  prefix: string;              ///< 接頭語（例: REQ, SPEC, TEST）
  startNumber: number;         ///< 開始番号（デフォルト: 1）
  digits: number;              ///< 桁数（ゼロパディング、デフォルト: 3）
  assignmentRule: CardIdAssignmentRule; ///< 付与ルール
}

export interface ConversionPipelineOptions extends ConversionOptions {
  signal?: AbortSignal;
  onProgress?: (event: ConversionProgressEvent) => void;
  cardIdOptions?: CardIdOptions; ///< カードID自動付与設定
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

/**
 * @brief カードIDを生成する。
 * @param prefix 接頭語（例: REQ, SPEC, TEST）
 * @param number 番号
 * @param digits 桁数（ゼロパディング）
 * @return カードID（例: REQ-001, SPEC-042）
 */
const generateCardId = (prefix: string, number: number, digits: number): string => {
  if (!prefix) {
    return String(number).padStart(digits, '0');
  }
  return `${prefix}-${String(number).padStart(digits, '0')}`;
};

/**
 * @brief カード配列にIDを自動付与する。
 * @param cards カード配列
 * @param options ID設定オプション
 * @return ID付与後のカード配列
 */
const assignCardIds = <T extends { kind?: string; cardId?: string }>(
  cards: T[],
  options: CardIdOptions,
): T[] => {
  const { prefix, startNumber, digits, assignmentRule } = options;

  // 手動指定のみの場合、かつ接頭語が空の場合は何もしない
  // （接頭語が設定されている場合は、IDを付与したい意図があると推測）
  if (assignmentRule === 'manual' && !prefix) {
    return cards;
  }

  let currentNumber = startNumber;

  return cards.map((card) => {
    // 既にcardIdが設定されている場合はスキップ
    if (card.cardId) {
      return card;
    }

    // 見出しのみの場合は見出しカードのみ付与
    if (assignmentRule === 'heading' && card.kind !== 'heading') {
      return card;
    }

    // IDを生成して付与
    const cardId = generateCardId(prefix, currentNumber, digits);
    currentNumber++;

    return { ...card, cardId };
  });
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

  let cards;
  let warnings: string[] = [];

  if (strategy === 'rule') {
    ensureNotAborted(signal);
    emitProgress({ phase: 'convert', percent: 40 });
    cards = convertWithRuleEngine(document, options);
    emitProgress({ phase: 'convert', percent: 65 });
  } else {
    const adapter = getLlmAdapter();
    ensureNotAborted(signal);
    emitProgress({ phase: 'convert', percent: 45 });
    const response = await adapter.convert({ document }, signal);
    cards = response.cards;
    warnings = response.warnings ?? [];
    emitProgress({ phase: 'convert', percent: 65 });
  }

  // カードID自動付与処理
  // assignCardIds関数内で付与ルールと接頭語のチェックを行う
  if (options?.cardIdOptions) {
    ensureNotAborted(signal);
    emitProgress({ phase: 'convert', percent: 70 });
    cards = assignCardIds(cards, options.cardIdOptions);
  }

  emitProgress({ phase: 'complete', percent: 75 });
  return {
    cards,
    warnings,
  } satisfies ConversionResult;
};
