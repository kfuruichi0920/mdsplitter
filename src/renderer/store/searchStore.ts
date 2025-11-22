import { create } from 'zustand';
import type { SearchRequest, SearchResult } from '../utils/search';

export interface SearchSession {
  id: string;
  label: string;
  request: SearchRequest;
  results: SearchResult[];
  error: string | null;
  createdAt: number;
}

interface SearchStoreState {
  isOpen: boolean;
  sessions: SearchSession[];
  activeSessionId: string | null;
  draftText: string;
  open: () => void;
  close: () => void;
  setOpen: (open: boolean) => void;
  addSession: (session: SearchSession) => void;
  activateSession: (sessionId: string) => void;
  removeSession: (sessionId: string) => void;
  setDraftText: (text: string) => void;
  reset: () => void;
}

const initialState: Pick<SearchStoreState, 'isOpen' | 'sessions' | 'activeSessionId' | 'draftText'> = {
  isOpen: false,
  sessions: [],
  activeSessionId: null,
  draftText: '',
};

export const useSearchStore = create<SearchStoreState>()((set, get) => ({
  ...initialState,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  setOpen: (open) => set({ isOpen: open }),
  addSession: (session) =>
    set((state) => {
      const nextSessions = [session, ...state.sessions.filter((s) => s.id !== session.id)];
      return { sessions: nextSessions, activeSessionId: session.id };
    }),
  activateSession: (sessionId) => {
    const exists = get().sessions.some((s) => s.id === sessionId);
    if (!exists) {
      return;
    }
    set({ activeSessionId: sessionId });
  },
  removeSession: (sessionId) =>
    set((state) => {
      const filtered = state.sessions.filter((s) => s.id !== sessionId);
      const nextActive =
        state.activeSessionId === sessionId
          ? filtered.length > 0
            ? filtered[0].id
            : null
          : state.activeSessionId;
      return { sessions: filtered, activeSessionId: nextActive };
    }),
  setDraftText: (text) => set({ draftText: text }),
  reset: () => set({ ...initialState }),
}));

export const resetSearchStore = (): void => {
  useSearchStore.getState().reset();
};
