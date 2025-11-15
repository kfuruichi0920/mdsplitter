/**
 * @file cardPresentation.ts
 * @brief カード表示用の定数群。
 * @details
 * ステータスや種別に対応するラベル/アイコンを集中管理する。
 */

import type { CardKind, CardStatus } from '../store/workspaceStore';

/** ステータスごとの表示ラベル。 */
export const CARD_STATUS_LABEL: Record<CardStatus, string> = {
  draft: 'Draft',
  review: 'Review',
  approved: 'Approved',
  deprecated: 'Deprecated',
};

/** ステータスバッジ用クラス名。 */
export const CARD_STATUS_CLASS: Record<CardStatus, string> = {
  draft: 'card__status card__status--draft',
  review: 'card__status card__status--review',
  approved: 'card__status card__status--approved',
  deprecated: 'card__status card__status--deprecated',
};

/** カード種別に応じたアイコン。 */
export const CARD_KIND_ICON: Record<CardKind, string> = {
  heading: '🔖',
  paragraph: '📝',
  bullet: '📍',
  figure: '📊',
  table: '📅',
  test: '🧪',
  qa: '💬',
};

/** カード種別のラベル。 */
export const CARD_KIND_LABEL: Record<CardKind, string> = {
  heading: '見出し',
  paragraph: '段落',
  bullet: '箇条書き',
  figure: '図',
  table: '表',
  test: '試験',
  qa: 'QA',
};
