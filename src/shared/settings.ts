/**
 * @file settings.ts
 * @brief アプリ設定の型定義と既定値を提供するユーティリティ。
 * @details
 * メイン/レンダラ双方から参照され、`settings.json` の読み書きに利用する。
 */

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

export interface ThemeSettings {
  mode: ThemeModeSetting;
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
    mode: 'dark'
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
