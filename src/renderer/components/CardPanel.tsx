import React, { useState } from 'react';
import { CardFile } from '@shared/types';
import { useCardStore } from '../store/useCardStore';
import CardPanelToolbar from './CardPanelToolbar';
import CardList from './CardList';

interface CardPanelProps {
  cardFile: CardFile | null;
  filePath?: string;
}

const CardPanel: React.FC<CardPanelProps> = ({ cardFile, filePath }) => {
  const { selectedCards, selectCard, clearSelection } = useCardStore();
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
