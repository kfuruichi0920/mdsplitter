import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConnectorLayoutStore, type CardAnchorEntry } from '../store/connectorLayoutStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { shallow } from 'zustand/shallow';
import { useTraceStore, type TraceSeed, toTraceNodeKey, splitTraceNodeKey } from '../store/traceStore';
import { useTracePreferenceStore, makeCardKey, type TraceConnectorSide } from '../store/tracePreferenceStore';
import type { TraceabilityLink } from '@/shared/traceability';

interface TraceConnectorLayerProps {
  containerRef: React.RefObject<HTMLDivElement>;
  direction: 'horizontal' | 'vertical';
  splitRatio: number;
  nodeId: string;
  leftLeafIds: string[];
  rightLeafIds: string[];
}

interface ConnectorPathEntry {
  id: string;
  path: string;
  className: string;
}

const directionSwap = (direction: 'forward' | 'backward' | 'bidirectional'): 'forward' | 'backward' | 'bidirectional' => {
  if (direction === 'forward') return 'backward';
  if (direction === 'backward') return 'forward';
  return 'bidirectional';
};

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

  // スロットリングされた測定処理
  const scheduleMeasure = useCallback(() => {
    if (rafRef.current !== null) {
      return;
    }
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
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
      return true;
    });
  }, [enabledRelationKinds, isCardSideVisible, isTraceVisible, traceLinks]);

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
        {connectorPaths.length === 0 ? (
          <path
            className="trace-connector-path trace-connector-path--placeholder"
            d={`M ${(containerRect.width * splitRatio) / 2} ${containerRect.height / 2} C ${(containerRect.width * splitRatio) / 2 + 48} ${
              containerRect.height / 2
            }, ${(containerRect.width * (1 + splitRatio)) / 2 - 48} ${containerRect.height / 2}, ${(containerRect.width * (1 + splitRatio)) / 2} ${
              containerRect.height / 2
            }`}
          />
        ) : (
          connectorPaths.map((connector) => <path key={connector.id} className={connector.className} d={connector.path} />)
        )}
      </svg>
    </div>
  );
};
