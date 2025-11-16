import type { TraceabilityRelation } from './traceability';

export interface MatrixOpenRequest {
  leftFile: string;
  rightFile: string;
}

export interface MatrixOpenResult {
  windowId: string;
}

export interface MatrixInitPayload {
  windowId: string;
  leftFile: string;
  rightFile: string;
}

export interface TraceChangeEvent {
  leftFile: string;
  rightFile: string;
  relations: TraceabilityRelation[];
}

export interface CardSelectionChangeEvent {
  fileName: string;
  selectedCardIds: string[];
  source: 'cards-panel' | 'matrix-window';
}

export interface MatrixCloseRequest {
  windowId: string;
}

export interface MatrixCloseResult {
  ok: boolean;
}

export type MatrixExportFormat = 'csv' | 'excel';

export interface MatrixExportRequest {
  fileName: string;
  content: string;
  format: MatrixExportFormat;
  encoding: 'utf8' | 'base64';
}

export interface MatrixExportResult {
  savedPath: string;
}
