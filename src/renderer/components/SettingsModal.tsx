/**
 * @file SettingsModal.tsx
 * @brief アプリ設定編集用モーダルコンポーネント。
 * @details
 * テーマ/入出力/ログ/ワークスペースの4セクションをタブ切り替えで編集し、
 * 入力値検証や最近開いたファイル管理、テーマプレビュー呼び出しを担う。
 * onChange で双方向バインディングし、保存/キャンセル操作を親へ通知する。
 * @author K.Furuichi
 * @date 2025-11-15
 * @version 0.1
 * @copyright MIT
 */
import { useMemo } from 'react';
import type {
  AppSettings,
  EncodingFallback,
  LogLevel,
  ThemeModeSetting,
  ThemeSettings,
  SerendieColorTheme,
} from '@/shared/settings';

export type SettingsSection = 'theme' | 'input' | 'logging' | 'workspace';

const SECTION_DEFINITIONS: { id: SettingsSection; label: string; icon: string }[] = [
  { id: 'theme', label: 'テーマ', icon: '🎨' },
  { id: 'input', label: '入出力', icon: '📥' },
  { id: 'logging', label: 'ログ', icon: '🧾' },
  { id: 'workspace', label: 'ワークスペース', icon: '🗂️' },
];

/**
 * @brief 設定モーダルのプロパティ。
 */
export interface SettingsModalProps {
  isOpen: boolean;
  isLoading: boolean;
  isSaving: boolean;
  settings: AppSettings | null;
  section: SettingsSection;
  validationErrors: Record<string, string>;
  errorMessage: string | null;
  onSectionChange: (section: SettingsSection) => void;
  onClose: () => void;
  onSave: () => void;
  onChange: (nextSettings: AppSettings) => void;
  onPreviewTheme: (mode: ThemeModeSetting, themeSettings: ThemeSettings) => void;
  onClearRecent: () => void;
}

/**
 * @brief 数値入力を検証し、非数値時はフォールバック値に置き換える。
 * @param value 入力値。
 * @param fallback フォールバック数値。
 * @return 有効な数値。
 */
const numberInput = (value: number, fallback: number): number => (Number.isFinite(value) ? value : fallback);

/**
 * @brief アプリ全体の設定を編集するモーダルダイアログ。
 * @details
 * セクション切り替え UI とフォームをレンダリングし、入力値を onChange で親ストアへ反映する。
 * @param props モーダル状態とイベントハンドラ群。
 * @return JSX。
 */
export const SettingsModal = ({
  isOpen,
  isLoading,
  isSaving,
  settings,
  section,
  validationErrors,
  errorMessage,
  onSectionChange,
  onClose,
  onSave,
  onChange,
  onPreviewTheme,
  onClearRecent,
}: SettingsModalProps) => {
  const encodedRecentFiles = useMemo(() => settings?.workspace.recentFiles ?? [], [settings]);

  if (!isOpen) {
    return null;
  }

  const handleThemeModeChange = (mode: ThemeModeSetting) => {
    if (!settings) {
      return;
    }
    const next: AppSettings = {
      ...settings,
      theme: {
        ...settings.theme,
        mode,
      },
    };
    onChange(next);
    onPreviewTheme(mode, next.theme);
  };

  const handleColorThemeChange = (colorTheme: SerendieColorTheme) => {
    if (!settings) {
      return;
    }
    const next: AppSettings = {
      ...settings,
      theme: {
        ...settings.theme,
        colorTheme,
      },
    };
    onChange(next);
    onPreviewTheme(next.theme.mode, next.theme);
  };

  const handleSplitterWidthChange = (value: number) => {
    if (!settings) {
      return;
    }
    const next: AppSettings = {
      ...settings,
      theme: {
        ...settings.theme,
        splitterWidth: value,
      },
    };
    onChange(next);
    onPreviewTheme(next.theme.mode, next.theme);
  };

  const handleInputChange = <K extends keyof AppSettings['input']>(key: K, value: AppSettings['input'][K]) => {
    if (!settings) {
      return;
    }
    onChange({
      ...settings,
      input: {
        ...settings.input,
        [key]: value,
      },
    });
  };

  const handleLoggingChange = <K extends keyof AppSettings['logging']>(key: K, value: AppSettings['logging'][K]) => {
    if (!settings) {
      return;
    }
    onChange({
      ...settings,
      logging: {
        ...settings.logging,
        [key]: value,
      },
    });
  };

  const renderThemeSection = () => {
    if (!settings) {
      return null;
    }
    return (
      <div className="settings-modal__section">
        <h3>テーマ</h3>
        <div className="settings-field">
          <label className="settings-field__label">モード</label>
          <div className="settings-radio-group" role="radiogroup" aria-label="テーマモード">
            {[
              { value: 'light', label: 'ライト' },
              { value: 'dark', label: 'ダーク' },
              { value: 'system', label: 'システム' },
            ].map((option) => (
              <label key={option.value} className="settings-radio">
                <input
                  type="radio"
                  name="theme-mode"
                  value={option.value}
                  checked={settings.theme.mode === option.value}
                  onChange={() => handleThemeModeChange(option.value as ThemeModeSetting)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="settings-field">
          <label className="settings-field__label">カラーテーマ</label>
          <div className="settings-radio-group" role="radiogroup" aria-label="カラーテーマ">
            {[
              { value: 'konjo', label: '紺青 (Konjo)' },
              { value: 'asagi', label: '浅葱 (Asagi)' },
              { value: 'sumire', label: '菫 (Sumire)' },
              { value: 'tsutsuji', label: '躑躅 (Tsutsuji)' },
              { value: 'kurikawa', label: '栗皮 (Kurikawa)' },
            ].map((option) => (
              <label key={option.value} className="settings-radio">
                <input
                  type="radio"
                  name="color-theme"
                  value={option.value}
                  checked={settings.theme.colorTheme === option.value}
                  onChange={() => handleColorThemeChange(option.value as SerendieColorTheme)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="settings-field">
          <label className="settings-field__label" htmlFor="splitter-width">分割境界幅 (px)</label>
          <input
            id="splitter-width"
            type="range"
            min={2}
            max={12}
            value={numberInput(settings.theme.splitterWidth, 4)}
            onChange={(event) => handleSplitterWidthChange(Number(event.target.value))}
          />
          <div className="settings-field__note">現在: {settings.theme.splitterWidth}px</div>
          {validationErrors['theme.splitterWidth'] ? (
            <div className="settings-field__error">{validationErrors['theme.splitterWidth']}</div>
          ) : null}
        </div>
      </div>
    );
  };

  const renderInputSection = () => {
    if (!settings) {
      return null;
    }
    return (
      <div className="settings-modal__section">
        <h3>入出力</h3>
        <div className="settings-field">
          <label className="settings-field__label" htmlFor="warn-size">警告サイズ (MB)</label>
          <input
            id="warn-size"
            type="number"
            min={1}
            value={numberInput(settings.input.maxWarnSizeMB, 10)}
            onChange={(event) => handleInputChange('maxWarnSizeMB', Number(event.target.value))}
          />
          {validationErrors['input.maxWarnSizeMB'] ? (
            <div className="settings-field__error">{validationErrors['input.maxWarnSizeMB']}</div>
          ) : null}
        </div>
        <div className="settings-field">
          <label className="settings-field__label" htmlFor="abort-size">中断サイズ (MB)</label>
          <input
            id="abort-size"
            type="number"
            min={1}
            value={numberInput(settings.input.maxAbortSizeMB, 200)}
            onChange={(event) => handleInputChange('maxAbortSizeMB', Number(event.target.value))}
          />
          {validationErrors['input.maxAbortSizeMB'] ? (
            <div className="settings-field__error">{validationErrors['input.maxAbortSizeMB']}</div>
          ) : null}
        </div>
        <div className="settings-field">
          <label className="settings-field__label" htmlFor="encoding-fallback">エンコーディングフォールバック</label>
          <select
            id="encoding-fallback"
            value={settings.input.encodingFallback}
            onChange={(event) => handleInputChange('encodingFallback', event.target.value as EncodingFallback)}
          >
            <option value="reject">拒否する</option>
            <option value="assume-sjis">SJISとみなす</option>
            <option value="assume-utf8">UTF-8とみなす</option>
          </select>
        </div>
        <div className="settings-field settings-field--inline">
          <label className="settings-checkbox">
            <input
              type="checkbox"
              checked={settings.input.normalizeNewline}
              onChange={(event) => handleInputChange('normalizeNewline', event.target.checked)}
            />
            <span>改行を統一する</span>
          </label>
        </div>
      </div>
    );
  };

  const renderLoggingSection = () => {
    if (!settings) {
      return null;
    }
    return (
      <div className="settings-modal__section">
        <h3>ログ</h3>
        <div className="settings-field">
          <label className="settings-field__label" htmlFor="log-level">ログレベル</label>
          <select
            id="log-level"
            value={settings.logging.level}
            onChange={(event) => handleLoggingChange('level', event.target.value as LogLevel)}
          >
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>
        </div>
        <div className="settings-field">
          <label className="settings-field__label" htmlFor="log-size">ローテーションサイズ (MB)</label>
          <input
            id="log-size"
            type="number"
            min={1}
            value={numberInput(settings.logging.maxSizeMB, 5)}
            onChange={(event) => handleLoggingChange('maxSizeMB', Number(event.target.value))}
          />
          {validationErrors['logging.maxSizeMB'] ? (
            <div className="settings-field__error">{validationErrors['logging.maxSizeMB']}</div>
          ) : null}
        </div>
        <div className="settings-field">
          <label className="settings-field__label" htmlFor="log-files">ローテーション世代数</label>
          <input
            id="log-files"
            type="number"
            min={1}
            value={numberInput(settings.logging.maxFiles, 5)}
            onChange={(event) => handleLoggingChange('maxFiles', Number(event.target.value))}
          />
          {validationErrors['logging.maxFiles'] ? (
            <div className="settings-field__error">{validationErrors['logging.maxFiles']}</div>
          ) : null}
        </div>
      </div>
    );
  };

  const renderWorkspaceSection = () => {
    if (!settings) {
      return null;
    }
    return (
      <div className="settings-modal__section">
        <h3>ワークスペース</h3>
        <div className="settings-field">
          <label className="settings-field__label">最後に開いたファイル</label>
          <div className="settings-field__note">{settings.workspace.lastOpenedFile ?? 'なし'}</div>
        </div>
        <div className="settings-field">
          <label className="settings-field__label">最近開いたファイル</label>
          {encodedRecentFiles.length === 0 ? (
            <div className="settings-field__note">履歴はありません。</div>
          ) : (
            <ul className="settings-recent-list">
              {encodedRecentFiles.map((file) => (
                <li key={file}>{file}</li>
              ))}
            </ul>
          )}
          <button type="button" className="settings-secondary-button" onClick={onClearRecent} disabled={encodedRecentFiles.length === 0}>
            履歴をクリア
          </button>
        </div>
      </div>
    );
  };

  const renderSection = () => {
    switch (section) {
      case 'theme':
        return renderThemeSection();
      case 'input':
        return renderInputSection();
      case 'logging':
        return renderLoggingSection();
      case 'workspace':
        return renderWorkspaceSection();
      default:
        return null;
    }
  };

  return (
    <div className="settings-modal__backdrop" role="presentation" onClick={onClose}>
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="settings-modal__header">
          <div>
            <h2 id="settings-modal-title">設定</h2>
            <p className="settings-modal__subtitle">アプリケーション全体の設定を編集します。</p>
          </div>
          <button type="button" className="settings-close-button" onClick={onClose} aria-label="設定を閉じる">
            ✕
          </button>
        </header>
        <div className="settings-modal__body">
          <nav className="settings-modal__nav" aria-label="設定セクション">
            {SECTION_DEFINITIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`settings-nav__item${section === item.id ? ' settings-nav__item--active' : ''}`}
                onClick={() => onSectionChange(item.id)}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="settings-modal__content">
            {isLoading || !settings ? (
              <div className="settings-loading">設定を読み込み中です...</div>
            ) : (
              renderSection()
            )}
          </div>
        </div>
        <footer className="settings-modal__footer">
          {errorMessage ? <div className="settings-modal__error">{errorMessage}</div> : <span />}
          <div className="settings-modal__actions">
            <button type="button" className="settings-secondary-button" onClick={onClose} disabled={isSaving}>
              キャンセル
            </button>
            <button type="button" className="settings-primary-button" onClick={onSave} disabled={isSaving || isLoading || !settings}>
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
