import { useLayoutEffect, useRef, useState } from 'react';

type SplitDirection = 'horizontal' | 'vertical';

interface TraceConnectorLayerProps {
  containerRef: React.RefObject<HTMLDivElement>;
  direction: SplitDirection;
  splitRatio: number;
  nodeId: string;
}

interface ConnectorGeometry {
  width: number;
  height: number;
  path: string;
}

/**
 * @brief 左右パネル間の仮コネクタを描画するレイヤ。
 * @details
 * P2-10a では左右ペアの検出と SVG コンテナの配置のみを行い、
 * 中央同士を結ぶ単一のベジェ曲線を描画する。
 */
export const TraceConnectorLayer = ({
  containerRef,
  direction,
  splitRatio,
  nodeId,
}: TraceConnectorLayerProps) => {
  const [geometry, setGeometry] = useState<ConnectorGeometry | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const rafRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (direction !== 'vertical') {
      setGeometry(null);
      return () => {};
    }

    const element = containerRef.current;
    if (!element) {
      setGeometry(null);
      return () => {};
    }

    const computeGeometry = () => {
      if (!containerRef.current) {
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        setGeometry(null);
        return;
      }

      const leftX = (rect.width * splitRatio) / 2;
      const rightBase = rect.width * splitRatio;
      const rightX = rightBase + (rect.width - rightBase) / 2;
      const midY = rect.height / 2;
      const controlOffset = Math.max((rightX - leftX) * 0.35, 24);

      const path = `M ${leftX} ${midY} C ${leftX + controlOffset} ${midY}, ${rightX - controlOffset} ${midY}, ${rightX} ${midY}`;

      setGeometry({
        width: rect.width,
        height: rect.height,
        path,
      });
    };

    const scheduleUpdate = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        computeGeometry();
      });
    };

    computeGeometry();

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
  }, [containerRef, direction, splitRatio]);

  if (direction !== 'vertical' || !geometry) {
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
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        preserveAspectRatio="none"
      >
        <path className="trace-connector-path trace-connector-path--placeholder" d={geometry.path} />
      </svg>
    </div>
  );
};
