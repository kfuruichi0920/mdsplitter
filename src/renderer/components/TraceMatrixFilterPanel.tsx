import React from 'react';

import type { MatrixFilter } from '@/renderer/store/matrixStore';
import type { Card, CardStatus } from '@/shared/workspace';

interface TraceMatrixFilterPanelProps {
  filter: MatrixFilter;
  onQueryChange: (field: 'cardIdQuery' | 'titleQuery', value: string) => void;
  onToggleStatus: (status: CardStatus) => void;
  onFocusRow: (cardId: string | null) => void;
  onFocusColumn: (cardId: string | null) => void;
  onReset: () => void;
  leftCards: Card[];
  rightCards: Card[];
}

const STATUS_LABELS: Record<CardStatus, string> = {
  draft: 'Draft',
  review: 'Review',
  approved: 'Approved',
  deprecated: 'Deprecated',
};

export const TraceMatrixFilterPanel: React.FC<TraceMatrixFilterPanelProps> = ({
  filter,
  onQueryChange,
  onToggleStatus,
  onFocusRow,
  onFocusColumn,
  onReset,
  leftCards,
  rightCards,
}) => (
  <aside className="trace-matrix-filter">
    <div className="trace-matrix-filter__section">
      <h3>テキストフィルタ</h3>
      <label>
        <span>カードID</span>
        <input
          type="text"
          value={filter.cardIdQuery}
          onChange={(event) => onQueryChange('cardIdQuery', event.target.value)}
          placeholder="例: SPEC-001"
        />
      </label>
      <label>
        <span>タイトル</span>
        <input
          type="text"
          value={filter.titleQuery}
          onChange={(event) => onQueryChange('titleQuery', event.target.value)}
          placeholder="例: 認証"
        />
      </label>
    </div>
    <div className="trace-matrix-filter__section">
      <h3>ステータス</h3>
      <div className="trace-matrix-filter__status-grid">
        {(Object.keys(STATUS_LABELS) as CardStatus[]).map((status) => (
          <label key={status} className="trace-matrix-filter__checkbox">
            <input
              type="checkbox"
              checked={filter.status[status]}
              onChange={() => onToggleStatus(status)}
            />
            <span>{STATUS_LABELS[status]}</span>
          </label>
        ))}
      </div>
    </div>
    <div className="trace-matrix-filter__section">
      <h3>トレース存在フィルタ</h3>
      <label>
        <span>選択列にトレースがある行</span>
        <select
          value={filter.columnTraceFocus ?? ''}
          onChange={(event) => onFocusColumn(event.target.value || null)}
        >
          <option value="">（指定なし）</option>
          {rightCards.map((card) => (
            <option key={card.id} value={card.id}>
              {card.cardId ?? card.id} / {card.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>選択行にトレースがある列</span>
        <select
          value={filter.rowTraceFocus ?? ''}
          onChange={(event) => onFocusRow(event.target.value || null)}
        >
          <option value="">（指定なし）</option>
          {leftCards.map((card) => (
            <option key={card.id} value={card.id}>
              {card.cardId ?? card.id} / {card.title}
            </option>
          ))}
        </select>
      </label>
    </div>
    <div className="trace-matrix-filter__section">
      <button type="button" className="btn-secondary w-full" onClick={onReset}>
        フィルタをリセット
      </button>
    </div>
  </aside>
);

TraceMatrixFilterPanel.displayName = 'TraceMatrixFilterPanel';
