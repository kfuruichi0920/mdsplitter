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
