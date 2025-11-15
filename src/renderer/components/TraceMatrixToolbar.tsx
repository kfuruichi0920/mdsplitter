interface TraceMatrixToolbarProps {
  totalTraces: number;
  untracedLeftCount: number;
  untracedRightCount: number;
  onExport?: () => void;
}

export const TraceMatrixToolbar: React.FC<TraceMatrixToolbarProps> = ({
  totalTraces,
  untracedLeftCount,
  untracedRightCount,
  onExport,
}) => (
  <div className="trace-matrix-toolbar">
    <div className="trace-matrix-toolbar__stats">
      <span>トレース総数: {totalTraces}</span>
      <span>未トレース（行）: {untracedLeftCount}</span>
      <span>未トレース（列）: {untracedRightCount}</span>
    </div>
    <div className="trace-matrix-toolbar__actions">
      <button type="button" className="btn-primary" onClick={onExport} disabled={!onExport}>
        CSVエクスポート
      </button>
    </div>
  </div>
);

TraceMatrixToolbar.displayName = 'TraceMatrixToolbar';
