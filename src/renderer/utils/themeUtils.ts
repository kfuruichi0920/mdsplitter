/**
 * @file themeUtils.ts
 * @brief テーマ設定をCSS変数に反映するユーティリティ関数。
 * @details
 * ThemeSettingsの色設定と境界幅をルート要素のCSS変数として設定し、
 * スタイルシートから参照可能にする。
 * @author K.Furuichi
 * @date 2025-11-06
 * @version 0.1
 * @copyright MIT
 */

import type { ThemeColorSettings } from '@/shared/settings';
import { TRACE_RELATION_KINDS, type TraceRelationKind } from '@/shared/traceability';

/**
 * @brief CSS変数名のマッピング定義。
 * @details
 * ThemeColorSettings のプロパティ名とCSS変数名の対応表。
 */
const CSS_VAR_MAP: Record<
  Exclude<keyof ThemeColorSettings, 'relationColors' | 'connectorHighlight'>,
  string
> = {
  background: '--theme-background',
  foreground: '--theme-foreground',
  border: '--theme-border',
  primary: '--theme-primary',
  secondary: '--theme-secondary',
  cardBackground: '--theme-card-background',
  cardBorder: '--theme-card-border',
  connectorActive: '--theme-connector-active',
  connectorInactive: '--theme-connector-inactive',
};

const FALLBACK_TRACE_COLORS: Record<TraceRelationKind, string> = {
  trace: '#60a5fa',
  refines: '#10b981',
  tests: '#f97316',
  duplicates: '#f43f5e',
  satisfy: '#6366f1',
  relate: '#14b8a6',
  specialize: '#a855f7',
};

/**
 * @brief テーマ色設定をCSS変数として:root要素に適用する。
 * @param colors テーマ色設定オブジェクト。
 * @details
 * ThemeColorSettings の各プロパティを対応するCSS変数名に変換し、
 * document.documentElement.style に設定する。
 */
export const applyThemeColors = (colors: ThemeColorSettings): void => {
  const root = document.documentElement;
  Object.entries(CSS_VAR_MAP).forEach(([key, varName]) => {
    const colorKey = key as keyof typeof CSS_VAR_MAP;
    root.style.setProperty(varName, colors[colorKey]);
  });

  const highlightColor = colors.connectorHighlight ?? colors.connectorActive ?? '#93c5fd';
  root.style.setProperty('--trace-highlight-color', highlightColor);

  TRACE_RELATION_KINDS.forEach((kind) => {
    const value = colors.relationColors?.[kind] ?? FALLBACK_TRACE_COLORS[kind];
    root.style.setProperty(`--trace-color-${kind}`, value);
  });
};

/**
 * @brief 分割境界の幅をCSS変数として:root要素に適用する。
 * @param widthPx 境界幅（ピクセル数）。
 */
export const applySplitterWidth = (widthPx: number): void => {
  const root = document.documentElement;
  root.style.setProperty('--theme-splitter-width', `${widthPx}px`);
};

export const applyTypography = (fontSize: number, fontFamily: string): void => {
  const root = document.documentElement;
  root.style.setProperty('--theme-font-size', `${fontSize}px`);
  root.style.setProperty('--theme-font-family', fontFamily);
};
