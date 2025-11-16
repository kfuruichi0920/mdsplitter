import * as XLSX from 'xlsx';

import type { Card } from '@/shared/workspace';
import type { TraceabilityRelation } from '@/shared/traceability';
import { makeRelationKey } from '@/renderer/utils/matrixRelations';

const toMatrixAoa = (
  leftCards: Card[],
  rightCards: Card[],
  relations: TraceabilityRelation[],
): string[][] => {
  const lookup = new Map<string, boolean>();
  relations.forEach((relation) => {
    relation.left_ids.forEach((leftId) => {
      relation.right_ids.forEach((rightId) => {
        lookup.set(makeRelationKey(leftId, rightId), true);
      });
    });
  });
  const header = [''].concat(rightCards.map((card) => card.cardId ?? card.id));
  const rows = leftCards.map((leftCard) => {
    const row = [leftCard.cardId ?? leftCard.id];
    rightCards.forEach((rightCard) => {
      row.push(lookup.has(makeRelationKey(leftCard.id, rightCard.id)) ? '●' : '');
    });
    return row;
  });
  return [header, ...rows];
};

export const exportMatrixToCSV = (
  leftCards: Card[],
  rightCards: Card[],
  relations: TraceabilityRelation[],
): string => {
  const aoa = toMatrixAoa(leftCards, rightCards, relations);
  return aoa
    .map((row) =>
      row
        .map((cell) => {
          if (cell.includes(',') || cell.includes('"')) {
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
): string => {
  const aoa = toMatrixAoa(leftCards, rightCards, relations);
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'TraceMatrix');
  return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
};
