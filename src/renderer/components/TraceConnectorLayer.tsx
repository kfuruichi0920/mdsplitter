import { useEffect, useMemo, useRef, useState } from 'react';
import { useConnectorLayoutStore, type CardAnchorEntry } from '../store/connectorLayoutStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { shallow } from 'zustand/shallow';
import { useTraceStore } from '../store/traceStore';

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

const useActiveFiles = (leftLeafIds: string[], rightLeafIds: string[]) => {
  return useWorkspaceStore(
    (state) => {
      const getActiveFile = (leafId: string): string | null => {
        const leaf = state.leafs[leafId];
        if (!leaf?.activeTabId) {
          return null;
        }
        const tab = state.tabs[leaf.activeTabId];
        return tab?.fileName ?? null;
      };

      const left = leftLeafIds.map(getActiveFile).find((file) => file) ?? null;
      const right = rightLeafIds.map(getActiveFile).find((file) => file) ?? null;
      return { left, right };
    },
    shallow,
  );
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

    const measure = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        return;
      }
      setContainerRect(rect);
    };

    measure();
    let observer: ResizeObserver | null = null;
    const handleWindowResize = () => measure();

    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(element);
      resizeObserverRef.current = observer;
    } else {
      // jsdom 環境などで ResizeObserver が未定義の場合のフォールバック
      resizeObserverRef.current = null;
    }

    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      observer?.disconnect();
      resizeObserverRef.current = null;
    };
  }, [containerRef, direction]);

  const cards = useConnectorLayoutStore((state) => state.cards);
  const highlightedCardIds = useWorkspaceStore(
    (state) => {
      const ids: string[] = [];
      Object.values(state.tabs).forEach((tab) => {
        if (tab?.selectedCardId) {
          ids.push(tab.selectedCardId);
        }
      });
      return ids;
    },
    shallow,
  );
  const highlightedSet = useMemo(() => new Set(highlightedCardIds), [highlightedCardIds]);

  const loadTraceForPair = useTraceStore((state) => state.loadTraceForPair);
  const getCachedTrace = useTraceStore((state) => state.getCached);

  const activeFiles = useActiveFiles(leftLeafIds, rightLeafIds);

  useEffect(() => {
    if (direction !== 'vertical') {
      return;
    }
    if (!activeFiles.left || !activeFiles.right) {
      return;
    }
    void loadTraceForPair(activeFiles.left, activeFiles.right);
  }, [activeFiles.left, activeFiles.right, direction, loadTraceForPair]);

  const pairKey = activeFiles.left && activeFiles.right ? `${activeFiles.left}|||${activeFiles.right}` : null;
  const traceEntry = useTraceStore(
    (state) => (pairKey ? state.cache[pairKey] : undefined),
    shallow,
  );
  const traceLinks = traceEntry?.links ?? [];

  const connectorPaths = useMemo<ConnectorPathEntry[]>(() => {
    if (direction !== 'vertical') {
      return [];
    }

    const rect = containerRect;
    if (!rect) {
      return [];
    }

    const entries = Object.values(cards);
    const findEntry = (cardId: string, leafIds: string[]): CardAnchorEntry | undefined =>
      entries.find((entry) => entry.cardId === cardId && leafIds.includes(entry.leafId));

    return traceLinks.reduce<ConnectorPathEntry[]>((acc, link) => {
      let source = findEntry(link.sourceCardId, leftLeafIds);
      let target = findEntry(link.targetCardId, rightLeafIds);
      let effectiveDirection = link.direction;

      if (!source || !target) {
        const altSource = findEntry(link.sourceCardId, rightLeafIds);
        const altTarget = findEntry(link.targetCardId, leftLeafIds);
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
      const className = [
        'trace-connector-path',
        `trace-connector-path--${link.relation}`,
        `trace-connector-path--dir-${effectiveDirection}`,
        (highlightedSet.has(link.sourceCardId) || highlightedSet.has(link.targetCardId))
          ? 'trace-connector-path--highlight'
          : '',
      ]
        .filter(Boolean)
        .join(' ');

      acc.push({ id: link.id, path, className });
      return acc;
    }, []);
  }, [cards, containerRect, direction, highlightedSet, leftLeafIds, rightLeafIds, traceLinks]);

  if (direction !== 'vertical') {
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
