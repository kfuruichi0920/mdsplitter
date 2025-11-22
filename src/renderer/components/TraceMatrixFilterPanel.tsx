import React from 'react';

import type { MatrixFilter } from '@/renderer/store/matrixStore';
import type { Card, CardStatus, CardKind } from '@/shared/workspace';

interface TraceMatrixFilterPanelProps {
  filter: MatrixFilter;
  onQueryChange: (field: 'rowTitleQuery' | 'columnTitleQuery', value: string) => void;
  onToggleStatus: (side: 'row' | 'column', status: CardStatus) => void;
  onToggleKind: (side: 'row' | 'column', kind: CardKind) => void;
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

const KIND_LABELS: Record<CardKind, string> = {
  heading: 'Heading',
  paragraph: 'Paragraph',
  bullet: 'Bullet',
  figure: 'Figure',
  table: 'Table',
  test: 'Test',
  qa: 'Q&A',
};

export const TraceMatrixFilterPanel: React.FC<TraceMatrixFilterPanelProps> = ({
  filter,
  onQueryChange,
  onToggleStatus,
  onToggleKind,
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
        <span>行タイトル</span>
        <input
          type="text"
          value={filter.rowTitleQuery}
          onChange={(event) => onQueryChange('rowTitleQuery', event.target.value)}
          placeholder="例: 認証"
        />
      </label>
      <label>
        <span>列タイトル</span>
        <input
          type="text"
          value={filter.columnTitleQuery}
          onChange={(event) => onQueryChange('columnTitleQuery', event.target.value)}
          placeholder="例: 認証"
        />
      </label>
    </div>
    <div className="trace-matrix-filter__section">
      <h3>ステータス</h3>
      <div className="trace-matrix-filter__status-grid trace-matrix-filter__status-grid--two-column">
        <div>
          <p className="trace-matrix-filter__subheading">行</p>
          {(Object.keys(STATUS_LABELS) as CardStatus[]).map((status) => (
            <label key={`row-${status}`} className="trace-matrix-filter__checkbox trace-matrix-filter__checkbox--compact">
              <input
                type="checkbox"
                checked={filter.statusRow[status]}
                onChange={() => onToggleStatus('row', status)}
              />
              <span>{STATUS_LABELS[status]}</span>
            </label>
          ))}
        </div>
        <div>
          <p className="trace-matrix-filter__subheading">列</p>
          {(Object.keys(STATUS_LABELS) as CardStatus[]).map((status) => (
            <label key={`col-${status}`} className="trace-matrix-filter__checkbox trace-matrix-filter__checkbox--compact">
              <input
                type="checkbox"
                checked={filter.statusColumn[status]}
                onChange={() => onToggleStatus('column', status)}
              />
              <span>{STATUS_LABELS[status]}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
    <div className="trace-matrix-filter__section">
      <h3>カード種別</h3>
      <div className="trace-matrix-filter__status-grid trace-matrix-filter__status-grid--two-column">
        <div>
          <p className="trace-matrix-filter__subheading">行</p>
          {(Object.keys(KIND_LABELS) as CardKind[]).map((kind) => (
            <label key={`row-${kind}`} className="trace-matrix-filter__checkbox trace-matrix-filter__checkbox--compact">
              <input
                type="checkbox"
                checked={filter.kindRow[kind]}
                onChange={() => onToggleKind('row', kind)}
              />
              <span>{KIND_LABELS[kind]}</span>
            </label>
          ))}
        </div>
        <div>
          <p className="trace-matrix-filter__subheading">列</p>
          {(Object.keys(KIND_LABELS) as CardKind[]).map((kind) => (
            <label key={`col-${kind}`} className="trace-matrix-filter__checkbox trace-matrix-filter__checkbox--compact">
              <input
                type="checkbox"
                checked={filter.kindColumn[kind]}
                onChange={() => onToggleKind('column', kind)}
              />
              <span>{KIND_LABELS[kind]}</span>
            </label>
          ))}
        </div>
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
      <button type="button" className="btn-primary w-full" onClick={onReset}>
        フィルタをリセット
      </button>
    </div>
  </aside>
);

TraceMatrixFilterPanel.displayName = 'TraceMatrixFilterPanel';
