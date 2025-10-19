import React from 'react';
import { CardInfoType } from '@shared/types';

interface CardPanelToolbarProps {
  onExpandAll: () => void;
  onCollapseAll: () => void;
  filterText: string;
  onFilterTextChange: (text: string) => void;
  selectedCardTypes: string[];
  onCardTypesChange: (types: string[]) => void;
  compactMode: boolean;
  onToggleCompactMode: () => void;
}

const CardPanelToolbar: React.FC<CardPanelToolbarProps> = ({
  onExpandAll,
  onCollapseAll,
  filterText,
  onFilterTextChange,
  selectedCardTypes,
  onCardTypesChange,
  compactMode,
  onToggleCompactMode,
}) => {
  const cardTypes: { value: CardInfoType; label: string }[] = [
    { value: 'heading', label: 'Heading' },
    { value: 'paragraph', label: 'Paragraph' },
    { value: 'bullet', label: 'Bullet' },
    { value: 'figure', label: 'Figure' },
    { value: 'table', label: 'Table' },
    { value: 'test', label: 'Test' },
    { value: 'qa', label: 'Q&A' },
    { value: 'other', label: 'Other' },
  ];

  const toggleCardType = (type: string) => {
    if (selectedCardTypes.includes(type)) {
      onCardTypesChange(selectedCardTypes.filter((t) => t !== type));
    } else {
      onCardTypesChange([...selectedCardTypes, type]);
    }
  };

  const selectAllTypes = () => {
    onCardTypesChange(cardTypes.map((t) => t.value));
  };

  const deselectAllTypes = () => {
    onCardTypesChange([]);
  };

  return (
    <div className="px-3 py-2 border-b border-secondary-200 dark:border-secondary-700 bg-secondary-50 dark:bg-secondary-800">
      {/* First row: Expand/Collapse and Compact mode */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={onExpandAll}
          className="px-2 py-1 text-xs rounded bg-white dark:bg-secondary-700 border border-secondary-300 dark:border-secondary-600 hover:bg-secondary-100 dark:hover:bg-secondary-600 text-secondary-700 dark:text-secondary-300"
          title="Expand all cards"
        >
          ▼ Expand All
        </button>
        <button
          onClick={onCollapseAll}
          className="px-2 py-1 text-xs rounded bg-white dark:bg-secondary-700 border border-secondary-300 dark:border-secondary-600 hover:bg-secondary-100 dark:hover:bg-secondary-600 text-secondary-700 dark:text-secondary-300"
          title="Collapse all cards"
        >
          ▶ Collapse All
        </button>
        <div className="flex-1" />
        <button
          onClick={onToggleCompactMode}
          className={`px-2 py-1 text-xs rounded border ${
            compactMode
              ? 'bg-primary-100 dark:bg-primary-900 border-primary-400 dark:border-primary-600 text-primary-700 dark:text-primary-300'
              : 'bg-white dark:bg-secondary-700 border-secondary-300 dark:border-secondary-600 text-secondary-700 dark:text-secondary-300'
          } hover:bg-secondary-100 dark:hover:bg-secondary-600`}
          title="Toggle compact mode"
        >
          ☰ Compact
        </button>
      </div>

      {/* Second row: Filter text */}
      <div className="mb-2">
        <input
          type="text"
          value={filterText}
          onChange={(e) => onFilterTextChange(e.target.value)}
          placeholder="Filter by text..."
          className="w-full px-2 py-1 text-xs rounded border border-secondary-300 dark:border-secondary-600 bg-white dark:bg-secondary-700 text-secondary-900 dark:text-secondary-100 placeholder-secondary-400 dark:placeholder-secondary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      {/* Third row: Card type filter */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={selectAllTypes}
          className="px-1.5 py-0.5 text-xs rounded bg-white dark:bg-secondary-700 border border-secondary-300 dark:border-secondary-600 hover:bg-secondary-100 dark:hover:bg-secondary-600 text-secondary-600 dark:text-secondary-400"
        >
          All
        </button>
        <button
          onClick={deselectAllTypes}
          className="px-1.5 py-0.5 text-xs rounded bg-white dark:bg-secondary-700 border border-secondary-300 dark:border-secondary-600 hover:bg-secondary-100 dark:hover:bg-secondary-600 text-secondary-600 dark:text-secondary-400"
        >
          None
        </button>
        <div className="w-px bg-secondary-300 dark:bg-secondary-600" />
        {cardTypes.map((type) => (
          <button
            key={type.value}
            onClick={() => toggleCardType(type.value)}
            className={`px-1.5 py-0.5 text-xs rounded border ${
              selectedCardTypes.includes(type.value)
                ? 'bg-primary-100 dark:bg-primary-900 border-primary-400 dark:border-primary-600 text-primary-700 dark:text-primary-300'
                : 'bg-white dark:bg-secondary-700 border-secondary-300 dark:border-secondary-600 text-secondary-600 dark:text-secondary-400'
            } hover:bg-secondary-100 dark:hover:bg-secondary-600`}
          >
            {type.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default CardPanelToolbar;
