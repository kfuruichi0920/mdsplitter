/**
 * @file panelLayoutStore.ts
 * @brief カードパネル分割レイアウトを管理する Zustand ストア。
 */

import { create } from 'zustand';

export type SplitDirection = 'horizontal' | 'vertical';
export type PanelView = 'cards';

export interface PanelLeafNode {
  id: string;
  kind: 'leaf';
  view: PanelView;
}

export interface PanelSplitNode {
  id: string;
  kind: 'split';
  direction: SplitDirection;
  children: PanelNode[];
  sizes: number[]; // 各ノードの占有率 (合計=1)
}

export type PanelNode = PanelLeafNode | PanelSplitNode;

export interface PanelLayoutState {
  root: PanelNode;
  activeLeafId: string;
  splitActiveLeaf: (direction: SplitDirection) => void;
  setActiveLeaf: (leafId: string) => void;
  closeLeaf: (leafId: string) => void;
  updateSplitSizes: (splitId: string, sizes: number[]) => void;
  resetLayout: () => void;
}

let nodeIdCounter = 0;
const MIN_SIZE = 0.1;

const createLeaf = (view: PanelView): PanelLeafNode => ({
  id: `leaf-${++nodeIdCounter}`,
  kind: 'leaf',
  view,
});

const createSplitNode = (
  direction: SplitDirection,
  children: PanelNode[],
  sizes: number[],
): PanelSplitNode => ({
  id: `split-${++nodeIdCounter}`,
  kind: 'split',
  direction,
  children,
  sizes,
});

const normalizeSizes = (sizes: number[]): number[] => {
  const total = sizes.reduce((acc, value) => acc + value, 0);
  if (total === 0) {
    return sizes.map(() => 1 / sizes.length);
  }
  return sizes.map((value) => value / total);
};

const findFirstLeafId = (node: PanelNode): string => {
  if (node.kind === 'leaf') {
    return node.id;
  }
  return findFirstLeafId(node.children[0]);
};

const splitLeaf = (
  node: PanelNode,
  targetLeafId: string,
  direction: SplitDirection,
): { node: PanelNode; changed: boolean; newActiveId?: string } => {
  if (node.kind === 'leaf') {
    if (node.id !== targetLeafId) {
      return { node, changed: false };
    }

    const cloneCurrent: PanelLeafNode = { ...node };
    const duplicated = createLeaf(node.view);
    const splitNode = createSplitNode(direction, [cloneCurrent, duplicated], [0.5, 0.5]);
    return { node: splitNode, changed: true, newActiveId: duplicated.id };
  }

  let updatedChildren = node.children;
  let updatedSizes = node.sizes;
  let newActiveId: string | undefined;
  let changed = false;

  updatedChildren = node.children.map((child, index) => {
    const result = splitLeaf(child, targetLeafId, direction);
    if (result.changed) {
      changed = true;
      if (result.newActiveId) {
        newActiveId = result.newActiveId;
      }
      return result.node;
    }
    return child;
  });

  if (!changed) {
    return { node, changed: false };
  }

  return {
    node: {
      ...node,
      children: updatedChildren,
      sizes: updatedSizes,
    },
    changed: true,
    newActiveId,
  };
};

const updateSplitById = (
  node: PanelNode,
  splitId: string,
  updater: (split: PanelSplitNode) => PanelSplitNode,
): PanelNode => {
  if (node.kind === 'leaf') {
    return node;
  }

  if (node.id === splitId) {
    return updater(node);
  }

  return {
    ...node,
    children: node.children.map((child) => updateSplitById(child, splitId, updater)),
  };
};

const removeLeaf = (
  node: PanelNode,
  leafId: string,
): { node: PanelNode | null; removed: boolean } => {
  if (node.kind === 'leaf') {
    if (node.id === leafId) {
      return { node: null, removed: true };
    }
    return { node, removed: false };
  }

  const nextChildren: PanelNode[] = [];
  const nextSizes: number[] = [];
  let removed = false;

  node.children.forEach((child, index) => {
    const result = removeLeaf(child, leafId);
    if (result.removed) {
      removed = true;
      if (result.node) {
        nextChildren.push(result.node);
        nextSizes.push(node.sizes[index]);
      }
    } else if (result.node) {
      nextChildren.push(result.node);
      nextSizes.push(node.sizes[index]);
    }
  });

  if (!removed) {
    return { node, removed: false };
  }

  if (nextChildren.length === 0) {
    return { node: null, removed: true };
  }

  if (nextChildren.length === 1) {
    return { node: nextChildren[0], removed: true };
  }

  return {
    node: {
      ...node,
      children: nextChildren,
      sizes: normalizeSizes(nextSizes),
    },
    removed: true,
  };
};

export const usePanelLayoutStore = create<PanelLayoutState>((set, get) => ({
  root: createLeaf('cards'),
  activeLeafId: '',

  splitActiveLeaf: (direction) => {
    const state = get();
    const activeId = state.activeLeafId || findFirstLeafId(state.root);

    const result = splitLeaf(state.root, activeId, direction);
    if (!result.changed) {
      return;
    }

    set({
      root: result.node,
      activeLeafId: result.newActiveId ?? activeId,
    });
  },

  setActiveLeaf: (leafId) => {
    set({ activeLeafId: leafId });
  },

  closeLeaf: (leafId) => {
    const state = get();
    const totalLeaves = collectLeafIds(state.root).length;
    if (totalLeaves <= 1) {
      return;
    }

    const result = removeLeaf(state.root, leafId);
    if (!result.removed || !result.node) {
      return;
    }

    const nextRoot = result.node;
    const nextActive = collectLeafIds(nextRoot)[0];

    set({
      root: nextRoot,
      activeLeafId: nextActive,
    });
  },

  updateSplitSizes: (splitId, sizes) => {
    const state = get();
    const normalized = normalizeSizes(sizes.map((size) => Math.max(size, MIN_SIZE)));

    const nextRoot = updateSplitById(state.root, splitId, (splitNode) => ({
      ...splitNode,
      sizes: normalized,
    }));

    set({ root: nextRoot });
  },

  resetLayout: () => {
    const root = createLeaf('cards');
    set({ root, activeLeafId: root.id });
  },
}));

export const collectLeafIds = (node: PanelNode): string[] => {
  if (node.kind === 'leaf') {
    return [node.id];
  }
  return node.children.flatMap((child) => collectLeafIds(child));
};

// 初期化時にアクティブリーフをセット
const initialLeafId = usePanelLayoutStore.getState().root.id;
usePanelLayoutStore.setState({ activeLeafId: initialLeafId });
