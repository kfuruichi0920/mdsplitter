/**
 * @file ruleEngine.ts
 * @brief ルールベースのドキュメント→カード変換エンジン。
 * @details
 * Markdown/プレーンテキストを正規表現パターンで解析し、階層構造を持つカード配列に変換。
 * 見出し・箇条書き・段落を識別し、親子・前後関係を構築。計算量O(N)（N: 行数）。
 * 例:
 * @code
 * const cards = convertWithRuleEngine(doc, { maxTitleLength: 30 });
 * @endcode
 * @author K.Furuichi
 * @date 2025-11-16
 * @version 0.2
 * @copyright MIT
 * @see pipeline.ts
 */

import type { Card } from '@/shared/workspace';
import type { ConversionOptions, NormalizedDocument } from './types';

/**
 * @brief 解析済みセグメント。
 * @details
 * 見出し・段落・箇条書きの種別とテキスト・階層レベルを保持。
 */
interface ParsedSegment {
  kind: 'heading' | 'paragraph' | 'bullet'; ///< セグメント種別。
  text: string; ///< セグメント本文。
  level: number; ///< 階層レベル（0が最上位）。
}

/**
 * @brief テキストをサニタイズ（タブ等を空白に変換、前後の空白を削除）
 * @param text サニタイズ対象のテキスト
 * @return サニタイズ後のテキスト
 */
const sanitizeText = (text: string): string => text.replace(/[\t\f\v]+/g, ' ').trim();

/**
 * @brief タイトルを指定された最大文字数で切り捨てる
 * @param text 元のテキスト
 * @param fallback テキストが空の場合のフォールバック
 * @param maxLength 最大文字数
 * @return 切り捨て後のタイトル（最大文字数を超える場合は末尾に…を付与）
 */
const summarizeTitle = (text: string, fallback: string, maxLength: number): string => {
  const sanitized = sanitizeText(text);
  if (!sanitized) {
    return fallback;
  }
  if (sanitized.length <= maxLength) {
    return sanitized;
  }
  return `${sanitized.slice(0, maxLength - 1)}…`;
};

const headingPattern = /^(?<hashes>#{1,6})\s+(?<title>.+)$/; ///< Markdown見出しパターン（#が1～6個）。
const markdownBulletPattern = /^\s*(?:[-*+]|\d+[.)])\s+(?<body>.+)$/; ///< Markdown箇条書きパターン。
const numberedHeadingPattern = /^(?<seq>\d+(?:\.\d+)*[.)]?)\s+(?<title>.+)$/; ///< プレーンテキスト番号付き見出しパターン。
const plainBulletPattern = /^\s*(?:[-*+]|\d+[.)])\s+(?<body>.+)$/; ///< プレーンテキスト箇条書きパターン。

/**
 * @brief 段落バッファをフラッシュしてセグメント配列に追加。
 * @details
 * バッファが空でなければ、結合して段落セグメントを生成。計算量O(M)（M: バッファ行数）。
 * @param paragraphs 段落バッファ（破壊的にクリアされる）。
 * @param segments セグメント配列（追加先）。
 * @param parentLevel 親見出しレベル。
 * @note バッファは破壊的にクリアされる（副作用）。
 */
const flushParagraph = (
  paragraphs: string[],
  segments: ParsedSegment[],
  parentLevel: number,
): void => {
  if (paragraphs.length === 0) {
    return;
  }
  const text = paragraphs.join('\n').trim();
  if (!text) {
    paragraphs.length = 0;
    return;
  }
  segments.push({ kind: 'paragraph', text, level: Math.max(parentLevel + 1, 0) });
  paragraphs.length = 0;
};

/**
 * @brief Markdownドキュメントを解析してセグメント配列を生成。
 * @details
 * 見出し（#）、箇条書き、段落を識別。計算量O(N)（N: 行数）。
 * @param content Markdownテキスト。
 * @return 解析済みセグメント配列。
 */
const parseMarkdownDocument = (content: string): ParsedSegment[] => {
  const segments: ParsedSegment[] = [];
  const lines = content.split(/\n/);
  const paragraphBuffer: string[] = [];
  let currentHeadingLevel = -1;

  lines.forEach((line) => {
    const headingMatch = line.match(headingPattern);
    if (headingMatch?.groups?.hashes) {
      flushParagraph(paragraphBuffer, segments, currentHeadingLevel);
      const level = headingMatch.groups.hashes.length - 1;
      currentHeadingLevel = level;
      segments.push({ kind: 'heading', text: headingMatch.groups.title.trim(), level });
      return;
    }

    const bulletMatch = line.match(markdownBulletPattern);
    if (bulletMatch?.groups?.body) {
      flushParagraph(paragraphBuffer, segments, currentHeadingLevel);
      segments.push({ kind: 'bullet', text: bulletMatch.groups.body.trim(), level: Math.max(currentHeadingLevel + 1, 0) });
      return;
    }

    if (line.trim().length === 0) {
      flushParagraph(paragraphBuffer, segments, currentHeadingLevel);
      return;
    }

    paragraphBuffer.push(line);
  });

  flushParagraph(paragraphBuffer, segments, currentHeadingLevel);
  return segments;
};

/**
 * @brief プレーンテキストドキュメントを解析してセグメント配列を生成。
 * @details
 * 番号付き見出し（1.、1.1など）、箇条書き、段落を識別。計算量O(N)（N: 行数）。
 * @param content プレーンテキスト。
 * @return 解析済みセグメント配列。
 */
const parsePlainTextDocument = (content: string): ParsedSegment[] => {
  const segments: ParsedSegment[] = [];
  const lines = content.split(/\n/);
  const paragraphBuffer: string[] = [];
  let currentHeadingLevel = -1;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph(paragraphBuffer, segments, currentHeadingLevel);
      return;
    }

    const numberedHeadingMatch = trimmed.match(numberedHeadingPattern);
    if (numberedHeadingMatch?.groups?.title) {
      flushParagraph(paragraphBuffer, segments, currentHeadingLevel);
      const seq = numberedHeadingMatch.groups.seq.replace(/[.)]$/, '');
      const level = seq.includes('.') ? seq.split('.').length - 1 : 0;
      currentHeadingLevel = level;
      segments.push({ kind: 'heading', text: numberedHeadingMatch.groups.title.trim(), level });
      return;
    }

    const bulletMatch = trimmed.match(plainBulletPattern);
    if (bulletMatch?.groups?.body) {
      flushParagraph(paragraphBuffer, segments, currentHeadingLevel);
      segments.push({ kind: 'bullet', text: bulletMatch.groups.body.trim(), level: Math.max(currentHeadingLevel + 1, 0) });
      return;
    }

    paragraphBuffer.push(line);
  });

  flushParagraph(paragraphBuffer, segments, currentHeadingLevel);
  return segments;
};

/**
 * @brief カードIDを生成（ゼロパディング4桁）。
 * @param index インデックス（1起算）。
 * @return カードID（例: card-0001）。
 */
const createCardId = (index: number): string => `card-${String(index).padStart(4, '0')}`;

/**
 * @brief セグメント配列からカード配列を構築。
 * @details
 * 階層スタックで親子関係を追跡し、prev_id/next_id/child_idsを設定。計算量O(N)（N: セグメント数）。
 * @param document 元ドキュメント情報。
 * @param segments 解析済みセグメント配列。
 * @param options 変換オプション（タイトル最大長等）。
 * @return カード配列。
 */
const buildCards = (document: NormalizedDocument, segments: ParsedSegment[], options?: ConversionOptions): Card[] => {
  const timestamp = (options?.now ?? new Date()).toISOString();
  const maxTitleLength = options?.maxTitleLength ?? 20; // デフォルト20文字
  const cards: Card[] = [];
  const cardMap = new Map<string, Card>();
  const childMap = new Map<string | null, string[]>();
  const pushChild = (parentId: string | null, childId: string) => {
    const next = childMap.get(parentId) ?? [];
    next.push(childId);
    childMap.set(parentId, next);
  };
  const headingStack: { level: number; cardId: string }[] = [];

  segments.forEach((segment) => {
    while (segment.kind === 'heading' && headingStack.length > 0 && headingStack[headingStack.length - 1].level >= segment.level) {
      headingStack.pop();
    }

    const parentEntry = headingStack[headingStack.length - 1];
    const parentId = segment.kind === 'heading' ? parentEntry?.cardId ?? null : parentEntry?.cardId ?? null;
    const parentLevel = parentEntry?.level ?? -1;
    const level = segment.kind === 'heading' ? segment.level : Math.max(parentLevel + 1, 0);
    const id = createCardId(cards.length + 1);

    const body = segment.text.trim();
    const defaultTitle = segment.kind === 'heading' ? `見出し ${cards.length + 1}` : `セクション ${cards.length + 1}`;
    // すべてのカード種別で最大文字数制限を適用
    const rawTitle = segment.kind === 'heading' ? sanitizeText(segment.text) || defaultTitle : summarizeTitle(body, defaultTitle, maxTitleLength);
    const title = rawTitle.length > maxTitleLength ? `${rawTitle.slice(0, maxTitleLength - 1)}…` : rawTitle;

    const card: Card = {
      id,
      title,
      body,
      status: 'draft',
      kind: segment.kind,
      hasLeftTrace: false,
      hasRightTrace: false,
      markdownPreviewEnabled: document.isMarkdown,
      updatedAt: timestamp,
      parent_id: parentId,
      child_ids: [],
      prev_id: null,
      next_id: null,
      level,
    };

    cards.push(card);
    cardMap.set(id, card);
    pushChild(parentId, id);

    if (segment.kind === 'heading') {
      headingStack.push({ level: segment.level, cardId: id });
    }
  });

  childMap.forEach((childIds, parentId) => {
    childIds.forEach((childId, index) => {
      const card = cardMap.get(childId);
      if (!card) {
        return;
      }
      card.prev_id = index === 0 ? null : childIds[index - 1];
      card.next_id = index === childIds.length - 1 ? null : childIds[index + 1];
    });
    if (parentId) {
      const parentCard = cardMap.get(parentId);
      if (parentCard) {
        parentCard.child_ids = [...childIds];
      }
    }
  });

  return cards;
};

/**
 * @brief ルールベース変換のエントリーポイント。
 * @details
 * Markdown/プレーンテキストを判定し、適切なパーサーでカード配列を生成。計算量O(N)。
 * @param document 正規化済みドキュメント。
 * @param options 変換オプション（タイトル最大長等）。
 * @return カード配列。
 */
export const convertWithRuleEngine = (
  document: NormalizedDocument,
  options?: ConversionOptions,
): Card[] => {
  const segments = document.isMarkdown
    ? parseMarkdownDocument(document.content)
    : parsePlainTextDocument(document.content);
  return buildCards(document, segments, options);
};
