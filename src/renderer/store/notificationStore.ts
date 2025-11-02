/**
 * @file notificationStore.ts
 * @brief 共通通知(トースト)コンポーネント向けの状態管理。
 */

import { create } from 'zustand';

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

export interface NotificationItem {
  id: string;
  level: NotificationLevel;
  message: string;
  createdAt: number;
}

interface NotificationStore {
  items: NotificationItem[];
  add: (level: NotificationLevel, message: string, ttlMs?: number) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const DEFAULT_TTL = 4000;

export const useNotificationStore = create<NotificationStore>()((set, get) => ({
  items: [],
  add: (level, message, ttlMs = DEFAULT_TTL) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item: NotificationItem = {
      id,
      level,
      message,
      createdAt: Date.now(),
    };

    set((state) => ({ items: [...state.items, item] }));

    window.setTimeout(() => {
      get().remove(id);
    }, ttlMs);
  },
  remove: (id: string) => {
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
  },
  clear: () => {
    set({ items: [] });
  },
}));
