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
 * @brief カード本文の統計情報。
 */
export interface CardContentStatistics {
  charCount: number;
  wordCount: number;
  lineCount: number;
}

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
