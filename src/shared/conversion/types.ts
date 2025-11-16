import type { ConverterStrategy } from '@/shared/settings';
import type { Card } from '@/shared/workspace';

export interface NormalizedDocument {
  fileName: string;
  baseName: string;
  extension: string;
  content: string;
  isMarkdown: boolean;
}

export interface ConversionOptions {
  now?: Date;
  maxTitleLength?: number; ///< カードタイトルの最大文字数
}

export interface ConversionResult {
  cards: Card[];
  warnings: string[];
}

export type ConversionStrategy = ConverterStrategy;

export interface ConversionProgressEvent {
  phase: 'prepare' | 'convert' | 'complete';
  percent: number;
}
