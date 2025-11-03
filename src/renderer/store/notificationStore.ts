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
  /**
   * @brief 通知を追加する。
   * @details
   * 一意IDを生成し、通知リストに追加。TTL経過後に自動削除。
   * @param level 通知レベル。
   * @param message メッセージ。
   * @param ttlMs 生存時間（ミリ秒）。
   */
  add: (level, message, ttlMs = DEFAULT_TTL) => {
    //! 一意ID生成
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item: NotificationItem = {
      id,
      level,
      message,
      createdAt: Date.now(),
    };

    //! 通知リストに追加
    set((state) => ({ items: [...state.items, item] }));

    //! TTL経過後に自動削除
    window.setTimeout(() => {
      get().remove(id);
    }, ttlMs);
  },
  /**
   * @brief 指定IDの通知を削除。
   * @param id 通知ID。
   */
  remove: (id: string) => {
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
  },
  /**
   * @brief 全通知をクリア。
   */
  clear: () => {
    set({ items: [] });
  },
}));
