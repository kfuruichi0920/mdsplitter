// Theme types
export type ThemeMode = 'light' | 'dark' | 'system';

// Panel types
export interface Panel {
  id: string;
  type: 'card' | 'editor' | 'welcome';
  title: string;
  filePath?: string;
  isDirty?: boolean;
}

export interface PanelLayout {
  id: string;
  direction: 'horizontal' | 'vertical';
  children: (PanelLayout | Panel)[];
  sizes?: number[];
}

// Card types (Phase 3: Data Model Definition)
export type CardInfoType = 'heading' | 'paragraph' | 'bullet' | 'figure' | 'table' | 'test' | 'qa' | 'other';
export type CardStatus = 'draft' | 'review' | 'approved' | 'deprecated';

export interface CardContent {
  text: string;
  number?: string; // 図番号、表番号、試験番号など
}

export interface Card {
  id: string; // UUID v4
  type: CardInfoType;
  status: CardStatus;
  content: CardContent;
  updatedAt: string; // ISO 8601
  parent_id: string | null;
  child_ids: string[];
  prev_id: string | null;
  next_id: string | null;
}

export interface CardFileHeader {
  id: string; // UUID v4
  fileName: string;
  orgInputFilePath: string; // オリジナルの入力ファイルの絶対パス
  inputFilePath: string; // inputフォルダにコピーされた入力ファイルの絶対パス
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  memo?: string;
}

export interface CardFile {
  schemaVersion: number;
  header: CardFileHeader;
  body: Card[];
}

// Traceability types (Phase 3: Data Model Definition)
export type TraceRelationType = 'trace' | 'refines' | 'tests' | 'duplicates' | 'satisfy' | 'relate' | 'specialize';
export type TraceDirection = 'left_to_right' | 'right_to_left' | 'bidirectional';

export interface TraceRelation {
  id: string; // UUID v4
  left_ids: string[]; // left_fileのカードID配列
  right_ids: string[]; // right_fileのカードID配列
  type: TraceRelationType;
  directed: TraceDirection;
  memo?: string;
}

export interface TraceFileHeader {
  id: string; // UUID v4
  fileName: string;
  leftFilePath: string; // 左側カードファイルの絶対パス
  rightFilePath: string; // 右側カードファイルの絶対パス
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  memo?: string;
}

export interface TraceFile {
  schemaVersion: number;
  header: TraceFileHeader;
  body: TraceRelation[];
}

// Application settings (Phase 3: Extended Settings)
export type LLMProvider = 'openai' | 'gemini' | 'ollama' | 'none';
export type ConverterStrategy = 'rule' | 'llm';
export type EncodingFallback = 'reject' | 'assume-sjis' | 'assume-utf8';
export type FileLockingMode = 'optimistic' | 'pessimistic' | 'none';
export type AutoReloadPolicy = 'prompt' | 'auto' | 'ignore';

export interface AppSettings {
  // ファイル入力
  input: {
    maxWarnSizeMB: number;
    maxAbortSizeMB: number;
  };
  file: {
    encodingFallback: EncodingFallback;
    normalizeNewline: boolean;
  };

  // 変換方式
  converter: {
    strategy: ConverterStrategy;
    timeoutMs: number | 'none';
  };

  // LLM設定
  llm: {
    provider: LLMProvider;
    endpoint?: string;
    model?: string;
    temperature: number;
    maxTokens?: number;
    allowCloud: boolean;
    redaction?: {
      enabled: boolean;
    };
    apiKey?: string;
    timeoutMs?: number;
    maxConcurrency?: number;
  };

  // ログ
  log: {
    logLevel: 'info' | 'warn' | 'error' | 'debug';
    logRotation?: {
      maxFileSizeMB: number;
      maxFiles: number;
      retentionDays: number;
    };
  };

  // 履歴／Undo/Redo
  history: {
    maxDepth: number;
    perFile: boolean;
    persistOnExit: boolean;
  };

  // UI／表示設定
  ui: {
    theme: ThemeMode;
    locale?: string;
    font?: {
      family?: string;
      size?: number;
    };
    window?: {
      startMaximized: boolean;
      bounds?: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    };
    tab?: {
      maxWidth?: number;
      height?: number;
    };
    highlightColors?: {
      selected?: string;
      edited?: string;
      traceHighlight?: string;
    };
    autoSave?: {
      enabled: boolean;
      intervalMs: number;
    };
  };

  // トレーサビリティ
  trace?: {
    defaultDirection: TraceDirection;
    highlightColors?: {
      selected?: string;
      traceHighlight?: string;
    };
  };

  // ファイル監視
  fileWatcher?: {
    enabled: boolean;
    debounceMs: number;
    autoReloadPolicy: AutoReloadPolicy;
    ignorePatterns?: string[];
  };

  // 検索／置換
  search?: {
    defaultRegex: boolean;
    maxResults: number;
    caseSensitiveDefault: boolean;
  };

  // 同時編集／ロック
  concurrency?: {
    fileLocking: FileLockingMode;
    maxOpenFiles: number;
  };

  // その他運用
  recentFiles?: {
    limit: number;
  };
  shortcuts?: Record<string, string>;

  // 作業ディレクトリ（後方互換性のため残す）
  workDir: string;
}

// Log types
export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  details?: unknown;
}

// File system types
export interface FileInfo {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
}

// LLM types
export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
}

export interface LLMRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface LLMConfigValidation {
  valid: boolean;
  message: string;
}

// File I/O types
export interface FileOpenResult {
  success: boolean;
  filePath?: string;
  content?: string;
  encoding?: string;
  error?: string;
}

export interface FileSaveResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface FileDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles'>;
}
