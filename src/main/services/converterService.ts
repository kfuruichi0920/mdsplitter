import { Card, CardFile, CardContent, CardInfoType } from '../../shared/types';
import { generateUUID, getCurrentISOTimestamp } from '../../shared/utils';
import { logInfo, logWarn, logError } from './logService';
import { generateLLMCompletion } from './llmService';
import { getSettings } from './settingsService';

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
 * 匿名化処理（固有名詞と数値をマスク）
 */
function anonymizeContent(content: string): { anonymized: string; mapping: Map<string, string> } {
  const mapping = new Map<string, string>();
  let anonymized = content;
  let counter = 1;

  // 簡易的な固有名詞検出（大文字で始まる単語）と数値の匿名化
  // 実際のプロダクションでは、より高度なNLPライブラリを使用すべき
  anonymized = anonymized.replace(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g, (match) => {
    if (!mapping.has(match)) {
      mapping.set(match, `NAME_${counter++}`);
    }
    return mapping.get(match)!;
  });

  anonymized = anonymized.replace(/\b\d{4,}\b/g, (match) => {
    if (!mapping.has(match)) {
      mapping.set(match, `NUM_${counter++}`);
    }
    return mapping.get(match)!;
  });

  return { anonymized, mapping };
}

/**
 * 匿名化を元に戻す
 */
function deanonymizeContent(content: string, mapping: Map<string, string>): string {
  let deanonymized = content;
  mapping.forEach((placeholder, original) => {
    const regex = new RegExp(placeholder, 'g');
    deanonymized = deanonymized.replace(regex, original);
  });
  return deanonymized;
}

/**
 * LLMを使ってテキストをカードに変換
 */
export async function convertWithLLM(
  content: string,
  inputFilePath: string,
  copiedInputFilePath: string,
  fileName: string,
  fileExtension: string
): Promise<CardFile> {
  logInfo('Starting LLM-based conversion', { inputFilePath });

  const settings = getSettings();
  const now = new Date().toISOString();

  // 匿名化処理
  let processedContent = content;
  let anonymizationMapping: Map<string, string> | null = null;

  if (settings.llm.redaction?.enabled) {
    const result = anonymizeContent(content);
    processedContent = result.anonymized;
    anonymizationMapping = result.mapping;
    logInfo('Content anonymized for LLM processing', {
      mappingSize: anonymizationMapping.size,
    });
  }

  // プロンプト設計
  const systemPrompt = `あなたは文書を構造化カードに分割する専門家です。
以下のルールに従って、入力テキストを JSON 形式のカード配列に変換してください。

【カード分割ルール】
1. 見出し（heading）: Markdownの場合は # で始まる行、テキストの場合は大文字で始まり、独立した行
2. 段落（paragraph）: 通常の文章ブロック。空行で区切られる
3. 箇条書き（bullet）: - や * や番号で始まる項目
4. 図（figure）: 「図X.Y」のような表記を含む部分
5. 表（table）: 「表X.Y」のような表記を含む部分
6. 試験（test）: 「試験」「テスト」「Test」などの表記を含む部分
7. QA（qa）: 「Q:」「A:」「質問」「回答」などの表記を含む部分

【階層構造】
- Markdownの見出しレベル（#の数）で階層を判断
- テキストの場合はインデントや番号体系（1., 1.1., 1.1.1.）で階層を判断

【出力フォーマット】
JSONの配列形式で、各カードは以下の構造：
{
  "type": "heading|paragraph|bullet|figure|table|test|qa|other",
  "content": {
    "text": "カードの内容",
    "number": "図番号や表番号など（オプション）"
  },
  "level": 階層レベル（0が最上位）
}`;

  const userPrompt = `以下のテキストをカードに分割してください：

\`\`\`
${processedContent}
\`\`\`

JSON配列のみを返してください。説明文は不要です。`;

  try {
    const response = await generateLLMCompletion({
      prompt: userPrompt,
      systemPrompt,
      temperature: settings.llm.temperature,
      timeout: settings.converter.timeoutMs === 'none' ? undefined : settings.converter.timeoutMs,
    });

    logInfo('LLM response received', {
      contentLength: response.content.length,
      tokens: response.usage?.totalTokens,
    });

    // JSONパース
    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Invalid LLM response: JSON array not found');
    }

    interface LLMCardResult {
      type: CardInfoType;
      content: { text: string; number?: string };
      level: number;
    }

    const llmCards: LLMCardResult[] = JSON.parse(jsonMatch[0]);

    // 匿名化を元に戻す
    if (anonymizationMapping) {
      llmCards.forEach((card) => {
        card.content.text = deanonymizeContent(card.content.text, anonymizationMapping!);
        if (card.content.number) {
          card.content.number = deanonymizeContent(card.content.number, anonymizationMapping!);
        }
      });
    }

    // Card型に変換し、階層構造を構築
    const cards: Card[] = [];
    const levelStack: Map<number, string> = new Map();

    llmCards.forEach((llmCard) => {
      const card: Card = {
        id: generateUUID(),
        type: llmCard.type,
        status: 'draft',
        content: llmCard.content,
        updatedAt: now,
        parent_id: null,
        child_ids: [],
        prev_id: null,
        next_id: null,
      };

      // 親子関係の設定
      for (let parentLevel = llmCard.level - 1; parentLevel >= 0; parentLevel--) {
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

      // 兄弟関係の設定
      const siblingId = levelStack.get(llmCard.level);
      if (siblingId) {
        const siblingCard = cards.find((c) => c.id === siblingId);
        if (siblingCard) {
          siblingCard.next_id = card.id;
          card.prev_id = siblingId;
        }
      }

      levelStack.set(llmCard.level, card.id);
      // より深いレベルのスタックをクリア
      for (let clearLevel = llmCard.level + 1; clearLevel <= 10; clearLevel++) {
        levelStack.delete(clearLevel);
      }

      cards.push(card);
    });

    logInfo('LLM conversion completed', {
      inputFilePath,
      totalCards: cards.length,
      tokens: response.usage?.totalTokens,
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
  } catch (error) {
    logError('LLM conversion failed', error);
    throw error;
  }
}

/**
 * ファイルをカードに変換（エントリーポイント）
 */
export async function convertToCards(
  content: string,
  inputFilePath: string,
  copiedInputFilePath: string,
  fileName: string,
  fileExtension: string,
  strategy?: 'rule' | 'llm'
): Promise<CardFile> {
  const settings = getSettings();
  const conversionStrategy = strategy || settings.converter.strategy;

  if (conversionStrategy === 'llm') {
    return await convertWithLLM(
      content,
      inputFilePath,
      copiedInputFilePath,
      fileName,
      fileExtension
    );
  }

  // 固定ルールによる変換
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
