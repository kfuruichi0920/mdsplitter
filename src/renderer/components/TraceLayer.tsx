import React, { useRef, useEffect, useState } from 'react';
import { TraceRelation } from '@shared/types';
import { useTraceStore } from '../store/useTraceStore';
import TraceConnector from './TraceConnector';

interface Point {
  x: number;
  y: number;
}

interface CardPosition {
  cardId: string;
  leftJunction: Point;
  rightJunction: Point;
}

interface TraceLayerProps {
  leftPanelRef: React.RefObject<HTMLDivElement>;
  rightPanelRef: React.RefObject<HTMLDivElement>;
  traceFileKey: string;
}

/**
 * トレースコネクタレイヤー
 * 左右のカードパネル間にSVGレイヤーを配置してコネクタを描画
 */
const TraceLayer: React.FC<TraceLayerProps> = ({
  leftPanelRef,
  rightPanelRef,
  traceFileKey,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cardPositions, setCardPositions] = useState<Map<string, CardPosition>>(new Map());
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });

  const {
    traceFiles,
    traceVisible,
    traceTypeFilter,
    selectedTraceRelations,
    selectTraceRelation,
  } = useTraceStore();

  const traceFile = traceFiles.get(traceFileKey);

  // カード位置を取得する関数
  const getCardJunctionPoints = (
    cardElement: Element,
    containerRect: DOMRect,
    side: 'left' | 'right'
  ): { leftJunction: Point; rightJunction: Point } | null => {
    const rect = cardElement.getBoundingClientRect();

    // コンテナ相対座標に変換
    const relativeTop = rect.top - containerRect.top;
    const relativeLeft = rect.left - containerRect.left;
    const centerY = relativeTop + rect.height / 2;

    return {
      leftJunction: {
        x: relativeLeft,
        y: centerY,
      },
      rightJunction: {
        x: relativeLeft + rect.width,
        y: centerY,
      },
    };
  };

  // カード位置の更新
  const updateCardPositions = () => {
    if (!leftPanelRef.current || !rightPanelRef.current || !svgRef.current) return;

    const newPositions = new Map<string, CardPosition>();
    const svgRect = svgRef.current.getBoundingClientRect();

    // 左パネルのカード位置を取得
    const leftCards = leftPanelRef.current.querySelectorAll('[data-card-id]');
    leftCards.forEach((cardElement) => {
      const cardId = cardElement.getAttribute('data-card-id');
      if (!cardId) return;

      const points = getCardJunctionPoints(cardElement, svgRect, 'left');
      if (points) {
        newPositions.set(cardId, {
          cardId,
          ...points,
        });
      }
    });

    // 右パネルのカード位置を取得
    const rightCards = rightPanelRef.current.querySelectorAll('[data-card-id]');
    rightCards.forEach((cardElement) => {
      const cardId = cardElement.getAttribute('data-card-id');
      if (!cardId) return;

      const points = getCardJunctionPoints(cardElement, svgRect, 'right');
      if (points) {
        newPositions.set(cardId, {
          cardId,
          ...points,
        });
      }
    });

    setCardPositions(newPositions);
  };

  // SVGサイズの更新
  const updateSvgDimensions = () => {
    if (!svgRef.current) return;

    const parent = svgRef.current.parentElement;
    if (!parent) return;

    setSvgDimensions({
      width: parent.clientWidth,
      height: parent.clientHeight,
    });
  };

  // 初期化とリサイズ監視
  useEffect(() => {
    updateSvgDimensions();
    updateCardPositions();

    const handleResize = () => {
      updateSvgDimensions();
      updateCardPositions();
    };

    const handleScroll = () => {
      updateCardPositions();
    };

    window.addEventListener('resize', handleResize);
    leftPanelRef.current?.addEventListener('scroll', handleScroll);
    rightPanelRef.current?.addEventListener('scroll', handleScroll);

    // 定期的に位置を更新（カードの展開/折りたたみ対応）
    const interval = setInterval(updateCardPositions, 500);

    return () => {
      window.removeEventListener('resize', handleResize);
      leftPanelRef.current?.removeEventListener('scroll', handleScroll);
      rightPanelRef.current?.removeEventListener('scroll', handleScroll);
      clearInterval(interval);
    };
  }, [leftPanelRef, rightPanelRef]);

  // トレースファイル変更時に位置を更新
  useEffect(() => {
    updateCardPositions();
  }, [traceFile]);

  // コネクタクリックハンドラー
  const handleConnectorClick = (relationId: string, multi: boolean) => {
    selectTraceRelation(relationId, multi);
  };

  if (!traceVisible || !traceFile) {
    return null;
  }

  // フィルタされたトレース関係
  const filteredRelations = traceFile.body.filter((relation) =>
    traceTypeFilter.includes(relation.type)
  );

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
      }}
      width={svgDimensions.width}
      height={svgDimensions.height}
    >
      <g style={{ pointerEvents: 'auto' }}>
        {filteredRelations.map((relation) => {
          // 左側と右側のカード位置を取得
          const leftPositions = relation.left_ids
            .map((id) => cardPositions.get(id))
            .filter((pos): pos is CardPosition => pos !== undefined);

          const rightPositions = relation.right_ids
            .map((id) => cardPositions.get(id))
            .filter((pos): pos is CardPosition => pos !== undefined);

          // 両側にカードが存在する場合のみコネクタを描画
          if (leftPositions.length === 0 || rightPositions.length === 0) {
            return null;
          }

          // 複数カード間のコネクタを描画（すべての組み合わせ）
          return leftPositions.flatMap((leftPos) =>
            rightPositions.map((rightPos, index) => (
              <TraceConnector
                key={`${relation.id}-${leftPos.cardId}-${rightPos.cardId}-${index}`}
                id={relation.id}
                startPoint={leftPos.rightJunction}
                endPoint={rightPos.leftJunction}
                type={relation.type}
                direction={relation.directed}
                isSelected={selectedTraceRelations.has(relation.id)}
                onClick={(id) => handleConnectorClick(id, false)}
                onDoubleClick={(id) => {
                  // ダブルクリックで編集ダイアログを開く（将来実装）
                  console.log('Edit trace relation:', id);
                }}
              />
            ))
          );
        })}
      </g>
    </svg>
  );
};

export default TraceLayer;
