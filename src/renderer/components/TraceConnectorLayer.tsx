/**
 * @file TraceConnectorLayer.tsx
 * @brief トレースリンクをSVGで描画するオーバーレイレイヤー。
 * @details
 * 左右のカードペイン間に存在するトレースリンクを監視し、可視状態・フィルタ条件・
 * ビューポート座標に基づいて平滑なベジェ曲線を動的生成する。Electron/Reactの
 * コンテキストで使用され、カードの選択状態や設定ストアと連携する。
 * 例:
 * @code
 * <TraceConnectorLayer
 *   containerRef={containerRef}
 *   direction="vertical"
 *   splitRatio={0.5}
 *   nodeId="split-root"
 *   leftLeafIds={["left"]}
 *   rightLeafIds={["right"]}
 * />
 * @endcode
 * 計測頻度の自動調整やビューポート外コネクタの抑制など、パフォーマンス最適化を内包。
 * @author md2data
 * @date 2024-11-17
 * @version 0.1
 * @copyright MIT
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConnectorLayoutStore, type CardAnchorEntry } from '../store/connectorLayoutStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { shallow } from 'zustand/shallow';
import { useTraceStore, type TraceSeed, toTraceNodeKey, splitTraceNodeKey } from '../store/traceStore';
import { useTracePreferenceStore, makeCardKey, type TraceConnectorSide } from '../store/tracePreferenceStore';
import type { TraceabilityLink } from '@/shared/traceability';

/**
 * @brief TraceConnectorLayerが利用するプロパティ型。
 * @details
 * 左右リーフの識別子や分割比など、描画領域のレイアウト情報と状態同期用IDを受け取る。
 */
interface TraceConnectorLayerProps {
  containerRef: React.RefObject<HTMLDivElement>;
  direction: 'horizontal' | 'vertical';
  splitRatio: number;
  nodeId: string;
  leftLeafIds: string[];
  rightLeafIds: string[];
}

/**
 * @brief SVGパス生成に使用する一時データ構造。
 */
interface ConnectorPathEntry {
  id: string;
  path: string;
  className: string;
}

/**
 * @brief リンク方向を左右入れ替え時に反転するユーティリティ。
 * @param direction 元の方向（forward/backward/bidirectional）。
 * @return 入れ替え後の方向。双方向の場合はそのまま。
 */
const directionSwap = (direction: 'forward' | 'backward' | 'bidirectional'): 'forward' | 'backward' | 'bidirectional' => {
  if (direction === 'forward') return 'backward';
  if (direction === 'backward') return 'forward';
  return 'bidirectional';
};

/**
 * @brief カードアンカーの画面座標をローカルSVG座標へ変換する。
 * @param anchor 対象カードアンカー情報。
 * @param rect SVGコンテナの境界ボックス。
 * @param side 端点側（left/right）。
 * @return SVGローカル座標系での{x, y}。
 */
const toLocalPoint = (anchor: CardAnchorEntry, rect: DOMRectReadOnly, side: 'left' | 'right') => {
  const x = side === 'left' ? anchor.rect.left : anchor.rect.right;
  return {
    x: x - rect.left,
    y: anchor.rect.midY - rect.top,
  };
};

interface FilePair {
  left: string;
  right: string;
}

/**
 * @brief 左右ペインでアクティブなファイルのデカルト積を返すカスタムフック。
 * @details
 * ファイル名文字列を連結し、依存配列が安定するようメモ化することで再レンダリングを抑制。
 * @param leftLeafIds 左側リーフID群。
 * @param rightLeafIds 右側リーフID群。
 * @return FilePair配列。空リーフの場合は空配列。
 */
const useActiveFiles = (leftLeafIds: string[], rightLeafIds: string[]) => {
  // ファイル名をソート済み文字列として取得（参照の安定性のため）
  const leftFilesStr = useWorkspaceStore(
    (state) => {
      const getActiveFile = (leafId: string): string | null => {
        const leaf = state.leafs[leafId];
        if (!leaf?.activeTabId) {
          return null;
        }
        const tab = state.tabs[leaf.activeTabId];
        return tab?.fileName ?? null;
      };

      const leftFiles = leftLeafIds.map(getActiveFile).filter((file): file is string => file !== null);
      return leftFiles.sort().join('|||');
    },
  );

  const rightFilesStr = useWorkspaceStore(
    (state) => {
      const getActiveFile = (leafId: string): string | null => {
        const leaf = state.leafs[leafId];
        if (!leaf?.activeTabId) {
          return null;
        }
        const tab = state.tabs[leaf.activeTabId];
        return tab?.fileName ?? null;
      };

      const rightFiles = rightLeafIds.map(getActiveFile).filter((file): file is string => file !== null);
      return rightFiles.sort().join('|||');
    },
  );

  // ペアの生成をuseMemoで安定化（文字列が変わった時のみ再計算）
  return useMemo(() => {
    const leftFiles = leftFilesStr ? leftFilesStr.split('|||') : [];
    const rightFiles = rightFilesStr ? rightFilesStr.split('|||') : [];

    const pairs: FilePair[] = [];
    for (const left of leftFiles) {
      for (const right of rightFiles) {
        pairs.push({ left, right });
      }
    }
    return pairs;
  }, [leftFilesStr, rightFilesStr]);
};

  /**
   * @brief トレースリンクを描画するReactコンポーネント。
   * @details
   * directionがverticalのときにのみSVGレイヤーを表示し、カード座標とトレース設定を元に
   * ベジェ曲線パスを生成する。測定のスロットリング、ファイルペア毎のトレースロード、
   * 選択ノードのハイライトを内包。O(N)でリンクを走査する。
   * @param props TraceConnectorLayerProps。
   * @return SVGを含むdiv。非対応方向ではnull。
   */
export const TraceConnectorLayer = ({
  containerRef,
  direction,
  splitRatio,
  nodeId,
  leftLeafIds,
  rightLeafIds,
}: TraceConnectorLayerProps) => {
  const [containerRect, setContainerRect] = useState<DOMRectReadOnly | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastMeasureTimeRef = useRef<number>(0);

  // 測定処理をuseCallbackでメモ化
  const measure = useCallback(() => {
    const element = containerRef.current;
    if (!element) {
      setContainerRect(null);
      return;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return;
    }
    setContainerRect(rect);
  }, [containerRef]);

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

  // コンテナの監視
  useEffect(() => {
    if (direction !== 'vertical') {
      setContainerRect(null);
      return () => {};
    }

    const element = containerRef.current;
    if (!element) {
      setContainerRect(null);
      return () => {};
    }

    measure();
    let observer: ResizeObserver | null = null;
    const handleWindowResize = () => scheduleMeasure();

    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(scheduleMeasure);
      observer.observe(element);
      resizeObserverRef.current = observer;
    } else {
      // jsdom 環境などで ResizeObserver が未定義の場合のフォールバック
      resizeObserverRef.current = null;
    }

    window.addEventListener('resize', handleWindowResize, { passive: true });

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      observer?.disconnect();
      resizeObserverRef.current = null;
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [containerRef, direction, measure, scheduleMeasure]);

  // splitRatio変更時にコンテナ矩形を再測定（分割境界ドラッグ対応）
  useEffect(() => {
    if (direction !== 'vertical') {
      return;
    }
    scheduleMeasure();
  }, [splitRatio, direction, scheduleMeasure]);

  const cards = useConnectorLayoutStore((state) => state.cards);
  const tabsSnapshot = useWorkspaceStore((state) => state.tabs);
  const selectionSeeds = useMemo<TraceSeed[]>(() => {
    const seeds: TraceSeed[] = [];
    Object.values(tabsSnapshot).forEach((tab) => {
      if (tab?.fileName && tab.selectedCardIds.size > 0) {
        tab.selectedCardIds.forEach((cardId) => {
          seeds.push({ fileName: tab.fileName as string, cardId });
        });
      }
    });
    return seeds;
  }, [tabsSnapshot]);
  const seedsByFile = useMemo(() => {
    const map = new Map<string, Set<string>>();
    selectionSeeds.forEach(({ fileName, cardId }) => {
      if (!map.has(fileName)) {
        map.set(fileName, new Set<string>());
      }
      map.get(fileName)?.add(cardId);
    });
    return map;
  }, [selectionSeeds]);
  const loadTraceForPair = useTraceStore((state) => state.loadTraceForPair);

  const activeFilePairs = useActiveFiles(leftLeafIds, rightLeafIds);

  useEffect(() => {
    if (direction !== 'vertical') {
      return;
    }
    // 全てのペアに対してトレースファイルを読み込む
    for (const pair of activeFilePairs) {
      void loadTraceForPair(pair.left, pair.right);
    }
  }, [activeFilePairs, direction, loadTraceForPair]);

  // ファイルペア情報を含む拡張リンク型
  interface ExtendedLink extends TraceabilityLink {
    sourceFileName: string;
    targetFileName: string;
  }

  // 全てのペアからトレースリンクを収集（ファイル情報を付加）
  const traceLinks = useTraceStore(
    (state) => {
      const allLinks: ExtendedLink[] = [];
      for (const pair of activeFilePairs) {
        const pairKey = `${pair.left}|||${pair.right}`;
        const entry = state.cache[pairKey];
        if (entry?.links) {
          // 各リンクにファイル情報を付加
          entry.links.forEach((link) => {
            allLinks.push({
              ...link,
              sourceFileName: pair.left,
              targetFileName: pair.right,
            });
          });
        }
      }
      return allLinks;
    },
    shallow,
  );
  const isTraceVisible = useTracePreferenceStore((state) => state.isVisible);
  const enabledRelationKinds = useTracePreferenceStore((state) => state.enabledKinds, shallow);
  const cardVisibilityMap = useTracePreferenceStore((state) => state.mutedCards, shallow);
  const showOffscreenConnectors = useTracePreferenceStore((state) => state.showOffscreenConnectors);

  const isCardSideVisible = useCallback(
    (fileName: string, cardId: string, side: TraceConnectorSide) => {
      const key = makeCardKey(fileName, cardId, side);
      return cardVisibilityMap[key] !== false;
    },
    [cardVisibilityMap],
  );

  const excludeSelfTrace = useTracePreferenceStore((state) => state.excludeSelfTrace);
  const traceCacheSnapshot = useTraceStore((state) => state.cache, shallow);
  const highlightedNodeKeys = useMemo(() => {
    if (selectionSeeds.length === 0) {
      return new Set<string>();
    }
    const related = useTraceStore.getState().getRelatedNodeKeys(selectionSeeds);
    selectionSeeds.forEach((seed) => related.add(toTraceNodeKey(seed.fileName, seed.cardId)));
    if (excludeSelfTrace) {
      Array.from(related).forEach((nodeKey) => {
        const { fileName, cardId } = splitTraceNodeKey(nodeKey);
        const seedsForFile = seedsByFile.get(fileName);
        if (seedsForFile && !seedsForFile.has(cardId)) {
          related.delete(nodeKey);
        }
      });
    }
    return related;
  }, [excludeSelfTrace, selectionSeeds, seedsByFile, traceCacheSnapshot]);

  /**
   * @brief トレースリンクをフィルタリングする。
   * @details
   * パフォーマンス最適化: ビューポート外のカードのコネクタを早期に除外し、
   * 後続のSVGパス生成処理を削減する。showOffscreenConnectorsがfalseの場合、
   * ビューポート外のカードへのリンクをフィルタリング。
   */
  const filteredLinks = useMemo(() => {
    if (!isTraceVisible) {
      return [] as ExtendedLink[];
    }
    return traceLinks.filter((link) => {
      if (!enabledRelationKinds[link.relation]) {
        return false;
      }
      if (!isCardSideVisible(link.sourceFileName, link.sourceCardId, 'right')) {
        return false;
      }
      if (!isCardSideVisible(link.targetFileName, link.targetCardId, 'left')) {
        return false;
      }

      // ビューポート外のカードのコネクタを除外（パフォーマンス最適化）
      if (!showOffscreenConnectors) {
        // ソースカードとターゲットカードの可視性をチェック
        const findVisibleEntry = (cardId: string, fileName: string, leafIds: string[]): boolean => {
          const entry = Object.values(cards).find(
            (e) => e.cardId === cardId && e.fileName === fileName && leafIds.includes(e.leafId)
          );
          return entry?.isVisible ?? false;
        };

        // 左側のleafIdsでソースカードを検索
        let sourceVisible = findVisibleEntry(link.sourceCardId, link.sourceFileName, leftLeafIds);
        let targetVisible = findVisibleEntry(link.targetCardId, link.targetFileName, rightLeafIds);

        // 見つからない場合は左右を入れ替えて検索
        if (!sourceVisible && !targetVisible) {
          sourceVisible = findVisibleEntry(link.sourceCardId, link.sourceFileName, rightLeafIds);
          targetVisible = findVisibleEntry(link.targetCardId, link.targetFileName, leftLeafIds);
        }

        // 両方のカードが可視でない場合は除外
        if (!sourceVisible || !targetVisible) {
          return false;
        }
      }

      return true;
    });
  }, [cards, enabledRelationKinds, isCardSideVisible, isTraceVisible, leftLeafIds, rightLeafIds, showOffscreenConnectors, traceLinks]);

  const connectorPaths = useMemo<ConnectorPathEntry[]>(() => {
    if (direction !== 'vertical') {
      return [];
    }

    const rect = containerRect;
    if (!rect) {
      return [];
    }

    const entries = Object.values(cards).filter((entry) => showOffscreenConnectors || entry.isVisible);

    // ファイル名とleafIdsでエントリを検索するヘルパー
    const findEntry = (cardId: string, fileName: string, leafIds: string[]): CardAnchorEntry | undefined =>
      entries.find((entry) => entry.cardId === cardId && entry.fileName === fileName && leafIds.includes(entry.leafId));

    return filteredLinks.reduce<ConnectorPathEntry[]>((acc, link) => {
      // 左側のleafIdsとソースファイル名でソースカードを検索
      let source = findEntry(link.sourceCardId, link.sourceFileName, leftLeafIds);
      // 右側のleafIdsとターゲットファイル名でターゲットカードを検索
      let target = findEntry(link.targetCardId, link.targetFileName, rightLeafIds);
      let effectiveDirection = link.direction;

      // 見つからない場合は左右を入れ替えて検索
      if (!source || !target) {
        const altSource = findEntry(link.sourceCardId, link.sourceFileName, rightLeafIds);
        const altTarget = findEntry(link.targetCardId, link.targetFileName, leftLeafIds);
        if (!altSource || !altTarget) {
          return acc;
        }
        source = altTarget;
        target = altSource;
        effectiveDirection = directionSwap(link.direction);
      }

      const start = toLocalPoint(source, rect, 'right');
      const end = toLocalPoint(target, rect, 'left');
      const deltaX = end.x - start.x;
      if (deltaX <= 0) {
        return acc;
      }

      const curvature = Math.max(deltaX * 0.35, 24);
      const path = `M ${start.x} ${start.y} C ${start.x + curvature} ${start.y}, ${end.x - curvature} ${end.y}, ${end.x} ${end.y}`;
      const sourceKey = toTraceNodeKey(source.fileName, source.cardId);
      const targetKey = toTraceNodeKey(target.fileName, target.cardId);
      const shouldHighlight = highlightedNodeKeys.has(sourceKey) || highlightedNodeKeys.has(targetKey);

      const className = [
        'trace-connector-path',
        `trace-connector-path--${link.relation}`,
        `trace-connector-path--dir-${effectiveDirection}`,
        shouldHighlight ? 'trace-connector-path--highlight' : '',
      ]
        .filter(Boolean)
        .join(' ');

      acc.push({ id: link.id, path, className });
      return acc;
    }, []);
  }, [cards, containerRect, direction, filteredLinks, highlightedNodeKeys, leftLeafIds, rightLeafIds, showOffscreenConnectors]);

  if (direction !== 'vertical' || !isTraceVisible) {
    return null;
  }

  if (!containerRect) {
    return null;
  }

  return (
    <div
      className="trace-connector-layer"
      style={{ gridColumn: '1 / -1', gridRow: '1 / -1' }}
      aria-hidden="true"
      data-split-node={nodeId}
    >
      <svg
        className="trace-connector-layer__svg"
        viewBox={`0 0 ${containerRect.width} ${containerRect.height}`}
        preserveAspectRatio="none"
      >
        <defs>
          <marker
            id="trace-connector-arrow"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M 0 0 L 6 3 L 0 6 z" fill="#60a5fa" />
          </marker>
        </defs>
        {connectorPaths.map((connector) => <path key={connector.id} className={connector.className} d={connector.path} />)}
      </svg>
    </div>
  );
};
