/**
 * @file markdown.test.ts
 * @brief Markdownレンダラーのテスト
 */

import { renderMarkdownToHtml } from '../markdown';

describe('renderMarkdownToHtml', () => {
  describe('基本的なMarkdown構文', () => {
    it('見出しをレンダリングできる', () => {
      const result = renderMarkdownToHtml('# Header 1');
      expect(result).toBe('<h1>Header 1</h1>');
    });

    it('段落をレンダリングできる', () => {
      const result = renderMarkdownToHtml('This is a paragraph.');
      expect(result).toBe('<p>This is a paragraph.</p>');
    });

    it('リストをレンダリングできる', () => {
      const markdown = '- Item 1\n- Item 2';
      const result = renderMarkdownToHtml(markdown);
      expect(result).toBe('<ul><li>Item 1</li><li>Item 2</li></ul>');
    });

    it('コードブロックをレンダリングできる', () => {
      const markdown = '```\ncode line 1\ncode line 2\n```';
      const result = renderMarkdownToHtml(markdown);
      expect(result).toBe('<pre><code>code line 1\ncode line 2</code></pre>');
    });
  });

  describe('Markdownテーブル', () => {
    it('基本的なテーブルをレンダリングできる', () => {
      const markdown = [
        '| Header 1 | Header 2 |',
        '|----------|----------|',
        '| Cell 1   | Cell 2   |',
        '| Cell 3   | Cell 4   |'
      ].join('\n');
      
      const result = renderMarkdownToHtml(markdown);
      
      expect(result).toContain('<table class="markdown-table">');
      expect(result).toContain('<thead>');
      expect(result).toContain('<th>Header 1</th>');
      expect(result).toContain('<th>Header 2</th>');
      expect(result).toContain('</thead>');
      expect(result).toContain('<tbody>');
      expect(result).toContain('<td>Cell 1</td>');
      expect(result).toContain('<td>Cell 2</td>');
      expect(result).toContain('<td>Cell 3</td>');
      expect(result).toContain('<td>Cell 4</td>');
      expect(result).toContain('</tbody>');
      expect(result).toContain('</table>');
    });

    it('左寄せアライメントを適用できる', () => {
      const markdown = [
        '| Header 1 | Header 2 |',
        '|:---------|:---------|',
        '| Left 1   | Left 2   |'
      ].join('\n');
      
      const result = renderMarkdownToHtml(markdown);
      
      // 左寄せの場合はstyle属性が付かない（デフォルト）
      expect(result).toContain('<th>Header 1</th>');
      expect(result).toContain('<td>Left 1</td>');
    });

    it('中央寄せアライメントを適用できる', () => {
      const markdown = [
        '| Header 1 | Header 2 |',
        '|:--------:|:--------:|',
        '| Center 1 | Center 2 |'
      ].join('\n');
      
      const result = renderMarkdownToHtml(markdown);
      
      expect(result).toContain('<th style="text-align: center">Header 1</th>');
      expect(result).toContain('<th style="text-align: center">Header 2</th>');
      expect(result).toContain('<td style="text-align: center">Center 1</td>');
      expect(result).toContain('<td style="text-align: center">Center 2</td>');
    });

    it('右寄せアライメントを適用できる', () => {
      const markdown = [
        '| Header 1 | Header 2 |',
        '|---------:|---------:|',
        '| Right 1  | Right 2  |'
      ].join('\n');
      
      const result = renderMarkdownToHtml(markdown);
      
      expect(result).toContain('<th style="text-align: right">Header 1</th>');
      expect(result).toContain('<th style="text-align: right">Header 2</th>');
      expect(result).toContain('<td style="text-align: right">Right 1</td>');
      expect(result).toContain('<td style="text-align: right">Right 2</td>');
    });

    it('混合アライメントを適用できる', () => {
      const markdown = [
        '| Left | Center | Right |',
        '|:-----|:------:|------:|',
        '| L    | C      | R     |'
      ].join('\n');
      
      const result = renderMarkdownToHtml(markdown);
      
      // 1列目: 左寄せ（デフォルト）
      expect(result).toContain('<th>Left</th>');
      expect(result).toContain('<td>L</td>');
      
      // 2列目: 中央寄せ
      expect(result).toContain('<th style="text-align: center">Center</th>');
      expect(result).toContain('<td style="text-align: center">C</td>');
      
      // 3列目: 右寄せ
      expect(result).toContain('<th style="text-align: right">Right</th>');
      expect(result).toContain('<td style="text-align: right">R</td>');
    });

    it('テーブル内のインライン記法をレンダリングできる', () => {
      const markdown = [
        '| **Bold** | *Italic* | `Code` |',
        '|----------|----------|--------|',
        '| ~~Del~~  | __Bold__ | _Ital_ |'
      ].join('\n');
      
      const result = renderMarkdownToHtml(markdown);
      
      expect(result).toContain('<strong>Bold</strong>');
      expect(result).toContain('<em>Italic</em>');
      expect(result).toContain('<code>Code</code>');
      expect(result).toContain('<del>Del</del>');
    });

    it('テーブルの前後に他のコンテンツがある場合も正しく処理できる', () => {
      const markdown = [
        '段落1',
        '',
        '| Header |',
        '|--------|',
        '| Cell   |',
        '',
        '段落2'
      ].join('\n');
      
      const result = renderMarkdownToHtml(markdown);
      
      expect(result).toContain('<p>段落1</p>');
      expect(result).toContain('<table class="markdown-table">');
      expect(result).toContain('<p>段落2</p>');
    });

    it('空のセルを含むテーブルを処理できる', () => {
      const markdown = [
        '| Header 1 | Header 2 |',
        '|----------|----------|',
        '|          | Cell 2   |',
        '| Cell 3   |          |'
      ].join('\n');
      
      const result = renderMarkdownToHtml(markdown);
      
      expect(result).toContain('<table class="markdown-table">');
      expect(result).toContain('<td></td>');
      expect(result).toContain('<td>Cell 2</td>');
      expect(result).toContain('<td>Cell 3</td>');
    });

    it('1列だけのテーブルを処理できる', () => {
      const markdown = [
        '| Single |',
        '|--------|',
        '| Row 1  |',
        '| Row 2  |'
      ].join('\n');
      
      const result = renderMarkdownToHtml(markdown);
      
      expect(result).toContain('<table class="markdown-table">');
      expect(result).toContain('<th>Single</th>');
      expect(result).toContain('<td>Row 1</td>');
      expect(result).toContain('<td>Row 2</td>');
    });

    it('テーブルの行が1行だけでもレンダリングできる', () => {
      const markdown = [
        '| Header |',
        '|--------|',
        '| Cell   |'
      ].join('\n');
      
      const result = renderMarkdownToHtml(markdown);
      
      expect(result).toContain('<table class="markdown-table">');
      expect(result).toContain('<th>Header</th>');
      expect(result).toContain('<td>Cell</td>');
    });

    it('区切り行がないテーブル風の行は通常のテキストとして扱われる', () => {
      const markdown = [
        '| Not a table |',
        '| Another row |'
      ].join('\n');
      
      const result = renderMarkdownToHtml(markdown);
      
      // テーブルとして認識されない
      expect(result).not.toContain('<table');
      expect(result).toContain('<p>');
    });

    it('複数のテーブルを連続して処理できる', () => {
      const markdown = [
        '| Table 1 |',
        '|---------|',
        '| Cell 1  |',
        '',
        '| Table 2 |',
        '|---------|',
        '| Cell 2  |'
      ].join('\n');
      
      const result = renderMarkdownToHtml(markdown);
      
      // テーブルが2つ含まれる
      const tableCount = (result.match(/<table/g) || []).length;
      expect(tableCount).toBe(2);
      expect(result).toContain('Cell 1');
      expect(result).toContain('Cell 2');
    });

    it('HTMLエスケープが適用される', () => {
      const markdown = [
        '| Header |',
        '|--------|',
        '| <script> |'
      ].join('\n');
      
      const result = renderMarkdownToHtml(markdown);
      
      expect(result).toContain('&lt;script&gt;');
      expect(result).not.toContain('<script>');
    });
  });

  describe('エッジケース', () => {
    it('空文字列を処理できる', () => {
      const result = renderMarkdownToHtml('');
      expect(result).toBe('');
    });

    it('改行のみの文字列を処理できる', () => {
      const result = renderMarkdownToHtml('\n\n\n');
      expect(result).toBe('');
    });

    it('テーブルとコードブロックの組み合わせを処理できる', () => {
      const markdown = [
        '| Header |',
        '|--------|',
        '| Cell   |',
        '',
        '```',
        'code',
        '```'
      ].join('\n');
      
      const result = renderMarkdownToHtml(markdown);
      
      expect(result).toContain('<table class="markdown-table">');
      expect(result).toContain('<pre><code>code</code></pre>');
    });

    it('テーブルとリストの組み合わせを処理できる', () => {
      const markdown = [
        '| Header |',
        '|--------|',
        '| Cell   |',
        '',
        '- List item'
      ].join('\n');
      
      const result = renderMarkdownToHtml(markdown);
      
      expect(result).toContain('<table class="markdown-table">');
      expect(result).toContain('<ul><li>List item</li></ul>');
    });
  });
});
