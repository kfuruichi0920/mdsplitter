import React, { useState, useEffect, useRef } from 'react';
import { Card, CardInfoType, CardStatus } from '@shared/types';

interface CardItemProps {
  card: Card;
  indentLevel: number;
  expandedAll: boolean;
  compactMode: boolean;
  onSelect?: (cardId: string, multi: boolean) => void;
  onSelectRange?: (cardId: string, shift: boolean) => void;
  isSelected?: boolean;
  onUpdate?: (cardId: string, updates: Partial<Card>) => void;
}

const CardItem: React.FC<CardItemProps> = ({
  card,
  indentLevel,
  expandedAll,
  compactMode,
  onSelect,
  onSelectRange,
  isSelected = false,
  onUpdate,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(card.content.text);
  const [editedNumber, setEditedNumber] = useState(card.content.number || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync with expandedAll prop
  useEffect(() => {
    setIsExpanded(expandedAll);
  }, [expandedAll]);

  // Sync edited values with card prop
  useEffect(() => {
    setEditedText(card.content.text);
    setEditedNumber(card.content.number || '');
  }, [card.content.text, card.content.number]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (e.shiftKey && onSelectRange) {
      // Shift-click for range selection
      onSelectRange(card.id, true);
    } else if (onSelect) {
      // Ctrl/Cmd-click for multi selection, or normal click
      const multi = e.ctrlKey || e.metaKey;
      onSelect(card.id, multi);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setIsExpanded(true);
  };

  const handleSaveEdit = () => {
    if (onUpdate && (editedText !== card.content.text || editedNumber !== card.content.number)) {
      onUpdate(card.id, {
        content: {
          text: editedText,
          number: editedNumber || undefined,
        },
      });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedText(card.content.text);
    setEditedNumber(card.content.number || '');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancelEdit();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSaveEdit();
    }
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    if (onUpdate) {
      onUpdate(card.id, { status: e.target.value as CardStatus });
    }
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    if (onUpdate) {
      onUpdate(card.id, { type: e.target.value as CardInfoType });
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
        className={`flex items-center gap-2 px-2 py-1 ${isEditing ? 'cursor-default' : 'cursor-pointer'}`}
        onClick={isEditing ? undefined : handleCardClick}
        onDoubleClick={isEditing ? undefined : handleDoubleClick}
      >
        {/* Expand/collapse icon */}
        <span
          className="text-xs text-secondary-500 dark:text-secondary-400 w-3 hover:text-secondary-700 dark:hover:text-secondary-300"
          onClick={toggleExpand}
        >
          {isExpanded ? '▼' : '▶'}
        </span>

        {/* Type selector or icon */}
        {isEditing ? (
          <select
            value={card.type}
            onChange={handleTypeChange}
            onClick={(e) => e.stopPropagation()}
            className="text-xs rounded border px-1 py-0.5 bg-white dark:bg-secondary-700 border-secondary-300 dark:border-secondary-600"
          >
            <option value="heading">Heading</option>
            <option value="paragraph">Paragraph</option>
            <option value="bullet">Bullet</option>
            <option value="figure">Figure</option>
            <option value="table">Table</option>
            <option value="test">Test</option>
            <option value="qa">Q&A</option>
            <option value="other">Other</option>
          </select>
        ) : (
          <span
            className={`flex items-center justify-center w-5 h-5 text-xs font-semibold rounded border ${getTypeColor(
              card.type
            )}`}
          >
            {getTypeIcon(card.type)}
          </span>
        )}

        {/* Status selector or badge */}
        {isEditing ? (
          <select
            value={card.status}
            onChange={handleStatusChange}
            onClick={(e) => e.stopPropagation()}
            className="text-xs rounded border px-1 py-0.5 bg-white dark:bg-secondary-700 border-secondary-300 dark:border-secondary-600"
          >
            <option value="draft">Draft</option>
            <option value="review">Review</option>
            <option value="approved">Approved</option>
            <option value="deprecated">Deprecated</option>
          </select>
        ) : (
          <span
            className={`px-1.5 py-0.5 text-xs rounded ${getStatusColor(
              card.status
            )}`}
          >
            {card.status}
          </span>
        )}

        {/* Number input or display */}
        {isEditing ? (
          <input
            type="text"
            value={editedNumber}
            onChange={(e) => setEditedNumber(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Number"
            className="text-xs font-mono w-24 px-1 py-0.5 rounded border bg-white dark:bg-secondary-700 border-secondary-300 dark:border-secondary-600"
          />
        ) : (
          card.content.number && (
            <span className="text-xs font-mono text-secondary-600 dark:text-secondary-400">
              {card.content.number}
            </span>
          )
        )}

        {/* Preview text or editing indicator */}
        <span className="text-xs text-secondary-700 dark:text-secondary-300 truncate flex-1">
          {isEditing ? (
            <span className="italic text-primary-600 dark:text-primary-400">Editing...</span>
          ) : compactMode ? (
            card.content.text.substring(0, 50) +
            (card.content.text.length > 50 ? '...' : '')
          ) : (
            card.content.text.substring(0, 100) +
            (card.content.text.length > 100 ? '...' : '')
          )}
        </span>

        {/* Updated timestamp */}
        <span className="text-xs text-secondary-500 dark:text-secondary-500">
          {new Date(card.updatedAt).toLocaleString()}
        </span>

        {/* Unsaved marker */}
        {isEditing && (
          <span className="text-xs text-yellow-600 dark:text-yellow-400 font-semibold">
            *
          </span>
        )}
      </div>

      {/* Card content (expanded) */}
      {isExpanded && !compactMode && (
        <div className="px-2 pb-2 pt-1 border-t border-secondary-200 dark:border-secondary-700">
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                ref={textareaRef}
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
                className="w-full min-h-[100px] text-sm px-2 py-1 rounded border bg-white dark:bg-secondary-700 border-secondary-300 dark:border-secondary-600 text-secondary-800 dark:text-secondary-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveEdit();
                  }}
                  className="px-3 py-1 text-xs rounded bg-primary-600 hover:bg-primary-700 text-white"
                >
                  Save (Ctrl+Enter)
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelEdit();
                  }}
                  className="px-3 py-1 text-xs rounded bg-secondary-300 dark:bg-secondary-600 hover:bg-secondary-400 dark:hover:bg-secondary-500 text-secondary-800 dark:text-secondary-200"
                >
                  Cancel (Esc)
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-secondary-800 dark:text-secondary-200 whitespace-pre-wrap">
              {card.content.text}
            </div>
          )}
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
