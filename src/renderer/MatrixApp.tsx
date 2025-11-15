import React from 'react';

import { TraceMatrixDialog } from '@/renderer/components/TraceMatrixDialog';
import { useMatrixIPC } from '@/renderer/hooks/useMatrixIPC';
import { useMatrixStore } from '@/renderer/store/matrixStore';

export const MatrixApp: React.FC = () => {
  useMatrixIPC();
  const isLoading = useMatrixStore((state) => state.isLoading);
  const error = useMatrixStore((state) => state.error);
  const leftFile = useMatrixStore((state) => state.leftFile);
  const rightFile = useMatrixStore((state) => state.rightFile);

  return (
    <div className="trace-matrix-app">
      {error ? <div className="trace-matrix-status trace-matrix-status--error">{error}</div> : null}
      {!leftFile || !rightFile ? <p className="trace-matrix-status">ファイル情報を待機中…</p> : null}
      {isLoading ? <p className="trace-matrix-status">ロード中…</p> : null}
      {leftFile && rightFile ? <TraceMatrixDialog /> : null}
    </div>
  );
};

MatrixApp.displayName = 'MatrixApp';
