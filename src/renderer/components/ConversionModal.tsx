import type { ConverterStrategy } from '@/shared/settings';

import type { ConversionModalDisplayState } from '../types/conversion';

interface ConversionModalProps {
  state: ConversionModalDisplayState;
  onClose: () => void;
  onPickSource: () => void;
  onStrategyChange: (strategy: ConverterStrategy) => void;
  onConvert: () => void;
  onAcknowledgeWarning: (next: boolean) => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
};

export const ConversionModal: React.FC<ConversionModalProps> = ({
  state,
  onClose,
  onPickSource,
  onStrategyChange,
  onConvert,
  onAcknowledgeWarning,
}) => {
  if (!state.isOpen) {
    return null;
  }

  const source = state.source;
  const convertDisabled =
    !source ||
    state.converting ||
    state.picking ||
    (source.sizeStatus === 'warn' && !state.warnAcknowledged);

  return (
    <div className="conversion-modal__backdrop" role="presentation">
      <div className="conversion-modal" role="dialog" aria-modal="true" aria-labelledby="conversion-modal-title">
        <header className="conversion-modal__header">
          <div>
            <h2 id="conversion-modal-title">カード変換</h2>
            <p className="conversion-modal__subtitle">テキスト/Markdownファイルを変換方式に沿ってカード化します。</p>
          </div>
          <button type="button" className="conversion-modal__close" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </header>

        <div className="conversion-modal__body">
          <section className="conversion-modal__section">
            <div className="conversion-modal__section-header">
              <h3>1. 入力ファイル</h3>
              <button type="button" className="toolbar-button" onClick={onPickSource} disabled={state.picking}>
                {state.picking ? '読込中…' : 'ファイルを選択'}
              </button>
            </div>
            {source ? (
              <div className="conversion-modal__file">
                <dl>
                  <div>
                    <dt>ファイル名</dt>
                    <dd>{source.fileName}</dd>
                  </div>
                  <div>
                    <dt>文字コード</dt>
                    <dd>{source.encoding}</dd>
                  </div>
                  <div>
                    <dt>サイズ</dt>
                    <dd>{formatFileSize(source.sizeBytes)}</dd>
                  </div>
                  <div>
                    <dt>行数</dt>
                    <dd>{source.lineCount}</dd>
                  </div>
                </dl>
                <div className="conversion-modal__preview" aria-label="内容プレビュー">
                  <pre>{source.preview}</pre>
                </div>
              </div>
            ) : (
              <p className="conversion-modal__empty">テキスト（.txt）または Markdown（.md）ファイルを選択してください。</p>
            )}

            {source?.sizeStatus === 'warn' && (
              <div className="conversion-modal__warning" role="alert">
                <strong>⚠️ 大容量ファイルです。</strong>
                <p>処理時間が長くなる可能性があります。続行する場合は確認チェックをオンにしてください。</p>
                <label className="conversion-modal__checkbox">
                  <input
                    type="checkbox"
                    checked={state.warnAcknowledged}
                    onChange={(event) => onAcknowledgeWarning(event.target.checked)}
                  />
                  警告を理解しました（続行します）
                </label>
              </div>
            )}
          </section>

          <section className="conversion-modal__section">
            <div className="conversion-modal__section-header">
              <h3>2. 変換方式</h3>
            </div>
            <div className="conversion-modal__strategies">
              <label className="conversion-modal__radio">
                <input
                  type="radio"
                  name="conversion-strategy"
                  value="rule"
                  checked={state.selectedStrategy === 'rule'}
                  onChange={() => onStrategyChange('rule')}
                />
                <div>
                  <strong>固定ルール</strong>
                  <p>見出し/段落/箇条書きを規則ベースで分割します。</p>
                </div>
              </label>
              <label className="conversion-modal__radio">
                <input
                  type="radio"
                  name="conversion-strategy"
                  value="llm"
                  checked={state.selectedStrategy === 'llm'}
                  onChange={() => onStrategyChange('llm')}
                />
                <div>
                  <strong>LLM 変換</strong>
                  <p>LLM アダプタを通じて要約・階層化します（スタブ実装）。</p>
                </div>
              </label>
            </div>
          </section>
        </div>

        {state.error && <div className="conversion-modal__error">{state.error}</div>}

        <footer className="conversion-modal__footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={state.converting}>
            キャンセル
          </button>
          <button type="button" className="btn-primary" onClick={onConvert} disabled={convertDisabled}>
            {state.converting ? '変換中…' : '変換を実行'}
          </button>
        </footer>
      </div>
    </div>
  );
};
