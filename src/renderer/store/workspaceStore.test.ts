/**
 * @file workspaceStore.test.ts
 * @brief ワークスペースストアの単体テスト。
 * @details
 * 分割パネルごとのタブ管理とカード操作の挙動を検証する。
 */
import { act } from '@testing-library/react';

import {
  getNextCardStatus,
  resetWorkspaceStore,
  useWorkspaceStore,
  type Card,
  type OpenTabResult,
} from './workspaceStore';

describe('workspaceStore (multi-panel tabs)', () => {
  const baseCards: Card[] = [
    {
      id: 'card-001',
      title: 'カード1',
      body: '本文1',
      status: 'draft',
      kind: 'heading',
      hasLeftTrace: false,
      hasRightTrace: true,
      updatedAt: '2025-11-01T00:00:00.000Z',
      parent_id: null,
      child_ids: ['card-002'],
      prev_id: null,
      next_id: null,
      level: 0,
    },
    {
      id: 'card-002',
      title: 'カード2',
      body: '本文2',
      status: 'review',
      kind: 'paragraph',
      hasLeftTrace: true,
      hasRightTrace: false,
      updatedAt: '2025-11-01T01:00:00.000Z',
      parent_id: 'card-001',
      child_ids: [],
      prev_id: null,
      next_id: null,
      level: 1,
    },
  ];

  const otherCards: Card[] = [
    {
      id: 'card-101',
      title: '別カード1',
      body: '別本文1',
      status: 'approved',
      kind: 'bullet',
      hasLeftTrace: true,
      hasRightTrace: true,
      updatedAt: '2025-11-01T02:00:00.000Z',
      parent_id: null,
      child_ids: [],
      prev_id: null,
      next_id: null,
      level: 0,
    },
  ];

  beforeEach(() => {
    resetWorkspaceStore();
    jest.useRealTimers();
  });

  afterEach(() => {
    resetWorkspaceStore();
    jest.useRealTimers();
  });

  it('opens a new tab per leaf and selects the first card', () => {
    let openResult: OpenTabResult | null = null;
    act(() => {
      openResult = useWorkspaceStore.getState().openTab('leaf-A', 'alpha.json', baseCards);
    });

    const result = openResult!;
    expect(result.status).toBe('opened');
    const state = useWorkspaceStore.getState();
    const leaf = state.leafs['leaf-A'];
    expect(leaf?.tabIds).toHaveLength(1);
    const tabId = leaf?.activeTabId;
    expect(tabId).toBeDefined();
    const tab = tabId ? state.tabs[tabId] : undefined;
    expect(tab?.fileName).toBe('alpha.json');
    expect(tab?.cards).toHaveLength(2);
    expect(tab?.selectedCardIds).toEqual(new Set(['card-001']));
  });

  it('activates existing tab when opening same file in same leaf', () => {
    let first: OpenTabResult | null = null;
    let second: OpenTabResult | null = null;

    act(() => {
      first = useWorkspaceStore.getState().openTab('leaf-A', 'alpha.json', baseCards);
    });

    act(() => {
      second = useWorkspaceStore.getState().openTab('leaf-A', 'alpha.json', baseCards);
    });

    expect(first!.status).toBe('opened');
    expect(second!.status).toBe('activated');
    const state = useWorkspaceStore.getState();
    expect(state.leafs['leaf-A']?.tabIds).toHaveLength(1);
  });

  it('denies opening the same file in a different leaf', () => {
    act(() => {
      useWorkspaceStore.getState().openTab('leaf-A', 'alpha.json', baseCards);
    });

    const result = useWorkspaceStore.getState().openTab('leaf-B', 'alpha.json', baseCards);
    expect(result.status).toBe('denied');
    if (result.status === 'denied') {
      expect(result.reason).toMatch(/開かれています/);
    }
    const state = useWorkspaceStore.getState();
    expect(state.leafs['leaf-B']).toBeUndefined();
  });

  it('closes a tab and reassigns active tab within the leaf', () => {
    let firstTabId = '';
    let secondTabId = '';

    act(() => {
      const firstResult = useWorkspaceStore.getState().openTab('leaf-A', 'alpha.json', baseCards);
      expect(firstResult.status).toBe('opened');
      if (firstResult.status !== 'denied') {
        firstTabId = firstResult.tabId;
      }
    });

    act(() => {
      const secondResult = useWorkspaceStore.getState().openTab('leaf-A', 'beta.json', otherCards);
      expect(secondResult.status).toBe('opened');
      if (secondResult.status !== 'denied') {
        secondTabId = secondResult.tabId;
      }
    });

    act(() => {
      useWorkspaceStore.getState().setActiveTab('leaf-A', firstTabId);
      useWorkspaceStore.getState().closeTab('leaf-A', firstTabId);
    });

    const state = useWorkspaceStore.getState();
    expect(state.tabs[firstTabId]).toBeUndefined();
    expect(state.fileToLeaf['alpha.json']).toBeUndefined();
    expect(state.leafs['leaf-A']?.tabIds).toEqual([secondTabId]);
    expect(state.leafs['leaf-A']?.activeTabId).toBe(secondTabId);
  });

  it('cycles card status within a tab', () => {
    let tabId = '';
    act(() => {
      const outcome = useWorkspaceStore.getState().openTab('leaf-A', 'alpha.json', baseCards);
      expect(outcome.status).toBe('opened');
      if (outcome.status !== 'denied') {
        tabId = outcome.tabId;
      }
    });

    const beforeStatus = baseCards[0].status;
    let nextStatus;
    act(() => {
      nextStatus = useWorkspaceStore.getState().cycleCardStatus('leaf-A', tabId, 'card-001');
    });

    expect(nextStatus).toBe(getNextCardStatus(beforeStatus));
    const state = useWorkspaceStore.getState();
    expect(state.tabs[tabId]?.cards[0].status).toBe(getNextCardStatus(beforeStatus));
  });

  it('adds a new sibling card after the last selected card and selects it', () => {
    let tabId = '';
    act(() => {
      const outcome = useWorkspaceStore.getState().openTab('leaf-A', 'alpha.json', baseCards);
      expect(outcome.status).toBe('opened');
      if (outcome.status !== 'denied') {
        tabId = outcome.tabId;
      }
    });

    act(() => {
      useWorkspaceStore.getState().selectCard('leaf-A', tabId, 'card-002');
    });

    let createdCard: Card | null = null;
    act(() => {
      createdCard = useWorkspaceStore.getState().addCard('leaf-A', tabId);
    });

    expect(createdCard).not.toBeNull();
    const state = useWorkspaceStore.getState();
    const tab = state.tabs[tabId];
    expect(tab?.cards).toHaveLength(3);
    const lastCard = createdCard!;
    expect(lastCard.parent_id).toBe('card-001');
    expect(lastCard.level).toBe(1);
    expect(tab?.selectedCardIds).toEqual(new Set([lastCard.id]));

    act(() => {
      const undone = useWorkspaceStore.getState().undo();
      expect(undone).toBe(true);
    });

    const reverted = useWorkspaceStore.getState().tabs[tabId];
    expect(reverted?.cards).toHaveLength(2);
  });

  it('deletes selected cards (including descendants) and restores via undo', () => {
    let tabId = '';
    act(() => {
      const outcome = useWorkspaceStore.getState().openTab('leaf-A', 'alpha.json', baseCards);
      expect(outcome.status).toBe('opened');
      if (outcome.status !== 'denied') {
        tabId = outcome.tabId;
      }
    });

    let deleted = 0;
    act(() => {
      deleted = useWorkspaceStore.getState().deleteCards('leaf-A', tabId);
    });

    expect(deleted).toBe(2);
    const state = useWorkspaceStore.getState();
    expect(state.tabs[tabId]?.cards).toHaveLength(0);
    expect(state.tabs[tabId]?.selectedCardIds).toEqual(new Set());

    act(() => {
      const restored = useWorkspaceStore.getState().undo();
      expect(restored).toBe(true);
    });

    const reverted = useWorkspaceStore.getState().tabs[tabId];
    expect(reverted?.cards).toHaveLength(2);
  });

  it('removes all tabs when a leaf is closed', () => {
    let tabId: string = '';
    act(() => {
      const outcome = useWorkspaceStore.getState().openTab('leaf-A', 'alpha.json', baseCards);
      expect(outcome.status).toBe('opened');
      if (outcome.status !== 'denied') {
        tabId = outcome.tabId;
      }
    });

    act(() => {
      useWorkspaceStore.getState().closeLeaf('leaf-A');
    });

    const state = useWorkspaceStore.getState();
    expect(state.leafs['leaf-A']).toBeUndefined();
    expect(state.tabs[tabId]).toBeUndefined();
    expect(state.fileToLeaf['alpha.json']).toBeUndefined();
  });
});
