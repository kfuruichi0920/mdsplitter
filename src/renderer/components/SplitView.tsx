import { Fragment, useCallback, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';

import {
  collectLeafIds,
  usePanelLayoutStore,
  type PanelLeafNode,
  type PanelNode,
  type PanelSplitNode,
  type SplitDirection,
} from '../store/panelLayoutStore';

export interface LeafRenderHelpers {
  isActive: boolean;
  setActive: () => void;
  requestClose: () => void;
  canClose: boolean;
}

type RenderLeafFn = (leaf: PanelLeafNode, helpers: LeafRenderHelpers) => ReactNode;

interface SplitViewProps {
  renderLeaf: RenderLeafFn;
}

const SplitLeaf = ({
  leaf,
  isActive,
  onActivate,
  onClose,
  canClose,
  children,
}: {
  leaf: PanelLeafNode;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
  canClose: boolean;
  children: ReactNode;
}) => {
  return (
    <div
      className={`panel-leaf${isActive ? ' panel-leaf--active' : ''}`}
      data-panel-id={leaf.id}
      data-testid="panel-leaf"
      onMouseDown={onActivate}
    >
      {children}
      {canClose ? (
        <button
          type="button"
          className="panel-leaf__close"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          aria-label="パネルを閉じる"
        >
          ×
        </button>
      ) : null}
    </div>
  );
};

const SplitLeafContainer = ({
  leaf,
  renderLeaf,
  totalLeafCount,
}: {
  leaf: PanelLeafNode;
  renderLeaf: RenderLeafFn;
  totalLeafCount: number;
}) => {
  const setActiveLeaf = usePanelLayoutStore((state) => state.setActiveLeaf);
  const activeLeafId = usePanelLayoutStore((state) => state.activeLeafId);
  const closeLeaf = usePanelLayoutStore((state) => state.closeLeaf);

  const isActive = leaf.id === activeLeafId;
  const canClose = totalLeafCount > 1;

  return (
    <SplitLeaf
      leaf={leaf}
      isActive={isActive}
      onActivate={() => setActiveLeaf(leaf.id)}
      onClose={() => closeLeaf(leaf.id)}
      canClose={canClose}
    >
      {renderLeaf(leaf, {
        isActive,
        setActive: () => setActiveLeaf(leaf.id),
        requestClose: () => closeLeaf(leaf.id),
        canClose,
      })}
    </SplitLeaf>
  );
};

const SplitDivider = ({
  node,
  index,
  direction,
  containerRef,
}: {
  node: PanelSplitNode;
  index: number;
  direction: SplitDirection;
  containerRef: React.RefObject<HTMLDivElement>;
}) => {
  const updateSplitSizes = usePanelLayoutStore((state) => state.updateSplitSizes);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      event.preventDefault();
      const pointerId = event.pointerId;
      const target = event.currentTarget;
      const rect = container.getBoundingClientRect();
      const initialSizes = [...node.sizes];
      const totalLength = direction === 'horizontal' ? rect.width : rect.height;
      const startPosition = direction === 'horizontal' ? event.clientX : event.clientY;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) {
          return;
        }
        const currentPosition = direction === 'horizontal' ? moveEvent.clientX : moveEvent.clientY;
        const deltaRatio = (currentPosition - startPosition) / (totalLength || 1);
        const nextSizes = [...initialSizes];
        let first = initialSizes[index] + deltaRatio;
        let second = initialSizes[index + 1] - deltaRatio;
        const min = 0.1;
        if (first < min) {
          second -= min - first;
          first = min;
        } else if (second < min) {
          first -= min - second;
          second = min;
        }
        nextSizes[index] = first;
        nextSizes[index + 1] = second;
        updateSplitSizes(node.id, nextSizes);
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== pointerId) {
          return;
        }
        target.releasePointerCapture(pointerId);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };

      target.setPointerCapture(pointerId);
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    [containerRef, direction, node.id, node.sizes, updateSplitSizes, index],
  );

  const ariaOrientation = direction === 'horizontal' ? 'vertical' : 'horizontal';
  const className = `panel-divider panel-divider--${direction}`;

  return <div role="separator" aria-orientation={ariaOrientation} className={className} onPointerDown={handlePointerDown} />;
};

const SplitSplitContainer = ({
  node,
  renderLeaf,
  totalLeafCount,
}: {
  node: PanelSplitNode;
  renderLeaf: RenderLeafFn;
  totalLeafCount: number;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className={`panel-split panel-split--${node.direction}`} data-split-direction={node.direction}>
      {node.children.map((child, index) => {
        const size = node.sizes[index];
        return (
          <Fragment key={child.id}>
            <div className="panel-split__child" style={{ flexGrow: size, flexBasis: 0, flexShrink: 0 }}>
              <SplitWrapper node={child} renderLeaf={renderLeaf} totalLeafCount={totalLeafCount} />
            </div>
            {index < node.children.length - 1 ? (
              <SplitDivider node={node} index={index} direction={node.direction} containerRef={containerRef} />
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
};

function SplitWrapper({
  node,
  renderLeaf,
  totalLeafCount,
}: {
  node: PanelNode;
  renderLeaf: RenderLeafFn;
  totalLeafCount: number;
}): JSX.Element {
  if (node.kind === 'leaf') {
    return <SplitLeafContainer leaf={node} renderLeaf={renderLeaf} totalLeafCount={totalLeafCount} />;
  }
  return <SplitSplitContainer node={node} renderLeaf={renderLeaf} totalLeafCount={totalLeafCount} />;
}

export const SplitView = ({ renderLeaf }: SplitViewProps) => {
  const root = usePanelLayoutStore((state) => state.root);
  const totalLeafCount = useMemo(() => collectLeafIds(root).length, [root]);

  return <SplitWrapper node={root} renderLeaf={renderLeaf} totalLeafCount={totalLeafCount} />;
};
