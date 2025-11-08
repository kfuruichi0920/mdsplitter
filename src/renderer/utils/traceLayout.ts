import type { SplitNode, SplitContainerNode } from '../store/splitStore';

export const collectLeafIds = (node: SplitNode): string[] => {
  if (node.type === 'leaf') {
    return [node.id];
  }
  return [...collectLeafIds(node.first), ...collectLeafIds(node.second)];
};

const containsLeaf = (node: SplitNode, leafId: string): boolean => {
  if (node.type === 'leaf') {
    return node.id === leafId;
  }
  return containsLeaf(node.first, leafId) || containsLeaf(node.second, leafId);
};

export interface TracePairContext {
  splitNode: SplitContainerNode;
  leftLeafIds: string[];
  rightLeafIds: string[];
}

export const findVerticalPairForLeaf = (root: SplitNode, activeLeafId: string | null): TracePairContext | null => {
  if (!activeLeafId) {
    return null;
  }

  const dfs = (node: SplitNode): TracePairContext | null => {
    if (node.type === 'leaf') {
      return null;
    }

    const inFirst = containsLeaf(node.first, activeLeafId);
    const inSecond = containsLeaf(node.second, activeLeafId);
    if (!inFirst && !inSecond) {
      return null;
    }

    if (node.direction === 'vertical' && inFirst !== inSecond) {
      return {
        splitNode: node,
        leftLeafIds: collectLeafIds(node.first),
        rightLeafIds: collectLeafIds(node.second),
      } satisfies TracePairContext;
    }

    const nextNode = inFirst ? node.first : node.second;
    return dfs(nextNode);
  };

  return dfs(root);
};
