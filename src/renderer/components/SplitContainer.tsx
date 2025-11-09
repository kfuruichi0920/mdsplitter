/**
 * @file SplitContainer.tsx
 * @brief 分割ノードを再帰的に描画するコンテナコンポーネント。
 * @details
 * 分割ノードツリーを走査し、葉ノードにはカードパネルを、分割ノードには
 * Splitter コンポーネントで区切られた2つの子コンテナを描画する。
 * @author K.Furuichi
 * @date 2025-11-03
 * @version 0.1
 * @copyright MIT
 */

import { useCallback, useMemo, useRef } from 'react';

import { useSplitStore } from '../store/splitStore';

import { TraceConnectorLayer } from './TraceConnectorLayer';

import type { SplitNode, SplitContainerNode as SplitContainerNodeType } from '../store/splitStore';
import type { CSSProperties, ReactNode } from 'react';

const collectLeafIds = (node: SplitNode): string[] => {
  if (node.type === 'leaf') {
    return [node.id];
  }
  return [...collectLeafIds(node.first), ...collectLeafIds(node.second)];
};

/**
 * @brief 分割コンテナコンポーネントのプロパティ。
 */
export interface SplitContainerProps {
  node: SplitNode; ///< 描画対象のノード。
  renderLeaf: (leafId: string, meta: { isActive: boolean }) => ReactNode; ///< 葉ノードを描画する関数。
}

/**
 * @brief 分割コンテナコンポーネント。
 * @details
 * 再帰的に分割ノードツリーを描画する。葉ノードの場合は renderLeaf を呼び出し、
 * 分割ノードの場合は Splitter で区切られた2つの SplitContainer を描画する。
 */
export const SplitContainer = ({ node, renderLeaf }: SplitContainerProps) => {
  const activeLeafId = useSplitStore((state) => state.activeLeafId);
  return <SplitTree node={node} renderLeaf={renderLeaf} activeLeafId={activeLeafId} />;
};

const SplitTree = ({
  node,
  renderLeaf,
  activeLeafId,
}: {
  node: SplitNode;
  renderLeaf: (leafId: string, meta: { isActive: boolean }) => ReactNode;
  activeLeafId: string | null;
}) => {
  //! 葉ノードの場合は renderLeaf で描画
  if (node.type === 'leaf') {
    return (
      <div className="split-leaf" data-leaf-id={node.id} data-testid={`split-leaf-${node.id}`}>
        <div className="split-leaf__viewport">
          {renderLeaf(node.id, { isActive: node.id === activeLeafId })}
        </div>
      </div>
    );
  }

  //! 分割ノードの場合は SplitContainerNode で再帰描画
  return <SplitContainerNode node={node} renderLeaf={renderLeaf} activeLeafId={activeLeafId} />;
};

/**
 * @brief 分割ノードの内部コンポーネント（Hooks を使用）。
 */
const SplitContainerNode = ({
  node,
  renderLeaf,
  activeLeafId,
}: {
  node: SplitContainerNodeType;
  renderLeaf: (leafId: string, meta: { isActive: boolean }) => ReactNode;
  activeLeafId: string | null;
}) => {
  const updateSplitRatio = useSplitStore((state) => state.updateSplitRatio);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leftLeafIds = useMemo(() => collectLeafIds(node.first), [node.first]);
  const rightLeafIds = useMemo(() => collectLeafIds(node.second), [node.second]);
  /**
   * @brief 分割比率を更新するコールバック。
   * @details
   * Splitterコンポーネントから呼ばれ、指定IDの分割ノードの比率を更新。
   * @param ratio 新しい分割比率（0.0 〜 1.0）。
   */
  const handleRatioChange = useCallback(
    (ratio: number) => {
      updateSplitRatio(node.id, ratio);
    },
    [node.id, updateSplitRatio],
  );

  const isHorizontal = node.direction === 'horizontal';
  const containerClass = `split-container split-container--${node.direction}`;

  //! 分割比率からグリッドテンプレート（行/列幅）を計算
  const gridTemplate = useMemo<string>(() => {
    const firstPercent = node.splitRatio * 100;
    const secondPercent = (1 - node.splitRatio) * 100;
    return `${firstPercent}% 4px ${secondPercent}%`;
  }, [node.splitRatio]);

  //! directionに応じてCSSグリッドの設定を切り替え
  const containerStyle = useMemo<CSSProperties>(() => {
    if (isHorizontal) {
      return {
        display: 'grid',
        gridTemplateRows: gridTemplate,
        height: '100%',
        width: '100%',
      } satisfies CSSProperties;
    }

    return {
      display: 'grid',
      gridTemplateColumns: gridTemplate,
      height: '100%',
      width: '100%',
    } satisfies CSSProperties;
  }, [gridTemplate, isHorizontal]);

  return (
    <div
      className={containerClass}
      style={containerStyle}
      data-split-id={node.id}
      ref={containerRef}
    >
      <SplitTree node={node.first} renderLeaf={renderLeaf} activeLeafId={activeLeafId} />
      <Splitter
        direction={node.direction}
        splitRatio={node.splitRatio}
        onRatioChange={handleRatioChange}
      />
      <SplitTree node={node.second} renderLeaf={renderLeaf} activeLeafId={activeLeafId} />
      <TraceConnectorLayer
        containerRef={containerRef}
        direction={node.direction}
        splitRatio={node.splitRatio}
        nodeId={node.id}
        leftLeafIds={leftLeafIds}
        rightLeafIds={rightLeafIds}
      />
    </div>
  );
};

/**
 * @brief 分割境界コンポーネントのプロパティ。
 */
interface SplitterProps {
  direction: 'horizontal' | 'vertical'; ///< 分割方向。
  splitRatio: number; ///< 現在の分割比率。
  onRatioChange: (ratio: number) => void; ///< 分割比率変更時のコールバック。
}

/**
 * @brief 分割境界コンポーネント。
 * @details
 * ドラッグ&ドロップで分割比率を変更できる境界線を描画する。
 */
const Splitter = ({ direction, splitRatio, onRatioChange }: SplitterProps) => {
  const isHorizontal = direction === 'horizontal';
  const splitterClass = `splitter splitter--${direction}`;

  /**
   * @brief ドラッグ開始処理。
   * @details
   * PointerDownでドラッグ開始。親コンテナのrect取得し、pointermoveで分割比率計算。
   * @param event PointerDown イベント。
   */
  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);

      const container = event.currentTarget.parentElement;
      if (!container) {
        return; //! 親コンテナがなければ何もしない
      }

      const rect = container.getBoundingClientRect();

      /**
       * @brief ドラッグ中の処理。
       * @details
       * pointermoveで分割比率を計算し、onRatioChangeを呼ぶ。
       * @param moveEvent PointerMove イベント。
       */
      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (isHorizontal) {
          const offset = moveEvent.clientY - rect.top;
          const ratio = offset / rect.height;
          onRatioChange(ratio);
        } else {
          const offset = moveEvent.clientX - rect.left;
          const ratio = offset / rect.width;
          onRatioChange(ratio);
        }
      };

      /**
       * @brief ドラッグ終了処理。
       * @details
       * pointermove/pointerupリスナーを解除。
       */
      const handlePointerUp = () => {
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
      };

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
    },
    [isHorizontal, onRatioChange],
  );

  return (
    <div
      className={splitterClass}
      role="separator"
      aria-orientation={isHorizontal ? 'horizontal' : 'vertical'}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(splitRatio * 100)}
      onPointerDown={handlePointerDown}
    />
  );
};
