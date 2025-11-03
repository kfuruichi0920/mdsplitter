/**
 * @file splitPaneStore.ts
 * @brief カードパネルの分割管理ストア。
 * @details
 * VSCode のような再帰的グリッド構造による水平/垂直分割を管理する。
 * 各分割ノードは、さらに子ノードを持つことができ、各リーフノードは
 * カードファイルを表示するパネルとなる。
 * @author K.Furuichi
 * @date 2025-11-03
 * @version 0.1
 * @copyright MIT
 */

import { create } from 'zustand';

/** 分割方向 */
export type SplitDirection = 'horizontal' | 'vertical';

/** パネルタイプ */
export type PaneType = 'split' | 'leaf';

/** ベースノード */
export interface BaseNode {
  id: string; ///< ノードの一意識別子
  type: PaneType; ///< ノードタイプ
}

/** 分割ノード（コンテナ） */
export interface SplitNode extends BaseNode {
  type: 'split';
  direction: SplitDirection; ///< 分割方向
  children: PaneNode[]; ///< 子ノード配列
  sizes: number[]; ///< 各子ノードのサイズ比率（合計100）
}

/** リーフノード（カードパネル） */
export interface LeafNode extends BaseNode {
  type: 'leaf';
  cardFileId: string | null; ///< 表示中のカードファイルID
  activeTabIndex: number; ///< アクティブタブのインデックス
  tabs: string[]; ///< タブとして開いているカードファイルID配列
}

/** パネルノードの型（ユニオン型） */
export type PaneNode = SplitNode | LeafNode;

/** 分割履歴エントリ */
export interface SplitHistoryEntry {
  timestamp: string; ///< 操作時刻（ISO8601）
  action: 'split' | 'merge' | 'resize'; ///< 操作種別
  nodeId: string; ///< 対象ノードID
  direction?: SplitDirection; ///< 分割方向（split時のみ）
  memo?: string; ///< メモ
}

/** 分割管理ストアの状態 */
export interface SplitPaneStoreState {
  /** ルートノード */
  root: PaneNode;
  /** 分割履歴 */
  history: SplitHistoryEntry[];
  /** アクティブパネルID */
  activePaneId: string | null;

  // アクション
  /** パネルを分割する */
  splitPane: (nodeId: string, direction: SplitDirection) => void;
  /** パネルを統合する（分割解除） */
  mergePane: (nodeId: string) => void;
  /** パネルサイズを変更する */
  resizePane: (nodeId: string, sizes: number[]) => void;
  /** アクティブパネルを設定する */
  setActivePane: (nodeId: string) => void;
  /** カードファイルをパネルで開く */
  openCardFile: (paneId: string, fileId: string) => void;
  /** タブを閉じる */
  closeTab: (paneId: string, tabIndex: number) => void;
  /** ストアをリセットする */
  reset: () => void;
}

/** 新しいリーフノードを生成する */
const createLeafNode = (id: string): LeafNode => ({
  id,
  type: 'leaf',
  cardFileId: null,
  activeTabIndex: 0,
  tabs: [],
});

/** 新しい分割ノードを生成する */
const createSplitNode = (
  id: string,
  direction: SplitDirection,
  children: PaneNode[]
): SplitNode => ({
  id,
  type: 'split',
  direction,
  children,
  sizes: children.map(() => 100 / children.length),
});

/** 初期状態を生成する */
const createInitialState = (): Pick<SplitPaneStoreState, 'root' | 'history' | 'activePaneId'> => {
  const rootLeaf = createLeafNode('pane-root');
  return {
    root: rootLeaf,
    history: [],
    activePaneId: rootLeaf.id,
  };
};

/** ノードIDでノードを検索する（再帰） */
const findNode = (node: PaneNode, targetId: string): PaneNode | null => {
  if (node.id === targetId) {
    return node;
  }
  if (node.type === 'split') {
    for (const child of node.children) {
      const found = findNode(child, targetId);
      if (found) {
        return found;
      }
    }
  }
  return null;
};

/** ノードIDで親ノードを検索する（再帰） */
const findParentNode = (
  node: PaneNode,
  targetId: string,
  parent: SplitNode | null = null
): SplitNode | null => {
  if (node.id === targetId) {
    return parent;
  }
  if (node.type === 'split') {
    for (const child of node.children) {
      const found = findParentNode(child, targetId, node);
      if (found !== null) {
        return found;
      }
    }
  }
  return null;
};

/** ノードを分割する（イミュータブル更新） */
const splitNodeInTree = (
  node: PaneNode,
  targetId: string,
  direction: SplitDirection
): PaneNode => {
  if (node.id === targetId && node.type === 'leaf') {
    // 対象ノードを分割
    const newLeaf1 = createLeafNode(`${targetId}-split-1`);
    const newLeaf2 = createLeafNode(`${targetId}-split-2`);
    // 既存のタブ情報を新しいリーフノードに引き継ぐ
    newLeaf1.tabs = [...node.tabs];
    newLeaf1.cardFileId = node.cardFileId;
    newLeaf1.activeTabIndex = node.activeTabIndex;

    return createSplitNode(targetId, direction, [newLeaf1, newLeaf2]);
  }
  if (node.type === 'split') {
    // 子ノードを再帰的に分割
    return {
      ...node,
      children: node.children.map((child) => splitNodeInTree(child, targetId, direction)),
    };
  }
  return node;
};

/** ノードを統合する（イミュータブル更新） */
const mergeNodeInTree = (root: PaneNode, targetId: string): PaneNode => {
  if (root.type === 'split') {
    // 対象ノードが子に含まれるか確認
    const targetIndex = root.children.findIndex((child) => child.id === targetId);
    if (targetIndex !== -1) {
      // 対象ノードを削除し、残りのノードで構成
      const newChildren = root.children.filter((_, i) => i !== targetIndex);
      if (newChildren.length === 1) {
        // 子が1つになった場合は、親を子に置き換え
        return newChildren[0];
      }
      // サイズを再計算
      const newSizes = newChildren.map(() => 100 / newChildren.length);
      return {
        ...root,
        children: newChildren,
        sizes: newSizes,
      };
    }
    // 子ノードを再帰的に統合
    return {
      ...root,
      children: root.children.map((child) => mergeNodeInTree(child, targetId)),
    };
  }
  return root;
};

/** パネルサイズを変更する（イミュータブル更新） */
const resizeNodeInTree = (node: PaneNode, targetId: string, sizes: number[]): PaneNode => {
  if (node.id === targetId && node.type === 'split') {
    return {
      ...node,
      sizes,
    };
  }
  if (node.type === 'split') {
    return {
      ...node,
      children: node.children.map((child) => resizeNodeInTree(child, targetId, sizes)),
    };
  }
  return node;
};

/** カードファイルを開く（イミュータブル更新） */
const openCardFileInTree = (node: PaneNode, paneId: string, fileId: string): PaneNode => {
  if (node.id === paneId && node.type === 'leaf') {
    const tabIndex = node.tabs.indexOf(fileId);
    if (tabIndex !== -1) {
      // 既に開いている場合はアクティブにする
      return {
        ...node,
        activeTabIndex: tabIndex,
        cardFileId: fileId,
      };
    }
    // 新しいタブとして追加
    return {
      ...node,
      tabs: [...node.tabs, fileId],
      activeTabIndex: node.tabs.length,
      cardFileId: fileId,
    };
  }
  if (node.type === 'split') {
    return {
      ...node,
      children: node.children.map((child) => openCardFileInTree(child, paneId, fileId)),
    };
  }
  return node;
};

/** タブを閉じる（イミュータブル更新） */
const closeTabInTree = (node: PaneNode, paneId: string, tabIndex: number): PaneNode => {
  if (node.id === paneId && node.type === 'leaf') {
    const newTabs = node.tabs.filter((_, i) => i !== tabIndex);
    const newActiveIndex = Math.min(node.activeTabIndex, Math.max(0, newTabs.length - 1));
    return {
      ...node,
      tabs: newTabs,
      activeTabIndex: newActiveIndex,
      cardFileId: newTabs[newActiveIndex] ?? null,
    };
  }
  if (node.type === 'split') {
    return {
      ...node,
      children: node.children.map((child) => closeTabInTree(child, paneId, tabIndex)),
    };
  }
  return node;
};

/** Zustand ストア定義 */
export const useSplitPaneStore = create<SplitPaneStoreState>()((set, get) => ({
  ...createInitialState(),

  splitPane: (nodeId: string, direction: SplitDirection) => {
    const state = get();
    const targetNode = findNode(state.root, nodeId);
    if (!targetNode || targetNode.type !== 'leaf') {
      return;
    }
    const newRoot = splitNodeInTree(state.root, nodeId, direction);
    const newHistoryEntry: SplitHistoryEntry = {
      timestamp: new Date().toISOString(),
      action: 'split',
      nodeId,
      direction,
    };
    set({
      root: newRoot,
      history: [...state.history, newHistoryEntry],
    });
  },

  mergePane: (nodeId: string) => {
    const state = get();
    const targetNode = findNode(state.root, nodeId);
    if (!targetNode) {
      return;
    }
    const newRoot = mergeNodeInTree(state.root, nodeId);
    const newHistoryEntry: SplitHistoryEntry = {
      timestamp: new Date().toISOString(),
      action: 'merge',
      nodeId,
    };
    set({
      root: newRoot,
      history: [...state.history, newHistoryEntry],
    });
  },

  resizePane: (nodeId: string, sizes: number[]) => {
    const state = get();
    const newRoot = resizeNodeInTree(state.root, nodeId, sizes);
    const newHistoryEntry: SplitHistoryEntry = {
      timestamp: new Date().toISOString(),
      action: 'resize',
      nodeId,
    };
    set({
      root: newRoot,
      history: [...state.history, newHistoryEntry],
    });
  },

  setActivePane: (nodeId: string) => {
    set({ activePaneId: nodeId });
  },

  openCardFile: (paneId: string, fileId: string) => {
    const state = get();
    const newRoot = openCardFileInTree(state.root, paneId, fileId);
    set({ root: newRoot });
  },

  closeTab: (paneId: string, tabIndex: number) => {
    const state = get();
    const newRoot = closeTabInTree(state.root, paneId, tabIndex);
    set({ root: newRoot });
  },

  reset: () => {
    const initial = createInitialState();
    set(initial);
  },
}));

/** ストアを初期状態へリセットするユーティリティ */
export const resetSplitPaneStore = (): void => {
  useSplitPaneStore.getState().reset();
};
