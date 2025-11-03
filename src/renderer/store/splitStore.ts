/**
 * @file splitStore.ts
 * @brief カードパネルエリアの分割状態管理ストア。
 * @details
 * VSCode のような再帰的な分割構造を実現する。分割ノードはツリー構造で管理し、
 * 各ノードは葉（カードパネル）または内部ノード（左右/上下分割）のいずれかとなる。
 * 分割操作は Undo/Redo 可能とする。
 * @author K.Furuichi
 * @date 2025-11-03
 * @version 0.1
 * @copyright MIT
 */

import { create } from 'zustand';
import { nanoid } from 'nanoid';

/** 分割方向。 */
export type SplitDirection = 'horizontal' | 'vertical';

/** 分割ノードの種類。 */
export type SplitNodeType = 'leaf' | 'split';

/**
 * @brief 分割ノード基底型。
 */
export interface SplitNodeBase {
  id: string; ///< ノードの一意識別子。
  type: SplitNodeType; ///< ノードの種類。
}

/**
 * @brief 葉ノード（カードパネルを表示）。
 */
export interface SplitLeafNode extends SplitNodeBase {
  type: 'leaf';
  tabId: string | null; ///< 表示中のタブID（null の場合は空のパネル）。
}

/**
 * @brief 分割ノード（2つの子ノードを持つ）。
 */
export interface SplitContainerNode extends SplitNodeBase {
  type: 'split';
  direction: SplitDirection; ///< 分割方向。
  first: SplitNode; ///< 最初の子ノード（左または上）。
  second: SplitNode; ///< 2番目の子ノード（右または下）。
  splitRatio: number; ///< 分割比率（0.0 〜 1.0、first の割合）。
}

/** 分割ノードのユニオン型。 */
export type SplitNode = SplitLeafNode | SplitContainerNode;

/**
 * @brief 分割操作履歴のエントリ。
 */
export interface SplitHistoryEntry {
  root: SplitNode; ///< その時点のルートノード。
  timestamp: Date; ///< 操作時刻。
}

/**
 * @brief 分割管理ストアの状態。
 */
export interface SplitState {
  root: SplitNode; ///< ルートノード。
  history: SplitHistoryEntry[]; ///< 操作履歴（Undo 用）。
  historyIndex: number; ///< 現在の履歴インデックス。
  activeLeafId: string | null; ///< アクティブな葉ノードのID。
}

/**
 * @brief 分割管理ストアのアクション。
 */
export interface SplitActions {
  /**
   * @brief 指定した葉ノードを分割する。
   * @param leafId 分割対象の葉ノードID。
   * @param direction 分割方向。
   */
  splitLeaf: (leafId: string, direction: SplitDirection) => void;

  /**
   * @brief 指定した分割ノードの境界比率を変更する。
   * @param nodeId 分割ノードID。
   * @param ratio 新しい分割比率（0.0 〜 1.0）。
   */
  updateSplitRatio: (nodeId: string, ratio: number) => void;

  /**
   * @brief 指定した葉ノードを削除し、親ノードを統合する。
   * @param leafId 削除対象の葉ノードID。
   */
  removeLeaf: (leafId: string) => void;

  /**
   * @brief アクティブな葉ノードを設定する。
   * @param leafId 葉ノードID。
   */
  setActiveLeaf: (leafId: string) => void;

  /**
   * @brief Undo 操作を実行する。
   */
  undo: () => void;

  /**
   * @brief Redo 操作を実行する。
   */
  redo: () => void;

  /**
   * @brief 分割状態をリセットする。
   */
  reset: () => void;
}

/**
 * @brief 初期ルートノードを生成する。
 * @return 単一の葉ノード。
 */
const createInitialRoot = (): SplitLeafNode => ({
  id: nanoid(),
  type: 'leaf',
  tabId: null,
});

/**
 * @brief ノードツリーから指定IDの葉ノードを検索する。
 * @param node 検索対象のノード。
 * @param leafId 検索する葉ノードID。
 * @return 見つかった葉ノード、または null。
 */
const findLeafNode = (node: SplitNode, leafId: string): SplitLeafNode | null => {
  if (node.type === 'leaf') {
    return node.id === leafId ? node : null;
  }

  return findLeafNode(node.first, leafId) ?? findLeafNode(node.second, leafId);
};

/**
 * @brief ノードツリーから指定IDの分割ノードを検索する。
 * @param node 検索対象のノード。
 * @param nodeId 検索する分割ノードID。
 * @return 見つかった分割ノード、または null。
 */
const findSplitNode = (node: SplitNode, nodeId: string): SplitContainerNode | null => {
  if (node.type === 'split' && node.id === nodeId) {
    return node;
  }

  if (node.type === 'split') {
    return findSplitNode(node.first, nodeId) ?? findSplitNode(node.second, nodeId);
  }

  return null;
};

/**
 * @brief ノードツリーを再帰的に複製する（イミュータブル更新用）。
 * @param node 複製対象のノード。
 * @return 複製されたノード。
 */
const cloneNode = (node: SplitNode): SplitNode => {
  if (node.type === 'leaf') {
    return { ...node };
  }

  return {
    ...node,
    first: cloneNode(node.first),
    second: cloneNode(node.second),
  };
};

/**
 * @brief 指定した葉ノードを分割する。
 * @param root ルートノード。
 * @param leafId 分割対象の葉ノードID。
 * @param direction 分割方向。
 * @return 新しいルートノード、または null（失敗時）。
 */
const splitLeafNode = (root: SplitNode, leafId: string, direction: SplitDirection): SplitNode | null => {
  const replaceNode = (node: SplitNode): SplitNode | null => {
    if (node.type === 'leaf' && node.id === leafId) {
      //! 対象ノードを見つけたら、分割ノードに置き換える
      const newFirst: SplitLeafNode = { ...node }; //! 既存ノードを first へ
      const newSecond: SplitLeafNode = {
        id: nanoid(),
        type: 'leaf',
        tabId: null, //! 新しい葉は空
      };

      const newSplit: SplitContainerNode = {
        id: nanoid(),
        type: 'split',
        direction,
        first: newFirst,
        second: newSecond,
        splitRatio: 0.5, //! 初期分割比率は 50:50
      };

      return newSplit;
    }

    if (node.type === 'split') {
      const newFirst = replaceNode(node.first);
      const newSecond = replaceNode(node.second);

      if (newFirst !== null) {
        return { ...node, first: newFirst };
      }

      if (newSecond !== null) {
        return { ...node, second: newSecond };
      }
    }

    return null;
  };

  return replaceNode(root) ?? cloneNode(root);
};

/**
 * @brief 指定した葉ノードを削除し、兄弟ノードで置き換える。
 * @param root ルートノード。
 * @param leafId 削除対象の葉ノードID。
 * @return 新しいルートノード、または null（削除不可）。
 */
const removeLeafNode = (root: SplitNode, leafId: string): SplitNode | null => {
  //! ルートが葉で、かつ削除対象の場合は削除不可（最低1つの葉を保持）
  if (root.type === 'leaf' && root.id === leafId) {
    return null;
  }

  const replaceNode = (node: SplitNode): SplitNode | null => {
    if (node.type === 'split') {
      //! first が削除対象の場合、second で置き換え
      if (node.first.type === 'leaf' && node.first.id === leafId) {
        return cloneNode(node.second);
      }

      //! second が削除対象の場合、first で置き換え
      if (node.second.type === 'leaf' && node.second.id === leafId) {
        return cloneNode(node.first);
      }

      //! 再帰的に子ノードを処理
      const newFirst = replaceNode(node.first);
      const newSecond = replaceNode(node.second);

      if (newFirst !== null && newFirst !== node.first) {
        return { ...node, first: newFirst };
      }

      if (newSecond !== null && newSecond !== node.second) {
        return { ...node, second: newSecond };
      }
    }

    return null;
  };

  return replaceNode(root) ?? cloneNode(root);
};

/**
 * @brief 指定した分割ノードの比率を更新する。
 * @param root ルートノード。
 * @param nodeId 分割ノードID。
 * @param ratio 新しい分割比率。
 * @return 新しいルートノード。
 */
const updateSplitRatioInTree = (root: SplitNode, nodeId: string, ratio: number): SplitNode => {
  const updateNode = (node: SplitNode): SplitNode => {
    if (node.type === 'split' && node.id === nodeId) {
      return { ...node, splitRatio: Math.max(0.1, Math.min(0.9, ratio)) }; //! 10%〜90% に制限
    }

    if (node.type === 'split') {
      return {
        ...node,
        first: updateNode(node.first),
        second: updateNode(node.second),
      };
    }

    return node;
  };

  return updateNode(root);
};

/**
 * @brief 分割管理ストアを作成する。
 */
export const useSplitStore = create<SplitState & SplitActions>((set) => ({
  root: createInitialRoot(),
  history: [{ root: createInitialRoot(), timestamp: new Date() }],
  historyIndex: 0,
  activeLeafId: null,

  splitLeaf: (leafId, direction) =>
    set((state) => {
      const leaf = findLeafNode(state.root, leafId);
      if (!leaf) {
        console.warn(`[splitStore] Leaf node ${leafId} not found.`);
        return state;
      }

      const newRoot = splitLeafNode(state.root, leafId, direction);
      if (!newRoot) {
        console.warn(`[splitStore] Failed to split leaf ${leafId}.`);
        return state;
      }

      //! 履歴を更新（現在のインデックス以降を削除してから追加）
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push({ root: newRoot, timestamp: new Date() });

      return {
        root: newRoot,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    }),

  updateSplitRatio: (nodeId, ratio) =>
    set((state) => {
      const splitNode = findSplitNode(state.root, nodeId);
      if (!splitNode) {
        console.warn(`[splitStore] Split node ${nodeId} not found.`);
        return state;
      }

      const newRoot = updateSplitRatioInTree(state.root, nodeId, ratio);
      return { root: newRoot };
    }),

  removeLeaf: (leafId) =>
    set((state) => {
      const leaf = findLeafNode(state.root, leafId);
      if (!leaf) {
        console.warn(`[splitStore] Leaf node ${leafId} not found.`);
        return state;
      }

      const newRoot = removeLeafNode(state.root, leafId);
      if (!newRoot) {
        console.warn(`[splitStore] Cannot remove the last leaf node.`);
        return state;
      }

      //! 履歴を更新
      const newHistory = state.history.slice(0, state.historyIndex + 1);
      newHistory.push({ root: newRoot, timestamp: new Date() });

      return {
        root: newRoot,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        activeLeafId: state.activeLeafId === leafId ? null : state.activeLeafId,
      };
    }),

  setActiveLeaf: (leafId) =>
    set((state) => {
      const leaf = findLeafNode(state.root, leafId);
      if (!leaf) {
        console.warn(`[splitStore] Leaf node ${leafId} not found.`);
        return state;
      }

      return { activeLeafId: leafId };
    }),

  undo: () =>
    set((state) => {
      if (state.historyIndex <= 0) {
        console.warn('[splitStore] No history to undo.');
        return state;
      }

      const newIndex = state.historyIndex - 1;
      return {
        root: state.history[newIndex].root,
        historyIndex: newIndex,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) {
        console.warn('[splitStore] No history to redo.');
        return state;
      }

      const newIndex = state.historyIndex + 1;
      return {
        root: state.history[newIndex].root,
        historyIndex: newIndex,
      };
    }),

  reset: () =>
    set(() => {
      const initialRoot = createInitialRoot();
      return {
        root: initialRoot,
        history: [{ root: initialRoot, timestamp: new Date() }],
        historyIndex: 0,
        activeLeafId: null,
      };
    }),
}));
