/**
 * @file TraceConnector.tsx
 * @brief トレーサビリティコネクタ描画コンポーネント。
 * @details
 * 水平分割された左右のパネル間で、カード間のトレーサビリティ関係を
 * SVGコネクタとして描画する。Bézier曲線を使用して自然な曲線を実現し、
 * 矢印で方向性を表現する。
 * @author K.Furuichi
 * @date 2025-11-03
 * @version 0.1
 * @copyright MIT
 */

import { type FC, useCallback, useEffect, useRef, useState } from 'react';
import { useTraceStore, type TraceRelation, type TraceDirection } from '../store/traceStore';

/** コネクタの座標情報 */
interface ConnectorPoint {
  x: number;
  y: number;
}

/** コネクタのプロパティ */
interface ConnectorProps {
  relation: TraceRelation;
  leftCardId: string;
  rightCardId: string;
  containerRect: DOMRect;
  leftPaneRect: DOMRect;
  rightPaneRect: DOMRect;
  isSelected: boolean;
  onSelect: (relationId: string) => void;
}

/** 単一コネクタコンポーネント */
const Connector: FC<ConnectorProps> = ({
  relation,
  leftCardId,
  rightCardId,
  containerRect,
  leftPaneRect,
  rightPaneRect,
  isSelected,
  onSelect,
}) => {
  // カード要素を取得
  const leftCardEl = document.querySelector(`[data-card-id="${leftCardId}"]`);
  const rightCardEl = document.querySelector(`[data-card-id="${rightCardId}"]`);

  if (!leftCardEl || !rightCardEl) {
    return null;
  }

  const leftCardRect = leftCardEl.getBoundingClientRect();
  const rightCardRect = rightCardEl.getBoundingClientRect();

  // コネクタの始点・終点を計算（コンテナ座標系）
  const startX = leftCardRect.right - containerRect.left;
  const startY = leftCardRect.top + leftCardRect.height / 2 - containerRect.top;
  const endX = rightCardRect.left - containerRect.left;
  const endY = rightCardRect.top + rightCardRect.height / 2 - containerRect.top;

  // Bézier曲線の制御点を計算
  const midX = (startX + endX) / 2;
  const controlPoint1X = startX + (midX - startX) * 0.5;
  const controlPoint2X = endX - (endX - midX) * 0.5;

  // SVGパス（Bézier曲線）
  const path = `M ${startX} ${startY} C ${controlPoint1X} ${startY}, ${controlPoint2X} ${endY}, ${endX} ${endY}`;

  // コネクタのスタイル
  const getStrokeStyle = () => {
    switch (relation.type) {
      case 'refines':
        return { strokeDasharray: '5,5', strokeWidth: 2 };
      case 'tests':
        return { strokeDasharray: '2,2', strokeWidth: 2 };
      case 'duplicates':
        return { strokeWidth: 3 };
      default:
        return { strokeWidth: 2 };
    }
  };

  const strokeStyle = getStrokeStyle();
  const strokeColor = isSelected ? '#F97316' : '#3B82F6'; // オレンジ or ブルー
  const strokeOpacity = isSelected ? 1 : 0.6;

  // 矢印マーカーの描画
  const renderArrowMarker = (direction: TraceDirection) => {
    const markerId = `arrow-${relation.id}`;
    return (
      <defs>
        <marker
          id={markerId}
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L9,3 z" fill={strokeColor} />
        </marker>
        {direction === 'bidirectional' && (
          <marker
            id={`${markerId}-start`}
            markerWidth="10"
            markerHeight="10"
            refX="1"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M9,0 L9,6 L0,3 z" fill={strokeColor} />
          </marker>
        )}
      </defs>
    );
  };

  const markerEnd =
    relation.directed === 'left_to_right' || relation.directed === 'bidirectional'
      ? `url(#arrow-${relation.id})`
      : undefined;
  const markerStart =
    relation.directed === 'bidirectional' ? `url(#arrow-${relation.id}-start)` : undefined;

  const handleClick = useCallback(() => {
    onSelect(relation.id);
  }, [relation.id, onSelect]);

  return (
    <g onClick={handleClick} className="cursor-pointer">
      {renderArrowMarker(relation.directed)}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeOpacity={strokeOpacity}
        {...strokeStyle}
        markerEnd={markerEnd}
        markerStart={markerStart}
        className="transition-all hover:stroke-opacity-100"
      />
    </g>
  );
};

/** トレースコネクタコンテナのプロパティ */
interface TraceConnectorContainerProps {
  leftPaneId: string;
  rightPaneId: string;
}

/** トレースコネクタコンテナ */
export const TraceConnectorContainer: FC<TraceConnectorContainerProps> = ({
  leftPaneId,
  rightPaneId,
}) => {
  const { connectorsVisible, getTraceRelations, selectedTraceId, selectTrace } = useTraceStore();
  const containerRef = useRef<SVGSVGElement>(null);
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);
  const [relations, setRelations] = useState<TraceRelation[]>([]);

  // コンテナのサイズを取得
  useEffect(() => {
    const updateRect = () => {
      if (containerRef.current) {
        setContainerRect(containerRef.current.getBoundingClientRect());
      }
    };
    updateRect();
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, []);

  // トレース関係を取得
  useEffect(() => {
    const traceRelations = getTraceRelations(leftPaneId, rightPaneId);
    setRelations(traceRelations);
  }, [leftPaneId, rightPaneId, getTraceRelations]);

  if (!connectorsVisible || !containerRect || relations.length === 0) {
    return null;
  }

  // パネルの矩形情報を取得
  const leftPaneEl = document.querySelector(`[data-pane-id="${leftPaneId}"]`);
  const rightPaneEl = document.querySelector(`[data-pane-id="${rightPaneId}"]`);

  if (!leftPaneEl || !rightPaneEl) {
    return null;
  }

  const leftPaneRect = leftPaneEl.getBoundingClientRect();
  const rightPaneRect = rightPaneEl.getBoundingClientRect();

  const handleSelectTrace = useCallback(
    (relationId: string) => {
      selectTrace(relationId);
    },
    [selectTrace]
  );

  return (
    <svg
      ref={containerRef}
      className="trace-connector-container absolute inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    >
      <g className="pointer-events-auto">
        {relations.map((relation) =>
          relation.left_ids.flatMap((leftId) =>
            relation.right_ids.map((rightId) => (
              <Connector
                key={`${relation.id}-${leftId}-${rightId}`}
                relation={relation}
                leftCardId={leftId}
                rightCardId={rightId}
                containerRect={containerRect}
                leftPaneRect={leftPaneRect}
                rightPaneRect={rightPaneRect}
                isSelected={relation.id === selectedTraceId}
                onSelect={handleSelectTrace}
              />
            ))
          )
        )}
      </g>
    </svg>
  );
};
