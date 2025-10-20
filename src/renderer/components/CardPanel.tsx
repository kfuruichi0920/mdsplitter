import React, { useState, useEffect } from 'react';
import { CardFile } from '@shared/types';
import { useCardStore } from '../store/useCardStore';
import CardPanelToolbar from './CardPanelToolbar';
import CardList from './CardList';

interface CardPanelProps {
  cardFile: CardFile | null;
  filePath?: string;
}

const CardPanel: React.FC<CardPanelProps> = ({ cardFile, filePath }) => {
  const { selectedCards, lastSelectedCard, selectCard, selectRange, selectAll, clearSelection, updateCard } = useCardStore();
  const [expandedAll, setExpandedAll] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [compactMode, setCompactMode] = useState(false);
  const [selectedCardTypes, setSelectedCardTypes] = useState<string[]>([
    'heading',
    'paragraph',
    'bullet',
    'figure',
    'table',
    'test',
    'qa',
    'other',
  ]);

  const handleExpandAll = () => {
    setExpandedAll(true);
  };

  const handleCollapseAll = () => {
    setExpandedAll(false);
  };

  const toggleCompactMode = () => {
    setCompactMode(!compactMode);
  };

  const handleSelectCard = (cardId: string, multi: boolean) => {
    selectCard(cardId, multi);
  };

  const handleUpdateCard = (cardId: string, updates: Partial<import('@shared/types').Card>) => {
    if (filePath) {
      updateCard(filePath, cardId, updates);
    }
  };

  const handleSelectRange = (startCardId: string, endCardId: string, allCards: string[]) => {
    selectRange(startCardId, endCardId, allCards);
  };

  const handleAddCard = () => {
    if (!filePath || !cardFile) return;

    const newCard: import('@shared/types').Card = {
      id: crypto.randomUUID(),
      type: 'paragraph',
      status: 'draft',
      content: {
        text: 'New card',
      },
      updatedAt: new Date().toISOString(),
      parent_id: null,
      child_ids: [],
      prev_id: null,
      next_id: null,
    };

    const { addCard: storeAddCard } = useCardStore.getState();
    storeAddCard(filePath, newCard);
  };

  const handleDeleteSelected = () => {
    if (!filePath || selectedCards.size === 0) return;

    if (confirm(`Delete ${selectedCards.size} card(s)?`)) {
      const { deleteCard: storeDeleteCard } = useCardStore.getState();
      selectedCards.forEach((cardId) => {
        storeDeleteCard(filePath, cardId);
      });
      clearSelection();
    }
  };

  const handleSave = async () => {
    if (!filePath || !cardFile) return;

    try {
      const result = await window.electron.saveCardFile({ cardFile });
      if (result.success) {
        console.log('Card file saved:', result.savedPath);
        await window.electron.logInfo('Card file saved', { savedPath: result.savedPath });
        // TODO: Show success notification
      } else {
        console.error('Save failed:', result.error);
        await window.electron.logError('Failed to save card file', result.error);
        // TODO: Show error notification
      }
    } catch (error) {
      console.error('Save error:', error);
      await window.electron.logError('Save error', error);
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+A / Cmd+A: Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && cardFile) {
        e.preventDefault();
        const allCardIds = cardFile.body.map((card) => card.id);
        selectAll(allCardIds);
      }
      // Ctrl+S / Cmd+S: Save
      else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      // Delete: Delete selected cards
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCards.size > 0) {
        e.preventDefault();
        handleDeleteSelected();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cardFile, selectAll, selectedCards, filePath]);

  if (!cardFile) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-sm text-secondary-600 dark:text-secondary-400">
            No card file loaded
          </p>
          <p className="text-xs text-secondary-500 dark:text-secondary-500 mt-2">
            {filePath || 'Open a file to view cards'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-secondary-900">
      {/* Card Panel Toolbar */}
      <div className="border-b border-secondary-200 dark:border-secondary-700">
        <CardPanelToolbar
          onExpandAll={handleExpandAll}
          onCollapseAll={handleCollapseAll}
          filterText={filterText}
          onFilterTextChange={setFilterText}
          selectedCardTypes={selectedCardTypes}
          onCardTypesChange={setSelectedCardTypes}
          compactMode={compactMode}
          onToggleCompactMode={toggleCompactMode}
        />
        {/* Action buttons */}
        <div className="flex gap-2 px-2 py-1 bg-secondary-50 dark:bg-secondary-800">
          <button
            onClick={handleSave}
            className="px-2 py-1 text-xs rounded bg-green-600 hover:bg-green-700 text-white"
            title="Save card file (Ctrl+S)"
          >
            💾 Save
          </button>
          <button
            onClick={handleAddCard}
            className="px-2 py-1 text-xs rounded bg-primary-600 hover:bg-primary-700 text-white"
            title="Add new card"
          >
            + Add Card
          </button>
          <button
            onClick={handleDeleteSelected}
            disabled={selectedCards.size === 0}
            className="px-2 py-1 text-xs rounded bg-red-600 hover:bg-red-700 text-white disabled:bg-secondary-400 disabled:cursor-not-allowed"
            title="Delete selected cards (Del)"
          >
            Delete ({selectedCards.size})
          </button>
        </div>
      </div>

      {/* Card List */}
      <div className="flex-1 overflow-auto">
        <CardList
          cards={cardFile.body}
          expandedAll={expandedAll}
          filterText={filterText}
          selectedCardTypes={selectedCardTypes}
          compactMode={compactMode}
          selectedCards={selectedCards}
          onSelectCard={handleSelectCard}
          onSelectRange={handleSelectRange}
          lastSelectedCard={lastSelectedCard}
          onUpdateCard={handleUpdateCard}
        />
      </div>

      {/* Card count info */}
      <div className="px-3 py-1 border-t border-secondary-200 dark:border-secondary-700 bg-secondary-50 dark:bg-secondary-800">
        <p className="text-xs text-secondary-600 dark:text-secondary-400">
          {cardFile.body.length} cards total
        </p>
      </div>
    </div>
  );
};

export default CardPanel;
