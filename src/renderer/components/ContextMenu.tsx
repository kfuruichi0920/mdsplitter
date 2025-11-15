import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

export interface ContextMenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  variant?: 'default' | 'danger';
  closeOnSelect?: boolean;
  onSelect?: () => void;
}

export interface ContextMenuSection {
  key: string;
  title?: string;
  items: ContextMenuItem[];
}

interface ContextMenuProps {
  x: number;
  y: number;
  sections: ContextMenuSection[];
  onClose: () => void;
}

/**
 * @brief パネル共通の右クリックメニュー。
 * @details
 * 画面端で折り返し位置を調整し、外側クリックやEscで閉じる。
 */
export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, sections, onClose }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ top: y, left: x });

  const visibleSections = useMemo(() => sections.filter((section) => section.items.length > 0), [sections]);

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) {
      setPosition({ top: y, left: x });
      return;
    }
    const rect = node.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let nextTop = y;
    let nextLeft = x;

    if (rect.bottom > viewportHeight) {
      nextTop = Math.max(8, viewportHeight - rect.height - 8);
    }
    if (rect.right > viewportWidth) {
      nextLeft = Math.max(8, viewportWidth - rect.width - 8);
    }

    setPosition({ top: nextTop, left: nextLeft });
  }, [x, y, sections]);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      onClose();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  if (visibleSections.length === 0) {
    return null;
  }

  const handleSelect = (item: ContextMenuItem) => {
    if (item.disabled) {
      return;
    }
    item.onSelect?.();
    if (item.closeOnSelect !== false) {
      onClose();
    }
  };

  return (
    <div
      ref={containerRef}
      className="panel-context-menu"
      style={{ top: position.top, left: position.left }}
      role="menu"
    >
      {visibleSections.map((section, sectionIndex) => (
        <React.Fragment key={section.key}>
          <div className="panel-context-menu__section" aria-label={section.title ?? undefined}>
            {section.title ? <p className="panel-context-menu__section-label">{section.title}</p> : null}
            {section.items.map((item) => (
              <button
                key={item.key}
                type="button"
                className={[
                  'panel-context-menu__item',
                  item.variant === 'danger' ? 'panel-context-menu__item--danger' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => handleSelect(item)}
                disabled={item.disabled}
                role="menuitem"
              >
                {item.icon ? <span className="panel-context-menu__icon" aria-hidden>{item.icon}</span> : null}
                <span className="panel-context-menu__label">{item.label}</span>
                {item.shortcut ? <span className="panel-context-menu__shortcut">{item.shortcut}</span> : null}
              </button>
            ))}
          </div>
          {sectionIndex < visibleSections.length - 1 ? <div className="panel-context-menu__divider" /> : null}
        </React.Fragment>
      ))}
    </div>
  );
};

ContextMenu.displayName = 'ContextMenu';
