import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

interface ViewBox {
  width: number;
  height: number;
  rect: DOMRectReadOnly;
}

interface ConnectorPathEntry {
  id: string;
  path: string;
  className: string;
}

export const TraceConnectorLayer = ({
  containerRef,
  direction,
  splitRatio,
  nodeId,
  leftLeafIds,
  rightLeafIds,
}: TraceConnectorLayerProps) => {
  const [viewBox, setViewBox] = useState<ViewBox | null>(null);
  const rafRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
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

  const activeFiles = useWorkspaceStore(
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

  useEffect(() => {
    if (direction !== 'vertical') {
      return;
    }
    if (!activeFiles.left || !activeFiles.right) {
      return;
    }
    void loadTraceForPair(activeFiles.left, activeFiles.right);
  }, [activeFiles.left, activeFiles.right, direction, loadTraceForPair]);

  useLayoutEffect(() => {
    if (direction !== 'vertical') {
      setViewBox(null);
      return () => {};
    }

    const element = containerRef.current;
    if (!element) {
      setViewBox(null);
      return () => {};
    }

    const updateViewBox = () => {
      if (!containerRef.current) {
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        setViewBox(null);
        return;
      }
      setViewBox({
        width: rect.width,
        height: rect.height,
        rect,
      });
    };

    const scheduleUpdate = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        updateViewBox();
      });
    };

    updateViewBox();

    window.addEventListener('resize', scheduleUpdate);
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserverRef.current = new ResizeObserver(scheduleUpdate);
      resizeObserverRef.current.observe(element);
    }

    return () => {
      window.removeEventListener('resize', scheduleUpdate);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
    };
  }, [containerRef, direction]);

  const pairKey = activeFiles.left && activeFiles.right ? `${activeFiles.left}|||${activeFiles.right}` : null;

  const traceEntry = useTraceStore(
    (state) => (pairKey ? state.cache[pairKey] : undefined),
    shallow,
  );

  useEffect(() => {
    if (direction !== 'vertical') {
      return;
    }
    if (!activeFiles.left || !activeFiles.right) {
      return;
    }
    void loadTraceForPair(activeFiles.left, activeFiles.right);
  }, [activeFiles.left, activeFiles.right, direction, loadTraceForPair]);

  const traceLinks = traceEntry?.links ?? [];

  const connectorPaths = useMemo<ConnectorPathEntry[]>(() => {
    if (direction !== 'vertical' || !viewBox) {
      return [];
    }
    const containerRect = viewBox.rect;
    const entries = Object.values(cards);
    const findEntry = (cardId: string, leafIds: string[]): CardAnchorEntry | undefined =>
      entries.find((entry) => entry.cardId === cardId && leafIds.includes(entry.leafId));

    const toLocalPoint = (anchor: CardAnchorEntry, side: 'left' | 'right') => {
      const x = side === 'left' ? anchor.rect.left : anchor.rect.right;
      return {
        x: x - containerRect.left,
        y: anchor.rect.midY - containerRect.top,
      };
    };

    return traceLinks.reduce<ConnectorPathEntry[]>((acc, link) => {
      const source = findEntry(link.sourceCardId, leftLeafIds);
      const target = findEntry(link.targetCardId, rightLeafIds);
      const effectiveDirection = link.direction;

      if (!source || !target) {
        return acc;
      }

      const start = toLocalPoint(source, 'right');
      const end = toLocalPoint(target, 'left');
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

      acc.push({
        id: link.id,
        path,
        className,
      });

      return acc;
    }, []);
  }, [cards, direction, highlightedSet, leftLeafIds, rightLeafIds, traceLinks, viewBox]);

  if (direction !== 'vertical' || !viewBox) {
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
        viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
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
            d={`M ${(viewBox.width * splitRatio) / 2} ${viewBox.height / 2} C ${(viewBox.width * splitRatio) / 2 + 48} ${
              viewBox.height / 2
            }, ${(viewBox.width * (1 + splitRatio)) / 2 - 48} ${viewBox.height / 2}, ${(viewBox.width * (1 + splitRatio)) / 2} ${
              viewBox.height / 2
            }`}
          />
        ) : (
          connectorPaths.map((connector) => <path key={connector.id} className={connector.className} d={connector.path} />)
        )}
      </svg>
    </div>
  );
};
