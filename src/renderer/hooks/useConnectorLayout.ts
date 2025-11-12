/**
 * @file useConnectorLayout.ts
 * @brief カード要素の座標をコネクタレイアウトストアに登録するためのフック群。
 */

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useConnectorLayoutStore } from '../store/connectorLayoutStore';
import { useSplitStore } from '../store/splitStore';

interface CardAnchorOptions {
  cardId: string;
  leafId: string;
  fileName: string; ///< カードが属するファイル名（同一cardIdの識別に使用）。
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * @brief カード要素の DOMRect を監視し、コネクタレイアウトストアへ登録する ref を返す。
 * @details
 * ResizeObserver とスクロールイベントで座標を最新化し、コネクタ描画が最新位置に追従するようにする。
 */
export const useCardConnectorAnchor = ({
  cardId,
  leafId,
  fileName,
  scrollContainerRef,
}: CardAnchorOptions): ((instance: HTMLElement | null) => void) => {
  const registerCardAnchor = useConnectorLayoutStore((state) => state.registerCardAnchor);
  const removeCardAnchor = useConnectorLayoutStore((state) => state.removeCardAnchor);

  const elementRef = useRef<HTMLElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastMeasureTimeRef = useRef<number>(0);

  const measure = useCallback(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }
    const rect = element.getBoundingClientRect();
    let isVisible = true;
    const scrollElement = scrollContainerRef?.current;
    if (scrollElement) {
      const containerRect = scrollElement.getBoundingClientRect();
      const overlapY = Math.min(rect.bottom, containerRect.bottom) - Math.max(rect.top, containerRect.top);
      const overlapX = Math.min(rect.right, containerRect.right) - Math.max(rect.left, containerRect.left);
      isVisible = overlapY > 0 && overlapX > 0;
    }
    registerCardAnchor(cardId, leafId, fileName, rect, { isVisible });
  }, [cardId, fileName, leafId, registerCardAnchor, scrollContainerRef]);

  /**
   * @brief スクロール速度に応じてスロットリング間隔を調整する測定スケジューラ。
   * @details
   * パフォーマンス最適化: 高速スクロール中は測定間隔を広げて（約30fps）、
   * CPU使用率を削減する。通常時は60fpsで測定。
   */
  const scheduleMeasure = useCallback(() => {
    if (rafRef.current !== null) {
      return;
    }

    // スクロール速度を検出
    const now = Date.now();
    const timeSinceLastMeasure = now - lastMeasureTimeRef.current;

    // 高速スクロール中は間隔を空ける（60fps → 30fps）
    // 33ms = 約30fps、前回の測定から33ms未満なら測定をスキップ
    if (timeSinceLastMeasure < 33) {
      return;
    }

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      lastMeasureTimeRef.current = Date.now();
      measure();
    });
  }, [measure]);

  const cleanupObservers = useCallback(() => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const setRef = useCallback(
    (node: HTMLElement | null) => {
      cleanupObservers();
      elementRef.current = node;

      if (!node) {
        removeCardAnchor(cardId, leafId, fileName);
        return;
      }

      measure();

      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => {
          scheduleMeasure();
        });
        observer.observe(node);
        resizeObserverRef.current = observer;
      }
    },
    [cardId, leafId, fileName, cleanupObservers, measure, removeCardAnchor, scheduleMeasure],
  );

  useLayoutEffect(() => {
    // 初期レンダリング後に位置を測定
    measure();
  }, [measure]);

  useEffect(() => {
    const scrollElement = scrollContainerRef?.current;
    if (!scrollElement) {
      return;
    }
    const handleScroll = () => {
      scheduleMeasure();
    };
    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, [scheduleMeasure, scrollContainerRef]);

  useEffect(() => {
    const handleWindowScroll = () => {
      scheduleMeasure();
    };
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleWindowScroll);
    };
  }, [scheduleMeasure]);

  useEffect(() => {
    const handleWindowResize = () => {
      scheduleMeasure();
    };
    window.addEventListener('resize', handleWindowResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [scheduleMeasure]);

  useEffect(() => {
    const handleLayoutChanged = () => {
      scheduleMeasure();
    };
    window.addEventListener('mdsplitter:card-layout-changed', handleLayoutChanged as EventListener);
    return () => {
      window.removeEventListener('mdsplitter:card-layout-changed', handleLayoutChanged as EventListener);
    };
  }, [scheduleMeasure]);

  // 分割境界移動時のレイアウトバージョン変更を監視
  const layoutVersion = useSplitStore((state) => state.layoutVersion);
  useEffect(() => {
    scheduleMeasure();
  }, [layoutVersion, scheduleMeasure]);

  useEffect(() => {
    return () => {
      cleanupObservers();
      removeCardAnchor(cardId, leafId, fileName);
    };
  }, [cardId, leafId, fileName, cleanupObservers, removeCardAnchor]);

  return setRef;
};
