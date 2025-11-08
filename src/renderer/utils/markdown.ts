/**
 * @file markdown.ts
 * @brief 簡易Markdown→HTMLレンダラ。
 * @details 外部ライブラリを使わず、代表的なMarkdown構文（見出し/リスト/コード/強調など）のみをサポートする軽量実装。
 */

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const escapeAttribute = (value: string): string => escapeHtml(value).replace(/\(/g, '&#40;').replace(/\)/g, '&#41;');

const renderInline = (value: string): string => {
  let result = escapeHtml(value);

  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  result = result.replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>');
  result = result.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
    const safeHref = escapeAttribute(href.trim());
    const safeLabel = label;
    return `<a href="${safeHref}" target="_blank" rel="noreferrer">${safeLabel}</a>`;
  });

  return result;
};

export const renderMarkdownToHtml = (markdown: string): string => {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let inList: false | 'ul' | 'ol' = false;
  let inCode = false;
  let codeBuffer: string[] = [];
  let paragraph: string[] = [];

  const closeList = () => {
    if (inList) {
      html += `</${inList}>`;
      inList = false;
    }
  };

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      html += `<p>${renderInline(paragraph.join(' '))}</p>`;
      paragraph = [];
    }
  };

  const flushCode = () => {
    if (codeBuffer.length > 0) {
      html += `<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`;
      codeBuffer = [];
    }
  };

  lines.forEach((rawLine) => {
    const line = rawLine;
    const trimmed = line.trimEnd();

    if (trimmed.startsWith('```')) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushParagraph();
        closeList();
        inCode = true;
      }
      return;
    }

    if (inCode) {
      codeBuffer.push(line);
      return;
    }

    if (trimmed === '') {
      flushParagraph();
      closeList();
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      flushParagraph();
      closeList();
      html += `<h${level}>${renderInline(content)}</h${level}>`;
      return;
    }

    const unordered = trimmed.match(/^[-*+]\s+(.*)$/);
    if (unordered) {
      flushParagraph();
      if (inList !== 'ul') {
        closeList();
        inList = 'ul';
        html += '<ul>';
      }
      html += `<li>${renderInline(unordered[1])}</li>`;
      return;
    }

    const ordered = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (ordered) {
      flushParagraph();
      if (inList !== 'ol') {
        closeList();
        inList = 'ol';
        html += '<ol>';
      }
      html += `<li>${renderInline(ordered[2])}</li>`;
      return;
    }

    const blockquote = trimmed.match(/^>\s?(.*)$/);
    if (blockquote) {
      flushParagraph();
      closeList();
      html += `<blockquote>${renderInline(blockquote[1])}</blockquote>`;
      return;
    }

    paragraph.push(line.trim());
  });

  if (inCode) {
    flushCode();
  }
  flushParagraph();
  closeList();

  return html;
};
