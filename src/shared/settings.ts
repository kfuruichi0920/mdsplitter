/**
 * @file settings.ts
 * @brief アプリ設定の型定義と既定値を提供するユーティリティ。
 * @details
 * メイン/レンダラ双方から参照され、`settings.json` の読み書きに利用する。
 * 制約: 型定義のみ、バリデーションは未実装。@todo バリデーション関数追加。
 * @author K.Furuichi
 * @date 2025-11-02
 * @version 0.1
 * @copyright MIT
 */

import type { TraceRelationKind } from './traceability';

export const SETTINGS_VERSION = 1;

export type ThemeModeSetting = 'light' | 'dark' | 'system';

export type EncodingFallback = 'reject' | 'assume-sjis' | 'assume-utf8';

export type ConverterStrategy = 'rule' | 'llm';

export type LlmProvider = 'none' | 'openai' | 'gemini' | 'ollama';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface InputSettings {
  maxWarnSizeMB: number;
  maxAbortSizeMB: number;
  encodingFallback: EncodingFallback;
  normalizeNewline: boolean;
}

export interface ConverterSettings {
  strategy: ConverterStrategy;
  timeoutMs: number | null;
}

export interface LlmSettings {
  provider: LlmProvider;
  endpoint: string;
  apiKey: string;
}

export interface LoggingSettings {
  level: LogLevel;
  maxSizeMB: number;
  maxFiles: number;
}

export interface WorkspaceSettings {
  lastOpenedFile: string | null;
  recentFiles: string[];
}

/**
 * @brief ライト/ダークモード毎の色設定。
 */
export interface ThemeColorSettings {
  background: string;         ///< 背景色
  foreground: string;         ///< 前景色（テキスト）
  border: string;             ///< 境界線色
  primary: string;            ///< プライマリ色（アクセント）
  secondary: string;          ///< セカンダリ色
  cardBackground: string;     ///< カード背景色
  cardBorder: string;         ///< カード境界線色
  connectorActive: string;    ///< アクティブコネクタ色
  connectorInactive: string;  ///< 非アクティブコネクタ色
  connectorHighlight?: string; ///< 強調時のコネクタ色
  relationColors?: Partial<Record<TraceRelationKind, string>>; ///< 種別ごとのコネクタ色
}

/**
 * @brief Serendieカラーテーマ種別。
 */
export type SerendieColorTheme = 'konjo' | 'asagi' | 'sumire' | 'tsutsuji' | 'kurikawa';

/**
 * @brief テーマ設定（モード + 外観設定）。
 */
export interface ThemeSettings {
  mode: ThemeModeSetting;
  colorTheme: SerendieColorTheme; ///< Serendieカラーテーマ
  splitterWidth: number;      ///< 分割境界の幅（px）
  light: ThemeColorSettings;  ///< ライトモード色設定
  dark: ThemeColorSettings;   ///< ダークモード色設定
}

export interface AppSettings {
  version: number;
  theme: ThemeSettings;
  input: InputSettings;
  converter: ConverterSettings;
  llm: LlmSettings;
  logging: LoggingSettings;
  workspace: WorkspaceSettings;
}

export type AppSettingsPatch = Partial<AppSettings>;

export const defaultSettings: AppSettings = {
  version: SETTINGS_VERSION,
  theme: {
    mode: 'dark',
    colorTheme: 'konjo',
    splitterWidth: 4,
    light: {
      background: '#ffffff',
      foreground: '#1f2937',
      border: '#e5e7eb',
      primary: '#3b82f6',
      secondary: '#6b7280',
      cardBackground: '#f9fafb',
      cardBorder: '#d1d5db',
      connectorActive: '#60a5fa',
      connectorInactive: '#9ca3af',
      connectorHighlight: '#93c5fd',
      relationColors: {
        trace: '#60a5fa',
        refines: '#10b981',
        tests: '#f97316',
        duplicates: '#f43f5e',
        satisfy: '#6366f1',
        relate: '#14b8a6',
        specialize: '#a855f7',
      },
    },
    dark: {
      background: '#111827',
      foreground: '#f9fafb',
      border: '#374151',
      primary: '#60a5fa',
      secondary: '#9ca3af',
      cardBackground: '#1f2937',
      cardBorder: '#4b5563',
      connectorActive: '#3b82f6',
      connectorInactive: '#6b7280',
      connectorHighlight: '#bfdbfe',
      relationColors: {
        trace: '#3b82f6',
        refines: '#34d399',
        tests: '#fb923c',
        duplicates: '#f87171',
        satisfy: '#818cf8',
        relate: '#2dd4bf',
        specialize: '#c084fc',
      },
    }
  },
  input: {
    maxWarnSizeMB: 10,
    maxAbortSizeMB: 200,
    encodingFallback: 'reject',
    normalizeNewline: true
  },
  converter: {
    strategy: 'rule',
    timeoutMs: 60000
  },
  llm: {
    provider: 'none',
    endpoint: '',
    apiKey: ''
  },
  logging: {
    level: 'info',
    maxSizeMB: 5,
    maxFiles: 5
  },
  workspace: {
    lastOpenedFile: null,
    recentFiles: []
  }
};

/**
 * @brief 設定オブジェクトをディープマージする簡易ユーティリティ。
 * @param base 既存設定。
 * @param patch 上書きする設定。
 * @return マージ後の設定。
 */
export const mergeSettings = (base: AppSettings, patch: AppSettingsPatch): AppSettings => {
  const clone = <T>(value: T): T => {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value)) as T;
  };

  const output: AppSettings = clone(base);

  const assign = (target: any, source: any) => {
    if (source === null || source === undefined) {
      return;
    }

    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (typeof target[key] !== 'object' || target[key] === null) {
          target[key] = {};
        }
        assign(target[key], value);
      } else {
        target[key] = value;
      }
    }
  };

  assign(output, patch);
  return output;
};
