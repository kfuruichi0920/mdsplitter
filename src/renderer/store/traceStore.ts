/**
 * @file traceStore.ts
 * @brief トレーサビリティ情報管理ストア。
 * @details
 * カードファイル間のトレーサビリティ関係を管理する。
 * 2つのカードファイル間の関係（トレース、詳細化、テスト等）を保持し、
 * コネクタ描画のためのデータを提供する。
 * @author K.Furuichi
 * @date 2025-11-03
 * @version 0.1
 * @copyright MIT
 */

import { create } from 'zustand';

/** トレーサビリティ関係の種別 */
export type TraceRelationType =
  | 'trace'
  | 'refines'
  | 'tests'
  | 'duplicates'
  | 'satisfy'
  | 'relate'
  | 'specialize';

/** トレーサビリティの方向性 */
export type TraceDirection = 'left_to_right' | 'right_to_left' | 'bidirectional';

/** トレーサビリティ関係 */
export interface TraceRelation {
  id: string; ///< トレーサビリティ関係の一意な識別子
  left_ids: string[]; ///< left_fileのカードID配列
  right_ids: string[]; ///< right_fileのカードID配列
  type: TraceRelationType; ///< 関係性の種別
  directed: TraceDirection; ///< 方向性
  memo: string; ///< 任意記述
}

/** トレーサビリティファイルのヘッダー情報 */
export interface TraceFileHeader {
  id: string; ///< 一意な識別子
  fileName: string; ///< ファイル名
  leftFilePath: string; ///< 左側カードファイルの絶対パス
  rightFilePath: string; ///< 右側カードファイルの絶対パス
  createdAt: string; ///< 初回の作成時刻（ISO 8601）
  updatedAt: string; ///< 最終更新時刻（ISO 8601）
  memo: string; ///< 任意記述
}

/** トレーサビリティファイル */
export interface TraceFile {
  schemaVersion: number; ///< スキーマバージョン
  header: TraceFileHeader; ///< ヘッダー情報
  body: TraceRelation[]; ///< トレーサビリティ関係の配列
}

/** トレーサビリティストアの状態 */
export interface TraceStoreState {
  /** トレーサビリティファイルマップ（traceFileId -> TraceFile） */
  traceFiles: Map<string, TraceFile>;
  /** 選択中のトレース関係ID */
  selectedTraceId: string | null;
  /** コネクタ表示の有効/無効 */
  connectorsVisible: boolean;

  // アクション
  /** トレーサビリティファイルを読み込む */
  loadTraceFile: (file: TraceFile) => void;
  /** トレーサビリティファイルを閉じる */
  closeTraceFile: (traceFileId: string) => void;
  /** トレース関係を追加する */
  addTraceRelation: (traceFileId: string, relation: TraceRelation) => void;
  /** トレース関係を削除する */
  removeTraceRelation: (traceFileId: string, relationId: string) => void;
  /** トレース関係を更新する */
  updateTraceRelation: (traceFileId: string, relationId: string, patch: Partial<TraceRelation>) => void;
  /** トレース関係を選択する */
  selectTrace: (relationId: string) => void;
  /** コネクタ表示を切り替える */
  toggleConnectorsVisible: () => void;
  /** 2つのカードファイル間のトレース関係を取得する */
  getTraceRelations: (leftFileId: string, rightFileId: string) => TraceRelation[];
  /** ストアをリセットする */
  reset: () => void;
}

/** 初期状態を生成する */
const createInitialState = (): Pick<
  TraceStoreState,
  'traceFiles' | 'selectedTraceId' | 'connectorsVisible'
> => ({
  traceFiles: new Map(),
  selectedTraceId: null,
  connectorsVisible: true,
});

/** Zustand ストア定義 */
export const useTraceStore = create<TraceStoreState>()((set, get) => ({
  ...createInitialState(),

  loadTraceFile: (file: TraceFile) => {
    set((state) => {
      const newTraceFiles = new Map(state.traceFiles);
      newTraceFiles.set(file.header.id, file);
      return { traceFiles: newTraceFiles };
    });
  },

  closeTraceFile: (traceFileId: string) => {
    set((state) => {
      const newTraceFiles = new Map(state.traceFiles);
      newTraceFiles.delete(traceFileId);
      return { traceFiles: newTraceFiles };
    });
  },

  addTraceRelation: (traceFileId: string, relation: TraceRelation) => {
    set((state) => {
      const file = state.traceFiles.get(traceFileId);
      if (!file) return state;
      const updatedFile: TraceFile = {
        ...file,
        body: [...file.body, relation],
        header: {
          ...file.header,
          updatedAt: new Date().toISOString(),
        },
      };
      const newTraceFiles = new Map(state.traceFiles);
      newTraceFiles.set(traceFileId, updatedFile);
      return { traceFiles: newTraceFiles };
    });
  },

  removeTraceRelation: (traceFileId: string, relationId: string) => {
    set((state) => {
      const file = state.traceFiles.get(traceFileId);
      if (!file) return state;
      const updatedFile: TraceFile = {
        ...file,
        body: file.body.filter((rel) => rel.id !== relationId),
        header: {
          ...file.header,
          updatedAt: new Date().toISOString(),
        },
      };
      const newTraceFiles = new Map(state.traceFiles);
      newTraceFiles.set(traceFileId, updatedFile);
      return { traceFiles: newTraceFiles };
    });
  },

  updateTraceRelation: (traceFileId: string, relationId: string, patch: Partial<TraceRelation>) => {
    set((state) => {
      const file = state.traceFiles.get(traceFileId);
      if (!file) return state;
      const updatedBody = file.body.map((rel) =>
        rel.id === relationId ? { ...rel, ...patch } : rel
      );
      const updatedFile: TraceFile = {
        ...file,
        body: updatedBody,
        header: {
          ...file.header,
          updatedAt: new Date().toISOString(),
        },
      };
      const newTraceFiles = new Map(state.traceFiles);
      newTraceFiles.set(traceFileId, updatedFile);
      return { traceFiles: newTraceFiles };
    });
  },

  selectTrace: (relationId: string) => {
    set({ selectedTraceId: relationId });
  },

  toggleConnectorsVisible: () => {
    set((state) => ({ connectorsVisible: !state.connectorsVisible }));
  },

  getTraceRelations: (leftFileId: string, rightFileId: string) => {
    const state = get();
    const relations: TraceRelation[] = [];
    state.traceFiles.forEach((file) => {
      // ファイルパスからファイルIDを抽出して比較
      // 簡易的な実装: ヘッダーのleftFilePath/rightFilePathにファイルIDが含まれることを想定
      const matchesLeft = file.header.leftFilePath.includes(leftFileId);
      const matchesRight = file.header.rightFilePath.includes(rightFileId);
      if (matchesLeft && matchesRight) {
        relations.push(...file.body);
      }
    });
    return relations;
  },

  reset: () => {
    const initial = createInitialState();
    set(initial);
  },
}));

/** ストアを初期状態へリセットするユーティリティ */
export const resetTraceStore = (): void => {
  useTraceStore.getState().reset();
};
