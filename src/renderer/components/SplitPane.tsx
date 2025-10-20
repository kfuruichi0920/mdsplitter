import React, { useState, useRef, useEffect } from 'react';
import { Panel, PanelLayout } from '@shared/types';
import { useAppStore } from '../store/useAppStore';
import TabBar from './TabBar';
import PanelContent from './PanelContent';

interface SplitPaneProps {
  layout: PanelLayout | Panel;
}

const SplitPane: React.FC<SplitPaneProps> = ({ layout }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sizes, setSizes] = useState<number[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState<number>(-1);

  // Debug logging
  useEffect(() => {
    console.log('SplitPane render:', { layout, hasType: 'type' in layout, hasDirection: 'direction' in layout });
  }, [layout]);

  // If this is a simple Panel (leaf node)
  if ('type' in layout) {
    return <PanelContent panel={layout} />;
  }

  // This is a PanelLayout (split node)
  const { direction, children } = layout;

  // Safety check
  if (!children || children.length === 0) {
    console.error('SplitPane: Invalid layout - no children', layout);
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-secondary-800">
        <div className="text-red-500">Error: Invalid panel layout</div>
      </div>
    );
  }

  // Initialize sizes from layout or use equal distribution
  useEffect(() => {
    if (layout.sizes && layout.sizes.length === children.length) {
      setSizes(layout.sizes);
    } else {
      const equalSize = 100 / children.length;
      setSizes(children.map(() => equalSize));
    }
  }, [children.length, layout.sizes]);

  const handleMouseDown = (index: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragIndex(index);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || dragIndex < 0) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const isHorizontal = direction === 'horizontal';
      const containerSize = isHorizontal ? containerRect.width : containerRect.height;
      const mousePos = isHorizontal ? e.clientX - containerRect.left : e.clientY - containerRect.top;

      // Calculate the position as a percentage
      const percentage = (mousePos / containerSize) * 100;

      // Calculate cumulative sizes up to dragIndex
      const cumulativeSize = sizes.slice(0, dragIndex + 1).reduce((a, b) => a + b, 0);

      // Calculate the change
      const delta = percentage - cumulativeSize;

      // Update sizes ensuring minimum size of 10%
      const newSizes = [...sizes];
      const minSize = 10;

      if (delta > 0) {
        // Moving right/down - shrink next panel
        const available = newSizes[dragIndex + 1] - minSize;
        const actualDelta = Math.min(delta, available);
        newSizes[dragIndex] += actualDelta;
        newSizes[dragIndex + 1] -= actualDelta;
      } else {
        // Moving left/up - shrink current panel
        const available = newSizes[dragIndex] - minSize;
        const actualDelta = Math.min(-delta, available);
        newSizes[dragIndex] -= actualDelta;
        newSizes[dragIndex + 1] += actualDelta;
      }

      setSizes(newSizes);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragIndex(-1);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragIndex, sizes, direction]);

  const isHorizontal = direction === 'horizontal';

  return (
    <div
      ref={containerRef}
      className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} w-full h-full`}
    >
      {children.map((child, index) => (
        <React.Fragment key={child.id}>
          <div
            style={{
              [isHorizontal ? 'width' : 'height']: `${sizes[index] || 100 / children.length}%`,
            }}
            className="relative overflow-hidden"
          >
            <SplitPane layout={child} />
          </div>

          {/* Resizer */}
          {index < children.length - 1 && (
            <div
              onMouseDown={handleMouseDown(index)}
              className={`
                bg-secondary-200 dark:bg-secondary-700
                hover:bg-primary-500 dark:hover:bg-primary-600
                transition-colors
                ${isHorizontal ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'}
                ${isDragging && dragIndex === index ? 'bg-primary-500 dark:bg-primary-600' : ''}
              `}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default SplitPane;
