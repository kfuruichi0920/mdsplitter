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

    useConnectorLayoutStore.getState().registerCardAnchor('card-001', 'leaf-A', rect);

    let cards = useConnectorLayoutStore.getState().cards;
    expect(Object.keys(cards)).toHaveLength(1);
    const entry = Object.values(cards)[0];
    expect(entry.cardId).toBe('card-001');
    expect(entry.leafId).toBe('leaf-A');
    expect(entry.rect.top).toBe(20);
    expect(entry.rect.midY).toBe(50);

    useConnectorLayoutStore.getState().removeCardAnchor('card-001', 'leaf-A');
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

    useConnectorLayoutStore.getState().registerCardAnchor('card-001', 'leaf-A', rect);
    useConnectorLayoutStore.getState().registerCardAnchor('card-002', 'leaf-B', rect);

    useConnectorLayoutStore.getState().clearLeafAnchors('leaf-A');

    const cards = useConnectorLayoutStore.getState().cards;
    expect(Object.keys(cards)).toHaveLength(1);
    const remaining = Object.values(cards)[0];
    expect(remaining.leafId).toBe('leaf-B');
  });
});
