import { convertWithRuleEngine } from '../ruleEngine';
import type { NormalizedDocument } from '../types';

describe('convertWithRuleEngine', () => {
  const markdownDoc: NormalizedDocument = {
    fileName: 'spec.md',
    baseName: 'spec',
    extension: '.md',
    isMarkdown: true,
    content: `# 1. システム概要\n\n本システムは顧客向けに提供される。\n\n## 1.1 機能一覧\n- 認証\n- 検索\n\n### 1.1.1 認証フロー\nユーザはID/パスワードでログインする。\n\n## 1.2 制約\n1.2.1 データ保持\n保存期間は90日とする。\n`,
  };

  it('generates stable hierarchy for markdown documents', () => {
    const cards = convertWithRuleEngine(markdownDoc, { now: new Date('2025-11-09T00:00:00Z') });
    expect(cards).toMatchSnapshot();
  });

  it('parses numbered headings for plain text documents', () => {
    const plainDoc: NormalizedDocument = {
      fileName: 'spec.txt',
      baseName: 'spec',
      extension: '.txt',
      isMarkdown: false,
      content: `1. 目的\n本仕様は～\n\n1.1 背景\nテキスト。\n\n- 箇条書き\n`,
    };
    const cards = convertWithRuleEngine(plainDoc, { now: new Date('2025-11-09T00:00:00Z') });
    const root = cards.find((card) => card.title.includes('目的'));
    const childHeading = cards.find((card) => card.title.includes('背景'));
    const bullet = cards.find((card) => card.title.includes('箇条書き'));

    expect(root?.level).toBe(0);
    expect(childHeading?.parent_id).toBe(root?.id);
    expect(childHeading?.level).toBe(1);
    expect(bullet?.parent_id).toBe(childHeading?.id);
    expect(bullet?.level).toBe(2);
  });

  it('truncates long titles according to maxTitleLength setting', () => {
    const longTitleDoc: NormalizedDocument = {
      fileName: 'long.md',
      baseName: 'long',
      extension: '.md',
      isMarkdown: true,
      content: `# これは非常に長いタイトルでありカードタイトルの最大文字数を超えることを期待しています\n\n段落の内容も非常に長い文章であってカードタイトルとして保持する場合は最大文字数で切り捨てられることを期待します。\n`,
    };

    // デフォルト（20文字）でテスト
    const cardsDefault = convertWithRuleEngine(longTitleDoc, {
      now: new Date('2025-11-09T00:00:00Z'),
    });
    const headingCard = cardsDefault.find((card) => card.kind === 'heading');
    const paragraphCard = cardsDefault.find((card) => card.kind === 'paragraph');

    expect(headingCard?.title.length).toBeLessThanOrEqual(20);
    expect(headingCard?.title).toMatch(/…$/); // 末尾に…が付く
    expect(paragraphCard?.title.length).toBeLessThanOrEqual(20);
    expect(paragraphCard?.title).toMatch(/…$/);

    // カスタム値（40文字）でテスト
    const cardsCustom = convertWithRuleEngine(longTitleDoc, {
      now: new Date('2025-11-09T00:00:00Z'),
      maxTitleLength: 40,
    });
    const headingCardCustom = cardsCustom.find((card) => card.kind === 'heading');
    const paragraphCardCustom = cardsCustom.find((card) => card.kind === 'paragraph');

    expect(headingCardCustom?.title.length).toBeLessThanOrEqual(40);
    expect(headingCardCustom?.title).toMatch(/…$/);
    expect(paragraphCardCustom?.title.length).toBeLessThanOrEqual(40);
    expect(paragraphCardCustom?.title).toMatch(/…$/);
  });
});
