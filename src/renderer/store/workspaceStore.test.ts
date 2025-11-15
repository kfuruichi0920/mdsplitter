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
  type InsertPosition,
  type OpenTabResult,
  type WorkspaceStore,
} from './workspaceStore';

type MergeCardsReturn = ReturnType<WorkspaceStore['mergeCards']>;

const baseCards: Card[] = [
    {
      id: 'card-001',
      title: 'カード1',
      body: '本文1',
      status: 'draft',
      kind: 'heading',
      hasLeftTrace: false,
      hasRightTrace: true,
      markdownPreviewEnabled: true,
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
      markdownPreviewEnabled: true,
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
      markdownPreviewEnabled: true,
      updatedAt: '2025-11-01T02:00:00.000Z',
      parent_id: null,
      child_ids: [],
      prev_id: null,
      next_id: null,
      level: 0,
    },
  ];

const mergeCandidates: Card[] = [
    {
      id: 'merge-001',
      title: '統合候補1',
      body: '本文A',
      status: 'draft',
      kind: 'paragraph',
      hasLeftTrace: true,
      hasRightTrace: false,
      markdownPreviewEnabled: true,
      updatedAt: '2025-11-02T00:00:00.000Z',
      parent_id: null,
      child_ids: [],
      prev_id: null,
      next_id: 'merge-002',
      level: 0,
    },
    {
      id: 'merge-002',
      title: '統合候補2',
      body: '本文B',
      status: 'review',
      kind: 'paragraph',
      hasLeftTrace: false,
      hasRightTrace: true,
      markdownPreviewEnabled: true,
      updatedAt: '2025-11-02T01:00:00.000Z',
      parent_id: null,
      child_ids: [],
      prev_id: 'merge-001',
      next_id: 'merge-003',
      level: 0,
    },
    {
      id: 'merge-003',
      title: '統合候補3',
      body: '本文C',
      status: 'approved',
      kind: 'paragraph',
      hasLeftTrace: false,
      hasRightTrace: false,
      markdownPreviewEnabled: true,
      updatedAt: '2025-11-02T02:00:00.000Z',
      parent_id: null,
      child_ids: [],
      prev_id: 'merge-002',
      next_id: null,
      level: 0,
    },
  ];

describe('workspaceStore (multi-panel tabs)', () => {
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

  it('creates an untitled tab via createUntitledTab', () => {
    act(() => {
      useWorkspaceStore.getState().createUntitledTab('leaf-A');
    });

    const state = useWorkspaceStore.getState();
    const leaf = state.leafs['leaf-A'];
    expect(leaf?.tabIds).toHaveLength(1);
    const tabId = leaf?.activeTabId ?? undefined;
    expect(tabId).toBeDefined();
    const tab = tabId ? state.tabs[tabId] : undefined;
    expect(tab?.fileName).toBeNull();
    expect(tab?.title).toMatch(/新規ファイル/);
    expect(tab?.isDirty).toBe(true);
    expect(Object.keys(state.fileToLeaf)).toHaveLength(0);
  });

  it('increments untitled tab titles for successive creations', () => {
    act(() => {
      useWorkspaceStore.getState().createUntitledTab('leaf-A');
      useWorkspaceStore.getState().createUntitledTab('leaf-A');
    });

    const state = useWorkspaceStore.getState();
    const leaf = state.leafs['leaf-A'];
    expect(leaf?.tabIds).toHaveLength(2);
    const titles = leaf?.tabIds.map((id) => state.tabs[id]?.title) ?? [];
    expect(new Set(titles).size).toBe(titles.length);
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

  it('inserts a card before the anchor when position is before', () => {
    let tabId = '';
    act(() => {
      const outcome = useWorkspaceStore.getState().openTab('leaf-A', 'alpha.json', baseCards);
      expect(outcome.status).toBe('opened');
      if (outcome.status !== 'denied') {
        tabId = outcome.tabId;
      }
    });

    let created: Card | null = null;
    act(() => {
      created = useWorkspaceStore.getState().addCard('leaf-A', tabId, { anchorCardId: 'card-001', position: 'before' });
    });

    expect(created).not.toBeNull();
    const createdCard = created!;
    const cards = (useWorkspaceStore.getState().tabs[tabId]?.cards ?? []) as Card[];
    expect(cards[0].id).toBe(createdCard.id);
    expect(cards[1].id).toBe('card-001');
    expect(createdCard.parent_id).toBeNull();
  });

  it('adds a child card and expands the parent', () => {
    let tabId = '';
    act(() => {
      const outcome = useWorkspaceStore.getState().openTab('leaf-A', 'alpha.json', baseCards);
      expect(outcome.status).toBe('opened');
      if (outcome.status !== 'denied') {
        tabId = outcome.tabId;
      }
    });

    let created: Card | null = null;
    act(() => {
      created = useWorkspaceStore.getState().addCard('leaf-A', tabId, { anchorCardId: 'card-001', position: 'child' });
    });

    expect(created).not.toBeNull();
    const createdCard = created!;
    const state = useWorkspaceStore.getState();
    const tab = state.tabs[tabId];
    expect(createdCard.parent_id).toBe('card-001');
    expect(createdCard.level).toBe(1);
    expect(tab?.expandedCardIds.has('card-001')).toBe(true);
  });

  it('moves a card as child directly under the parent card', () => {
    const cards: Card[] = [
      {
        ...baseCards[0],
        id: 'parent',
        child_ids: [],
        next_id: 'sibling',
      },
      {
        ...baseCards[1],
        id: 'sibling',
        title: 'Sibling',
        parent_id: null,
        child_ids: [],
        prev_id: 'parent',
        next_id: 'target',
        level: 0,
      },
      {
        ...baseCards[1],
        id: 'target',
        title: 'Target',
        parent_id: null,
        child_ids: [],
        prev_id: 'sibling',
        next_id: null,
        level: 0,
      },
    ];

    let tabId = '';
    act(() => {
      const outcome = useWorkspaceStore.getState().openTab('leaf-A', 'move.json', cards);
      expect(outcome.status).toBe('opened');
      if (outcome.status !== 'denied') {
        tabId = outcome.tabId;
      }
    });

    act(() => {
      const ok = useWorkspaceStore.getState().moveCards('leaf-A', tabId, ['target'], 'parent', 'child');
      expect(ok).toBe(true);
    });

    const state = useWorkspaceStore.getState();
    const tab = state.tabs[tabId];
    expect(tab).toBeDefined();
    if (!tab) {
      return;
    }

    const parentIndex = tab.cards.findIndex((card) => card.id === 'parent');
    const targetIndex = tab.cards.findIndex((card) => card.id === 'target');
    const siblingIndex = tab.cards.findIndex((card) => card.id === 'sibling');

    expect(parentIndex).toBeGreaterThanOrEqual(0);
    expect(targetIndex).toBe(parentIndex + 1);
    expect(siblingIndex).toBeGreaterThan(targetIndex);
    expect(tab.cards[targetIndex].parent_id).toBe('parent');
    expect(tab.cards[targetIndex].level).toBe(tab.cards[parentIndex].level + 1);
  });

  it('allows moving a card to a higher level (ancestor parent)', () => {
    const cards: Card[] = [
      {
        ...baseCards[0],
        id: 'root',
        child_ids: ['child'],
        next_id: null,
      },
      {
        ...baseCards[1],
        id: 'child',
        parent_id: 'root',
        child_ids: ['grandchild'],
        prev_id: null,
        next_id: null,
        level: 1,
      },
      {
        ...baseCards[1],
        id: 'grandchild',
        parent_id: 'child',
        child_ids: [],
        prev_id: null,
        next_id: null,
        level: 2,
      },
      {
        ...otherCards[0],
        id: 'other-root',
        parent_id: null,
        child_ids: [],
        prev_id: 'root',
        next_id: null,
        level: 0,
      },
    ];

    let tabId = '';
    act(() => {
      const outcome = useWorkspaceStore.getState().openTab('leaf-A', 'reparent.json', cards);
      expect(outcome.status).toBe('opened');
      if (outcome.status !== 'denied') {
        tabId = outcome.tabId;
      }
    });

    act(() => {
      const ok = useWorkspaceStore.getState().moveCards('leaf-A', tabId, ['child'], 'other-root', 'before');
      expect(ok).toBe(true);
    });

    const tab = useWorkspaceStore.getState().tabs[tabId];
    expect(tab).toBeDefined();
    if (!tab) return;
    const childCard = tab.cards.find((card) => card.id === 'child');
    expect(childCard?.parent_id).toBeNull();
    expect(childCard?.level).toBe(0);
    const grandChild = tab.cards.find((card) => card.id === 'grandchild');
    expect(grandChild?.parent_id).toBe('child');
    expect(grandChild?.level).toBe(1);
  });

  it('rejects moving a card into its own descendant subtree', () => {
    const cards: Card[] = [
      {
        id: 'root',
        title: 'Root',
        body: '',
        status: 'draft',
        kind: 'heading',
        hasLeftTrace: false,
        hasRightTrace: false,
        markdownPreviewEnabled: true,
        updatedAt: '2025-11-01T00:00:00.000Z',
        parent_id: null,
        child_ids: ['child'],
        prev_id: null,
        next_id: null,
        level: 0,
      },
      {
        id: 'child',
        title: 'Child',
        body: '',
        status: 'draft',
        kind: 'paragraph',
        hasLeftTrace: false,
        hasRightTrace: false,
        markdownPreviewEnabled: true,
        updatedAt: '2025-11-01T00:10:00.000Z',
        parent_id: 'root',
        child_ids: [],
        prev_id: null,
        next_id: null,
        level: 1,
      },
    ];

    let tabId = '';
    act(() => {
      const outcome = useWorkspaceStore.getState().openTab('leaf-A', 'reject.json', cards);
      expect(outcome.status).toBe('opened');
      if (outcome.status !== 'denied') {
        tabId = outcome.tabId;
      }
    });

    let result = true;
    act(() => {
      result = useWorkspaceStore.getState().moveCards('leaf-A', tabId, ['root'], 'child', 'child');
    });

    expect(result).toBe(false);
    const tab = useWorkspaceStore.getState().tabs[tabId];
    expect(tab?.cards.map((c) => c.id)).toEqual(['root', 'child']);
    expect(tab?.cards[0].parent_id).toBeNull();
    expect(tab?.cards[1].parent_id).toBe('root');
  });

  it('copies selected root subtree and pastes after the anchor', () => {
    let tabId = '';
    act(() => {
      const outcome = useWorkspaceStore.getState().openTab('leaf-A', 'alpha.json', baseCards);
      expect(outcome.status).toBe('opened');
      if (outcome.status !== 'denied') {
        tabId = outcome.tabId;
      }
    });

    act(() => {
      useWorkspaceStore.getState().selectCard('leaf-A', tabId, 'card-001');
    });

    let copied = 0;
    act(() => {
      copied = useWorkspaceStore.getState().copySelection('leaf-A', tabId);
    });
    expect(copied).toBe(1);

    let pasteResult: { inserted: number; insertedIds: string[]; anchorId: string | null; position: InsertPosition } | null = null;
    act(() => {
      pasteResult = useWorkspaceStore.getState().pasteClipboard('leaf-A', tabId, { position: 'after' });
    });

    expect(pasteResult).not.toBeNull();
    const result = pasteResult!;
    expect(result.inserted).toBe(1);
    const cards = useWorkspaceStore.getState().tabs[tabId]?.cards ?? [];
    expect(cards).toHaveLength(4);
    const pastedId = result.insertedIds[0];
    const pastedCard = cards.find((card) => card.id === pastedId);
    expect(pastedCard?.title).toBe('カード1');
    const pastedChildren = cards.filter((card) => card.parent_id === pastedId);
    expect(pastedChildren).toHaveLength(1);
  });

  it('pastes clipboard as child when specifying anchor and position', () => {
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

    act(() => {
      const copied = useWorkspaceStore.getState().copySelection('leaf-A', tabId);
      expect(copied).toBe(1);
    });

    act(() => {
      useWorkspaceStore.getState().pasteClipboard('leaf-A', tabId, { position: 'child', anchorCardId: 'card-001' });
    });

    const cards = useWorkspaceStore.getState().tabs[tabId]?.cards ?? [];
    const children = cards.filter((card) => card.parent_id === 'card-001');
    expect(children.length).toBeGreaterThan(1);
  });

  it('normalizes card order so parents precede children even when input is shuffled', () => {
    const shuffledCards: Card[] = [
      {
        id: 'child-002',
        title: '子B',
        body: '本文B',
        status: 'draft',
        kind: 'paragraph',
        hasLeftTrace: false,
        hasRightTrace: false,
        markdownPreviewEnabled: true,
        updatedAt: '2025-11-01T02:00:00.000Z',
        parent_id: 'root-001',
        child_ids: [],
        prev_id: null,
        next_id: null,
        level: 0,
      },
      {
        id: 'root-001',
        title: 'ルート',
        body: '本文ルート',
        status: 'draft',
        kind: 'heading',
        hasLeftTrace: false,
        hasRightTrace: false,
        markdownPreviewEnabled: true,
        updatedAt: '2025-11-01T01:00:00.000Z',
        parent_id: null,
        child_ids: ['child-001', 'child-002'],
        prev_id: null,
        next_id: null,
        level: 0,
      },
      {
        id: 'child-001',
        title: '子A',
        body: '本文A',
        status: 'draft',
        kind: 'paragraph',
        hasLeftTrace: false,
        hasRightTrace: false,
        markdownPreviewEnabled: true,
        updatedAt: '2025-11-01T01:30:00.000Z',
        parent_id: 'root-001',
        child_ids: [],
        prev_id: null,
        next_id: null,
        level: 0,
      },
    ];

    let tabId = '';
    act(() => {
      const outcome = useWorkspaceStore.getState().openTab('leaf-shuffle', 'shuffle.json', shuffledCards);
      expect(outcome.status).toBe('opened');
      if (outcome.status !== 'denied') {
        tabId = outcome.tabId;
      }
    });

    const orderedCards = useWorkspaceStore.getState().tabs[tabId]?.cards ?? [];
    expect(orderedCards.map((card) => card.id)).toEqual(['root-001', 'child-001', 'child-002']);
    expect(orderedCards[0].level).toBe(0);
    expect(orderedCards[1].level).toBe(1);
    expect(orderedCards[2].level).toBe(1);
  });

  it('ignores nested selections when copying multiple cards', () => {
    let tabId = '';
    act(() => {
      const outcome = useWorkspaceStore.getState().openTab('leaf-A', 'alpha.json', baseCards);
      expect(outcome.status).toBe('opened');
      if (outcome.status !== 'denied') {
        tabId = outcome.tabId;
      }
    });

    act(() => {
      useWorkspaceStore.getState().selectCard('leaf-A', tabId, 'card-001');
      useWorkspaceStore.getState().selectCard('leaf-A', tabId, 'card-002', { multi: true });
    });

    let copied = 0;
    act(() => {
      copied = useWorkspaceStore.getState().copySelection('leaf-A', tabId);
    });
    expect(copied).toBe(1);

    act(() => {
      useWorkspaceStore.getState().pasteClipboard('leaf-A', tabId, { position: 'after' });
    });

    const cards = useWorkspaceStore.getState().tabs[tabId]?.cards ?? [];
    const childrenOfRoot = cards.filter((card) => card.parent_id === 'card-001');
    expect(childrenOfRoot.length).toBeGreaterThan(1);
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

  it('sets card trace flags without pushing undo entries', () => {
    let tabId = '';
    act(() => {
      const outcome = useWorkspaceStore.getState().openTab('leaf-A', 'alpha.json', baseCards);
      expect(outcome.status).toBe('opened');
      if (outcome.status !== 'denied') {
        tabId = outcome.tabId;
      }
    });

    act(() => {
      useWorkspaceStore.getState().setCardTraceFlags('alpha.json', {
        'card-001': { hasRightTrace: true },
      });
    });

    const state = useWorkspaceStore.getState();
    expect(state.tabs[tabId]?.cards[0]?.hasRightTrace).toBe(true);
    expect(state.undoStack).toHaveLength(0);

    act(() => {
      useWorkspaceStore.getState().setCardTraceFlags('alpha.json', {
        'card-001': { hasRightTrace: false },
      });
    });

    expect(useWorkspaceStore.getState().tabs[tabId]?.cards[0]?.hasRightTrace).toBe(false);
  });
});

  describe('mergeCards', () => {
    it('merges contiguous sibling cards and removes originals', () => {
      let tabId = '';
      act(() => {
        const outcome = useWorkspaceStore.getState().openTab('leaf-A', 'merge.json', mergeCandidates);
        expect(outcome.status).toBe('opened');
        if (outcome.status !== 'denied') {
          tabId = outcome.tabId;
        }
      });

      let result: MergeCardsReturn = null;
      act(() => {
        result = useWorkspaceStore.getState().mergeCards('leaf-A', tabId, ['merge-001', 'merge-002'], {
          title: '統合後タイトル',
          body: '本文A\n本文B',
          status: 'approved',
          kind: 'paragraph',
          cardId: 'MERGED-010',
          removeOriginals: true,
          inheritTraces: true,
        });
      });

      expect(result).not.toBeNull();
      const tab = useWorkspaceStore.getState().tabs[tabId];
      expect(tab?.cards).toHaveLength(mergeCandidates.length - 1);
      const newCard = tab?.cards.find((card) => card.id === result?.mergedCard.id);
      expect(newCard?.title).toBe('統合後タイトル');
      expect(newCard?.hasLeftTrace).toBe(true);
      expect(newCard?.hasRightTrace).toBe(true);
      expect(result?.removedCardIds).toEqual(['merge-001', 'merge-002']);
    });

    it('rejects non-contiguous selections', () => {
      let tabId = '';
      act(() => {
        const outcome = useWorkspaceStore.getState().openTab('leaf-A', 'merge.json', mergeCandidates);
        expect(outcome.status).toBe('opened');
        if (outcome.status !== 'denied') {
          tabId = outcome.tabId;
        }
      });

      let result: MergeCardsReturn = null;
      act(() => {
        result = useWorkspaceStore.getState().mergeCards('leaf-A', tabId, ['merge-001', 'merge-003'], {
          title: 'invalid',
          body: '',
          status: 'draft',
          kind: 'paragraph',
          cardId: undefined,
          removeOriginals: true,
          inheritTraces: false,
        });
      });

      expect(result).toBeNull();
      const tab = useWorkspaceStore.getState().tabs[tabId];
      expect(tab?.cards.map((card) => card.id)).toEqual(mergeCandidates.map((card) => card.id));
    });

    it('can retain originals when removeOriginals is false', () => {
      let tabId = '';
      act(() => {
        const outcome = useWorkspaceStore.getState().openTab('leaf-A', 'merge.json', mergeCandidates);
        expect(outcome.status).toBe('opened');
        if (outcome.status !== 'denied') {
          tabId = outcome.tabId;
        }
      });

      let result: MergeCardsReturn = null;
      act(() => {
        result = useWorkspaceStore.getState().mergeCards('leaf-A', tabId, ['merge-002', 'merge-003'], {
          title: '保持用',
          body: '本文C',
          status: 'review',
          kind: 'paragraph',
          cardId: undefined,
          removeOriginals: false,
          inheritTraces: false,
        });
      });

      expect(result).not.toBeNull();
      const tab = useWorkspaceStore.getState().tabs[tabId];
      expect(tab?.cards).toHaveLength(mergeCandidates.length + 1);
      expect(result?.removedCardIds).toHaveLength(0);
      const merged = tab?.cards.find((card) => card.title === '保持用');
      expect(merged).toBeDefined();
    });
  });
