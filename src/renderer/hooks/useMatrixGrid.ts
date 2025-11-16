import { useMemo } from 'react';

import { useReactTable, getCoreRowModel, type ColumnDef } from '@tanstack/react-table';

import type { Card } from '@/shared/workspace';
import { useMatrixStore } from '@/renderer/store/matrixStore';
import { buildRelationLookup, makeRelationKey } from '@/renderer/utils/matrixRelations';

interface MatrixRow {
  leftCard: Card;
}

export const useMatrixGrid = () => {
  const leftCards = useMatrixStore((state) => state.leftCards);
  const rightCards = useMatrixStore((state) => state.rightCards);
  const relations = useMatrixStore((state) => state.relations);
  const filter = useMatrixStore((state) => state.filter);

  const relationLookup = useMemo(() => buildRelationLookup(relations), [relations]);

  const filteredLeftCards = useMemo(() => {
    return leftCards.filter((card) => {
      if (filter.cardIdQuery && !(card.cardId ?? card.id).toLowerCase().includes(filter.cardIdQuery.toLowerCase())) {
        return false;
      }
      if (filter.titleQuery && !(card.title ?? '').toLowerCase().includes(filter.titleQuery.toLowerCase())) {
        return false;
      }
      if (!filter.status[card.status]) {
        return false;
      }
      if (filter.columnTraceFocus) {
        const key = makeRelationKey(card.id, filter.columnTraceFocus);
        if (!relationLookup.has(key)) {
          return false;
        }
      }
      return true;
    });
  }, [leftCards, filter, relationLookup]);

  const filteredRightCards = useMemo(() => {
    return rightCards.filter((card) => {
      if (filter.cardIdQuery && !(card.cardId ?? card.id).toLowerCase().includes(filter.cardIdQuery.toLowerCase())) {
        return false;
      }
      if (filter.titleQuery && !(card.title ?? '').toLowerCase().includes(filter.titleQuery.toLowerCase())) {
        return false;
      }
      if (!filter.status[card.status]) {
        return false;
      }
      if (filter.rowTraceFocus) {
        const key = makeRelationKey(filter.rowTraceFocus, card.id);
        if (!relationLookup.has(key)) {
          return false;
        }
      }
      return true;
    });
  }, [rightCards, filter, relationLookup]);

  const data = useMemo(() => filteredLeftCards.map((card) => ({ leftCard: card })), [filteredLeftCards]);

  const columns = useMemo<ColumnDef<MatrixRow>[]>(() => {
    const base: ColumnDef<MatrixRow>[] = [
      {
        id: 'rowHeader',
        header: () => null,
        cell: ({ row }) => row.original.leftCard,
      },
    ];
    const dynamicColumns = filteredRightCards.map((card): ColumnDef<MatrixRow> => ({
      id: card.id,
      header: () => card,
      cell: ({ row }) => relationLookup.get(makeRelationKey(row.original.leftCard.id, card.id)),
      meta: { card },
    }));
    return [...base, ...dynamicColumns];
  }, [filteredRightCards, relationLookup]);

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });

  const headerColumns = useMemo(() => table.getFlatHeaders().filter((header) => header.id !== 'rowHeader'), [table]);

  return {
    table,
    filteredLeftCards,
    filteredRightCards,
    relationLookup,
    headerColumns,
  };
};
