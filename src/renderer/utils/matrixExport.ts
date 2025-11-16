import * as XLSX from 'xlsx';

import type { Card } from '@/shared/workspace';
import type { TraceabilityRelation } from '@/shared/traceability';
import { makeRelationKey } from '@/renderer/utils/matrixRelations';

interface ExportOptions {
  includeMemo?: boolean;
}

const sanitizeBody = (body?: string): string => {
  if (!body) {
    return '';
  }
  return body.replace(/\s+/g, ' ').trim();
};

const describeDirection = (value?: TraceabilityRelation['directed']): { label: string; glyph: string } => {
  switch (value) {
    case 'right_to_left':
      return { label: '列→行', glyph: '◀' };
    case 'bidirectional':
      return { label: '双方向', glyph: '⇔' };
    default:
      return { label: '行→列', glyph: '▲' };
  }
};

const toMatrixAoa = (
  leftCards: Card[],
  rightCards: Card[],
  relations: TraceabilityRelation[],
  options?: ExportOptions,
): string[][] => {
  const relationMap = new Map<string, TraceabilityRelation>();
  relations.forEach((relation) => {
    relation.left_ids.forEach((leftId) => {
      relation.right_ids.forEach((rightId) => {
        relationMap.set(makeRelationKey(leftId, rightId), relation);
      });
    });
  });

  const rightHeaders = rightCards.map((card) => card.cardId ?? card.id);
  const rightTitles = rightCards.map((card) => card.title ?? '');
  const rightBodies = rightCards.map((card) => sanitizeBody(card.body));

  const headerRow = ['左カードID', '左カードタイトル', '左カード本文', ...rightHeaders];
  const titleRow = ['', '', '', ...rightTitles];
  const bodyRow = ['', '', '', ...rightBodies];

  const rows = leftCards.map((leftCard) => {
    const base = [leftCard.cardId ?? leftCard.id, leftCard.title ?? '', sanitizeBody(leftCard.body)];
    const cells = rightCards.map((rightCard) => {
      const relation = relationMap.get(makeRelationKey(leftCard.id, rightCard.id));
      if (!relation) {
        return '';
      }
      const directionInfo = describeDirection(relation.directed);
      let value = `${relation.type} (${directionInfo.glyph} ${directionInfo.label})`;
      if (options?.includeMemo) {
        const memo = relation.memo?.trim();
        if (memo) {
          value = `${value}\nMemo: ${memo}`;
        }
      }
      return value;
    });
    return [...base, ...cells];
  });

  return [headerRow, titleRow, bodyRow, ...rows];
};

export const exportMatrixToCSV = (
  leftCards: Card[],
  rightCards: Card[],
  relations: TraceabilityRelation[],
  options?: ExportOptions,
): string => {
  const aoa = toMatrixAoa(leftCards, rightCards, relations, options);
  return aoa
    .map((row) =>
      row
        .map((cell) => {
          if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join(','),
    )
    .join('\n');
};

export const exportMatrixToExcel = (
  leftCards: Card[],
  rightCards: Card[],
  relations: TraceabilityRelation[],
  options?: ExportOptions,
): string => {
  const aoa = toMatrixAoa(leftCards, rightCards, relations, options);
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'TraceMatrix');
  return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
};
