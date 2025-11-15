import { render, waitFor } from '@testing-library/react';
import { TraceConnectorLayer } from '../TraceConnectorLayer';
import { resetConnectorLayoutStore, useConnectorLayoutStore } from '../../store/connectorLayoutStore';
import { resetTracePreferenceStore, useTracePreferenceStore } from '../../store/tracePreferenceStore';
import { resetTraceStore, useTraceStore } from '../../store/traceStore';
import { resetWorkspaceStore, useWorkspaceStore } from '../../store/workspaceStore';

class ResizeObserverStub {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe() {
    // no-op for tests
  }
  unobserve() {
    // no-op
  }
  disconnect() {
    // no-op
  }
}

describe('TraceConnectorLayer', () => {
  beforeAll(() => {
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  });

  beforeEach(() => {
    resetConnectorLayoutStore();
    resetTracePreferenceStore();
    resetTraceStore();
    resetWorkspaceStore();
  });

  const seedWorkspace = (leftLeafId: string, rightLeafId: string, leftFile: string, rightFile: string) => {
    const tabLeft = {
      id: 'tab-left',
      leafId: leftLeafId,
      fileName: leftFile,
      title: leftFile,
      cards: [],
      selectedCardIds: new Set<string>(),
      isDirty: false,
      lastSavedAt: null,
      expandedCardIds: new Set<string>(),
      editingCardId: null,
      dirtyCardIds: new Set<string>(),
      displayMode: 'detailed' as const,
    };
    const tabRight = {
      id: 'tab-right',
      leafId: rightLeafId,
      fileName: rightFile,
      title: rightFile,
      cards: [],
      selectedCardIds: new Set<string>(),
      isDirty: false,
      lastSavedAt: null,
      expandedCardIds: new Set<string>(),
      editingCardId: null,
      dirtyCardIds: new Set<string>(),
      displayMode: 'detailed' as const,
    };
    useWorkspaceStore.setState((state) => ({
      ...state,
      tabs: {
        ...state.tabs,
        [tabLeft.id]: tabLeft,
        [tabRight.id]: tabRight,
      },
      leafs: {
        ...state.leafs,
        [leftLeafId]: { leafId: leftLeafId, tabIds: [tabLeft.id], activeTabId: tabLeft.id },
        [rightLeafId]: { leafId: rightLeafId, tabIds: [tabRight.id], activeTabId: tabRight.id },
      },
      fileToLeaf: {
        ...state.fileToLeaf,
        [leftFile]: leftLeafId,
        [rightFile]: rightLeafId,
      },
    }));
  };

  const seedTraceLink = (params: { leftFile: string; rightFile: string; sourceCardId: string; targetCardId: string }) => {
    const { leftFile, rightFile, sourceCardId, targetCardId } = params;
    const key = `${leftFile}|||${rightFile}`;
    useTraceStore.setState({
      cache: {
        [key]: {
          key,
          status: 'ready',
          timestamp: Date.now(),
          links: [
            {
              id: 'link-1',
              relationId: 'rel-1',
              sourceCardId,
              targetCardId,
              relation: 'trace',
              direction: 'forward',
            },
          ],
          relations: [],
          leftFile,
          rightFile,
          counts: { left: { [sourceCardId]: 1 }, right: { [targetCardId]: 1 } },
        },
      },
    });
  };

  it('renders connector paths when anchors exist on both sides', async () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: jest.fn(() => ({
        x: 0,
        y: 0,
        width: 600,
        height: 400,
        top: 0,
        left: 0,
        right: 600,
        bottom: 400,
        toJSON: () => ({}),
      })),
    });
    document.body.appendChild(container);

    const rectLeft = {
      x: 50,
      y: 100,
      width: 120,
      height: 60,
      top: 100,
      left: 50,
      right: 170,
      bottom: 160,
      toJSON: () => ({}),
    } as DOMRectReadOnly;

    const rectRight = {
      x: 380,
      y: 140,
      width: 120,
      height: 60,
      top: 140,
      left: 380,
      right: 500,
      bottom: 200,
      toJSON: () => ({}),
    } as DOMRectReadOnly;

    seedWorkspace('leaf-left', 'leaf-right', 'test-file-left.json', 'test-file-right.json');
    seedTraceLink({
      leftFile: 'test-file-left.json',
      rightFile: 'test-file-right.json',
      sourceCardId: 'card-001',
      targetCardId: 'card-002',
    });

    const layoutStore = useConnectorLayoutStore.getState();
    layoutStore.registerCardAnchor('card-001', 'leaf-left', 'test-file-left.json', rectLeft);
    layoutStore.registerCardAnchor('card-002', 'leaf-right', 'test-file-right.json', rectRight);

    render(
      <TraceConnectorLayer
        containerRef={{ current: container }}
        direction="vertical"
        splitRatio={0.5}
        nodeId="split-node"
        leftLeafIds={['leaf-left']}
        rightLeafIds={['leaf-right']}
      />,
      { container },
    );

    await waitFor(() => {
      const paths = container.querySelectorAll('path.trace-connector-path:not(.trace-connector-path--placeholder)');
      expect(paths.length).toBeGreaterThan(0);
    });
  });

  it('skips rendering when either endpoint is outside the viewport', async () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: jest.fn(() => ({
        x: 0,
        y: 0,
        width: 600,
        height: 400,
        top: 0,
        left: 0,
        right: 600,
        bottom: 400,
        toJSON: () => ({}),
      })),
    });
    document.body.appendChild(container);

    const rectVisible = {
      x: 40,
      y: 80,
      width: 120,
      height: 60,
      top: 80,
      left: 40,
      right: 160,
      bottom: 140,
      toJSON: () => ({}),
    } as DOMRectReadOnly;

    const rectHidden = {
      x: 400,
      y: 480,
      width: 120,
      height: 60,
      top: 480,
      left: 400,
      right: 520,
      bottom: 540,
      toJSON: () => ({}),
    } as DOMRectReadOnly;

    seedWorkspace('leaf-left', 'leaf-right', 'left.json', 'right.json');
    seedTraceLink({ leftFile: 'left.json', rightFile: 'right.json', sourceCardId: 'card-visible', targetCardId: 'card-hidden' });

    const layoutStore = useConnectorLayoutStore.getState();
    layoutStore.registerCardAnchor('card-visible', 'leaf-left', 'left.json', rectVisible, { isVisible: true });
    layoutStore.registerCardAnchor('card-hidden', 'leaf-right', 'right.json', rectHidden, { isVisible: false });

    render(
      <TraceConnectorLayer
        containerRef={{ current: container }}
        direction="vertical"
        splitRatio={0.5}
        nodeId="split-node"
        leftLeafIds={['leaf-left']}
        rightLeafIds={['leaf-right']}
      />,
      { container },
    );

    await waitFor(() => {
      const paths = container.querySelectorAll('path.trace-connector-path:not(.trace-connector-path--placeholder)');
      expect(paths.length).toBe(0);
    });
  });

  it('renders offscreen connectors when the global toggle is enabled', async () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: jest.fn(() => ({
        x: 0,
        y: 0,
        width: 600,
        height: 400,
        top: 0,
        left: 0,
        right: 600,
        bottom: 400,
        toJSON: () => ({}),
      })),
    });
    document.body.appendChild(container);

    const rectLeft = {
      x: 20,
      y: 420,
      width: 100,
      height: 40,
      top: 420,
      left: 20,
      right: 120,
      bottom: 460,
      toJSON: () => ({}),
    } as DOMRectReadOnly;

    const rectRight = {
      x: 420,
      y: 450,
      width: 120,
      height: 50,
      top: 450,
      left: 420,
      right: 540,
      bottom: 500,
      toJSON: () => ({}),
    } as DOMRectReadOnly;

    seedWorkspace('leaf-left', 'leaf-right', 'file-left.json', 'file-right.json');
    seedTraceLink({ leftFile: 'file-left.json', rightFile: 'file-right.json', sourceCardId: 'card-left', targetCardId: 'card-right' });

    const layoutStore = useConnectorLayoutStore.getState();
    layoutStore.registerCardAnchor('card-left', 'leaf-left', 'file-left.json', rectLeft, { isVisible: false });
    layoutStore.registerCardAnchor('card-right', 'leaf-right', 'file-right.json', rectRight, { isVisible: false });

    useTracePreferenceStore.getState().toggleOffscreenConnectors();

    render(
      <TraceConnectorLayer
        containerRef={{ current: container }}
        direction="vertical"
        splitRatio={0.5}
        nodeId="split-node"
        leftLeafIds={['leaf-left']}
        rightLeafIds={['leaf-right']}
      />,
      { container },
    );

    await waitFor(() => {
      const paths = container.querySelectorAll('path.trace-connector-path:not(.trace-connector-path--placeholder)');
      expect(paths.length).toBeGreaterThan(0);
    });
  });

  it('does not render placeholder path when no connectors exist', async () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: jest.fn(() => ({
        x: 0,
        y: 0,
        width: 600,
        height: 400,
        top: 0,
        left: 0,
        right: 600,
        bottom: 400,
        toJSON: () => ({}),
      })),
    });
    document.body.appendChild(container);

    // トレースリンクがない状態でワークスペースをセットアップ
    seedWorkspace('leaf-left', 'leaf-right', 'no-trace-left.json', 'no-trace-right.json');
    // トレースリンクは追加しない

    render(
      <TraceConnectorLayer
        containerRef={{ current: container }}
        direction="vertical"
        splitRatio={0.5}
        nodeId="split-node"
        leftLeafIds={['leaf-left']}
        rightLeafIds={['leaf-right']}
      />,
      { container },
    );

    await waitFor(() => {
      // すべてのパス要素（プレースホルダーを含む）を検索
      const allPaths = container.querySelectorAll('path');
      // マーカー定義のパス（矢印）のみ存在し、コネクタパスは存在しないことを確認
      const connectorPaths = container.querySelectorAll('path.trace-connector-path');
      const placeholderPaths = container.querySelectorAll('path.trace-connector-path--placeholder');

      // プレースホルダーパスが存在しないことを確認
      expect(placeholderPaths.length).toBe(0);
      // コネクタパスが存在しないことを確認
      expect(connectorPaths.length).toBe(0);
      // マーカー定義のパスのみ存在することを確認（矢印の定義）
      expect(allPaths.length).toBe(1); // マーカーのパスのみ
    });
  });
});
