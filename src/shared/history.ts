/**
 * @file history.ts
 * @brief カード履歴データの型定義とユーティリティ。
 */

import type { Card } from './workspace';

export type CardHistoryOperation = 'create' | 'update' | 'delete' | 'merge' | 'split' | 'restore';

export interface CardVersionDiff {
  before?: Partial<Card>;
  after?: Partial<Card>;
}

export interface CardVersion {
  versionId: string;
  timestamp: string;
  operation: CardHistoryOperation;
  card: Card;
  diff?: CardVersionDiff;
  restoredFromVersionId?: string;
  restoredFromTimestamp?: string;
}

export interface CardHistory {
  cardId: string;
  fileName: string;
  versions: CardVersion[];
}

export interface AppendCardHistoryRequest {
  fileName: string;
  cardId: string;
  version: CardVersion;
  maxEntries?: number;
}

export const MAX_CARD_HISTORY_VERSIONS = 100;
export const HISTORY_FILE_SUFFIX = '_history.json';

export const isCardVersion = (value: unknown): value is CardVersion => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<CardVersion>;
  if (
    typeof candidate.versionId !== 'string' ||
    typeof candidate.timestamp !== 'string' ||
    typeof candidate.operation !== 'string' ||
    typeof candidate.card !== 'object' ||
    candidate.card === null
  ) {
    return false;
  }

  if (
    (candidate.restoredFromVersionId !== undefined && typeof candidate.restoredFromVersionId !== 'string') ||
    (candidate.restoredFromTimestamp !== undefined && typeof candidate.restoredFromTimestamp !== 'string')
  ) {
    return false;
  }

  return true;
};

export const isCardHistory = (value: unknown): value is CardHistory => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<CardHistory>;
  if (typeof candidate.cardId !== 'string' || typeof candidate.fileName !== 'string' || !Array.isArray(candidate.versions)) {
    return false;
  }
  return candidate.versions.every((version) => isCardVersion(version));
};
