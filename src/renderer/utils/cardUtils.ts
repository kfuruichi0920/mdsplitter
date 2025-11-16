/**
 * @file cardUtils.ts
 * @brief カードパネルユーティリティ関数。
 * @details
 * カード関連の計算処理を提供する。
 * @author K.Furuichi
 * @date 2025-11-15
 * @version 0.1
 * @copyright MIT
 */

import type { Card } from '../store/workspaceStore';

/**
 * @brief カードタイトルのデフォルト最大文字数。
 */
export const DEFAULT_MAX_TITLE_LENGTH = 20;

/**
 * @brief カード本文の統計情報。
 */
export interface CardContentStatistics {
  charCount: number;
  wordCount: number;
  lineCount: number;
}

/**
 * @brief カードタイトルを最大文字数で切り捨てる。
 * @param title 元のタイトル
 * @param maxLength 最大文字数（デフォルト: 40）
 * @return 切り捨て後のタイトル（最大文字数を超える場合は末尾に…を付与）
 */
export const truncateCardTitle = (title: string, maxLength: number = DEFAULT_MAX_TITLE_LENGTH): string => {
  if (title.length <= maxLength) {
    return title;
  }
  return `${title.slice(0, maxLength - 1)}…`;
};

/**
 * @brief 未トレースカード数を計算する。
 * @param cards カードリスト。
 * @param side トレース方向（左/右）。
 * @return 未トレースカード数。
 */
export const countUntracedCards = (cards: Card[], side: 'left' | 'right'): number => {
  return cards.filter((card) => {
    const hasTrace = side === 'left' ? card.hasLeftTrace : card.hasRightTrace;
    return !hasTrace && card.status !== 'deprecated';
  }).length;
};

/**
 * @brief カードの文字数・単語数などを計算する。
 * @param card 対象カード（タイトル/本文）。
 * @return 統計情報。
 */
export const calculateCardContentStatistics = (card: Pick<Card, 'title' | 'body'>): CardContentStatistics => {
  const segments = [] as string[];
  if (card.title) {
    segments.push(card.title);
  }
  if (card.body) {
    segments.push(card.body);
  }
  const text = segments.join('\n').trim();
  if (!text) {
    return { charCount: 0, wordCount: 0, lineCount: 0 };
  }
  const charCount = text.length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const lineCount = text.split(/\r?\n/).length;
  return { charCount, wordCount, lineCount };
};
