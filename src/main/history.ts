/**
 * @file history.ts
 * @brief カード履歴の永続化管理（メインプロセス側）。
 * @details
 * カードID・ファイル名ごとに履歴ファイルを生成・読込・追記・ローテーション。
 * レガシー形式の修復機能を含む。計算量O(N)（N: バージョン数）。
 * 例:
 * @code
 * const history = await loadCardHistory('req.json', 'card-0001');
 * await appendCardHistoryVersion({ fileName: 'req.json', cardId: 'card-0001', version: {...} });
 * @endcode
 * @author K.Furuichi
 * @date 2025-11-16
 * @version 0.1
 * @copyright MIT
 * @see workspace.ts, shared/history.ts
 */

import path from 'node:path';
import { promises as fs } from 'node:fs';

import { getWorkspacePaths } from './workspace';
import type { CardHistory, AppendCardHistoryRequest, CardVersion } from '../shared/history';
import { HISTORY_FILE_SUFFIX, MAX_CARD_HISTORY_VERSIONS, isCardHistory, isCardVersion } from '../shared/history';

/**
 * @brief トークン文字列をサニタイズ（英数字とハイフン・アンダースコアのみ許可）。
 * @param token サニタイズ対象トークン。
 * @return サニタイズ済み文字列。
 */
const sanitizeToken = (token: string): string => token.replace(/[^a-zA-Z0-9_-]/g, '_');

/**
 * @brief カード履歴ファイルのパスを導出。
 * @param fileName カードファイル名（例: req.json）。
 * @param cardId カードID（例: card-0001）。
 * @return 履歴ファイルの絶対パス。
 */
const deriveHistoryFilePath = (fileName: string, cardId: string): string => {
  const paths = getWorkspacePaths();
  const baseName = fileName.replace(/\.json$/i, '');
  const safeFile = sanitizeToken(baseName);
  const safeCard = sanitizeToken(cardId);
  const historyFileName = `${safeFile}_${safeCard}${HISTORY_FILE_SUFFIX}`;
  return path.join(paths.historyDir, historyFileName);
};

/**
 * @brief レガシー形式のバージョンを修復。
 * @details
 * operation欠落時にdiffフィールドから復元し、型検証。
 * @param value 未検証オブジェクト。
 * @return 修復済みCardVersion、修復不可時はnull。
 */
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

/**
 * @brief レガシー形式の履歴を修復。
 * @details
 * fileName/cardId欠落時にフォールバック値を使用し、バージョン配列を修復。
 * @param value 未検証オブジェクト。
 * @param fallbackFileName フォールバックファイル名。
 * @param fallbackCardId フォールバックカードID。
 * @return 修復済みCardHistory、修復不可時はnull。
 */
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

/**
 * @brief カード履歴を読み込む。
 * @details
 * 履歴ファイルが存在しなければ空履歴を返す。レガシー形式の場合は修復して保存。
 * @param fileName カードファイル名。
 * @param cardId カードID。
 * @return カード履歴（履歴なしの場合は空配列）。
 * @throws なし（読込失敗時は空履歴を返す）。
 */
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

/**
 * @brief 新しいバージョンをカード履歴に追加。
 * @details
 * 既存履歴を読み込み、新バージョンを追記。最大エントリ数を超えた場合は古いものを削除。
 * @param payload 追加リクエスト（fileName, cardId, version, maxEntries）。
 * @return 更新後のカード履歴。
 * @throws ファイル書き込み失敗時の例外。
 */
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

/**
 * @brief カード履歴ファイルを削除。
 * @details
 * ファイルが存在しない場合は警告のみ。
 * @param fileName カードファイル名。
 * @param cardId カードID。
 * @throws なし（削除失敗時は警告のみ）。
 */
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
