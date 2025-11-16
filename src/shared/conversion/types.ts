/**
 * @file types.ts
 * @brief ドキュメント変換に関連する型定義集。
 * @details
 * 正規化ドキュメント、変換オプション、変換結果、進捗イベント等の型を定義。
 * 変換パイプライン全体で共有される基本型。
 * @author K.Furuichi
 * @date 2025-11-16
 * @version 0.1
 * @copyright MIT
 * @see pipeline.ts, ruleEngine.ts, llmAdapter.ts
 */

import type { ConverterStrategy } from '@/shared/settings';
import type { Card } from '@/shared/workspace';

/**
 * @brief 正規化済みドキュメント。
 * @details
 * 変換処理に必要なファイル名、拡張子、内容、Markdown判定を保持。
 */
export interface NormalizedDocument {
  fileName: string; ///< ファイル名（例: spec.md）。
  baseName: string; ///< 拡張子なしベース名（例: spec）。
  extension: string; ///< 拡張子（例: .md）。
  content: string; ///< ドキュメント本文。
  isMarkdown: boolean; ///< Markdown判定フラグ。
}

/**
 * @brief 変換オプション。
 * @details
 * タイムスタンプ、タイトル最大長等を指定。
 */
export interface ConversionOptions {
  now?: Date; ///< タイムスタンプ（省略時は現在時刻）。
  maxTitleLength?: number; ///< カードタイトルの最大文字数（デフォルト20）。
}

/**
 * @brief 変換結果。
 * @details
 * 生成されたカード配列と警告メッセージを保持。
 */
export interface ConversionResult {
  cards: Card[]; ///< 変換結果のカード配列。
  warnings: string[]; ///< 警告メッセージ配列。
}

/**
 * @brief 変換戦略種別（ルールベース/LLMベース）。
 */
export type ConversionStrategy = ConverterStrategy;

/**
 * @brief 変換進捗イベント。
 * @details
 * フェーズと進捗率を通知。
 */
export interface ConversionProgressEvent {
  phase: 'prepare' | 'convert' | 'complete'; ///< 変換フェーズ。
  percent: number; ///< 進捗率（0～100）。
}
