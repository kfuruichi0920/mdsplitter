
/**
 * @file splitStore.ts
 * @brief カードパネル分割状態管理ストア。
 * @details
 * VSCode風の再帰分割構造をツリーで管理。Undo/Redo・分割・統合・レイアウトバージョン管理等を提供。
 * @author K.Furuichi
 * @date 2025-11-06
 * @version 0.2
 * @copyright MIT
 */

import { create } from 'zustand';
import { nanoid } from 'nanoid';

/**
 * @brief 分割方向種別。
 */
export type SplitDirection = 'horizontal' | 'vertical';

/**
 * @brief 分割ノード種別。
 */
export type SplitNodeType = 'leaf' | 'split';

/**
 * @brief 分割ノード基底型。
 * @details
 * ノードID・種別を保持。
 */
export interface SplitNodeBase {
  id: string; ///< ノードの一意識別子。
  type: SplitNodeType; ///< ノードの種類。
}

/**
 * @brief 葉ノード（カードパネル表示用）。
 * @details
 * タブIDを保持。nullは空パネル。
 */
export interface SplitLeafNode extends SplitNodeBase {
  type: 'leaf';
  tabId: string | null; ///< 表示中のタブID（null の場合は空のパネル）。
}

/**
 * @brief 分割ノード（2子ノード保持）。
 * @details
 * 分割方向・子ノード・分割比率を管理。
 */
export interface SplitContainerNode extends SplitNodeBase {
  type: 'split';
  direction: SplitDirection; ///< 分割方向。
  first: SplitNode; ///< 最初の子ノード（左または上）。
  second: SplitNode; ///< 2番目の子ノード（右または下）。
  splitRatio: number; ///< 分割比率（0.0 〜 1.0、first の割合）。
}

/**
 * @brief 分割ノードのユニオン型。
 */
export type SplitNode = SplitLeafNode | SplitContainerNode;

/**
 * @brief 分割操作履歴エントリ。
 * @details
 * ルートノード・操作時刻を保持。
 */
export interface SplitHistoryEntry {
  root: SplitNode; ///< その時点のルートノード。
  timestamp: Date; ///< 操作時刻。
}

/**
 * @brief 分割管理ストアの状態。
 * @details
 * ルート・履歴・アクティブ葉ID・レイアウトバージョン等を管理。
 */
export interface SplitState {
  root: SplitNode; ///< ルートノード。
  history: SplitHistoryEntry[]; ///< 操作履歴（Undo 用）。
  historyIndex: number; ///< 現在の履歴インデックス。
  activeLeafId: string | null; ///< アクティブな葉ノードのID。
  layoutVersion: number; ///< レイアウト変更バージョン（分割境界移動時にインクリメント）。
}

/**
 * @brief 分割管理ストアのアクション。
 * @details
 * 分割・統合・比率変更・Undo/Redo・リセット等を管理。
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
 * @brief 初期ルートノード生成。
 * @return 単一葉ノード。
 */
const createInitialRoot = (): SplitLeafNode => ({
  id: nanoid(),
  type: 'leaf',
  tabId: null,
});

/**
 * @brief ノードツリーから指定IDの葉ノード検索。
 * @param node 検索対象ノード。
 * @param leafId 検索葉ID。
 * @return 見つかれば葉ノード、なければnull。
 */
const findLeafNode = (node: SplitNode, leafId: string): SplitLeafNode | null => {
  if (node.type === 'leaf') {
    return node.id === leafId ? node : null;
  }

  return findLeafNode(node.first, leafId) ?? findLeafNode(node.second, leafId);
};

/**
 * @brief ノードツリーから指定IDの分割ノード検索。
 * @param node 検索対象ノード。
 * @param nodeId 検索分割ノードID。
 * @return 見つかれば分割ノード、なければnull。
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
 * @brief ノードツリーを再帰複製（イミュータブル更新用）。
 * @param node 複製対象ノード。
 * @return 複製ノード。
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
 * @brief 指定葉ノードを分割。
 * @param root ルートノード。
 * @param leafId 分割葉ID。
 * @param direction 分割方向。
 * @return 新ルートノード、失敗時はnull。
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
 * @brief 指定葉ノード削除・兄弟ノードで置換。
 * @param root ルートノード。
 * @param leafId 削除葉ID。
 * @return 新ルートノード、削除不可時はnull。
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
 * @brief 指定分割ノードの比率更新。
 * @param root ルートノード。
 * @param nodeId 分割ノードID。
 * @param ratio 新分割比率。
 * @return 新ルートノード。
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
 * @brief 分割管理ストア本体。
 * @details
 * 分割・統合・比率変更・Undo/Redo・リセット等を管理。
 */
export const useSplitStore = create<SplitState & SplitActions>((set) => ({
  root: createInitialRoot(),
  history: [{ root: createInitialRoot(), timestamp: new Date() }],
  historyIndex: 0,
  activeLeafId: null,
  layoutVersion: 0,

  /**
   * @brief 指定した葉ノードを分割。
   * @details
   * 対象ノードが見つからなければ警告。履歴を更新。
   * @param leafId 分割対象の葉ノードID。
   * @param direction 分割方向。
   */
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

  /**
   * @brief 分割ノードの比率を更新。
   * @details
   * 指定IDの分割ノードがなければ警告。
   * layoutVersionをインクリメントして、コネクタ位置の再計算をトリガーする。
   * @param nodeId 分割ノードID。
   * @param ratio 新しい分割比率。
   */
  updateSplitRatio: (nodeId, ratio) =>
    set((state) => {
      const splitNode = findSplitNode(state.root, nodeId);
      if (!splitNode) {
        console.warn(`[splitStore] Split node ${nodeId} not found.`);
        return state;
      }

      const newRoot = updateSplitRatioInTree(state.root, nodeId, ratio);
      return { root: newRoot, layoutVersion: state.layoutVersion + 1 };
    }),

  /**
   * @brief 指定した葉ノードを削除。
   * @details
   * 最後の葉は削除不可。履歴を更新。
   * @param leafId 削除対象の葉ノードID。
   */
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

  /**
   * @brief アクティブな葉ノードを設定。
   * @details
   * 指定IDが存在しなければ警告。
   * @param leafId 葉ノードID。
   */
  setActiveLeaf: (leafId) =>
    set((state) => {
      const leaf = findLeafNode(state.root, leafId);
      if (!leaf) {
        console.warn(`[splitStore] Leaf node ${leafId} not found.`);
        return state;
      }

      return { activeLeafId: leafId };
    }),

  /**
   * @brief Undo操作。
   * @details
   * 履歴がなければ警告。
   */
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

  /**
   * @brief Redo操作。
   * @details
   * 履歴がなければ警告。
   */
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

  /**
   * @brief 分割状態をリセット。
   * @details
   * ルート・履歴・アクティブID・レイアウトバージョンを初期化。
   */
  reset: () =>
    set(() => {
      const initialRoot = createInitialRoot();
      return {
        root: initialRoot,
        history: [{ root: initialRoot, timestamp: new Date() }],
        historyIndex: 0,
        activeLeafId: null,
        layoutVersion: 0,
      };
    }),
}));
