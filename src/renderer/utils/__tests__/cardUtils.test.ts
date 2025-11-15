import type { Card } from '../../store/workspaceStore';
import { calculateCardContentStatistics } from '../cardUtils';

describe('calculateCardContentStatistics', () => {
  it('タイトルと本文の合計文字列を対象に統計を算出する', () => {
    const card: Pick<Card, 'title' | 'body'> = {
      title: 'SPEC-001 要件定義',
      body: '概要\n詳細\n付録',
    };
    const combined = `${card.title}\n${card.body}`;

    const stats = calculateCardContentStatistics(card);

    expect(stats.charCount).toBe(combined.length);
    expect(stats.wordCount).toBeGreaterThan(0);
    expect(stats.lineCount).toBe(4);
  });

  it('空文字列の場合はすべて0となる', () => {
    const stats = calculateCardContentStatistics({ title: '', body: '' });
    expect(stats).toEqual({ charCount: 0, wordCount: 0, lineCount: 0 });
  });

  it('連続した空白を単語区切りとして扱う', () => {
    const card: Pick<Card, 'title' | 'body'> = {
      title: 'alpha   beta',
      body: 'gamma',
    };
    const stats = calculateCardContentStatistics(card);
    expect(stats.wordCount).toBe(3);
  });
});
