import React from 'react';

import type { TraceRelationKind, TraceabilityRelation } from '@/shared/traceability';

interface TraceMatrixCellProps {
  hasTrace: boolean;
  traceKind?: TraceRelationKind;
  direction?: TraceabilityRelation['directed'];
  memo?: string;
  isRowHighlighted: boolean;
  isColumnHighlighted: boolean;
  onToggle: () => void;
  onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

export const TraceMatrixCell: React.FC<TraceMatrixCellProps> = ({
  hasTrace,
  traceKind,
  direction,
  memo,
  isRowHighlighted,
  isColumnHighlighted,
  onToggle,
  onContextMenu,
}) => {
  const hasMemo = Boolean(memo?.trim());
  const classes = [
    'trace-matrix-cell',
    hasTrace ? 'trace-matrix-cell--active' : '',
    traceKind ? `trace-matrix-cell--kind-${traceKind}` : '',
    isRowHighlighted ? 'trace-matrix-cell--row-highlight' : '',
    isColumnHighlighted ? 'trace-matrix-cell--column-highlight' : '',
    hasMemo ? 'trace-matrix-cell--has-memo' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const tooltipParts = [] as string[];
  if (hasTrace) {
    tooltipParts.push(`トレース: ${traceKind ?? 'trace'}`);
    tooltipParts.push(`方向: ${formatDirection(direction)}`);
  } else {
    tooltipParts.push('トレースなし');
  }
  if (hasMemo) {
    tooltipParts.push(`メモ: ${memo}`);
  }
  const title = tooltipParts.join('\n');

  return (
    <button
      type="button"
      className={classes}
      onClick={onToggle}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu(event);
      }}
      title={title}
      >
      {hasTrace ? '●' : ''}
    </button>
  );
};

TraceMatrixCell.displayName = 'TraceMatrixCell';

const formatDirection = (value?: TraceabilityRelation['directed']): string => {
  switch (value) {
    case 'right_to_left':
      return '列→行';
    case 'bidirectional':
      return '双方向';
    default:
      return '行→列';
  }
};
