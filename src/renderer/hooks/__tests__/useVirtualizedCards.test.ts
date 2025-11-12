/**
 * @file useVirtualizedCards.test.ts
 * @brief useVirtualizedCardsフックのユニットテスト
 * @details
 * 段階的カードレンダリングの動作を検証する。
 * IntersectionObserverをモックして、追加ロード処理をテスト。
 * @author K.Furuichi
 * @date 2025-11-12
 * @version 0.1
 * @copyright MIT
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useVirtualizedCards } from '../useVirtualizedCards';
import type { Card } from '../../store/workspaceStore';

// IntersectionObserverのモック
class IntersectionObserverMock {
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;

  constructor(
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit
  ) {
    this.callback = callback;
    this.options = options;
  }

  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();

  // テスト用のヘルパー: センチネル要素がビューポートに入ったことをシミュレート
  triggerIntersection(isIntersecting: boolean) {
    this.callback(
      [
        {
          isIntersecting,
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRatio: isIntersecting ? 1 : 0,
          intersectionRect: {} as DOMRectReadOnly,
          rootBounds: null,
          target: {} as Element,
          time: Date.now(),
        },
      ],
      this as unknown as IntersectionObserver
    );
  }
}

// グローバルにIntersectionObserverをモック
let observerInstance: IntersectionObserverMock | null = null;
global.IntersectionObserver = jest.fn((callback, options) => {
  observerInstance = new IntersectionObserverMock(callback, options);
  return observerInstance as unknown as IntersectionObserver;
}) as unknown as typeof IntersectionObserver;

// requestIdleCallbackのモック
global.requestIdleCallback = jest.fn((callback) => {
  setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 0);
  return 1;
}) as unknown as typeof requestIdleCallback;

// テスト用のカードデータ生成
const createMockCard = (id: string): Card => ({
  id,
  title: `Card ${id}`,
  body: '',
  status: 'draft',
  kind: 'paragraph',
  level: 1,
  hasLeftTrace: false,
  hasRightTrace: false,
  markdownPreviewEnabled: false,
  parent_id: null,
  child_ids: [],
  prev_id: null,
  next_id: null,
  updatedAt: '2025-11-12T00:00:00.000Z',
});

const createMockCards = (count: number): Card[] => {
  return Array.from({ length: count }, (_, i) => createMockCard(`card-${i + 1}`));
};

describe('useVirtualizedCards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    observerInstance = null;
  });

  describe('初期状態', () => {
    it('初期ロード件数のカードを返す（デフォルト: 50件）', () => {
      const cards = createMockCards(100);
      const { result } = renderHook(() =>
        useVirtualizedCards({ cards })
      );

      expect(result.current.visibleCards).toHaveLength(50);
      expect(result.current.loadedCount).toBe(50);
      expect(result.current.isLoading).toBe(false);
    });

    it('カード件数が初期ロード件数未満の場合、全カードを返す', () => {
      const cards = createMockCards(30);
      const { result } = renderHook(() =>
        useVirtualizedCards({ cards })
      );

      expect(result.current.visibleCards).toHaveLength(30);
      expect(result.current.loadedCount).toBe(30);
    });

    it('カスタム初期ロード件数を指定できる', () => {
      const cards = createMockCards(200);
      const { result } = renderHook(() =>
        useVirtualizedCards({ cards, initialLoadCount: 100 })
      );

      expect(result.current.visibleCards).toHaveLength(100);
      expect(result.current.loadedCount).toBe(100);
    });

    it('IntersectionObserverが初期化される', () => {
      const cards = createMockCards(100);
      renderHook(() => useVirtualizedCards({ cards }));

      expect(global.IntersectionObserver).toHaveBeenCalled();
      expect(observerInstance?.observe).toHaveBeenCalled();
    });
  });

  describe('追加ロード', () => {
    it('センチネル要素がビューポートに入ると追加ロードが実行される', async () => {
      const cards = createMockCards(150);
      const { result } = renderHook(() =>
        useVirtualizedCards({ cards, initialLoadCount: 50 })
      );

      expect(result.current.visibleCards).toHaveLength(50);

      // センチネルがビューポートに入ったことをシミュレート
      act(() => {
        observerInstance?.triggerIntersection(true);
      });

      // requestIdleCallbackの完了を待つ
      await waitFor(() => {
        expect(result.current.visibleCards).toHaveLength(100);
      });

      expect(result.current.loadedCount).toBe(100);
      expect(result.current.isLoading).toBe(false);
    });

    it('追加ロード中は isLoading が true になる', () => {
      const cards = createMockCards(150);
      const { result } = renderHook(() =>
        useVirtualizedCards({ cards, initialLoadCount: 50 })
      );

      act(() => {
        observerInstance?.triggerIntersection(true);
      });

      // requestIdleCallbackが実行される前は isLoading が true
      expect(result.current.isLoading).toBe(true);
    });

    it('カスタム追加ロード件数を指定できる', async () => {
      const cards = createMockCards(200);
      const { result } = renderHook(() =>
        useVirtualizedCards({
          cards,
          initialLoadCount: 50,
          loadIncrement: 30,
        })
      );

      expect(result.current.visibleCards).toHaveLength(50);

      act(() => {
        observerInstance?.triggerIntersection(true);
      });

      await waitFor(() => {
        expect(result.current.visibleCards).toHaveLength(80);
      });
    });

    it('全カードをロード済みの場合、追加ロードは実行されない', async () => {
      const cards = createMockCards(50);
      const { result } = renderHook(() =>
        useVirtualizedCards({ cards, initialLoadCount: 50 })
      );

      expect(result.current.loadedCount).toBe(50);

      act(() => {
        observerInstance?.triggerIntersection(true);
      });

      // ロード件数は変わらない
      await waitFor(() => {
        expect(result.current.loadedCount).toBe(50);
      });
    });

    it('複数回の追加ロードでカード全体をロードできる', async () => {
      const cards = createMockCards(200);
      const { result } = renderHook(() =>
        useVirtualizedCards({ cards, initialLoadCount: 50 })
      );

      // 1回目のロード
      act(() => {
        observerInstance?.triggerIntersection(true);
      });

      await waitFor(() => {
        expect(result.current.loadedCount).toBe(100);
      });

      // 2回目のロード
      act(() => {
        observerInstance?.triggerIntersection(true);
      });

      await waitFor(() => {
        expect(result.current.loadedCount).toBe(150);
      });

      // 3回目のロード
      act(() => {
        observerInstance?.triggerIntersection(true);
      });

      await waitFor(() => {
        expect(result.current.loadedCount).toBe(200);
      });

      // 全カードロード済み
      expect(result.current.visibleCards).toHaveLength(200);
    });
  });

  describe('カード配列の変更', () => {
    it('カード配列が変更されたら、ロード件数がリセットされる', () => {
      const initialCards = createMockCards(100);
      const { result, rerender } = renderHook(
        ({ cards }) => useVirtualizedCards({ cards }),
        { initialProps: { cards: initialCards } }
      );

      // 初期状態
      expect(result.current.loadedCount).toBe(50);

      // カード配列を変更
      const newCards = createMockCards(150);
      rerender({ cards: newCards });

      // ロード件数がリセットされる
      expect(result.current.loadedCount).toBe(50);
      expect(result.current.visibleCards).toHaveLength(50);
    });

    it('カード配列が空になった場合、visibleCards も空になる', () => {
      const initialCards = createMockCards(100);
      const { result, rerender } = renderHook(
        ({ cards }) => useVirtualizedCards({ cards }),
        { initialProps: { cards: initialCards } }
      );

      expect(result.current.visibleCards).toHaveLength(50);

      // カード配列を空にする
      rerender({ cards: [] });

      expect(result.current.visibleCards).toHaveLength(0);
      expect(result.current.loadedCount).toBe(0);
    });
  });

  describe('クリーンアップ', () => {
    it('アンマウント時に IntersectionObserver が disconnect される', () => {
      const cards = createMockCards(100);
      const { unmount } = renderHook(() =>
        useVirtualizedCards({ cards })
      );

      unmount();

      expect(observerInstance?.disconnect).toHaveBeenCalled();
    });
  });

  describe('ref の提供', () => {
    it('containerRef と sentinelRef が提供される', () => {
      const cards = createMockCards(100);
      const { result } = renderHook(() =>
        useVirtualizedCards({ cards })
      );

      expect(result.current.containerRef).toBeDefined();
      expect(result.current.sentinelRef).toBeDefined();
      expect(result.current.containerRef.current).toBeNull(); // 初期状態では null
      expect(result.current.sentinelRef.current).toBeNull(); // 初期状態では null
    });
  });
});
