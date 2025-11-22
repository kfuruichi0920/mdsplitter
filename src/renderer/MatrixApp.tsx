import React, { useEffect } from 'react';

import { TraceMatrixDialog } from '@/renderer/components/TraceMatrixDialog';
import { useMatrixIPC } from '@/renderer/hooks/useMatrixIPC';
import { useMatrixStore } from '@/renderer/store/matrixStore';
import { applyThemeColors, applyTypography, applySplitterWidth } from '@/renderer/utils/themeUtils';
import { defaultSettings } from '@/shared/settings';
import type { ThemeSettings } from '@/shared/settings';
import './styles.css';

export const MatrixApp: React.FC = () => {
  useMatrixIPC();
  const isLoading = useMatrixStore((state) => state.isLoading);
  const error = useMatrixStore((state) => state.error);
  const leftFile = useMatrixStore((state) => state.leftFile);
  const rightFile = useMatrixStore((state) => state.rightFile);

  useEffect(() => {
    void (async () => {
      try {
        const settings = await window.app.settings.load();
        const themeMode = resolveThemeMode(settings.theme.mode ?? defaultSettings.theme.mode);
        const colors = themeMode === 'dark' ? settings.theme.dark : settings.theme.light;
        applyThemeColors(colors);
        applyTypography(settings.theme.fontSize, settings.theme.fontFamily);
        applySplitterWidth(settings.theme.splitterWidth);
        if (themeMode === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (err) {
        console.error('[MatrixApp] failed to apply theme', err);
      }
    })();
    const unsubscribe = window.app.theme.onChanged((theme: ThemeSettings['theme']) => {
      const mode = resolveThemeMode(theme.mode ?? defaultSettings.theme.mode);
      const colors = mode === 'dark' ? theme.dark : theme.light;
      applyThemeColors(colors);
      applyTypography(theme.fontSize, theme.fontFamily);
      applySplitterWidth(theme.splitterWidth);
      if (mode === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    });
    return () => {
      unsubscribe?.();
    };
  }, []);

  const resolveThemeMode = (mode: 'light' | 'dark' | 'system'): 'light' | 'dark' => {
    if (mode === 'system') {
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return mode === 'dark' ? 'dark' : 'light';
  };

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
