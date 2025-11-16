import React from 'react';

import { TRACE_RELATION_KINDS, type TraceRelationKind, type TraceabilityRelation } from '@/shared/traceability';

interface TraceMatrixToolbarProps {
  totalTraces: number;
  untracedLeftCount: number;
  untracedRightCount: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onExportCSV?: () => void;
  onExportExcel?: () => void;
  defaultRelationKind: TraceRelationKind;
  defaultDirection: TraceabilityRelation['directed'];
  onChangeDefaultRelationKind: (kind: TraceRelationKind) => void;
  onChangeDefaultDirection: (direction: TraceabilityRelation['directed']) => void;
  confirmMemoDeletion: boolean;
  onChangeConfirmMemoDeletion: (value: boolean) => void;
  exportIncludeMemo: boolean;
  onChangeExportIncludeMemo: (value: boolean) => void;
}

export const TraceMatrixToolbar: React.FC<TraceMatrixToolbarProps> = ({
  totalTraces,
  untracedLeftCount,
  untracedRightCount,
  onRefresh,
  isRefreshing,
  onExportCSV,
  onExportExcel,
  defaultRelationKind,
  defaultDirection,
  onChangeDefaultRelationKind,
  onChangeDefaultDirection,
  confirmMemoDeletion,
  onChangeConfirmMemoDeletion,
  exportIncludeMemo,
  onChangeExportIncludeMemo,
}) => (
  <div className="trace-matrix-toolbar">
    <div className="trace-matrix-toolbar__stats">
      <span>トレース総数: {totalTraces}</span>
      <span>未トレース（行）: {untracedLeftCount}</span>
      <span>未トレース（列）: {untracedRightCount}</span>
    </div>
    <div className="trace-matrix-toolbar__actions">
      <button type="button" className="btn-secondary" onClick={onRefresh} disabled={!onRefresh || isRefreshing}>
        {isRefreshing ? '更新中…' : '更新'}
      </button>
      <button type="button" className="btn-secondary" onClick={onExportCSV} disabled={!onExportCSV}>
        CSVエクスポート
      </button>
      <button type="button" className="btn-primary" onClick={onExportExcel} disabled={!onExportExcel}>
        Excelエクスポート
      </button>
    </div>
    <div className="trace-matrix-toolbar__settings">
      <label>
        <span>デフォルト種別</span>
        <select value={defaultRelationKind} onChange={(event) => onChangeDefaultRelationKind(event.target.value as TraceRelationKind)}>
          {TRACE_RELATION_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>デフォルト方向</span>
        <select value={defaultDirection} onChange={(event) => onChangeDefaultDirection(event.target.value as TraceabilityRelation['directed'])}>
          <option value="left_to_right">行 → 列</option>
          <option value="right_to_left">列 → 行</option>
          <option value="bidirectional">双方向</option>
        </select>
      </label>
      <label className="trace-matrix-toolbar__checkbox">
        <input
          type="checkbox"
          checked={confirmMemoDeletion}
          onChange={(event) => onChangeConfirmMemoDeletion(event.target.checked)}
        />
        <span>メモ削除時に確認</span>
      </label>
      <label className="trace-matrix-toolbar__checkbox">
        <input
          type="checkbox"
          checked={exportIncludeMemo}
          onChange={(event) => onChangeExportIncludeMemo(event.target.checked)}
        />
        <span>エクスポートにメモを含める</span>
      </label>
    </div>
  </div>
);

TraceMatrixToolbar.displayName = 'TraceMatrixToolbar';
