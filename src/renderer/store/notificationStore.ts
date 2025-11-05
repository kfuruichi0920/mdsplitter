
/**
 * @file notificationStore.ts
 * @brief 共通通知（トースト）管理ストア。
 * @details
 * 通知メッセージの追加・削除・クリアを管理し、UIコンポーネントへ提供。
 * @author K.Furuichi
 * @date 2025-11-06
 * @version 0.1
 * @copyright MIT
 */

import { create } from 'zustand';


/**
 * @brief 通知レベル種別。
 */
export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';


/**
 * @brief 通知1件分の情報。
 * @details
 * ID・レベル・メッセージ・作成時刻を保持。
 */
export interface NotificationItem {
  id: string; ///< 一意ID。
  level: NotificationLevel; ///< 通知レベル。
  message: string; ///< メッセージ本文。
  createdAt: number; ///< 作成時刻（UNIX ms）。
}


/**
 * @brief 通知ストアの状態・アクション定義。
 */
interface NotificationStore {
  items: NotificationItem[]; ///< 通知リスト。
  add: (level: NotificationLevel, message: string, ttlMs?: number) => void; ///< 通知追加。
  remove: (id: string) => void; ///< 通知削除。
  clear: () => void; ///< 全通知クリア。
}


/**
 * @brief 通知のデフォルト生存時間（ms）。
 */
const DEFAULT_TTL = 4000;


/**
 * @brief 通知ストア本体。
 * @details
 * 通知追加・削除・クリアを管理。TTL経過後は自動削除。
 */
export const useNotificationStore = create<NotificationStore>()((set, get) => ({
  items: [],
  /**
   * @brief 通知を追加。
   * @details
   * 一意ID生成し通知リストへ追加。TTL経過後に自動削除。
   * @param level 通知レベル。
   * @param message メッセージ。
   * @param ttlMs 生存時間（ms）。
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
