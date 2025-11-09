import type { ConverterStrategy } from '@/shared/settings';

export interface ConversionSourceSummary {
  fileName: string;
  baseName: string;
  extension: string;
  sizeBytes: number;
  encoding: string;
  isMarkdown: boolean;
  sizeStatus: 'ok' | 'warn';
  content: string;
  preview: string;
  lineCount: number;
  workspaceFileName: string | null;
  workspacePath: string | null;
}

export interface ConversionModalDisplayState {
  isOpen: boolean;
  picking: boolean;
  converting: boolean;
  cancelRequested: boolean;
  error: string | null;
  source: ConversionSourceSummary | null;
  warnAcknowledged: boolean;
  selectedStrategy: ConverterStrategy;
  progressPercent: number;
  progressMessage: string;
}
