/**
 * @file cardFileStore.ts
 * @brief カードファイル管理ストア。
 * @details
 * 複数のカードファイルを管理し、各ファイルのカード情報を保持する。
 * パネルごとに異なるカードファイルを表示できるようにする。
 * @author K.Furuichi
 * @date 2025-11-03
 * @version 0.1
 * @copyright MIT
 */

import { create } from 'zustand';
import type { Card, CardPatch, CardStatus } from './workspaceStore';

/** カードファイルのヘッダー情報 */
export interface CardFileHeader {
  id: string; ///< 一意な識別子（UUID v4）
  fileName: string; ///< ファイル名
  orgInputFilePath: string; ///< オリジナルの入力ファイルの絶対パス
  inputFilePath: string; ///< inputフォルダにコピーされた入力ファイルの絶対パス
  createdAt: string; ///< 初回の作成時刻（ISO 8601）
  updatedAt: string; ///< 最終更新時刻（ISO 8601）
  memo: string; ///< 任意記述
}

/** カードファイル */
export interface CardFile {
  schemaVersion: number; ///< スキーマバージョン
  header: CardFileHeader; ///< ヘッダー情報
  body: Card[]; ///< カードオブジェクトの配列
}

/** カードファイルストアの状態 */
export interface CardFileStoreState {
  /** カードファイルマップ（fileId -> CardFile） */
  files: Map<string, CardFile>;
  /** 選択中のカード情報（fileId -> selectedCardId） */
  selections: Map<string, string | null>;

  // アクション
  /** カードファイルを読み込む */
  loadCardFile: (file: CardFile) => void;
  /** カードファイルを閉じる */
  closeCardFile: (fileId: string) => void;
  /** カードを選択する */
  selectCard: (fileId: string, cardId: string) => void;
  /** カード内容を更新する */
  updateCard: (fileId: string, cardId: string, patch: CardPatch) => void;
  /** ステータスを次段へ遷移させる */
  cycleCardStatus: (fileId: string, cardId: string) => CardStatus | null;
  /** カードファイルを取得する */
  getCardFile: (fileId: string) => CardFile | undefined;
  /** 選択中のカードIDを取得する */
  getSelectedCardId: (fileId: string) => string | null;
  /** ストアをリセットする */
  reset: () => void;
}

/** ステータス遷移順序 */
const CARD_STATUS_SEQUENCE: CardStatus[] = ['draft', 'review', 'approved', 'deprecated'];

/** ステータスを次段に遷移させる */
const getNextCardStatus = (current: CardStatus): CardStatus => {
  const index = CARD_STATUS_SEQUENCE.indexOf(current);
  const nextIndex = index === -1 ? 0 : (index + 1) % CARD_STATUS_SEQUENCE.length;
  return CARD_STATUS_SEQUENCE[nextIndex];
};

/** 初期状態を生成する */
const createInitialState = (): Pick<CardFileStoreState, 'files' | 'selections'> => ({
  files: new Map(),
  selections: new Map(),
});

/** Zustand ストア定義 */
export const useCardFileStore = create<CardFileStoreState>()((set, get) => ({
  ...createInitialState(),

  loadCardFile: (file: CardFile) => {
    set((state) => {
      const newFiles = new Map(state.files);
      newFiles.set(file.header.id, file);
      const newSelections = new Map(state.selections);
      // 初回読み込み時は最初のカードを選択
      if (!newSelections.has(file.header.id) && file.body.length > 0) {
        newSelections.set(file.header.id, file.body[0].id);
      }
      return { files: newFiles, selections: newSelections };
    });
  },

  closeCardFile: (fileId: string) => {
    set((state) => {
      const newFiles = new Map(state.files);
      newFiles.delete(fileId);
      const newSelections = new Map(state.selections);
      newSelections.delete(fileId);
      return { files: newFiles, selections: newSelections };
    });
  },

  selectCard: (fileId: string, cardId: string) => {
    set((state) => {
      const file = state.files.get(fileId);
      if (!file) return state;
      const exists = file.body.some((card) => card.id === cardId);
      if (!exists) return state;
      const newSelections = new Map(state.selections);
      newSelections.set(fileId, cardId);
      return { selections: newSelections };
    });
  },

  updateCard: (fileId: string, cardId: string, patch: CardPatch) => {
    set((state) => {
      const file = state.files.get(fileId);
      if (!file) return state;
      const updatedCards = file.body.map((card) => {
        if (card.id !== cardId) return card;
        const nextUpdatedAt = patch.updatedAt ?? new Date().toISOString();
        return { ...card, ...patch, updatedAt: nextUpdatedAt };
      });
      const updatedFile: CardFile = {
        ...file,
        body: updatedCards,
        header: {
          ...file.header,
          updatedAt: new Date().toISOString(),
        },
      };
      const newFiles = new Map(state.files);
      newFiles.set(fileId, updatedFile);
      return { files: newFiles };
    });
  },

  cycleCardStatus: (fileId: string, cardId: string) => {
    let nextStatus: CardStatus | null = null;
    set((state) => {
      const file = state.files.get(fileId);
      if (!file) return state;
      const updatedCards = file.body.map((card) => {
        if (card.id !== cardId) return card;
        nextStatus = getNextCardStatus(card.status);
        return {
          ...card,
          status: nextStatus,
          updatedAt: new Date().toISOString(),
        };
      });
      const updatedFile: CardFile = {
        ...file,
        body: updatedCards,
        header: {
          ...file.header,
          updatedAt: new Date().toISOString(),
        },
      };
      const newFiles = new Map(state.files);
      newFiles.set(fileId, updatedFile);
      return { files: newFiles };
    });
    return nextStatus;
  },

  getCardFile: (fileId: string) => {
    return get().files.get(fileId);
  },

  getSelectedCardId: (fileId: string) => {
    return get().selections.get(fileId) ?? null;
  },

  reset: () => {
    const initial = createInitialState();
    set(initial);
  },
}));

/** ストアを初期状態へリセットするユーティリティ */
export const resetCardFileStore = (): void => {
  useCardFileStore.getState().reset();
};
