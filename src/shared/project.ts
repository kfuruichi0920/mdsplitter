/**
 * @file project.ts
 * @brief プロジェクト(.msp)ファイルの型定義とバリデーション。
 */
import type { ThemeSettings } from './settings';

export const PROJECT_FILE_VERSION = '1.0.0';

export interface ProjectFile {
  version: string;
  metadata: {
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
  };
  files: {
    cardFiles: string[];
    traceFiles: string[];
  };
  settings?: {
    theme?: ThemeSettings;
  };
}

export interface ProjectValidationIssue {
  level: 'error' | 'warn';
  message: string;
  file?: string;
}

export interface ProjectValidationResult {
  ok: boolean;
  issues: ProjectValidationIssue[];
}

export const isProjectFile = (value: unknown): value is ProjectFile => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const v = value as Partial<ProjectFile>;
  if (typeof v.version !== 'string' || !v.metadata || typeof v.metadata !== 'object' || !v.files || typeof v.files !== 'object') {
    return false;
  }
  const meta = v.metadata as Record<string, unknown>;
  const files = v.files as Record<string, unknown>;
  if (
    typeof meta.name !== 'string' ||
    typeof meta.description !== 'string' ||
    typeof meta.createdAt !== 'string' ||
    typeof meta.updatedAt !== 'string'
  ) {
    return false;
  }
  if (!Array.isArray(files.cardFiles) || !Array.isArray(files.traceFiles)) {
    return false;
  }
  return true;
};
