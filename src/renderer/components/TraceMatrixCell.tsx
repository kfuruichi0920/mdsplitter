import React from 'react';

import type { TraceRelationKind } from '@/shared/traceability';

interface TraceMatrixCellProps {
  hasTrace: boolean;
  traceKind?: TraceRelationKind;
  isRowHighlighted: boolean;
  isColumnHighlighted: boolean;
  onToggle: () => void;
  onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export const TraceMatrixCell: React.FC<TraceMatrixCellProps> = ({
  hasTrace,
  traceKind,
  isRowHighlighted,
  isColumnHighlighted,
  onToggle,
  onContextMenu,
}) => {
  const classes = [
    'trace-matrix-cell',
    hasTrace ? 'trace-matrix-cell--active' : '',
    traceKind ? `trace-matrix-cell--kind-${traceKind}` : '',
    isRowHighlighted ? 'trace-matrix-cell--row-highlight' : '',
    isColumnHighlighted ? 'trace-matrix-cell--column-highlight' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      onClick={onToggle}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu(event);
      }}
      title={hasTrace ? `トレース: ${traceKind ?? 'trace'}` : 'トレースなし'}
    >
      {hasTrace ? '●' : ''}
    </button>
  );
};

TraceMatrixCell.displayName = 'TraceMatrixCell';
