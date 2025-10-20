import React, { useMemo } from 'react';
import { Card } from '@shared/types';
import CardItem from './CardItem';

interface CardListProps {
  cards: Card[];
  expandedAll: boolean;
  filterText: string;
  selectedCardTypes: string[];
  compactMode: boolean;
  selectedCards?: Set<string>;
  onSelectCard?: (cardId: string, multi: boolean) => void;
  onSelectRange?: (startCardId: string, endCardId: string, allCards: string[]) => void;
  lastSelectedCard?: string | null;
  onUpdateCard?: (cardId: string, updates: Partial<Card>) => void;
}

const CardList: React.FC<CardListProps> = ({
  cards,
  expandedAll,
  filterText,
  selectedCardTypes,
  compactMode,
  selectedCards = new Set(),
  onSelectCard,
  onSelectRange,
  lastSelectedCard = null,
  onUpdateCard,
}) => {
  // Filter cards based on type and text
  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      // Filter by card type
      if (!selectedCardTypes.includes(card.type)) {
        return false;
      }

      // Filter by text
      if (filterText.trim()) {
        const searchText = filterText.toLowerCase();
        const cardText = card.content.text.toLowerCase();
        const cardNumber = card.content.number?.toLowerCase() || '';
        return cardText.includes(searchText) || cardNumber.includes(searchText);
      }

      return true;
    });
  }, [cards, selectedCardTypes, filterText]);

  // Build hierarchy map for indentation
  const cardMap = useMemo(() => {
    const map = new Map<string, Card>();
    cards.forEach((card) => map.set(card.id, card));
    return map;
  }, [cards]);

  // Calculate indent level for each card
  const getIndentLevel = (card: Card): number => {
    let level = 0;
    let current = card;
    while (current.parent_id) {
      level++;
      const parent = cardMap.get(current.parent_id);
      if (!parent) break;
      current = parent;
    }
    return level;
  };

  if (filteredCards.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-sm text-secondary-500 dark:text-secondary-400">
          No cards match the current filter
        </p>
      </div>
    );
  }

  const handleSelectRange = (cardId: string, shift: boolean) => {
    if (shift && lastSelectedCard && onSelectRange) {
      const allCardIds = filteredCards.map((c) => c.id);
      onSelectRange(lastSelectedCard, cardId, allCardIds);
    }
  };

  return (
    <div className="p-2">
      {filteredCards.map((card) => (
        <CardItem
          key={card.id}
          card={card}
          indentLevel={getIndentLevel(card)}
          expandedAll={expandedAll}
          compactMode={compactMode}
          isSelected={selectedCards.has(card.id)}
          onSelect={onSelectCard}
          onSelectRange={handleSelectRange}
          onUpdate={onUpdateCard}
        />
      ))}
    </div>
  );
};

export default CardList;
