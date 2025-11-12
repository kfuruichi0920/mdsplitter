# カード・コネクタ表示パフォーマンス改善計画書

**作成日**: 2025-11-12
**バージョン**: 1.0
**対象**: MDSplitter アプリケーション

---

## 1. エグゼクティブサマリー

### 1.1 背景と目的

本アプリケーションは、大規模な非構造化データを「カード」として管理し、カード間のトレーサビリティを視覚的に表示するデスクトップアプリケーションです。

**現状の課題**:
- 大量のカード（最大10,000件）を表示する際のパフォーマンス低下
- 大量のトレーサビリティコネクタ（SVG）の描画コスト
- カードの可変高さ（コンパクト/詳細モード）と階層構造（折りたたみ機能）

**目標**:
- 10,000カード表示時の初期レンダリング: 8秒 → 2秒以下
- スクロール操作: 快適でスムーズな体験
- メモリ使用量: 40〜60%削減

### 1.2 アプローチ

仮想スクロール（react-window）の直接適用は、可変高さと階層構造のため困難です。そのため、**段階的な改善アプローチ**を採用します：

1. **フェーズ1**: React最適化（短期: 1〜2週間）
2. **フェーズ2**: IntersectionObserver導入（中期: 2〜3週間）
3. **フェーズ3**: 仮想スクロール導入（長期: 4〜6週間）

---

## 2. 現状分析

### 2.1 実装の概要

#### CardPanel.tsx（1,563行）
- **カード表示**: 全カード（最大10,000件）をDOMに描画
- **階層構造**: 親子関係と折りたたみ機能
- **表示モード**: コンパクト/詳細の2種類（可変高さ）
- **フィルタリング**: 文字列検索、カード種別フィルタ
- **監視**: 各カードにResizeObserver/スクロール監視を設定

#### TraceConnectorLayer.tsx（403行）
- **コネクタ描画**: SVGでベジェ曲線を描画
- **座標追跡**: スクロール時にカード位置を追跡して再描画
- **複数パネル**: 左右分割パネル間のトレーサビリティを表示

#### connectorLayoutStore.ts（166行）
- **位置管理**: 全カードのDOM位置をZustandで管理
- **座標更新**: ResizeObserverとスクロールイベントで座標更新
- **最適化**: 0.5px未満の差異は無視して不要な更新を抑制

### 2.2 パフォーマンスのボトルネック

#### ボトルネック1: DOM要素の過剰生成
- **現状**: 10,000カード × 複数DOM要素 = 数万〜数十万のDOM要素
- **影響**:
  - 初期レンダリング: 2〜8秒（仕様書 software_requirement.md:146）
  - メモリ使用量の増大
  - スクロール時の再描画コスト

#### ボトルネック2: コネクタ描画の計算コスト
- **現状**: 全カードにResizeObserver設定、スクロール時に座標再計算
- **影響**:
  - SVGパスの大量生成
  - スクロール時のrequestAnimationFrame呼び出し増加
  - CPU使用率の上昇

#### ボトルネック3: React再レンダリング
- **現状**: カード選択時に大量のコンポーネントが再レンダリング
- **影響**:
  - フィルタ変更時に全カードを再評価
  - 不要な再レンダリングの発生
  - UI応答性の低下

### 2.3 仕様上の制約

以下の機能要件を満たす必要があります（software_requirement.md:98-147）：

- カードの階層構造（親子関係）と順序関係（兄弟関係）
- 階層ごとの折りたたみ/展開機能
- コンパクト表示/詳細表示の切り替え
- トレーサビリティコネクタの表示
- 複数選択、ドラッグ&ドロップによる移動
- フィルタリング（文字列、カード種別）
- 最大10,000件のカードを快適に操作可能

---

## 3. 改善案の詳細

### 3.1 フェーズ1: React最適化（短期: 1〜2週間）

**目標**: 再レンダリング回数30〜50%削減、スクロール性能向上

#### 3.1.1 CardListItemのReact.memo化

**対象ファイル**: `src/renderer/components/CardPanel.tsx:1300-1562`

**変更内容**:
```typescript
// 変更前
const CardListItem = ({ card, isSelected, ... }: CardListItemProps) => {
  // ...
};

// 変更後
const CardListItem = React.memo(({ card, isSelected, ... }: CardListItemProps) => {
  // ...
}, (prevProps, nextProps) => {
  // カスタム比較関数で不要な再レンダリングを防ぐ
  return (
    prevProps.card.id === nextProps.card.id &&
    prevProps.card.updatedAt === nextProps.card.updatedAt &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isExpanded === nextProps.isExpanded &&
    // ... その他の重要なpropsのみ比較
  );
});
```

**効果**: カード個別の再レンダリングを30〜40%削減

**工数**: 2日

**リスク**: 低（既存の実装を変更せず、パフォーマンスのみ改善）

---

#### 3.1.2 useMemo/useCallbackの最適化

**対象ファイル**: `src/renderer/components/CardPanel.tsx`

**変更内容**:

1. **visibleCardsの計算最適化**（CardPanel.tsx:382-390）
```typescript
// 依存配列を最小化し、不要な再計算を防ぐ
const visibleCards = useMemo(() => {
  if (!filterActive) {
    return treeVisibleCards;
  }
  if (!filteredCardIds || filteredCardIds.size === 0) {
    return [];
  }
  return treeVisibleCards.filter((card) => filteredCardIds.has(card.id));
}, [filterActive, filteredCardIds, treeVisibleCards]);
```

2. **コールバック関数の安定化**
```typescript
// handleCardSelectなどの頻繁に使用される関数を最適化
const handleCardSelect = useCallback(
  (card: Card, event?: React.MouseEvent) => {
    // ... 実装は同じ
  },
  [activeTabId, leafId, selectCard, selectedCardIds] // 依存配列を最小化
);
```

**効果**: 不要な再計算を20〜30%削減

**工数**: 2日

**リスク**: 低

---

#### 3.1.3 コネクタ描画のスロットリング強化

**対象ファイル**: `src/renderer/hooks/useConnectorLayout.ts:52-60`

**現状**: 既にrequestAnimationFrameを使用しているが、さらに強化

**変更内容**:
```typescript
// スクロール速度に応じてスロットリング間隔を調整
const scheduleMeasure = useCallback(() => {
  if (rafRef.current !== null) {
    return;
  }

  // スクロール速度を検出
  const now = Date.now();
  const timeSinceLastMeasure = now - (lastMeasureTimeRef.current ?? 0);

  // 高速スクロール中は間隔を空ける（60fps → 30fps）
  if (timeSinceLastMeasure < 33) { // 約30fps
    return;
  }

  rafRef.current = window.requestAnimationFrame(() => {
    rafRef.current = null;
    lastMeasureTimeRef.current = Date.now();
    measure();
  });
}, [measure]);
```

**効果**: スクロール時のCPU使用率を20〜30%削減

**工数**: 2日

**リスク**: 低

---

#### 3.1.4 ビューポート外コネクタの非描画

**対象ファイル**: `src/renderer/components/TraceConnectorLayer.tsx:302-352`

**現状**: `showOffscreenConnectors`フラグで制御可能だが、デフォルトで有効

**変更内容**:
```typescript
// デフォルトをfalseに変更し、ビューポート外のコネクタを描画しない
const showOffscreenConnectors = useTracePreferenceStore(
  (state) => state.showOffscreenConnectors
); // デフォルト: false

// filteredLinksの生成時に、ビューポート外を除外
const filteredLinks = useMemo(() => {
  if (!isTraceVisible) {
    return [];
  }
  return traceLinks.filter((link) => {
    // ... 既存のフィルタリング

    // ビューポート外のカードのコネクタを除外
    if (!showOffscreenConnectors) {
      const source = findEntry(link.sourceCardId, link.sourceFileName, leftLeafIds);
      const target = findEntry(link.targetCardId, link.targetFileName, rightLeafIds);
      if (!source?.isVisible || !target?.isVisible) {
        return false;
      }
    }

    return true;
  });
}, [/* ... */]);
```

**効果**: 大量コネクタ表示時のSVG描画コストを40〜60%削減

**工数**: 3日

**リスク**: 中（既存のshowOffscreenConnectors機能を活用）

---

### 3.2 フェーズ2: IntersectionObserver導入（中期: 2〜3週間）

**目標**: 初期レンダリング50〜70%高速化、メモリ使用量40〜60%削減

#### 3.2.1 段階的カードレンダリングの実装

**対象ファイル**: `src/renderer/components/CardPanel.tsx`

**新規フック**: `src/renderer/hooks/useVirtualizedCards.ts`

**アプローチ**:
1. 初期表示: 最初の50〜100カード（ビューポート + バッファ）
2. スクロールに応じて追加ロード
3. ビューポート外のカードは最小限のDOM（プレースホルダー）

**変更内容**:

1. **新規フック作成**: `useVirtualizedCards.ts`
```typescript
/**
 * @file useVirtualizedCards.ts
 * @brief IntersectionObserverを使用した段階的カードレンダリング
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Card } from '../store/workspaceStore';

interface UseVirtualizedCardsOptions {
  cards: Card[];
  initialLoadCount?: number; // 初期ロード件数（デフォルト: 50）
  loadThreshold?: number; // 追加ロードの閾値（デフォルト: 0.5 = 50%）
}

interface VirtualizedCardsResult {
  visibleCards: Card[];
  isLoading: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  sentinelRef: React.RefObject<HTMLDivElement>;
}

export const useVirtualizedCards = ({
  cards,
  initialLoadCount = 50,
  loadThreshold = 0.5,
}: UseVirtualizedCardsOptions): VirtualizedCardsResult => {
  const [loadedCount, setLoadedCount] = useState(initialLoadCount);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(() => {
    if (isLoading || loadedCount >= cards.length) {
      return;
    }

    setIsLoading(true);

    // requestIdleCallbackで低優先度でロード
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        setLoadedCount((prev) => Math.min(prev + 50, cards.length));
        setIsLoading(false);
      });
    } else {
      // フォールバック
      setTimeout(() => {
        setLoadedCount((prev) => Math.min(prev + 50, cards.length));
        setIsLoading(false);
      }, 100);
    }
  }, [cards.length, isLoading, loadedCount]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      {
        root: containerRef.current,
        rootMargin: '200px', // 200px手前で追加ロード
        threshold: loadThreshold,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [loadMore, loadThreshold]);

  // カード配列が変更されたら、ロード件数をリセット
  useEffect(() => {
    setLoadedCount(Math.min(initialLoadCount, cards.length));
  }, [cards, initialLoadCount]);

  const visibleCards = cards.slice(0, loadedCount);

  return {
    visibleCards,
    isLoading,
    containerRef,
    sentinelRef,
  };
};
```

2. **CardPanelへの統合**
```typescript
// CardPanel.tsx内
import { useVirtualizedCards } from '../hooks/useVirtualizedCards';

export const CardPanel = ({ leafId, isActive = false, ... }: CardPanelProps) => {
  // ... 既存のコード

  // 段階的レンダリング
  const {
    visibleCards: renderedCards,
    isLoading: isLoadingMore,
    containerRef: virtualizedContainerRef,
    sentinelRef,
  } = useVirtualizedCards({
    cards: visibleCards, // フィルタ済みのカードリスト
    initialLoadCount: 50,
  });

  // panelScrollRefとvirtualizedContainerRefを統合
  const panelScrollRef = virtualizedContainerRef;

  return (
    <div className={panelClassName} /* ... */>
      {/* ... タブバー、ツールバー */}

      <div
        className="panel-cards"
        role="list"
        ref={panelScrollRef}
        /* ... */
      >
        {renderedCards.map((card) => (
          <CardListItem key={card.id} card={card} /* ... */ />
        ))}

        {/* センチネル要素（追加ロードのトリガー） */}
        {loadedCount < visibleCards.length && (
          <div ref={sentinelRef} className="load-more-sentinel" style={{ height: '1px' }} />
        )}

        {/* ローディング表示 */}
        {isLoadingMore && (
          <div className="panel-cards__loading">読み込み中...</div>
        )}

        {/* 既存の空メッセージ */}
        {renderedCards.length === 0 && /* ... */}
      </div>

      {/* ... コンテキストメニュー */}
    </div>
  );
};
```

**効果**:
- 初期レンダリング: 10,000カード → 50カード（DOM要素数を1/200に削減）
- 初期表示時間: 8秒 → 1秒以下
- メモリ使用量: 50〜60%削減

**工数**: 5日

**リスク**: 中
- 階層構造の折りたたみ機能との統合
- スクロール位置の維持
- フィルタリングとの併用

---

#### 3.2.2 コネクタの段階的描画

**対象ファイル**: `src/renderer/components/TraceConnectorLayer.tsx`

**変更内容**:

段階的にロードされたカードに対応して、コネクタも段階的に描画します。

```typescript
// TraceConnectorLayer.tsx内
const connectorPaths = useMemo<ConnectorPathEntry[]>(() => {
  if (direction !== 'vertical') {
    return [];
  }

  const rect = containerRect;
  if (!rect) {
    return [];
  }

  // ビューポート内（または設定でオフスクリーンも含む）のカードのみ
  const entries = Object.values(cards).filter((entry) =>
    showOffscreenConnectors || entry.isVisible
  );

  // ... 既存のコード（変更なし）

  return filteredLinks.reduce<ConnectorPathEntry[]>((acc, link) => {
    // ... 既存のロジック
  }, []);
}, [cards, containerRect, direction, filteredLinks, highlightedNodeKeys, leftLeafIds, rightLeafIds, showOffscreenConnectors]);
```

**効果**:
- コネクタ描画コストを表示カード数に比例して削減
- SVGパス数: 最大10,000 → 表示中のみ（50〜200程度）

**工数**: 4日

**リスク**: 中
- スクロール時のコネクタ再描画タイミング
- トレーサビリティのハイライト表示との整合性

---

#### 3.2.3 スクロール位置の維持

**対象ファイル**: `src/renderer/components/CardPanel.tsx`

**課題**: 段階的ロード時にスクロール位置がずれる可能性

**変更内容**:
```typescript
// useVirtualizedCards.ts内
export const useVirtualizedCards = ({ /* ... */ }) => {
  const [loadedCount, setLoadedCount] = useState(initialLoadCount);
  const scrollPositionRef = useRef<number>(0);

  const loadMore = useCallback(() => {
    // ロード前のスクロール位置を記録
    if (containerRef.current) {
      scrollPositionRef.current = containerRef.current.scrollTop;
    }

    setIsLoading(true);

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        setLoadedCount((prev) => Math.min(prev + 50, cards.length));
        setIsLoading(false);

        // ロード後、スクロール位置を復元（必要に応じて）
        // （通常は下方向スクロールなので自動的に維持される）
      });
    } else {
      // フォールバック
      setTimeout(() => {
        setLoadedCount((prev) => Math.min(prev + 50, cards.length));
        setIsLoading(false);
      }, 100);
    }
  }, [cards.length, isLoading, loadedCount]);

  // ... 残りのコード
};
```

**効果**: スムーズなスクロール体験

**工数**: 2日

**リスク**: 低

---

### 3.3 フェーズ3: 仮想スクロール導入（長期: 4〜6週間）

**目標**: 10,000カード表示で5秒 → 1秒以下、スクロール完全スムーズ化

#### 3.3.1 @tanstack/react-virtualの導入

**背景**:
- react-windowは固定高さ前提のため不適
- react-virtuosoも選択肢だが、@tanstack/react-virtualは軽量で柔軟
- 可変高さに対応

**インストール**:
```bash
npm install @tanstack/react-virtual
```

**新規フック**: `src/renderer/hooks/useVirtualizedCardList.ts`

**変更内容**:

```typescript
/**
 * @file useVirtualizedCardList.ts
 * @brief @tanstack/react-virtualを使用した仮想スクロール
 */

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import type { Card } from '../store/workspaceStore';

interface UseVirtualizedCardListOptions {
  cards: Card[];
  parentRef: React.RefObject<HTMLDivElement>;
  estimateSize?: (index: number) => number; // カードの推定高さ
}

export const useVirtualizedCardList = ({
  cards,
  parentRef,
  estimateSize,
}: UseVirtualizedCardListOptions) => {
  const rowVirtualizer = useVirtualizer({
    count: cards.length,
    getScrollElement: () => parentRef.current,
    estimateSize: estimateSize ?? (() => 100), // デフォルト推定高さ
    overscan: 10, // 前後10カードをバッファとして保持
  });

  return {
    virtualItems: rowVirtualizer.getVirtualItems(),
    totalSize: rowVirtualizer.getTotalSize(),
    measureElement: rowVirtualizer.measureElement,
  };
};
```

**CardPanelへの統合**:
```typescript
// CardPanel.tsx内
import { useVirtualizedCardList } from '../hooks/useVirtualizedCardList';

export const CardPanel = ({ leafId, isActive = false, ... }: CardPanelProps) => {
  // ... 既存のコード

  const panelScrollRef = useRef<HTMLDivElement | null>(null);

  // 仮想スクロール
  const {
    virtualItems,
    totalSize,
    measureElement,
  } = useVirtualizedCardList({
    cards: visibleCards,
    parentRef: panelScrollRef,
    estimateSize: (index) => {
      // カード表示モードに応じて推定高さを返す
      const card = visibleCards[index];
      if (!card) return 100;

      // コンパクトモード: 約40px
      // 詳細モード: 約150px（本文の長さに依存）
      return cardDisplayMode === 'compact' ? 40 : 150;
    },
  });

  return (
    <div className={panelClassName} /* ... */>
      {/* ... タブバー、ツールバー */}

      <div
        className="panel-cards"
        role="list"
        ref={panelScrollRef}
        style={{ overflow: 'auto' }}
      >
        <div
          style={{
            height: `${totalSize}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualItem) => {
            const card = visibleCards[virtualItem.index];
            if (!card) return null;

            return (
              <div
                key={card.id}
                data-index={virtualItem.index}
                ref={measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <CardListItem
                  card={card}
                  // ... その他のprops
                />
              </div>
            );
          })}
        </div>

        {/* 既存の空メッセージ */}
        {visibleCards.length === 0 && /* ... */}
      </div>

      {/* ... コンテキストメニュー */}
    </div>
  );
};
```

**効果**:
- DOM要素数: 10,000 → 表示範囲のみ（20〜50程度）
- 初期レンダリング: 1秒以下
- スクロール: 完全スムーズ（60fps維持）

**工数**: 10日

**リスク**: 高
- 既存のスクロールイベント処理との統合
- コネクタ座標計算の再実装
- 階層構造との統合

---

#### 3.3.2 階層構造対応

**課題**: 折りたたみ機能と仮想スクロールの統合

**アプローチ**:
1. `visibleCards`に折りたたみ状態を反映（既存のロジックを活用）
2. 仮想スクロールは`visibleCards`のみを対象

**変更内容**:
```typescript
// CardPanel.tsx内（既存のコード）
const treeVisibleCards = useMemo(() => {
  // 既存の階層表示ロジック（CardPanel.tsx:309-339）
  // 折りたたまれたカードは含まれない
  const result: Card[] = [];
  const cardMap = new Map(cards.map((c) => [c.id, c]));

  const isVisible = (card: Card): boolean => {
    if (!card.parent_id) {
      return true;
    }
    const parent = cardMap.get(card.parent_id);
    if (!parent) {
      return true;
    }
    if (!expandedCardIds.has(parent.id)) {
      return false;
    }
    return isVisible(parent);
  };

  cards.forEach((card) => {
    if (isVisible(card)) {
      result.push(card);
    }
  });

  return result;
}, [cards, expandedCardIds]);

// treeVisibleCardsを仮想スクロールに渡す
const { virtualItems, totalSize, measureElement } = useVirtualizedCardList({
  cards: treeVisibleCards, // フィルタ + 階層表示済み
  parentRef: panelScrollRef,
  estimateSize: (index) => {
    const card = treeVisibleCards[index];
    return cardDisplayMode === 'compact' ? 40 : 150;
  },
});
```

**効果**: 折りたたみ機能と仮想スクロールの両立

**工数**: 7日

**リスク**: 高
- 折りたたみ/展開時のスクロール位置維持
- アニメーション効果との統合

---

#### 3.3.3 コネクタ座標計算の再実装

**対象ファイル**:
- `src/renderer/hooks/useConnectorLayout.ts`
- `src/renderer/components/TraceConnectorLayer.tsx`

**課題**: 仮想スクロールでは、カードのDOM位置が動的に変化

**アプローチ**:
1. 仮想スクロールの`virtualItems`から座標を取得
2. `connectorLayoutStore`に仮想スクロール対応の座標を登録

**変更内容**:

```typescript
// useConnectorLayout.ts内
export const useCardConnectorAnchor = ({
  cardId,
  leafId,
  fileName,
  scrollContainerRef,
  virtualTransform, // 新規パラメータ: 仮想スクロールのtranslateY値
}: CardAnchorOptions & { virtualTransform?: number }) => {
  const registerCardAnchor = useConnectorLayoutStore((state) => state.registerCardAnchor);
  const removeCardAnchor = useConnectorLayoutStore((state) => state.removeCardAnchor);

  // ... 既存のコード

  const measure = useCallback(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }
    let rect = element.getBoundingClientRect();

    // 仮想スクロールのtransformを考慮
    if (virtualTransform !== undefined) {
      rect = new DOMRect(
        rect.x,
        rect.y + virtualTransform,
        rect.width,
        rect.height
      );
    }

    // ... 残りのコード
  }, [cardId, fileName, leafId, registerCardAnchor, scrollContainerRef, virtualTransform]);

  // ... 残りのコード
};
```

**CardListItemへの統合**:
```typescript
// CardPanel.tsx内
{virtualItems.map((virtualItem) => {
  const card = visibleCards[virtualItem.index];
  if (!card) return null;

  return (
    <div
      key={card.id}
      data-index={virtualItem.index}
      ref={measureElement}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        transform: `translateY(${virtualItem.start}px)`,
      }}
    >
      <CardListItem
        card={card}
        virtualTransform={virtualItem.start} // 新規prop
        // ... その他のprops
      />
    </div>
  );
})}
```

**効果**: 仮想スクロールとコネクタ描画の統合

**工数**: 8日

**リスク**: 高
- 座標計算の精度
- スクロール時のコネクタの滑らかさ

---

## 4. 実装スケジュールと工数見積もり

### 4.1 フェーズ1: React最適化（短期）

| タスク | 担当 | 工数 | スケジュール |
|--------|------|------|-------------|
| CardListItemのmemo化 | 開発者A | 2日 | 1週目 月〜火 |
| useMemo/useCallback最適化 | 開発者A | 2日 | 1週目 水〜木 |
| 不要なprops削減 | 開発者A | 1日 | 1週目 金 |
| コネクタスロットリング強化 | 開発者B | 2日 | 1週目 月〜火 |
| ビューポート外コネクタ非描画 | 開発者B | 3日 | 1週目 水〜金 |
| **小計** | - | **10日** | **2週間** |

**マイルストーン**:
- 週次レビュー: 毎週金曜日
- パフォーマンス測定: 各タスク完了後
- フェーズ1完了レビュー: 2週目金曜日

---

### 4.2 フェーズ2: IntersectionObserver導入（中期）

| タスク | 担当 | 工数 | スケジュール |
|--------|------|------|-------------|
| useVirtualizedCards作成 | 開発者A | 3日 | 3週目 月〜水 |
| CardPanelへの統合 | 開発者A | 2日 | 3週目 木〜金 |
| コネクタ段階的描画 | 開発者B | 4日 | 3週目 月〜木 |
| スクロール位置維持 | 開発者B | 2日 | 3週目 金 + 4週目 月 |
| 階層構造との統合テスト | 開発者A + B | 2日 | 4週目 火〜水 |
| バグ修正・調整 | 開発者A + B | 1日 | 4週目 木 |
| **小計** | - | **14日** | **2〜3週間** |

**マイルストーン**:
- 週次レビュー: 毎週金曜日
- パフォーマンス測定: 4週目水曜日
- フェーズ2完了レビュー: 4週目金曜日

---

### 4.3 フェーズ3: 仮想スクロール導入（長期）

| タスク | 担当 | 工数 | スケジュール |
|--------|------|------|-------------|
| @tanstack/react-virtual調査 | 開発者A | 2日 | 5週目 月〜火 |
| useVirtualizedCardList作成 | 開発者A | 3日 | 5週目 水〜金 |
| CardPanelへの統合 | 開発者A | 5日 | 6週目 月〜金 |
| 階層構造対応 | 開発者A | 7日 | 7週目 全週 + 8週目 月〜火 |
| コネクタ座標計算の再実装 | 開発者B | 8日 | 6週目 全週 + 7週目 月〜水 |
| 統合テスト | 開発者A + B | 3日 | 8週目 水〜金 |
| バグ修正・調整 | 開発者A + B | 2日 | 9週目 月〜火 |
| 性能測定・最適化 | 開発者A + B | 2日 | 9週目 水〜木 |
| ドキュメント更新 | 開発者A + B | 1日 | 9週目 金 |
| **小計** | - | **33日** | **4〜6週間** |

**マイルストーン**:
- 週次レビュー: 毎週金曜日
- パフォーマンス測定: 8週目水曜日、9週目木曜日
- フェーズ3完了レビュー: 9週目金曜日

---

### 4.4 全体スケジュール

```
週 | フェーズ | タスク概要
---|---------|----------
1  | Ph.1    | React最適化（memo化、useMemo/useCallback）
2  | Ph.1    | コネクタ最適化（スロットリング、非描画）
3  | Ph.2    | IntersectionObserver導入（段階的レンダリング）
4  | Ph.2    | 統合テスト、バグ修正
5  | Ph.3    | @tanstack/react-virtual導入
6  | Ph.3    | CardPanel統合
7  | Ph.3    | 階層構造対応
8  | Ph.3    | コネクタ座標再実装、統合テスト
9  | Ph.3    | 最終調整、性能測定、ドキュメント
```

**総工数**: 57日（約3人月）

**推奨体制**:
- 開発者2名（フロントエンド経験者）
- レビュアー1名（週次レビュー）

---

## 5. 期待効果とKPI

### 5.1 パフォーマンス指標

| 指標 | 現状 | フェーズ1後 | フェーズ2後 | フェーズ3後（目標） |
|------|------|------------|------------|-------------------|
| **初期レンダリング時間（10,000カード）** | 8秒 | 6秒 | 2秒 | < 1秒 |
| **スクロールFPS** | 30〜40fps | 40〜50fps | 50〜55fps | 60fps |
| **メモリ使用量（10,000カード）** | 500MB | 450MB | 250MB | 100〜150MB |
| **DOM要素数（10,000カード）** | 50,000+ | 50,000+ | 2,500 | 1,000以下 |
| **再レンダリング回数（カード選択時）** | 10,000 | 7,000 | 500 | 50 |

### 5.2 ユーザー体験指標

| 指標 | 現状 | フェーズ1後 | フェーズ2後 | フェーズ3後（目標） |
|------|------|------------|------------|-------------------|
| **アプリ起動時間** | 2秒 | 2秒 | 1.5秒 | 1秒 |
| **ファイル読み込み時間（1,000カード）** | 1秒 | 0.8秒 | 0.5秒 | < 0.5秒 |
| **カード選択の応答性** | 即時 | 即時 | 即時 | 即時 |
| **フィルタ適用の応答性** | 0.5秒 | 0.3秒 | 0.1秒 | < 0.1秒 |

### 5.3 測定方法

1. **Chrome DevToolsによる測定**
   - Performance タブで初期レンダリング時間を測定
   - Memory タブでメモリ使用量を測定
   - Rendering タブで FPS を測定

2. **React DevTools Profiler**
   - 再レンダリング回数とコンポーネント別の時間を測定

3. **カスタムパフォーマンスロギング**
```typescript
// パフォーマンス測定用ユーティリティ
export const measurePerformance = (label: string, fn: () => void) => {
  const start = performance.now();
  fn();
  const end = performance.now();
  console.log(`[Performance] ${label}: ${(end - start).toFixed(2)}ms`);
};
```

---

## 6. リスク管理

### 6.1 技術的リスク

| リスク | 影響度 | 発生確率 | 対策 |
|--------|--------|----------|------|
| **階層構造と仮想スクロールの統合が困難** | 高 | 中 | フェーズ2で段階的アプローチを検証 |
| **コネクタ座標計算が複雑化** | 高 | 中 | 早期にプロトタイプを作成 |
| **パフォーマンス改善が期待値に届かない** | 中 | 低 | 各フェーズで測定し、計画を調整 |
| **既存機能との互換性問題** | 中 | 中 | 各フェーズで回帰テスト実施 |
| **@tanstack/react-virtualのバグや制約** | 中 | 低 | react-virtuosoなど代替案を検討 |

### 6.2 スケジュールリスク

| リスク | 影響度 | 発生確率 | 対策 |
|--------|--------|----------|------|
| **フェーズ3の工数が予想を超える** | 高 | 中 | フェーズ2で十分な効果が出ていれば、フェーズ3を延期可能 |
| **リソース不足（開発者の確保）** | 中 | 低 | 早期に体制を確定 |
| **他機能開発との競合** | 中 | 中 | 優先順位を明確化 |

### 6.3 ユーザー影響リスク

| リスク | 影響度 | 発生確率 | 対策 |
|--------|--------|----------|------|
| **段階的ロードによるユーザー体験の変化** | 低 | 高 | ユーザーテストで検証 |
| **既存の操作感が変わる** | 低 | 低 | 既存の挙動を可能な限り維持 |

---

## 7. 代替案の検討

### 7.1 Canvas APIによるコネクタ描画

**概要**: SVGではなくCanvas APIでコネクタを描画

**メリット**:
- 大量の描画要素でもパフォーマンスが高い
- ピクセル単位での制御が可能

**デメリット**:
- インタラクティブ性（ホバー、クリック）の実装が複雑
- アクセシビリティの対応が困難
- 高DPI画面での描画品質

**結論**: SVGで十分なパフォーマンスが得られるため、現時点では不採用

---

### 7.2 Web Workerによるバックグラウンド処理

**概要**: フィルタリングやコネクタ座標計算をWeb Workerで実行

**メリット**:
- メインスレッドの負荷軽減
- UI応答性の向上

**デメリット**:
- データのシリアライズコスト
- デバッグの複雑化
- DOMアクセス不可

**結論**: フェーズ3で効果が不十分な場合に検討

---

### 7.3 react-virtuosoの採用

**概要**: @tanstack/react-virtualの代わりにreact-virtuosoを使用

**メリット**:
- 可変高さに特化
- リスト専用の実装

**デメリット**:
- バンドルサイズが大きい
- カスタマイズの柔軟性が低い

**結論**: @tanstack/react-virtualで問題が発生した場合の代替案として検討

---

## 8. 検証計画

### 8.1 単体テスト

各フェーズで以下のテストを実施：

1. **React最適化（フェーズ1）**
   - CardListItemのmemo化が正しく機能しているか
   - useMemo/useCallbackの依存配列が正しいか
   - コネクタのスロットリングが機能しているか

2. **IntersectionObserver（フェーズ2）**
   - 段階的ロードが正しく動作するか
   - スクロール位置が維持されるか
   - 階層構造が正しく表示されるか

3. **仮想スクロール（フェーズ3）**
   - 仮想スクロールが正しく機能するか
   - コネクタ座標が正しく計算されるか
   - 折りたたみ/展開が正しく動作するか

### 8.2 統合テスト

各フェーズ完了時に以下を確認：

1. **既存機能の動作確認**
   - カードの選択、移動、編集
   - トレーサビリティの表示、作成、削除
   - フィルタリング、検索
   - Undo/Redo

2. **パフォーマンス測定**
   - 上記KPIに基づく測定
   - 様々なカード数（100, 1,000, 5,000, 10,000）で測定

3. **ブラウザ互換性**
   - Electron環境での動作確認

### 8.3 ユーザー受け入れテスト（UAT）

フェーズ2および3完了後に実施：

1. **実際のデータでの動作確認**
   - 本番相当のカードファイルを使用
   - 様々な操作シナリオ

2. **ユーザビリティ評価**
   - 操作感が変わっていないか
   - 新しいローディング表示が適切か

3. **パフォーマンス体感評価**
   - 実際のユーザーによる体感速度の評価

---

## 9. 移行計画

### 9.1 フェーズごとの移行

各フェーズは既存機能を壊さずに段階的に導入：

1. **フェーズ1**: 既存コードへの変更は最小限（memo化、最適化）
2. **フェーズ2**: オプション機能としてIntersectionObserverを導入（設定で有効/無効を切り替え可能）
3. **フェーズ3**: 仮想スクロールをデフォルトで有効化

### 9.2 設定による切り替え

**settings.json**に設定項目を追加：
```json
{
  "ui": {
    "cardRendering": {
      "mode": "virtual", // "standard" | "progressive" | "virtual"
      "progressiveLoadCount": 50, // IntersectionObserver使用時の初期ロード件数
      "virtualOverscan": 10 // 仮想スクロール使用時のオーバースキャン
    }
  }
}
```

### 9.3 ロールバック計画

問題が発生した場合の対応：

1. **フェーズ1**: コミットを巻き戻し
2. **フェーズ2**: 設定で`mode: "standard"`に戻す
3. **フェーズ3**: 設定で`mode: "progressive"`に戻す

---

## 10. ドキュメント更新

### 10.1 技術ドキュメント

以下のドキュメントを更新：

1. **アーキテクチャ設計書**
   - 仮想スクロールの実装方針
   - コネクタ座標計算の変更点

2. **コンポーネント設計書**
   - CardPanel、CardListItemの変更内容
   - 新規フックの仕様

3. **パフォーマンスガイドライン**
   - 推奨カード数
   - パフォーマンス測定方法

### 10.2 ユーザードキュメント

以下の情報を追加：

1. **操作マニュアル**
   - 段階的ロードの挙動説明
   - パフォーマンス設定の説明

2. **FAQ**
   - 「カードが全部表示されない」などの質問への回答

---

## 11. 結論

### 11.1 推奨アプローチ

**段階的な改善アプローチ**を推奨します：

1. **フェーズ1（短期）**: React最適化
   - リスクが低く、即効性がある
   - 2週間で実装可能
   - 30〜50%の性能改善

2. **フェーズ2（中期）**: IntersectionObserver導入
   - 中程度のリスク、大きな効果
   - 2〜3週間で実装可能
   - 初期レンダリング50〜70%高速化

3. **フェーズ3（長期）**: 仮想スクロール導入
   - 高リスク、最大効果
   - 4〜6週間で実装可能
   - 目標性能を完全達成

### 11.2 次のアクション

1. **計画の承認**: 本計画書をレビューし、承認を得る
2. **チーム編成**: 開発者2名、レビュアー1名を確保
3. **環境準備**: 開発環境、テスト環境の整備
4. **フェーズ1開始**: 承認後、即座に着手

---

## 付録A: 参考資料

### A.1 技術資料

- [@tanstack/react-virtual ドキュメント](https://tanstack.com/virtual/latest)
- [React Performance Optimization Guide](https://react.dev/learn/render-and-commit)
- [IntersectionObserver API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)

### A.2 関連ドキュメント

- `doc/software_requirement.md`: 非機能要件（4.2章）
- `doc/user_interface_design.md`: UI設計（8.1章: 仮想スクロール）
- `src/renderer/components/CardPanel.tsx`: カード表示コンポーネント
- `src/renderer/components/TraceConnectorLayer.tsx`: コネクタ描画コンポーネント

---

**作成者**: AI Assistant
**レビュアー**: （未定）
**承認者**: （未定）
**最終更新日**: 2025-11-12
