import React from 'react';

interface MatrixLaunchDialogProps {
  isOpen: boolean;
  files: string[];
  leftFile: string;
  rightFile: string;
  error: string | null;
  onChangeLeft: (value: string) => void;
  onChangeRight: (value: string) => void;
  onSwap: () => void;
  onSubmit: () => void;
  onClose: () => void;
}

export const MatrixLaunchDialog: React.FC<MatrixLaunchDialogProps> = ({
  isOpen,
  files,
  leftFile,
  rightFile,
  error,
  onChangeLeft,
  onChangeRight,
  onSwap,
  onSubmit,
  onClose,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="matrix-launcher" role="dialog" aria-modal="true" aria-label="トレースマトリクスを開く">
      <div className="matrix-launcher__backdrop" onClick={onClose} />
      <div className="matrix-launcher__body">
        <header className="matrix-launcher__header">
          <h2>トレースマトリクスを開く</h2>
          <button type="button" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </header>
        <div className="matrix-launcher__content">
          <label className="matrix-launcher__field">
            <span>左ファイル</span>
            <select value={leftFile} onChange={(event) => onChangeLeft(event.target.value)}>
              <option value="">選択してください</option>
              {files.map((file) => (
                <option key={file} value={file}>
                  {file}
                </option>
              ))}
            </select>
          </label>
          <label className="matrix-launcher__field">
            <span>右ファイル</span>
            <select value={rightFile} onChange={(event) => onChangeRight(event.target.value)}>
              <option value="">選択してください</option>
              {files.map((file) => (
                <option key={file} value={file}>
                  {file}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn-secondary" onClick={onSwap}>
            左右を入れ替え
          </button>
          {error ? <p className="matrix-launcher__error">{error}</p> : null}
        </div>
        <footer className="matrix-launcher__footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            キャンセル
          </button>
          <button type="button" className="btn-primary" onClick={onSubmit} disabled={files.length < 2}>
            マトリクスを開く
          </button>
        </footer>
      </div>
    </div>
  );
};

MatrixLaunchDialog.displayName = 'MatrixLaunchDialog';
