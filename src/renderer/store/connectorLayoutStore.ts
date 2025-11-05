/**
 * @file connectorLayoutStore.ts
 * @brief コネクタ描画用にカード要素のレイアウト情報を保持するストア。
 */

import { create } from 'zustand';

const toKey = (leafId: string, fileName: string, cardId: string): string => `${leafId}::${fileName}::${cardId}`;

/**
 * @brief カードアンカー位置情報。
 */
export interface CardAnchorEntry {
  key: string;
  cardId: string;
  leafId: string;
  fileName: string; ///< カードが属するファイル名（同一cardIdの識別に使用）。
  rect: AnchorMetrics;
  updatedAt: number;
}

/**
 * @brief カードの矩形から算出したアンカー座標。
 */
export interface AnchorMetrics {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  midY: number;
}

/**
 * @brief コネクタレイアウトストアの状態。
 */
interface ConnectorLayoutState {
  cards: Record<string, CardAnchorEntry>;
  registerCardAnchor: (cardId: string, leafId: string, fileName: string, rect: DOMRectReadOnly) => void;
  removeCardAnchor: (cardId: string, leafId: string, fileName: string) => void;
  clearLeafAnchors: (leafId: string) => void;
}

/**
 * @brief DOMRect から AnchorMetrics を生成する。
 */
const rectToMetrics = (rect: DOMRectReadOnly): AnchorMetrics => ({
  top: rect.top,
  left: rect.left,
  right: rect.right,
  bottom: rect.bottom,
  width: rect.width,
  height: rect.height,
  midY: rect.top + rect.height / 2,
});

/**
 * @brief 2つのAnchorMetricsが実質的に同じかどうかを判定する。
 * @details 小数点以下の微小な差異を無視し、1px未満の差は同一とみなす。
 */
const metricsEqual = (a: AnchorMetrics, b: AnchorMetrics): boolean => {
  const threshold = 0.5; // 0.5px以下の差は無視
  return (
    Math.abs(a.top - b.top) <= threshold &&
    Math.abs(a.left - b.left) <= threshold &&
    Math.abs(a.right - b.right) <= threshold &&
    Math.abs(a.bottom - b.bottom) <= threshold &&
    Math.abs(a.width - b.width) <= threshold &&
    Math.abs(a.height - b.height) <= threshold
  );
};

/**
 * @brief コネクタレイアウトストア本体。
 */
export const useConnectorLayoutStore = create<ConnectorLayoutState>()((set) => ({
  cards: {},
  registerCardAnchor: (cardId, leafId, fileName, rect) => {
    set((state) => {
      const key = toKey(leafId, fileName, cardId);
      const metrics = rectToMetrics(rect);

      // 既存のエントリと比較し、実質的に変更がなければ更新をスキップ
      const existing = state.cards[key];
      if (existing && metricsEqual(existing.rect, metrics)) {
        return state; // 変更なし
      }

      return {
        cards: {
          ...state.cards,
          [key]: {
            key,
            cardId,
            leafId,
            fileName,
            rect: metrics,
            updatedAt: Date.now(),
          },
        },
      } satisfies Pick<ConnectorLayoutState, 'cards'>;
    });
  },
  removeCardAnchor: (cardId, leafId, fileName) => {
    set((state) => {
      const key = toKey(leafId, fileName, cardId);
      if (!(key in state.cards)) {
        return state;
      }
      const nextCards = { ...state.cards };
      delete nextCards[key];
      return { cards: nextCards } satisfies Pick<ConnectorLayoutState, 'cards'>;
    });
  },
  clearLeafAnchors: (leafId) => {
    set((state) => {
      const nextCards = Object.fromEntries(
        Object.entries(state.cards).filter(([, entry]) => entry.leafId !== leafId),
      );
      return { cards: nextCards } satisfies Pick<ConnectorLayoutState, 'cards'>;
    });
  },
}));

/**
 * @brief 単体テスト等でストアを初期化するためのユーティリティ。
 */
export const resetConnectorLayoutStore = (): void => {
  useConnectorLayoutStore.setState({ cards: {} });
};
