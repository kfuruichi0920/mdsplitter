/**
 * @file splitStore.test.ts
 * @brief 分割ストアのユニットテスト。
 * @details
 * 分割操作、リサイズ、削除、Undo/Redo の動作を検証する。
 * @author K.Furuichi
 * @date 2025-11-03
 * @version 0.1
 * @copyright MIT
 */

import { renderHook, act } from '@testing-library/react';
import { useSplitStore, type SplitLeafNode, type SplitContainerNode } from '../splitStore';

describe('splitStore', () => {
  beforeEach(() => {
    //! 各テスト前にストアをリセット
    const { result } = renderHook(() => useSplitStore());
    act(() => {
      result.current.reset();
    });
  });

  describe('初期状態', () => {
    it('単一の葉ノードで初期化される', () => {
      const { result } = renderHook(() => useSplitStore());
      expect(result.current.root.type).toBe('leaf');
      expect(result.current.history).toHaveLength(1);
      expect(result.current.historyIndex).toBe(0);
      expect(result.current.activeLeafId).toBeNull();
    });
  });

  describe('splitLeaf', () => {
    it('葉ノードを左右分割できる', () => {
      const { result } = renderHook(() => useSplitStore());
      const initialLeafId = result.current.root.id;

      act(() => {
        result.current.splitLeaf(initialLeafId, 'vertical');
      });

      //! ルートが分割ノードになり、2つの葉ノードを持つ
      expect(result.current.root.type).toBe('split');
      const splitRoot = result.current.root as SplitContainerNode;
      expect(splitRoot.direction).toBe('vertical');
      expect(splitRoot.first.type).toBe('leaf');
      expect(splitRoot.second.type).toBe('leaf');
      expect(splitRoot.splitRatio).toBe(0.5);

      //! 履歴が追加される
      expect(result.current.history).toHaveLength(2);
      expect(result.current.historyIndex).toBe(1);
    });

    it('葉ノードを上下分割できる', () => {
      const { result } = renderHook(() => useSplitStore());
      const initialLeafId = result.current.root.id;

      act(() => {
        result.current.splitLeaf(initialLeafId, 'horizontal');
      });

      expect(result.current.root.type).toBe('split');
      const splitRoot = result.current.root as SplitContainerNode;
      expect(splitRoot.direction).toBe('horizontal');
    });

    it('存在しない葉ノードを分割しようとすると警告される', () => {
      const { result } = renderHook(() => useSplitStore());
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      act(() => {
        result.current.splitLeaf('non-existent-id', 'vertical');
      });

      //! 状態は変わらない
      expect(result.current.root.type).toBe('leaf');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Leaf node non-existent-id not found'));

      consoleSpy.mockRestore();
    });
  });

  describe('updateSplitRatio', () => {
    it('分割比率を更新できる', () => {
      const { result } = renderHook(() => useSplitStore());
      const initialLeafId = result.current.root.id;

      act(() => {
        result.current.splitLeaf(initialLeafId, 'vertical');
      });

      const splitRoot = result.current.root as SplitContainerNode;
      const splitNodeId = splitRoot.id;

      act(() => {
        result.current.updateSplitRatio(splitNodeId, 0.7);
      });

      const updatedRoot = result.current.root as SplitContainerNode;
      expect(updatedRoot.splitRatio).toBe(0.7);
    });

    it('分割比率は0.1〜0.9の範囲に制限される', () => {
      const { result } = renderHook(() => useSplitStore());
      const initialLeafId = result.current.root.id;

      act(() => {
        result.current.splitLeaf(initialLeafId, 'vertical');
      });

      const splitRoot = result.current.root as SplitContainerNode;
      const splitNodeId = splitRoot.id;

      act(() => {
        result.current.updateSplitRatio(splitNodeId, 0.05);
      });

      expect((result.current.root as SplitContainerNode).splitRatio).toBe(0.1);

      act(() => {
        result.current.updateSplitRatio(splitNodeId, 0.95);
      });

      expect((result.current.root as SplitContainerNode).splitRatio).toBe(0.9);
    });
  });

  describe('removeLeaf', () => {
    it('分割後に葉ノードを削除できる', () => {
      const { result } = renderHook(() => useSplitStore());
      const initialLeafId = result.current.root.id;

      act(() => {
        result.current.splitLeaf(initialLeafId, 'vertical');
      });

      const splitRoot = result.current.root as SplitContainerNode;
      const secondLeafId = (splitRoot.second as SplitLeafNode).id;

      act(() => {
        result.current.removeLeaf(secondLeafId);
      });

      //! ルートが再び葉ノードになる
      expect(result.current.root.type).toBe('leaf');
      expect(result.current.root.id).toBe(initialLeafId);
    });

    it('最後の葉ノードは削除できない', () => {
      const { result } = renderHook(() => useSplitStore());
      const initialLeafId = result.current.root.id;
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      act(() => {
        result.current.removeLeaf(initialLeafId);
      });

      //! 状態は変わらない
      expect(result.current.root.type).toBe('leaf');
      expect(result.current.root.id).toBe(initialLeafId);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cannot remove the last leaf node'));

      consoleSpy.mockRestore();
    });
  });

  describe('setActiveLeaf', () => {
    it('アクティブな葉ノードを設定できる', () => {
      const { result } = renderHook(() => useSplitStore());
      const initialLeafId = result.current.root.id;

      act(() => {
        result.current.setActiveLeaf(initialLeafId);
      });

      expect(result.current.activeLeafId).toBe(initialLeafId);
    });
  });

  describe('Undo/Redo', () => {
    it('分割操作をUndoできる', () => {
      const { result } = renderHook(() => useSplitStore());
      const initialLeafId = result.current.root.id;

      act(() => {
        result.current.splitLeaf(initialLeafId, 'vertical');
      });

      expect(result.current.root.type).toBe('split');

      act(() => {
        result.current.undo();
      });

      //! 分割前の状態に戻る
      expect(result.current.root.type).toBe('leaf');
      expect(result.current.root.id).toBe(initialLeafId);
      expect(result.current.historyIndex).toBe(0);
    });

    it('UndoしたあとRedoできる', () => {
      const { result } = renderHook(() => useSplitStore());
      const initialLeafId = result.current.root.id;

      act(() => {
        result.current.splitLeaf(initialLeafId, 'vertical');
      });

      act(() => {
        result.current.undo();
      });

      act(() => {
        result.current.redo();
      });

      //! 分割後の状態に戻る
      expect(result.current.root.type).toBe('split');
      expect(result.current.historyIndex).toBe(1);
    });

    it('履歴の先頭でUndoすると警告される', () => {
      const { result } = renderHook(() => useSplitStore());
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      act(() => {
        result.current.undo();
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No history to undo'));

      consoleSpy.mockRestore();
    });

    it('履歴の末尾でRedoすると警告される', () => {
      const { result } = renderHook(() => useSplitStore());
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      act(() => {
        result.current.redo();
      });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No history to redo'));

      consoleSpy.mockRestore();
    });
  });

  describe('reset', () => {
    it('ストアを初期状態にリセットできる', () => {
      const { result } = renderHook(() => useSplitStore());
      const initialLeafId = result.current.root.id;

      act(() => {
        result.current.splitLeaf(initialLeafId, 'vertical');
      });

      act(() => {
        result.current.reset();
      });

      //! 初期状態に戻る
      expect(result.current.root.type).toBe('leaf');
      expect(result.current.history).toHaveLength(1);
      expect(result.current.historyIndex).toBe(0);
      expect(result.current.activeLeafId).toBeNull();
    });
  });
});
