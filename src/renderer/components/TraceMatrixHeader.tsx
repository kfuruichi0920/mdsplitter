interface TraceMatrixHeaderProps {
  leftFile: string | null;
  rightFile: string | null;
  leftCount: number;
  rightCount: number;
}

export const TraceMatrixHeader: React.FC<TraceMatrixHeaderProps> = ({ leftFile, rightFile, leftCount, rightCount }) => (
  <header className="trace-matrix-header">
    <div>
      <p className="trace-matrix-header__label">行ファイル</p>
      <strong className="trace-matrix-header__value">{leftFile ?? '未選択'}</strong>
      <span className="trace-matrix-header__count">{leftCount} cards</span>
    </div>
    <div>
      <p className="trace-matrix-header__label">列ファイル</p>
      <strong className="trace-matrix-header__value">{rightFile ?? '未選択'}</strong>
      <span className="trace-matrix-header__count">{rightCount} cards</span>
    </div>
  </header>
);

TraceMatrixHeader.displayName = 'TraceMatrixHeader';
