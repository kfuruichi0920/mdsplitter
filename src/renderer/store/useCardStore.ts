import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Card, CardFile } from '@shared/types';

interface CardState {
  // Card files
  cardFiles: Map<string, CardFile>; // filePath -> CardFile
  activeFile: string | null;

  // Card operations (to be implemented in Phase 4)
  loadCardFile: (filePath: string, cardFile: CardFile) => void;
  unloadCardFile: (filePath: string) => void;
  setActiveFile: (filePath: string | null) => void;
  updateCard: (filePath: string, cardId: string, updates: Partial<Card>) => void;
  addCard: (filePath: string, card: Card, position?: { parentId?: string; afterId?: string }) => void;
  deleteCard: (filePath: string, cardId: string) => void;
  moveCard: (filePath: string, cardId: string, targetCardId: string, position: 'before' | 'after' | 'child') => void;

  // Selection
  selectedCards: Set<string>;
  lastSelectedCard: string | null;
  selectCard: (cardId: string, multi?: boolean) => void;
  selectRange: (startCardId: string, endCardId: string, allCards: string[]) => void;
  selectAll: (cardIds: string[]) => void;
  deselectCard: (cardId: string) => void;
  clearSelection: () => void;

  // Filter & Search
  filterText: string;
  setFilterText: (text: string) => void;
  expandedCards: Set<string>;
  toggleExpanded: (cardId: string) => void;
}

export const useCardStore = create<CardState>()(
  devtools(
    (set) => ({
      // Card files
      cardFiles: new Map(),
      activeFile: null,

      // Card operations
      loadCardFile: (filePath, cardFile) =>
        set((state) => {
          const newCardFiles = new Map(state.cardFiles);
          newCardFiles.set(filePath, cardFile);
          return {
            cardFiles: newCardFiles,
            activeFile: filePath,
          };
        }),

      unloadCardFile: (filePath) =>
        set((state) => {
          const newCardFiles = new Map(state.cardFiles);
          newCardFiles.delete(filePath);
          return {
            cardFiles: newCardFiles,
            activeFile: state.activeFile === filePath ? null : state.activeFile,
          };
        }),

      setActiveFile: (filePath) => set({ activeFile: filePath }),

      updateCard: (filePath, cardId, updates) =>
        set((state) => {
          const cardFile = state.cardFiles.get(filePath);
          if (!cardFile) return state;

          const updatedCards = cardFile.body.map((card) =>
            card.id === cardId ? { ...card, ...updates, updatedAt: new Date().toISOString() } : card
          );

          const newCardFiles = new Map(state.cardFiles);
          newCardFiles.set(filePath, {
            ...cardFile,
            body: updatedCards,
            header: {
              ...cardFile.header,
              updatedAt: new Date().toISOString(),
            },
          });

          return { cardFiles: newCardFiles };
        }),

      addCard: (filePath, card, position) =>
        set((state) => {
          const cardFile = state.cardFiles.get(filePath);
          if (!cardFile) return state;

          // TODO: Implement proper card insertion logic in Phase 4
          const newCardFiles = new Map(state.cardFiles);
          newCardFiles.set(filePath, {
            ...cardFile,
            body: [...cardFile.body, card],
            header: {
              ...cardFile.header,
              updatedAt: new Date().toISOString(),
            },
          });

          return { cardFiles: newCardFiles };
        }),

      deleteCard: (filePath, cardId) =>
        set((state) => {
          const cardFile = state.cardFiles.get(filePath);
          if (!cardFile) return state;

          const updatedCards = cardFile.body.filter((card) => card.id !== cardId);
          const newCardFiles = new Map(state.cardFiles);
          newCardFiles.set(filePath, {
            ...cardFile,
            body: updatedCards,
            header: {
              ...cardFile.header,
              updatedAt: new Date().toISOString(),
            },
          });

          return { cardFiles: newCardFiles };
        }),

      moveCard: (filePath, cardId, targetCardId, position) =>
        set((state) => {
          const cardFile = state.cardFiles.get(filePath);
          if (!cardFile || cardId === targetCardId) return state;

          const cards = [...cardFile.body];
          const cardIndex = cards.findIndex((c) => c.id === cardId);
          const targetIndex = cards.findIndex((c) => c.id === targetCardId);

          if (cardIndex === -1 || targetIndex === -1) return state;

          const card = cards[cardIndex];
          const targetCard = cards[targetIndex];

          // Remove card from its current position
          cards.splice(cardIndex, 1);

          // Adjust target index if needed
          const adjustedTargetIndex = cardIndex < targetIndex ? targetIndex - 1 : targetIndex;

          // Update card relationships based on position
          const updatedCard = { ...card };

          if (position === 'child') {
            // Make card a child of target
            updatedCard.parent_id = targetCard.id;
            updatedCard.prev_id = null;
            updatedCard.next_id = null;

            // Update target's child_ids
            const updatedTarget = {
              ...targetCard,
              child_ids: [...targetCard.child_ids, card.id],
            };
            const targetIdx = cards.findIndex((c) => c.id === targetCard.id);
            if (targetIdx !== -1) {
              cards[targetIdx] = updatedTarget;
            }
          } else {
            // Insert before or after target (sibling)
            updatedCard.parent_id = targetCard.parent_id;

            if (position === 'before') {
              updatedCard.prev_id = targetCard.prev_id;
              updatedCard.next_id = targetCard.id;
              cards.splice(adjustedTargetIndex, 0, updatedCard);
            } else {
              // after
              updatedCard.prev_id = targetCard.id;
              updatedCard.next_id = targetCard.next_id;
              cards.splice(adjustedTargetIndex + 1, 0, updatedCard);
            }
          }

          // Update references in other cards
          const finalCards = cards.map((c) => {
            if (c.id === targetCard.id && position !== 'child') {
              if (position === 'before') {
                return { ...c, prev_id: card.prev_id, next_id: card.id };
              } else {
                return { ...c, next_id: card.id };
              }
            }
            return c;
          });

          // Find and update the moved card in the final array
          const movedCardIndex = finalCards.findIndex((c) => c.id === card.id);
          if (movedCardIndex !== -1) {
            finalCards[movedCardIndex] = updatedCard;
          }

          const newCardFiles = new Map(state.cardFiles);
          newCardFiles.set(filePath, {
            ...cardFile,
            body: finalCards,
            header: {
              ...cardFile.header,
              updatedAt: new Date().toISOString(),
            },
          });

          return { cardFiles: newCardFiles };
        }),

      // Selection
      selectedCards: new Set(),
      lastSelectedCard: null,
      selectCard: (cardId, multi = false) =>
        set((state) => {
          const newSelection = multi ? new Set(state.selectedCards) : new Set<string>();
          if (multi && newSelection.has(cardId)) {
            // Toggle if already selected in multi mode
            newSelection.delete(cardId);
          } else {
            newSelection.add(cardId);
          }
          return { selectedCards: newSelection, lastSelectedCard: cardId };
        }),

      selectRange: (startCardId, endCardId, allCards) =>
        set((state) => {
          const startIndex = allCards.indexOf(startCardId);
          const endIndex = allCards.indexOf(endCardId);

          if (startIndex === -1 || endIndex === -1) return state;

          const minIndex = Math.min(startIndex, endIndex);
          const maxIndex = Math.max(startIndex, endIndex);

          const newSelection = new Set(state.selectedCards);
          for (let i = minIndex; i <= maxIndex; i++) {
            newSelection.add(allCards[i]);
          }

          return { selectedCards: newSelection, lastSelectedCard: endCardId };
        }),

      selectAll: (cardIds) =>
        set({ selectedCards: new Set(cardIds), lastSelectedCard: cardIds[cardIds.length - 1] || null }),

      deselectCard: (cardId) =>
        set((state) => {
          const newSelection = new Set(state.selectedCards);
          newSelection.delete(cardId);
          return { selectedCards: newSelection };
        }),

      clearSelection: () => set({ selectedCards: new Set(), lastSelectedCard: null }),

      // Filter & Search
      filterText: '',
      setFilterText: (text) => set({ filterText: text }),

      expandedCards: new Set(),
      toggleExpanded: (cardId) =>
        set((state) => {
          const newExpanded = new Set(state.expandedCards);
          if (newExpanded.has(cardId)) {
            newExpanded.delete(cardId);
          } else {
            newExpanded.add(cardId);
          }
          return { expandedCards: newExpanded };
        }),
    }),
    { name: 'CardStore' }
  )
);
