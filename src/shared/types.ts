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

// Card types (to be extended in Phase 3)
export type CardInfoType = 'section' | 'paragraph' | 'bullet' | 'diagram' | 'table' | 'test' | 'qa';
export type CardStatus = 'draft' | 'review' | 'approved' | 'deprecated';

export interface Card {
  id: string;
  content: string;
  info_type: CardInfoType;
  status: CardStatus;
  parent_id: string | null;
  child_ids: string[];
  prev_id: string | null;
  next_id: string | null;
  attributes: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CardFile {
  version: string;
  label: string;
  source_file: string;
  converted_at: string;
  conversion_method: 'rule' | 'llm';
  cards: Card[];
  metadata: {
    total_cards: number;
    llm_tokens?: number;
    [key: string]: unknown;
  };
}

// Traceability types (to be extended in Phase 5)
export type TraceRelationType = 'trace' | 'refines' | 'satisfies' | 'tests' | 'verifies' | 'depends';
export type TraceDirection = 'left_to_right' | 'right_to_left' | 'bidirectional';

export interface TraceRelation {
  id: string;
  left_card_id: string;
  right_card_id: string;
  relation_type: TraceRelationType;
  direction: TraceDirection;
  memo?: string;
  created_at: string;
  updated_at: string;
}

export interface TraceFile {
  version: string;
  left_file: string;
  right_file: string;
  relations: TraceRelation[];
  created_at: string;
  updated_at: string;
}

// Application settings
export interface AppSettings {
  theme: ThemeMode;
  workDir: string;
  fontSize: number;
  autoSave: boolean;
  autoSaveInterval: number; // in seconds
  maxUndoSteps: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  llmProvider?: 'openai' | 'gemini' | 'ollama';
  llmApiKey?: string;
  llmModel?: string;
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
