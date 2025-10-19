import React, { useState, useEffect } from 'react';
import { Card, CardInfoType, CardStatus } from '@shared/types';

interface CardItemProps {
  card: Card;
  indentLevel: number;
  expandedAll: boolean;
  compactMode: boolean;
  onSelect?: (cardId: string, multi: boolean) => void;
  isSelected?: boolean;
}

const CardItem: React.FC<CardItemProps> = ({
  card,
  indentLevel,
  expandedAll,
  compactMode,
  onSelect,
  isSelected = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Sync with expandedAll prop
  useEffect(() => {
    setIsExpanded(expandedAll);
  }, [expandedAll]);

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (onSelect) {
      const multi = e.ctrlKey || e.metaKey;
      onSelect(card.id, multi);
    }
  };

  // Get icon for card type
  const getTypeIcon = (type: CardInfoType): string => {
    switch (type) {
      case 'heading':
        return 'H';
      case 'paragraph':
        return 'P';
      case 'bullet':
        return '•';
      case 'figure':
        return 'F';
      case 'table':
        return 'T';
      case 'test':
        return '✓';
      case 'qa':
        return 'Q';
      case 'other':
        return '○';
      default:
        return '?';
    }
  };

  // Get color for card type
  const getTypeColor = (type: CardInfoType): string => {
    switch (type) {
      case 'heading':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700';
      case 'paragraph':
        return 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700';
      case 'bullet':
        return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700';
      case 'figure':
        return 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700';
      case 'table':
        return 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700';
      case 'test':
        return 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-700';
      case 'qa':
        return 'bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300 border-pink-300 dark:border-pink-700';
      case 'other':
        return 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700';
      default:
        return 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700';
    }
  };

  // Get status badge color
  const getStatusColor = (status: CardStatus): string => {
    switch (status) {
      case 'draft':
        return 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
      case 'review':
        return 'bg-yellow-200 dark:bg-yellow-700 text-yellow-800 dark:text-yellow-300';
      case 'approved':
        return 'bg-green-200 dark:bg-green-700 text-green-800 dark:text-green-300';
      case 'deprecated':
        return 'bg-red-200 dark:bg-red-700 text-red-800 dark:text-red-300';
      default:
        return 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  const indentPx = indentLevel * 16; // 16px per level

  return (
    <div
      className={`mb-1 rounded border ${
        isSelected
          ? 'border-primary-500 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/20'
          : 'border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-800'
      } hover:bg-secondary-50 dark:hover:bg-secondary-750 transition-colors relative`}
      style={{ marginLeft: `${indentPx}px` }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Left trace junction point */}
      <div
        className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 transition-all ${
          isHovering
            ? 'bg-blue-500 border-blue-600 scale-110'
            : 'bg-white dark:bg-secondary-700 border-secondary-400 dark:border-secondary-600'
        } cursor-pointer hover:scale-125`}
        title="Left trace junction"
      />

      {/* Right trace junction point */}
      <div
        className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full border-2 transition-all ${
          isHovering
            ? 'bg-blue-500 border-blue-600 scale-110'
            : 'bg-white dark:bg-secondary-700 border-secondary-400 dark:border-secondary-600'
        } cursor-pointer hover:scale-125`}
        title="Right trace junction"
      />

      {/* Card header */}
      <div
        className="flex items-center gap-2 px-2 py-1 cursor-pointer"
        onClick={handleCardClick}
      >
        {/* Expand/collapse icon */}
        <span
          className="text-xs text-secondary-500 dark:text-secondary-400 w-3 hover:text-secondary-700 dark:hover:text-secondary-300"
          onClick={toggleExpand}
        >
          {isExpanded ? '▼' : '▶'}
        </span>

        {/* Type icon */}
        <span
          className={`flex items-center justify-center w-5 h-5 text-xs font-semibold rounded border ${getTypeColor(
            card.type
          )}`}
        >
          {getTypeIcon(card.type)}
        </span>

        {/* Status badge */}
        <span
          className={`px-1.5 py-0.5 text-xs rounded ${getStatusColor(
            card.status
          )}`}
        >
          {card.status}
        </span>

        {/* Number (if exists) */}
        {card.content.number && (
          <span className="text-xs font-mono text-secondary-600 dark:text-secondary-400">
            {card.content.number}
          </span>
        )}

        {/* Preview text */}
        <span className="text-xs text-secondary-700 dark:text-secondary-300 truncate flex-1">
          {compactMode
            ? card.content.text.substring(0, 50) +
              (card.content.text.length > 50 ? '...' : '')
            : card.content.text.substring(0, 100) +
              (card.content.text.length > 100 ? '...' : '')}
        </span>

        {/* Updated timestamp */}
        <span className="text-xs text-secondary-500 dark:text-secondary-500">
          {new Date(card.updatedAt).toLocaleString()}
        </span>
      </div>

      {/* Card content (expanded) */}
      {isExpanded && !compactMode && (
        <div className="px-2 pb-2 pt-1 border-t border-secondary-200 dark:border-secondary-700">
          <div className="text-sm text-secondary-800 dark:text-secondary-200 whitespace-pre-wrap">
            {card.content.text}
          </div>
          {/* Metadata */}
          <div className="mt-2 pt-2 border-t border-secondary-200 dark:border-secondary-700">
            <div className="grid grid-cols-2 gap-2 text-xs text-secondary-600 dark:text-secondary-400">
              <div>
                <span className="font-semibold">ID:</span>{' '}
                <span className="font-mono">{card.id.substring(0, 8)}...</span>
              </div>
              <div>
                <span className="font-semibold">Type:</span> {card.type}
              </div>
              <div>
                <span className="font-semibold">Status:</span> {card.status}
              </div>
              <div>
                <span className="font-semibold">Updated:</span>{' '}
                {new Date(card.updatedAt).toLocaleString()}
              </div>
              {card.parent_id && (
                <div>
                  <span className="font-semibold">Parent:</span>{' '}
                  <span className="font-mono">
                    {card.parent_id.substring(0, 8)}...
                  </span>
                </div>
              )}
              {card.child_ids.length > 0 && (
                <div>
                  <span className="font-semibold">Children:</span>{' '}
                  {card.child_ids.length}
                </div>
              )}
              {card.prev_id && (
                <div>
                  <span className="font-semibold">Prev:</span>{' '}
                  <span className="font-mono">
                    {card.prev_id.substring(0, 8)}...
                  </span>
                </div>
              )}
              {card.next_id && (
                <div>
                  <span className="font-semibold">Next:</span>{' '}
                  <span className="font-mono">
                    {card.next_id.substring(0, 8)}...
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardItem;
