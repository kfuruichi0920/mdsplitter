import type { Card } from '../../store/workspaceStore';
import { calculateCardContentStatistics, truncateCardTitle, DEFAULT_MAX_TITLE_LENGTH } from '../cardUtils';

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

describe('truncateCardTitle', () => {
  it('最大文字数以下のタイトルはそのまま返す', () => {
    const shortTitle = '短いタイトル';
    expect(truncateCardTitle(shortTitle, 20)).toBe(shortTitle);
    expect(truncateCardTitle(shortTitle)).toBe(shortTitle);
  });

  it('最大文字数を超えるタイトルは切り捨てて末尾に…を付ける', () => {
    const longTitle = 'これは非常に長いタイトルでありカードタイトルの最大文字数を超えることを期待しています';
    const truncated = truncateCardTitle(longTitle, 20);
    expect(truncated.length).toBe(20);
    expect(truncated).toMatch(/…$/);
    // 20文字のうち、末尾1文字が…なので、元の文字列の最初の19文字 + …
    expect(truncated.substring(0, 19)).toBe(longTitle.substring(0, 19));
  });

  it('デフォルトの最大文字数（20文字）を使用する', () => {
    const longTitle = 'A'.repeat(100);
    const truncated = truncateCardTitle(longTitle);
    expect(truncated.length).toBe(DEFAULT_MAX_TITLE_LENGTH);
    expect(truncated.length).toBe(20);
    expect(truncated).toMatch(/…$/);
  });

  it('カスタムの最大文字数を適用する', () => {
    const title = '1234567890abcdefghij';
    const truncated = truncateCardTitle(title, 10);
    expect(truncated.length).toBe(10);
    expect(truncated).toBe('123456789…');
  });

  it('ちょうど最大文字数のタイトルはそのまま返す', () => {
    const exactTitle = 'A'.repeat(20);
    expect(truncateCardTitle(exactTitle, 20)).toBe(exactTitle);
  });
});
