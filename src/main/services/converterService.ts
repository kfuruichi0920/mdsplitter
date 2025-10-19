import { Card, CardFile, CardContent, CardInfoType } from '../../shared/types';
import { generateUUID, getCurrentISOTimestamp } from '../../shared/utils';
import { logInfo, logWarn, logError } from './logService';

/**
 * テキストからカードファイルへの変換サービス
 */

/**
 * Markdownファイルをカードに変換
 */
export function convertMarkdownToCards(
  content: string,
  inputFilePath: string,
  copiedInputFilePath: string,
  fileName: string
): CardFile {
  logInfo('Starting Markdown conversion', { inputFilePath });

  const lines = content.split('\n');
  const cards: Card[] = [];
  const now = new Date().toISOString();

  let currentCard: Partial<Card> | null = null;
  let currentContent: string[] = [];
  let lineIndex = 0;

  const createCard = (
    type: CardInfoType,
    content: CardContent,
    level: number
  ): Card => {
    return {
      id: generateUUID(),
      type,
      status: 'draft',
      content,
      updatedAt: now,
      parent_id: null,
      child_ids: [],
      prev_id: null,
      next_id: null,
    };
  };

  // 階層構造を管理するスタック（見出しレベル -> カードID）
  const levelStack: Map<number, string> = new Map();
  let lastCardId: string | null = null;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];

    // 見出しの検出
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];

      const card = createCard(
        'heading',
        { text: headingText },
        level
      );

      // 親子関係の設定
      for (let parentLevel = level - 1; parentLevel >= 1; parentLevel--) {
        const parentId = levelStack.get(parentLevel);
        if (parentId) {
          card.parent_id = parentId;
          const parentCard = cards.find((c) => c.id === parentId);
          if (parentCard) {
            parentCard.child_ids.push(card.id);
          }
          break;
        }
      }

      // 兄弟関係の設定（同じ階層の前のカード）
      const siblingId = levelStack.get(level);
      if (siblingId) {
        const siblingCard = cards.find((c) => c.id === siblingId);
        if (siblingCard) {
          siblingCard.next_id = card.id;
          card.prev_id = siblingId;
        }
      }

      levelStack.set(level, card.id);
      // より深いレベルのスタックをクリア
      for (let clearLevel = level + 1; clearLevel <= 6; clearLevel++) {
        levelStack.delete(clearLevel);
      }

      cards.push(card);
      lastCardId = card.id;
      lineIndex++;
      continue;
    }

    // 箇条書きの検出
    const bulletMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      const indent = bulletMatch[1].length;
      const bulletText = bulletMatch[3];

      const card = createCard(
        'bullet',
        { text: bulletText },
        0
      );

      // 最後の見出しの子として追加
      if (lastCardId) {
        const lastCard = cards.find((c) => c.id === lastCardId);
        if (lastCard && lastCard.type === 'heading') {
          card.parent_id = lastCard.id;
          lastCard.child_ids.push(card.id);
        }
      }

      cards.push(card);
      lineIndex++;
      continue;
    }

    // 空行のスキップ
    if (line.trim() === '') {
      lineIndex++;
      continue;
    }

    // 段落の検出
    currentContent = [line];
    lineIndex++;

    // 次の見出しまたは箇条書きが来るまで段落を継続
    while (lineIndex < lines.length) {
      const nextLine = lines[lineIndex];

      if (
        nextLine.match(/^#{1,6}\s+/) ||
        nextLine.match(/^(\s*)([-*+]|\d+\.)\s+/)
      ) {
        break;
      }

      if (nextLine.trim() === '') {
        lineIndex++;
        break;
      }

      currentContent.push(nextLine);
      lineIndex++;
    }

    if (currentContent.length > 0) {
      const card = createCard(
        'paragraph',
        { text: currentContent.join('\n') },
        0
      );

      // 最後の見出しの子として追加
      if (lastCardId) {
        const lastCard = cards.find((c) => c.id === lastCardId);
        if (lastCard && lastCard.type === 'heading') {
          card.parent_id = lastCard.id;
          lastCard.child_ids.push(card.id);
        }
      }

      cards.push(card);
    }
  }

  logInfo('Markdown conversion completed', {
    inputFilePath,
    totalCards: cards.length,
  });

  return {
    schemaVersion: 1,
    header: {
      id: generateUUID(),
      fileName,
      orgInputFilePath: inputFilePath,
      inputFilePath: copiedInputFilePath,
      createdAt: now,
      updatedAt: now,
    },
    body: cards,
  };
}

/**
 * テキストファイルをカードに変換
 */
export function convertTextToCards(
  content: string,
  inputFilePath: string,
  copiedInputFilePath: string,
  fileName: string
): CardFile {
  logInfo('Starting text conversion', { inputFilePath });

  const lines = content.split('\n');
  const cards: Card[] = [];
  const now = new Date().toISOString();

  const createCard = (type: CardInfoType, content: CardContent): Card => {
    return {
      id: generateUUID(),
      type,
      status: 'draft',
      content,
      updatedAt: now,
      parent_id: null,
      child_ids: [],
      prev_id: null,
      next_id: null,
    };
  };

  let currentParagraph: string[] = [];
  let lineIndex = 0;

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const card = createCard('paragraph', {
        text: currentParagraph.join('\n'),
      });
      cards.push(card);
      currentParagraph = [];
    }
  };

  while (lineIndex < lines.length) {
    const line = lines[lineIndex];

    // 空行の検出（段落の区切り）
    if (line.trim() === '') {
      flushParagraph();
      lineIndex++;
      continue;
    }

    // 箇条書きの検出
    const bulletMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      const bulletText = bulletMatch[3];
      const card = createCard('bullet', { text: bulletText });
      cards.push(card);
      lineIndex++;
      continue;
    }

    // 通常の行は段落に追加
    currentParagraph.push(line);
    lineIndex++;
  }

  // 残っている段落を保存
  flushParagraph();

  logInfo('Text conversion completed', {
    inputFilePath,
    totalCards: cards.length,
  });

  return {
    schemaVersion: 1,
    header: {
      id: generateUUID(),
      fileName,
      orgInputFilePath: inputFilePath,
      inputFilePath: copiedInputFilePath,
      createdAt: now,
      updatedAt: now,
    },
    body: cards,
  };
}

/**
 * ファイルをカードに変換（エントリーポイント）
 */
export function convertToCards(
  content: string,
  inputFilePath: string,
  copiedInputFilePath: string,
  fileName: string,
  fileExtension: string
): CardFile {
  if (fileExtension === '.md') {
    return convertMarkdownToCards(
      content,
      inputFilePath,
      copiedInputFilePath,
      fileName
    );
  } else if (fileExtension === '.txt') {
    return convertTextToCards(
      content,
      inputFilePath,
      copiedInputFilePath,
      fileName
    );
  } else {
    logError('Unsupported file extension', { fileExtension });
    throw new Error(`Unsupported file extension: ${fileExtension}`);
  }
}
