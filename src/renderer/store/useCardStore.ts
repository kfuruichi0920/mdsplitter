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

  // Selection
  selectedCards: Set<string>;
  selectCard: (cardId: string, multi?: boolean) => void;
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

          const updatedCards = cardFile.cards.map((card) =>
            card.id === cardId ? { ...card, ...updates, updated_at: new Date().toISOString() } : card
          );

          const newCardFiles = new Map(state.cardFiles);
          newCardFiles.set(filePath, { ...cardFile, cards: updatedCards });

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
            cards: [...cardFile.cards, card],
            metadata: {
              ...cardFile.metadata,
              total_cards: cardFile.cards.length + 1,
            },
          });

          return { cardFiles: newCardFiles };
        }),

      deleteCard: (filePath, cardId) =>
        set((state) => {
          const cardFile = state.cardFiles.get(filePath);
          if (!cardFile) return state;

          const updatedCards = cardFile.cards.filter((card) => card.id !== cardId);
          const newCardFiles = new Map(state.cardFiles);
          newCardFiles.set(filePath, {
            ...cardFile,
            cards: updatedCards,
            metadata: {
              ...cardFile.metadata,
              total_cards: updatedCards.length,
            },
          });

          return { cardFiles: newCardFiles };
        }),

      // Selection
      selectedCards: new Set(),
      selectCard: (cardId, multi = false) =>
        set((state) => {
          const newSelection = multi ? new Set(state.selectedCards) : new Set<string>();
          newSelection.add(cardId);
          return { selectedCards: newSelection };
        }),

      deselectCard: (cardId) =>
        set((state) => {
          const newSelection = new Set(state.selectedCards);
          newSelection.delete(cardId);
          return { selectedCards: newSelection };
        }),

      clearSelection: () => set({ selectedCards: new Set() }),

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
