import type { ConverterStrategy } from '@/shared/settings';

import type { CardIdAssignmentRule, ConversionModalDisplayState } from '../types/conversion';

interface ConversionModalProps {
  state: ConversionModalDisplayState;
  onClose: () => void;
  onPickSource: () => void;
  onStrategyChange: (strategy: ConverterStrategy) => void;
  onConvert: () => void;
  onAcknowledgeWarning: (next: boolean) => void;
  onCancelConversion: () => void;
  onCardIdPrefixChange: (prefix: string) => void;
  onCardIdStartNumberChange: (startNumber: number) => void;
  onCardIdDigitsChange: (digits: number) => void;
  onCardIdAssignmentRuleChange: (rule: CardIdAssignmentRule) => void;
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
  onCancelConversion,
  onCardIdPrefixChange,
  onCardIdStartNumberChange,
  onCardIdDigitsChange,
  onCardIdAssignmentRuleChange,
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
          <button
            type="button"
            className="conversion-modal__close"
            onClick={onClose}
            aria-label="閉じる"
            disabled={state.converting}
          >
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
                  {source.workspaceFileName && (
                    <div>
                      <dt>_input 保存名</dt>
                      <dd>{source.workspaceFileName}</dd>
                    </div>
                  )}
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

          <section className="conversion-modal__section">
            <div className="conversion-modal__section-header">
              <h3>3. カードID設定</h3>
            </div>
            <div className="conversion-modal__card-id-settings">
              <div className="conversion-modal__field-row">
                <div className="conversion-modal__field">
                  <label htmlFor="card-id-prefix">接頭語</label>
                  <input
                    id="card-id-prefix"
                    type="text"
                    value={state.cardIdPrefix}
                    onChange={(e) => onCardIdPrefixChange(e.target.value)}
                    placeholder="例: REQ, SPEC, TEST"
                    maxLength={10}
                  />
                  <p className="conversion-modal__field-help">カードIDの接頭語を指定します（例: REQ, SPEC, TEST）</p>
                </div>
                <div className="conversion-modal__field">
                  <label htmlFor="card-id-start-number">開始番号</label>
                  <input
                    id="card-id-start-number"
                    type="number"
                    value={state.cardIdStartNumber}
                    onChange={(e) => onCardIdStartNumberChange(Number(e.target.value))}
                    min="1"
                    max="9999"
                  />
                  <p className="conversion-modal__field-help">採番の開始番号を指定します</p>
                </div>
                <div className="conversion-modal__field">
                  <label htmlFor="card-id-digits">桁数</label>
                  <input
                    id="card-id-digits"
                    type="number"
                    value={state.cardIdDigits}
                    onChange={(e) => onCardIdDigitsChange(Number(e.target.value))}
                    min="1"
                    max="6"
                  />
                  <p className="conversion-modal__field-help">番号の桁数（ゼロパディング）</p>
                </div>
              </div>

              <div className="conversion-modal__field">
                <label>付与ルール</label>
                <div className="conversion-modal__radio-group">
                  <label className="conversion-modal__radio-inline">
                    <input
                      type="radio"
                      name="card-id-rule"
                      value="all"
                      checked={state.cardIdAssignmentRule === 'all'}
                      onChange={() => onCardIdAssignmentRuleChange('all')}
                    />
                    すべてのカード
                  </label>
                  <label className="conversion-modal__radio-inline">
                    <input
                      type="radio"
                      name="card-id-rule"
                      value="heading"
                      checked={state.cardIdAssignmentRule === 'heading'}
                      onChange={() => onCardIdAssignmentRuleChange('heading')}
                    />
                    見出しのみ
                  </label>
                  <label className="conversion-modal__radio-inline">
                    <input
                      type="radio"
                      name="card-id-rule"
                      value="manual"
                      checked={state.cardIdAssignmentRule === 'manual'}
                      onChange={() => onCardIdAssignmentRuleChange('manual')}
                    />
                    手動指定のみ
                  </label>
                </div>
              </div>

              {state.cardIdPrefix && state.cardIdAssignmentRule !== 'manual' && (
                <div className="conversion-modal__preview-box">
                  <strong>プレビュー:</strong>{' '}
                  {state.cardIdPrefix}-{String(state.cardIdStartNumber).padStart(state.cardIdDigits, '0')},{' '}
                  {state.cardIdPrefix}-{String(state.cardIdStartNumber + 1).padStart(state.cardIdDigits, '0')},{' '}
                  {state.cardIdPrefix}-{String(state.cardIdStartNumber + 2).padStart(state.cardIdDigits, '0')}, ...
                </div>
              )}
            </div>
          </section>
        </div>

        {state.converting && (
          <div className="conversion-modal__progress" role="status" aria-live="polite">
            <div className="conversion-modal__progress-bar">
              <div style={{ width: `${state.progressPercent}%` }} />
            </div>
            <p>
              {state.progressMessage}
              {state.cancelRequested ? '（キャンセル要求中…）' : ''}
            </p>
          </div>
        )}

        {state.error && <div className="conversion-modal__error">{state.error}</div>}

        <footer className="conversion-modal__footer">
          <button type="button" className="btn-secondary" onClick={onCancelConversion}>
            {state.converting ? (state.cancelRequested ? 'キャンセル処理中…' : '変換を中断') : '閉じる'}
          </button>
          <button type="button" className="btn-primary" onClick={onConvert} disabled={convertDisabled}>
            {state.converting ? '変換中…' : '変換を実行'}
          </button>
        </footer>
      </div>
    </div>
  );
};
