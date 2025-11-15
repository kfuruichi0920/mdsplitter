import type { Card } from '@/shared/workspace';
import type { TraceabilityRelation } from '@/shared/traceability';

const hasTraceBetween = (
  relations: TraceabilityRelation[],
  leftId: string,
  rightId: string,
): boolean =>
  relations.some((relation) => relation.left_ids.includes(leftId) && relation.right_ids.includes(rightId));

export const exportMatrixToCSV = (
  leftCards: Card[],
  rightCards: Card[],
  relations: TraceabilityRelation[],
): string => {
  const header = ['', ...rightCards.map((card) => card.cardId ?? card.id)];
  const rows = leftCards.map((leftCard) => {
    const row = [leftCard.cardId ?? leftCard.id];
    rightCards.forEach((rightCard) => {
      row.push(hasTraceBetween(relations, leftCard.id, rightCard.id) ? '●' : '');
    });
    return row;
  });

  return [header, ...rows]
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
