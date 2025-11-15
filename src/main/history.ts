import path from 'node:path';
import { promises as fs } from 'node:fs';

import { getWorkspacePaths } from './workspace';
import type { CardHistory, AppendCardHistoryRequest, CardVersion } from '../shared/history';
import { HISTORY_FILE_SUFFIX, MAX_CARD_HISTORY_VERSIONS, isCardHistory, isCardVersion } from '../shared/history';

const sanitizeToken = (token: string): string => token.replace(/[^a-zA-Z0-9_-]/g, '_');

const deriveHistoryFilePath = (fileName: string, cardId: string): string => {
  const paths = getWorkspacePaths();
  const baseName = fileName.replace(/\.json$/i, '');
  const safeFile = sanitizeToken(baseName);
  const safeCard = sanitizeToken(cardId);
  const historyFileName = `${safeFile}_${safeCard}${HISTORY_FILE_SUFFIX}`;
  return path.join(paths.historyDir, historyFileName);
};

const repairLegacyCardVersion = (value: unknown): CardVersion | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = { ...(value as Record<string, unknown>) };
  if (typeof record.operation !== 'string') {
    if (!record.diff && record.operation && typeof record.operation === 'object') {
      record.diff = record.operation;
    }
    record.operation = 'update';
  }
  return isCardVersion(record) ? (record as CardVersion) : null;
};

const repairLegacyHistory = (value: unknown, fallbackFileName: string, fallbackCardId: string): CardHistory | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  const rawVersions = Array.isArray(record.versions) ? record.versions : [];
  const repairedVersions: CardVersion[] = rawVersions
    .map((entry) => repairLegacyCardVersion(entry))
    .filter((entry): entry is CardVersion => Boolean(entry));

  const repairedHistory: CardHistory = {
    cardId: typeof record.cardId === 'string' ? record.cardId : fallbackCardId,
    fileName: typeof record.fileName === 'string' ? record.fileName : fallbackFileName,
    versions: repairedVersions,
  } satisfies CardHistory;

  return isCardHistory(repairedHistory) ? repairedHistory : null;
};

export const loadCardHistory = async (fileName: string, cardId: string): Promise<CardHistory> => {
  const filePath = deriveHistoryFilePath(fileName, cardId);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (isCardHistory(parsed)) {
      return parsed;
    }
    const repaired = repairLegacyHistory(parsed, fileName, cardId);
    if (repaired) {
      console.warn('[history] repaired legacy history file', filePath);
      await fs.writeFile(filePath, JSON.stringify(repaired, null, 2), 'utf8');
      return repaired;
    }
    console.warn('[history] invalid history file structure detected, resetting', filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.warn('[history] failed to load history file', filePath, error);
    }
  }
  return {
    cardId,
    fileName,
    versions: [],
  } satisfies CardHistory;
};

export const appendCardHistoryVersion = async (payload: AppendCardHistoryRequest): Promise<CardHistory> => {
  const { fileName, cardId, version, maxEntries = MAX_CARD_HISTORY_VERSIONS } = payload;
  const filePath = deriveHistoryFilePath(fileName, cardId);
  const current = await loadCardHistory(fileName, cardId);
  const nextVersions = [...current.versions, version];
  if (nextVersions.length > maxEntries) {
    nextVersions.splice(0, nextVersions.length - maxEntries);
  }
  const updated: CardHistory = {
    cardId,
    fileName,
    versions: nextVersions,
  };
  await fs.writeFile(filePath, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
};

export const deleteCardHistoryFile = async (fileName: string, cardId: string): Promise<void> => {
  const filePath = deriveHistoryFilePath(fileName, cardId);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.warn('[history] failed to delete history file', filePath, error);
    }
  }
};
