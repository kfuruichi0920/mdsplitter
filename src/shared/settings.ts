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

export type ThemeModeSetting = 'light' | 'dark' | 'system' | 'konjo' | 'asagi' | 'sumire' | 'kurikawa' | 'tsutsuji';

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
 * @brief テーマ設定（モード + 外観設定）。
 */
export interface ThemeSettings {
  mode: ThemeModeSetting;
  splitterWidth: number;      ///< 分割境界の幅（px）
  light: ThemeColorSettings;  ///< ライトモード色設定
  dark: ThemeColorSettings;   ///< ダークモード色設定
  konjo: ThemeColorSettings;  ///< KONJO（紺青）テーマ色設定
  asagi: ThemeColorSettings;  ///< ASAGI（浅葱）テーマ色設定
  sumire: ThemeColorSettings; ///< SUMIRE（菫）テーマ色設定
  kurikawa: ThemeColorSettings; ///< KURIKAWA（栗皮）テーマ色設定
  tsutsuji: ThemeColorSettings; ///< TSUTSUJI（躑躅）テーマ色設定
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
    },
    konjo: {
      background: '#D7DEFB',
      foreground: '#073165',
      border: '#BFCEFC',
      primary: '#428CFE',
      secondary: '#8FAEFE',
      cardBackground: '#BFCEFC',
      cardBorder: '#8FAEFE',
      connectorActive: '#0A69CF',
      connectorInactive: '#8FAEFE',
      connectorHighlight: '#428CFE',
      relationColors: {
        trace: '#428CFE',
        refines: '#40A683',
        tests: '#AC9301',
        duplicates: '#F84258',
        satisfy: '#0A69CF',
        relate: '#6ED0AE',
        specialize: '#8FAEFE',
      },
    },
    asagi: {
      background: '#C3EFF4',
      foreground: '#02373C',
      border: '#9CE6EC',
      primary: '#00A3AF',
      secondary: '#64CCD3',
      cardBackground: '#9CE6EC',
      cardBorder: '#64CCD3',
      connectorActive: '#00757E',
      connectorInactive: '#64CCD3',
      connectorHighlight: '#00A3AF',
      relationColors: {
        trace: '#00A3AF',
        refines: '#40A683',
        tests: '#AC9301',
        duplicates: '#F84258',
        satisfy: '#00757E',
        relate: '#6ED0AE',
        specialize: '#64CCD3',
      },
    },
    sumire: {
      background: '#EADAEE',
      foreground: '#462352',
      border: '#DCBDE4',
      primary: '#AA61C2',
      secondary: '#CC9FD9',
      cardBackground: '#DCBDE4',
      cardBorder: '#CC9FD9',
      connectorActive: '#733B85',
      connectorInactive: '#CC9FD9',
      connectorHighlight: '#AA61C2',
      relationColors: {
        trace: '#AA61C2',
        refines: '#40A683',
        tests: '#AC9301',
        duplicates: '#F84258',
        satisfy: '#733B85',
        relate: '#6ED0AE',
        specialize: '#CC9FD9',
      },
    },
    kurikawa: {
      background: '#F7D8C9',
      foreground: '#50230D',
      border: '#F7C6B0',
      primary: '#E26324',
      secondary: '#F49567',
      cardBackground: '#F7C6B0',
      cardBorder: '#F49567',
      connectorActive: '#AB4919',
      connectorInactive: '#F49567',
      connectorHighlight: '#E26324',
      relationColors: {
        trace: '#E26324',
        refines: '#40A683',
        tests: '#AC9301',
        duplicates: '#F84258',
        satisfy: '#AB4919',
        relate: '#6ED0AE',
        specialize: '#F49567',
      },
    },
    tsutsuji: {
      background: '#F6D7E0',
      foreground: '#591734',
      border: '#F5C1D1',
      primary: '#EB4F8E',
      secondary: '#F190B4',
      cardBackground: '#F5C1D1',
      cardBorder: '#F190B4',
      connectorActive: '#932653',
      connectorInactive: '#F190B4',
      connectorHighlight: '#EB4F8E',
      relationColors: {
        trace: '#EB4F8E',
        refines: '#40A683',
        tests: '#AC9301',
        duplicates: '#F84258',
        satisfy: '#932653',
        relate: '#6ED0AE',
        specialize: '#F190B4',
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
