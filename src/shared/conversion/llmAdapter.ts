/**
 * @file llmAdapter.ts
 * @brief LLMベースのドキュメント変換アダプター。
 * @details
 * LLM API（将来の拡張ポイント）へのインターフェースを定義し、スタブ実装を提供。
 * 現在はruleEngineにフォールバック。AbortSignal対応により中断可能。
 * 例:
 * @code
 * const adapter = getLlmAdapter();
 * const response = await adapter.convert({ document: doc }, signal);
 * @endcode
 * @author K.Furuichi
 * @date 2025-11-16
 * @version 0.1
 * @copyright MIT
 * @see ruleEngine.ts, pipeline.ts
 * @todo 実際のLLM API統合（OpenAI、Anthropic等）。
 */

import type { LlmProvider } from '@/shared/settings';
import type { Card } from '@/shared/workspace';

import type { NormalizedDocument } from './types';
import { convertWithRuleEngine } from './ruleEngine';

/**
 * @brief LLM変換のトークン使用量。
 */
export interface LlmConversionUsage {
  promptTokens: number; ///< プロンプトトークン数。
  completionTokens: number; ///< 補完トークン数。
}

/**
 * @brief LLM変換リクエスト。
 */
export interface LlmConversionRequest {
  document: NormalizedDocument; ///< 変換対象ドキュメント。
  temperature?: number; ///< サンプリング温度（任意、将来の拡張）。
  maxDepth?: number; ///< 最大階層深度（任意、将来の拡張）。
}

/**
 * @brief LLM変換レスポンス。
 */
export interface LlmConversionResponse {
  cards: Card[]; ///< 変換結果のカード配列。
  usage?: LlmConversionUsage; ///< トークン使用量（任意）。
  warnings?: string[]; ///< 警告メッセージ配列（任意）。
}

/**
 * @brief LLMアダプターインターフェース。
 * @details
 * LLMプロバイダー種別と変換メソッドを定義。
 */
export interface LlmAdapter {
  provider: LlmProvider; ///< LLMプロバイダー種別。
  convert: (request: LlmConversionRequest, signal?: AbortSignal) => Promise<LlmConversionResponse>; ///< 変換メソッド。
}

/**
 * @brief スタブLLMアダプター（開発・テスト用）。
 * @details
 * 実際のLLM APIを呼ばず、ruleEngineで変換してスタブレスポンスを返す。
 * AbortSignal対応により中断可能。
 */
class StubLlmAdapter implements LlmAdapter {
  public provider: LlmProvider = 'none';

  /**
   * @brief ドキュメントをカード配列に変換（スタブ実装）。
   * @details
   * ruleEngineにフォールバックし、ダミートークン使用量を算出。
   * @param request 変換リクエスト。
   * @param signal 中断シグナル（任意）。
   * @return 変換レスポンス（警告付き）。
   * @throws AbortError シグナルが中断された場合。
   */
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

let activeAdapter: LlmAdapter = new StubLlmAdapter(); ///< 現在アクティブなアダプター。

/**
 * @brief アクティブなLLMアダプターを設定。
 * @param adapter 新しいアダプター。
 * @note グローバル状態を変更（副作用）。
 */
export const setLlmAdapter = (adapter: LlmAdapter): void => {
  activeAdapter = adapter;
};

/**
 * @brief 現在アクティブなLLMアダプターを取得。
 * @return アクティブなアダプター。
 */
export const getLlmAdapter = (): LlmAdapter => activeAdapter;

/**
 * @brief アダプターをデフォルト（スタブ）にリセット。
 * @note グローバル状態を変更（副作用）。
 */
export const resetLlmAdapter = (): void => {
  activeAdapter = new StubLlmAdapter();
};
