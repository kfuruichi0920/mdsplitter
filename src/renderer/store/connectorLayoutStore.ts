
/**
 * @file connectorLayoutStore.ts
 * @brief コネクタ描画用カード要素レイアウト情報の管理ストア。
 * @details
 * 各カードのDOM位置・サイズを記録し、トレース線描画のための座標計算を補助する。
 * @author K.Furuichi
 * @date 2025-11-06
 * @version 0.1
 * @copyright MIT
 */

import { create } from 'zustand';

const toKey = (leafId: string, fileName: string, cardId: string): string => `${leafId}::${fileName}::${cardId}`;

/**
 * @brief カードアンカー位置情報。
 * @details
 * DOMRectから計算した座標・サイズ・更新時刻を保持。
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
 * @details
 * トレース線描画時の始点・終点計算に利用。
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
 * @details
 * カードごとのアンカー情報を管理し、登録・削除・リーフ単位クリアを提供。
 */
interface ConnectorLayoutState {
  cards: Record<string, CardAnchorEntry>;
  registerCardAnchor: (cardId: string, leafId: string, fileName: string, rect: DOMRectReadOnly) => void;
  removeCardAnchor: (cardId: string, leafId: string, fileName: string) => void;
  clearLeafAnchors: (leafId: string) => void;
}

/**
 * @brief DOMRect から AnchorMetrics を生成。
 * @param rect DOMRectReadOnly。
 * @return AnchorMetrics。
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
 * @brief 2つのAnchorMetricsが実質的に同じか判定。
 * @details
 * 小数点以下の微小な差異を無視し、0.5px未満の差は同一とみなす。
 * @param a 比較元。
 * @param b 比較先。
 * @return 同一ならtrue。
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
 * @details
 * カードアンカー情報の登録・削除・リーフ単位クリアを管理。
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
 * @brief ストアのアンカー情報を初期化。
 */
export const resetConnectorLayoutStore = (): void => {
  useConnectorLayoutStore.setState({ cards: {} });
};
