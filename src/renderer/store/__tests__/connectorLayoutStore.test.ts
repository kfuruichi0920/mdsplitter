import { resetConnectorLayoutStore, useConnectorLayoutStore } from '../connectorLayoutStore';

describe('connectorLayoutStore', () => {
  beforeEach(() => {
    resetConnectorLayoutStore();
  });

  it('registers and removes card anchors', () => {
    const rect: DOMRectReadOnly = {
      x: 10,
      y: 20,
      width: 120,
      height: 60,
      top: 20,
      left: 10,
      bottom: 80,
      right: 130,
      toJSON: () => ({}),
    } as DOMRectReadOnly;

    useConnectorLayoutStore.getState().registerCardAnchor('card-001', 'leaf-A', 'test-file.json', rect);

    let cards = useConnectorLayoutStore.getState().cards;
    expect(Object.keys(cards)).toHaveLength(1);
    const entry = Object.values(cards)[0];
    expect(entry.cardId).toBe('card-001');
    expect(entry.leafId).toBe('leaf-A');
    expect(entry.fileName).toBe('test-file.json');
    expect(entry.rect.top).toBe(20);
    expect(entry.rect.midY).toBe(50);

    useConnectorLayoutStore.getState().removeCardAnchor('card-001', 'leaf-A', 'test-file.json');
    cards = useConnectorLayoutStore.getState().cards;
    expect(Object.keys(cards)).toHaveLength(0);
  });

  it('clears anchors by leaf', () => {
    const rect = {
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      top: 0,
      left: 0,
      bottom: 10,
      right: 10,
      toJSON: () => ({}),
    } as DOMRectReadOnly;

    useConnectorLayoutStore.getState().registerCardAnchor('card-001', 'leaf-A', 'fileA.json', rect);
    useConnectorLayoutStore.getState().registerCardAnchor('card-002', 'leaf-B', 'fileB.json', rect);

    useConnectorLayoutStore.getState().clearLeafAnchors('leaf-A');

    const cards = useConnectorLayoutStore.getState().cards;
    expect(Object.keys(cards)).toHaveLength(1);
    const remaining = Object.values(cards)[0];
    expect(remaining.leafId).toBe('leaf-B');
  });

  it('distinguishes same cardId with different fileNames', () => {
    const rect: DOMRectReadOnly = {
      x: 10,
      y: 20,
      width: 120,
      height: 60,
      top: 20,
      left: 10,
      bottom: 80,
      right: 130,
      toJSON: () => ({}),
    } as DOMRectReadOnly;

    // 同じcardId、同じleafId、異なるfileName
    useConnectorLayoutStore.getState().registerCardAnchor('card-001', 'leaf-A', 'fileA.json', rect);
    useConnectorLayoutStore.getState().registerCardAnchor('card-001', 'leaf-A', 'fileB.json', rect);

    const cards = useConnectorLayoutStore.getState().cards;
    expect(Object.keys(cards)).toHaveLength(2);

    const entries = Object.values(cards);
    expect(entries[0].cardId).toBe('card-001');
    expect(entries[1].cardId).toBe('card-001');
    expect(entries[0].fileName).not.toBe(entries[1].fileName);
  });

  it('skips update when metrics are effectively unchanged (optimization)', async () => {
    const rect1: DOMRectReadOnly = {
      x: 10,
      y: 20,
      width: 120,
      height: 60,
      top: 20,
      left: 10,
      bottom: 80,
      right: 130,
      toJSON: () => ({}),
    } as DOMRectReadOnly;

    useConnectorLayoutStore.getState().registerCardAnchor('card-001', 'leaf-A', 'test-file.json', rect1);
    const cards1 = useConnectorLayoutStore.getState().cards;
    const entry1 = Object.values(cards1)[0];
    const firstUpdatedAt = entry1.updatedAt;
    const firstRectTop = entry1.rect.top;

    // 微小な差異（0.3px）で再登録
    const rect2: DOMRectReadOnly = {
      x: 10.2,
      y: 20.3,
      width: 120.1,
      height: 60.2,
      top: 20.3,
      left: 10.2,
      bottom: 80.5,
      right: 130.3,
      toJSON: () => ({}),
    } as DOMRectReadOnly;

    useConnectorLayoutStore.getState().registerCardAnchor('card-001', 'leaf-A', 'test-file.json', rect2);
    const cards2 = useConnectorLayoutStore.getState().cards;
    const entry2 = Object.values(cards2)[0];

    // 更新がスキップされているため、updatedAtとrectは変わらない
    expect(entry2.updatedAt).toBe(firstUpdatedAt);
    expect(entry2.rect.top).toBe(firstRectTop);

    // 少し待機してタイムスタンプを確実に変える
    const waitPromise = new Promise((resolve) => setTimeout(resolve, 10));
    await waitPromise;

    // 大きな差異（1px以上）で再登録
    const rect3: DOMRectReadOnly = {
      x: 10,
      y: 25,
      width: 120,
      height: 60,
      top: 25,
      left: 10,
      bottom: 85,
      right: 130,
      toJSON: () => ({}),
    } as DOMRectReadOnly;

    useConnectorLayoutStore.getState().registerCardAnchor('card-001', 'leaf-A', 'test-file.json', rect3);
    const cards3 = useConnectorLayoutStore.getState().cards;
    const entry3 = Object.values(cards3)[0];

    // 大きな差異のため更新される
    expect(entry3.updatedAt).toBeGreaterThan(firstUpdatedAt);
    expect(entry3.rect.top).toBe(25);
  });
});
