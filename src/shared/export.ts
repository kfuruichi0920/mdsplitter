/**
 * @file export.ts
 * @brief エクスポート機能の共有型定義。
 */

import type { CardKind, CardStatus } from './workspace';

/**
 * @brief エクスポート形式。
 */
export type ExportFormat = 'csv' | 'impact-csv' | 'rdf' | 'json-ld' | 'markdown';

/**
 * @brief エクスポートオプション。
 */
export interface ExportOptions {
	/** 廃止カードを含めるか */
	includeDeprecated: boolean;
	/** 対象ステータス（空の場合はすべて） */
	statuses: CardStatus[];
	/** 対象種別（空の場合はすべて） */
	kinds: CardKind[];
}
