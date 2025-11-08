import { create } from 'zustand';

export type PanelVisualState = 'active' | 'semiActive' | 'inactive';
export type SelectionMode = 'normal' | 'ctrl' | 'shift';

interface PanelEngagementStore {
  states: Record<string, PanelVisualState>;
  handleSelectionTransition: (previousLeafId: string | null, nextLeafId: string, mode: SelectionMode) => void;
  setPanelState: (leafId: string, state: PanelVisualState) => void;
  removePanel: (leafId: string) => void;
}

export const usePanelEngagementStore = create<PanelEngagementStore>()((set) => ({
  states: {},
  handleSelectionTransition: (previousLeafId, nextLeafId, mode) => {
    set((state) => {
      const nextStates = { ...state.states };
      if (previousLeafId && previousLeafId !== nextLeafId) {
        if (mode === 'ctrl') {
          nextStates[previousLeafId] = 'semiActive';
        } else {
          Object.keys(nextStates).forEach((leaf) => {
            if (leaf !== nextLeafId) {
              nextStates[leaf] = 'inactive';
            }
          });
        }
      }
      nextStates[nextLeafId] = 'active';
      return { states: nextStates };
    });
  },
  setPanelState: (leafId, panelState) => {
    set((state) => ({
      states: {
        ...state.states,
        [leafId]: panelState,
      },
    }));
  },
  removePanel: (leafId) => {
    set((state) => {
      const nextStates = { ...state.states };
      delete nextStates[leafId];
      return { states: nextStates };
    });
  },
}));
