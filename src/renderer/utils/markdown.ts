/**
 * @file markdown.ts
 * @brief 簡易Markdown→HTMLレンダラ。
 * @details 外部ライブラリを使わず、代表的なMarkdown構文（見出し/リスト/コード/強調/テーブルなど）のみをサポートする軽量実装。
 */

/**
 * テーブルのセルデータ型
 */
interface TableCell {
  content: string;
  align?: 'left' | 'center' | 'right';
}

/**
 * テーブルデータ型
 */
interface TableData {
  headers: TableCell[];
  rows: TableCell[][];
}

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

/**
 * テーブル行が有効なMarkdownテーブル行かどうかを判定
 * @param line テーブル行候補
 * @returns テーブル行として有効な場合true
 */
const isTableRow = (line: string): boolean => {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|');
};

/**
 * テーブルの区切り行（アライメント指定行）かどうかを判定
 * @param line 区切り行候補
 * @returns 区切り行として有効な場合true
 */
const isTableSeparator = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
    return false;
  }
  // 各セルが :?-+:? パターンに一致するかチェック
  const cells = trimmed.slice(1, -1).split('|').map(c => c.trim());
  return cells.length > 0 && cells.every(cell => /^:?-+:?$/.test(cell));
};

/**
 * テーブルセルのアライメントを取得
 * @param separator 区切り文字列 (例: ":---:", "---", ":---", "---:")
 * @returns アライメント
 */
const getCellAlignment = (separator: string): 'left' | 'center' | 'right' => {
  const trimmed = separator.trim();
  const startsWithColon = trimmed.startsWith(':');
  const endsWithColon = trimmed.endsWith(':');
  
  if (startsWithColon && endsWithColon) {
    return 'center';
  } else if (endsWithColon) {
    return 'right';
  }
  return 'left';
};

/**
 * テーブル行を解析してセルの配列に変換
 * @param line テーブル行
 * @param alignments アライメント情報（オプション）
 * @returns セルの配列
 */
const parseTableRow = (line: string, alignments?: ('left' | 'center' | 'right')[]): TableCell[] => {
  const trimmed = line.trim();
  const cellTexts = trimmed.slice(1, -1).split('|').map(c => c.trim());
  
  return cellTexts.map((content, index) => ({
    content,
    align: alignments ? alignments[index] : 'left'
  }));
};

/**
 * テーブルデータをHTMLに変換
 * @param table テーブルデータ
 * @returns HTML文字列
 */
const renderTable = (table: TableData): string => {
  let html = '<table class="markdown-table">';
  
  // ヘッダー行
  html += '<thead><tr>';
  table.headers.forEach(cell => {
    const alignStyle = cell.align && cell.align !== 'left' ? ` style="text-align: ${cell.align}"` : '';
    html += `<th${alignStyle}>${renderInline(cell.content)}</th>`;
  });
  html += '</tr></thead>';
  
  // ボディ行
  html += '<tbody>';
  table.rows.forEach(row => {
    html += '<tr>';
    row.forEach(cell => {
      const alignStyle = cell.align && cell.align !== 'left' ? ` style="text-align: ${cell.align}"` : '';
      html += `<td${alignStyle}>${renderInline(cell.content)}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody>';
  
  html += '</table>';
  return html;
};

export const renderMarkdownToHtml = (markdown: string): string => {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let inList: false | 'ul' | 'ol' = false;
  let inCode = false;
  let inTable = false;
  let codeBuffer: string[] = [];
  let paragraph: string[] = [];
  let tableBuffer: string[] = [];

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

  const flushTable = () => {
    if (tableBuffer.length >= 2) {
      // 最低でもヘッダー行と区切り行が必要
      const headerLine = tableBuffer[0];
      const separatorLine = tableBuffer[1];
      
      if (isTableRow(headerLine) && isTableSeparator(separatorLine)) {
        // アライメント情報を取得
        const separatorCells = separatorLine.trim().slice(1, -1).split('|').map(c => c.trim());
        const alignments = separatorCells.map(getCellAlignment);
        
        // テーブルデータを構築
        const headers = parseTableRow(headerLine, alignments);
        const rows: TableCell[][] = [];
        
        for (let i = 2; i < tableBuffer.length; i++) {
          if (isTableRow(tableBuffer[i])) {
            rows.push(parseTableRow(tableBuffer[i], alignments));
          }
        }
        
        const table: TableData = { headers, rows };
        html += renderTable(table);
      }
    }
    tableBuffer = [];
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimEnd();

    if (trimmed.startsWith('```')) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushParagraph();
        closeList();
        flushTable();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    // テーブルの検出と処理
    if (isTableRow(trimmed)) {
      // 次の行がテーブルの区切り行かチェック
      const nextLine = i + 1 < lines.length ? lines[i + 1].trimEnd() : '';
      
      if (!inTable && isTableSeparator(nextLine)) {
        // テーブルの開始
        flushParagraph();
        closeList();
        inTable = true;
        tableBuffer = [trimmed];
        continue;
      } else if (inTable) {
        // テーブル内の行
        tableBuffer.push(trimmed);
        continue;
      }
    } else if (inTable) {
      // テーブル終了
      flushTable();
      // 現在の行は通常の行として処理されるようにフォールスルー
    }

    if (trimmed === '') {
      flushParagraph();
      closeList();
      flushTable();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      flushParagraph();
      closeList();
      html += `<h${level}>${renderInline(content)}</h${level}>`;
      continue;
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
      continue;
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
      continue;
    }

    const blockquote = trimmed.match(/^>\s?(.*)$/);
    if (blockquote) {
      flushParagraph();
      closeList();
      html += `<blockquote>${renderInline(blockquote[1])}</blockquote>`;
      continue;
    }

    paragraph.push(line.trim());
  }

  if (inCode) {
    flushCode();
  }
  flushParagraph();
  closeList();
  flushTable();

  return html;
};
