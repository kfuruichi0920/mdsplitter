/**
 * @file useConnectorLayout.ts
 * @brief カード要素の座標をコネクタレイアウトストアに登録するためのフック群。
 */

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useConnectorLayoutStore } from '../store/connectorLayoutStore';

interface CardAnchorOptions {
  cardId: string;
  leafId: string;
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
  scrollContainerRef,
}: CardAnchorOptions): ((instance: HTMLElement | null) => void) => {
  const registerCardAnchor = useConnectorLayoutStore((state) => state.registerCardAnchor);
  const removeCardAnchor = useConnectorLayoutStore((state) => state.removeCardAnchor);

  const elementRef = useRef<HTMLElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const rafRef = useRef<number | null>(null);

  const measure = useCallback(() => {
    if (!elementRef.current) {
      return;
    }
    const rect = elementRef.current.getBoundingClientRect();
    registerCardAnchor(cardId, leafId, rect);
  }, [cardId, leafId, registerCardAnchor]);

  const scheduleMeasure = useCallback(() => {
    if (rafRef.current !== null) {
      return;
    }
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
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
        removeCardAnchor(cardId, leafId);
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
    [cardId, leafId, cleanupObservers, measure, removeCardAnchor, scheduleMeasure],
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
    return () => {
      cleanupObservers();
      removeCardAnchor(cardId, leafId);
    };
  }, [cardId, leafId, cleanupObservers, removeCardAnchor]);

  return setRef;
};
