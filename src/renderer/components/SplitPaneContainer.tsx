/**
 * @file SplitPaneContainer.tsx
 * @brief カードパネルの分割レイアウトコンテナ。
 * @details
 * 再帰的な分割構造を持つパネルコンテナを実装する。
 * 水平/垂直分割をサポートし、各パネルはリサイズ可能。
 * @author K.Furuichi
 * @date 2025-11-03
 * @version 0.1
 * @copyright MIT
 */

import { useCallback, useRef, useState, type FC, type PointerEvent } from 'react';
import { useSplitPaneStore, type PaneNode, type SplitNode } from '../store/splitPaneStore';
import { CardPanelView } from './CardPanelView';

/** 分割ノードのプロパティ */
interface SplitPaneNodeProps {
  node: PaneNode;
}

/** リサイザーのプロパティ */
interface ResizerProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
}

/** リサイザーコンポーネント */
const Resizer: FC<ResizerProps> = ({ direction, onResize }) => {
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef(0);

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY;
    },
    [direction]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = currentPos - startPosRef.current;
      startPosRef.current = currentPos;
      onResize(delta);
    },
    [isDragging, direction, onResize]
  );

  const handlePointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
  }, []);

  const cursorClass = direction === 'horizontal' ? 'cursor-col-resize' : 'cursor-row-resize';
  const sizeClass = direction === 'horizontal' ? 'w-1 h-full' : 'w-full h-1';
  const bgClass = isDragging ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600 hover:bg-blue-400';

  return (
    <div
      className={`${sizeClass} ${bgClass} ${cursorClass} transition-colors`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
};

/** 分割ノードコンポーネント（再帰的） */
const SplitPaneNode: FC<SplitPaneNodeProps> = ({ node }) => {
  const { resizePane } = useSplitPaneStore();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleResize = useCallback(
    (index: number, delta: number) => {
      if (node.type !== 'split') return;
      const container = containerRef.current;
      if (!container) return;

      const splitNode = node as SplitNode;
      const isHorizontal = splitNode.direction === 'horizontal';
      const containerSize = isHorizontal ? container.offsetWidth : container.offsetHeight;

      // デルタをパーセンテージに変換
      const deltaPercent = (delta / containerSize) * 100;

      // 新しいサイズを計算
      const newSizes = [...splitNode.sizes];
      newSizes[index] = Math.max(10, newSizes[index] + deltaPercent);
      newSizes[index + 1] = Math.max(10, newSizes[index + 1] - deltaPercent);

      // 合計が100になるように正規化
      const total = newSizes.reduce((sum, size) => sum + size, 0);
      const normalizedSizes = newSizes.map((size) => (size / total) * 100);

      resizePane(node.id, normalizedSizes);
    },
    [node, resizePane]
  );

  if (node.type === 'leaf') {
    return <CardPanelView paneId={node.id} />;
  }

  const splitNode = node as SplitNode;
  const isHorizontal = splitNode.direction === 'horizontal';
  const flexDirection = isHorizontal ? 'flex-row' : 'flex-col';

  return (
    <div ref={containerRef} className={`flex ${flexDirection} w-full h-full`}>
      {splitNode.children.map((child, index) => (
        <div key={child.id} className="split-pane-wrapper" style={{ flex: `${splitNode.sizes[index]} 1 0%` }}>
          <div className="w-full h-full">
            <SplitPaneNode node={child} />
          </div>
          {index < splitNode.children.length - 1 && (
            <Resizer
              direction={splitNode.direction}
              onResize={(delta) => handleResize(index, delta)}
            />
          )}
        </div>
      ))}
    </div>
  );
};

/** 分割パネルコンテナ（ルート） */
export const SplitPaneContainer: FC = () => {
  const { root } = useSplitPaneStore();

  return (
    <div className="split-pane-container w-full h-full overflow-hidden">
      <SplitPaneNode node={root} />
    </div>
  );
};
