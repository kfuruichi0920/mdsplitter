/**
 * @file CardPanel.untraced.test.ts
 * @brief CardPanelの未トレースカード数表示機能のテスト。
 * @details
 * 未トレースカードのカウント機能とフィルタ機能を検証する。
 */

import { countUntracedCards } from '../../utils/cardUtils';
import type { Card } from '../../store/workspaceStore';

describe('CardPanel - Untraced Card Count', () => {
  /**
   * @brief テスト用カードデータを作成する。
   */
  const createTestCard = (overrides: Partial<Card> = {}): Card => ({
    id: 'test-card',
    title: 'テストカード',
    body: 'テスト本文',
    status: 'draft',
    kind: 'paragraph',
    hasLeftTrace: false,
    hasRightTrace: false,
    markdownPreviewEnabled: true,
    updatedAt: new Date().toISOString(),
    parent_id: null,
    child_ids: [],
    prev_id: null,
    next_id: null,
    level: 0,
    ...overrides,
  });

  describe('countUntracedCards', () => {
    it('左側の未トレースカードを正しくカウントする', () => {
      const cards: Card[] = [
        createTestCard({ id: 'card-1', hasLeftTrace: false, hasRightTrace: true }),
        createTestCard({ id: 'card-2', hasLeftTrace: true, hasRightTrace: false }),
        createTestCard({ id: 'card-3', hasLeftTrace: false, hasRightTrace: false }),
      ];

      const count = countUntracedCards(cards, 'left');
      expect(count).toBe(2); // card-1 and card-3
    });

    it('右側の未トレースカードを正しくカウントする', () => {
      const cards: Card[] = [
        createTestCard({ id: 'card-1', hasLeftTrace: false, hasRightTrace: true }),
        createTestCard({ id: 'card-2', hasLeftTrace: true, hasRightTrace: false }),
        createTestCard({ id: 'card-3', hasLeftTrace: false, hasRightTrace: false }),
      ];

      const count = countUntracedCards(cards, 'right');
      expect(count).toBe(2); // card-2 and card-3
    });

    it('廃止カードは未トレースカウントから除外される', () => {
      const cards: Card[] = [
        createTestCard({ id: 'card-1', hasLeftTrace: false, status: 'draft' }),
        createTestCard({ id: 'card-2', hasLeftTrace: false, status: 'deprecated' }),
        createTestCard({ id: 'card-3', hasLeftTrace: false, status: 'review' }),
      ];

      const count = countUntracedCards(cards, 'left');
      expect(count).toBe(2); // card-1 and card-3, excluding deprecated card-2
    });

    it('全てのカードにトレースがある場合は0を返す', () => {
      const cards: Card[] = [
        createTestCard({ id: 'card-1', hasLeftTrace: true, hasRightTrace: true }),
        createTestCard({ id: 'card-2', hasLeftTrace: true, hasRightTrace: true }),
      ];

      expect(countUntracedCards(cards, 'left')).toBe(0);
      expect(countUntracedCards(cards, 'right')).toBe(0);
    });

    it('空の配列に対しては0を返す', () => {
      const cards: Card[] = [];

      expect(countUntracedCards(cards, 'left')).toBe(0);
      expect(countUntracedCards(cards, 'right')).toBe(0);
    });

    it('廃止カードのみの場合は0を返す', () => {
      const cards: Card[] = [
        createTestCard({ id: 'card-1', hasLeftTrace: false, status: 'deprecated' }),
        createTestCard({ id: 'card-2', hasRightTrace: false, status: 'deprecated' }),
      ];

      expect(countUntracedCards(cards, 'left')).toBe(0);
      expect(countUntracedCards(cards, 'right')).toBe(0);
    });

    it('複数のステータスが混在する場合、廃止以外の未トレースカードをカウントする', () => {
      const cards: Card[] = [
        createTestCard({ id: 'card-1', hasLeftTrace: false, status: 'draft' }),
        createTestCard({ id: 'card-2', hasLeftTrace: false, status: 'review' }),
        createTestCard({ id: 'card-3', hasLeftTrace: false, status: 'approved' }),
        createTestCard({ id: 'card-4', hasLeftTrace: false, status: 'deprecated' }),
        createTestCard({ id: 'card-5', hasLeftTrace: true, status: 'draft' }),
      ];

      const count = countUntracedCards(cards, 'left');
      expect(count).toBe(3); // card-1, card-2, card-3 (excluding deprecated card-4 and traced card-5)
    });
  });
});
