/**
 * @file historyStore.ts
 * @brief カード履歴のロード・キャッシュ・追記を管理するストア。
 */

import { create } from 'zustand';
import type { CardHistory, AppendCardHistoryRequest } from '@/shared/history';

interface HistoryState {
  histories: Record<string, CardHistory>;
  status: Record<string, 'idle' | 'loading' | 'ready' | 'error'>;
  loadHistory: (fileName: string, cardId: string) => Promise<CardHistory>;
  appendVersion: (payload: AppendCardHistoryRequest) => Promise<CardHistory | null>;
}

const historyKey = (fileName: string, cardId: string): string => `${fileName}::${cardId}`;

const cloneHistory = (history: CardHistory): CardHistory => ({
  cardId: history.cardId,
  fileName: history.fileName,
  versions: history.versions.map((version) => ({ ...version, card: { ...version.card } })),
});

const emptyHistory = (fileName: string, cardId: string): CardHistory => ({
  cardId,
  fileName,
  versions: [],
});

const hasHistoryApi = (): boolean => typeof window !== 'undefined' && Boolean(window.app?.history);

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  histories: {},
  status: {},
  loadHistory: async (fileName, cardId) => {
    if (!fileName || !cardId) {
      return emptyHistory(fileName, cardId);
    }
    const key = historyKey(fileName, cardId);
    const currentStatus = get().status[key];
    if (currentStatus === 'loading') {
      return get().histories[key] ?? emptyHistory(fileName, cardId);
    }
    set((state) => ({
      status: { ...state.status, [key]: 'loading' },
    }));

    let history: CardHistory = emptyHistory(fileName, cardId);
    if (hasHistoryApi()) {
      try {
        history = await window.app.history.load(fileName, cardId);
      } catch (error) {
        console.warn('[historyStore] failed to load history', error);
        set((state) => ({ status: { ...state.status, [key]: 'error' } }));
        return history;
      }
    }

    const cloned = cloneHistory(history);
    set((state) => ({
      histories: { ...state.histories, [key]: cloned },
      status: { ...state.status, [key]: 'ready' },
    }));
    return cloned;
  },
  appendVersion: async (payload) => {
    const { fileName, cardId } = payload;
    if (!fileName || !cardId) {
      return null;
    }
    const key = historyKey(fileName, cardId);
    let updated: CardHistory;

    if (hasHistoryApi()) {
      try {
        updated = await window.app.history.appendVersion(payload);
      } catch (error) {
        console.warn('[historyStore] failed to append history', error);
        return null;
      }
    } else {
      const fallback = get().histories[key] ?? emptyHistory(fileName, cardId);
      const nextVersions = [...fallback.versions, payload.version];
      updated = {
        cardId,
        fileName,
        versions: nextVersions,
      } satisfies CardHistory;
    }

    const cloned = cloneHistory(updated);
    set((state) => ({
      histories: { ...state.histories, [key]: cloned },
      status: { ...state.status, [key]: 'ready' },
    }));
    return cloned;
  },
}));
