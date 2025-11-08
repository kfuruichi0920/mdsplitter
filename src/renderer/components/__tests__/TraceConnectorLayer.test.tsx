import { render, waitFor } from '@testing-library/react';
import { TraceConnectorLayer } from '../TraceConnectorLayer';
import { resetConnectorLayoutStore, useConnectorLayoutStore } from '../../store/connectorLayoutStore';
import { resetTracePreferenceStore } from '../../store/tracePreferenceStore';

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
  });

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
      const paths = container.querySelectorAll('path.trace-connector-path');
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
      const paths = container.querySelectorAll('path.trace-connector-path');
      expect(paths.length).toBe(0);
    });
  });
});
