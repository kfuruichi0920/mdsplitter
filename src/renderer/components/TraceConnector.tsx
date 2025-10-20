import React from 'react';
import { TraceRelationType, TraceDirection } from '@shared/types';

interface Point {
  x: number;
  y: number;
}

interface TraceConnectorProps {
  id: string;
  startPoint: Point;
  endPoint: Point;
  type: TraceRelationType;
  direction: TraceDirection;
  isSelected?: boolean;
  isHighlighted?: boolean;
  onClick?: (id: string) => void;
  onDoubleClick?: (id: string) => void;
}

/**
 * 個別トレースコネクタの描画コンポーネント
 * Bézier曲線を使用して2点間を滑らかに接続
 */
const TraceConnector: React.FC<TraceConnectorProps> = ({
  id,
  startPoint,
  endPoint,
  type,
  direction,
  isSelected = false,
  isHighlighted = false,
  onClick,
  onDoubleClick,
}) => {
  // トレースタイプ別の色を取得
  const getTypeColor = (traceType: TraceRelationType): string => {
    switch (traceType) {
      case 'trace':
        return '#3b82f6'; // blue-500
      case 'refines':
        return '#8b5cf6'; // violet-500
      case 'tests':
        return '#10b981'; // green-500
      case 'duplicates':
        return '#f59e0b'; // amber-500
      case 'satisfy':
        return '#06b6d4'; // cyan-500
      case 'relate':
        return '#ec4899'; // pink-500
      case 'specialize':
        return '#6366f1'; // indigo-500
      default:
        return '#6b7280'; // gray-500
    }
  };

  // トレースタイプ別の線スタイルを取得
  const getStrokeDasharray = (traceType: TraceRelationType): string => {
    switch (traceType) {
      case 'trace':
        return ''; // 実線
      case 'refines':
        return '8,4'; // 長い破線
      case 'tests':
        return '4,4'; // 短い破線
      case 'duplicates':
        return '2,2'; // 点線
      case 'satisfy':
        return '8,4,2,4'; // 一点鎖線
      case 'relate':
        return ''; // 実線
      case 'specialize':
        return '8,4'; // 破線
      default:
        return '';
    }
  };

  // Bézier曲線の制御点を計算
  const calculateControlPoints = (start: Point, end: Point): { cp1: Point; cp2: Point } => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    // 水平距離の1/3を制御点のオフセットとして使用
    const offset = Math.abs(dx) / 3;

    return {
      cp1: { x: start.x + offset, y: start.y },
      cp2: { x: end.x - offset, y: end.y },
    };
  };

  const { cp1, cp2 } = calculateControlPoints(startPoint, endPoint);

  // SVGパスの生成
  const pathData = `M ${startPoint.x} ${startPoint.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${endPoint.x} ${endPoint.y}`;

  // 矢印マーカーの生成
  const getArrowMarkerId = () => `arrow-${type}-${direction}-${id}`;

  const color = getTypeColor(type);
  const strokeWidth = isSelected ? 3 : isHighlighted ? 2.5 : 2;
  const opacity = isHighlighted || isSelected ? 1 : 0.6;

  // 矢印の描画判定
  const showStartArrow = direction === 'right_to_left' || direction === 'bidirectional';
  const showEndArrow = direction === 'left_to_right' || direction === 'bidirectional';

  return (
    <g
      onClick={() => onClick?.(id)}
      onDoubleClick={() => onDoubleClick?.(id)}
      style={{ cursor: 'pointer' }}
    >
      {/* 矢印マーカー定義 */}
      <defs>
        {showEndArrow && (
          <marker
            id={`${getArrowMarkerId()}-end`}
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill={color} />
          </marker>
        )}
        {showStartArrow && (
          <marker
            id={`${getArrowMarkerId()}-start`}
            markerWidth="10"
            markerHeight="10"
            refX="0"
            refY="3"
            orient="auto-start-reverse"
            markerUnits="strokeWidth"
          >
            <path d="M9,0 L9,6 L0,3 z" fill={color} />
          </marker>
        )}
      </defs>

      {/* 選択時のハイライト用の太い透明パス（クリック領域拡大） */}
      <path
        d={pathData}
        fill="none"
        stroke="transparent"
        strokeWidth={strokeWidth + 10}
        style={{ pointerEvents: 'stroke' }}
      />

      {/* メインのコネクタパス */}
      <path
        d={pathData}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={getStrokeDasharray(type)}
        opacity={opacity}
        markerEnd={showEndArrow ? `url(#${getArrowMarkerId()}-end)` : undefined}
        markerStart={showStartArrow ? `url(#${getArrowMarkerId()}-start)` : undefined}
        style={{
          transition: 'stroke-width 0.2s, opacity 0.2s',
          filter: isSelected ? 'drop-shadow(0 0 4px rgba(0,0,0,0.3))' : undefined,
        }}
      />

      {/* 選択時の外枠 */}
      {isSelected && (
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth + 2}
          opacity={0.3}
          strokeDasharray={getStrokeDasharray(type)}
        />
      )}
    </g>
  );
};

export default TraceConnector;
