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
}

export interface ConversionResult {
  cards: Card[];
  warnings: string[];
}

export type ConversionStrategy = ConverterStrategy;
