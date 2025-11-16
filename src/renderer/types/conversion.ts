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

/**
 * @brief カードID付与ルール。
 * @details
 * - 'all': すべてのカードにIDを付与
 * - 'heading': 見出しカードのみIDを付与
 * - 'manual': 手動指定のみ（自動付与しない）
 */
export type CardIdAssignmentRule = 'all' | 'heading' | 'manual';

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
  // カードID自動付与設定
  cardIdPrefix: string;                     ///< ID接頭語（例: REQ, SPEC, TEST）
  cardIdStartNumber: number;                ///< 開始番号（デフォルト: 1）
  cardIdDigits: number;                     ///< 桁数（ゼロパディング、デフォルト: 3）
  cardIdAssignmentRule: CardIdAssignmentRule; ///< 付与ルール
  // タイトル設定
  maxTitleLength: number;                   ///< タイトル最大文字数（0-80、デフォルト: 20）
}
