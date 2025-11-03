import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { defaultSettings, mergeSettings } from '@/shared/settings';

import { App } from './App';
import { resetWorkspaceStore } from './store/workspaceStore';
import { resetUiStore } from './store/uiStore';

describe('App', () => {
  const cloneSettings = () => JSON.parse(JSON.stringify(defaultSettings)) as typeof defaultSettings;
  let currentSettings = cloneSettings();
  let saveWorkspaceMock: jest.Mock;

  beforeEach(() => {
    currentSettings = cloneSettings();
    saveWorkspaceMock = jest.fn().mockResolvedValue({ path: '/tmp/workspace.snapshot.json' });
    (window as any).app = {
      ping: jest.fn().mockResolvedValue({ ok: true, timestamp: Date.now() }),
      settings: {
        load: jest.fn().mockImplementation(async () => currentSettings),
        update: jest.fn().mockImplementation(async (patch) => {
          currentSettings = mergeSettings(currentSettings, patch);
          return currentSettings;
        }),
      },
      log: jest.fn().mockResolvedValue(undefined),
      workspace: {
        save: saveWorkspaceMock,
      },
    };

    act(() => {
      resetWorkspaceStore();
      resetUiStore();
    });
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    act(() => {
      resetWorkspaceStore();
      resetUiStore();
    });
    delete (window as any).app;
    saveWorkspaceMock.mockReset?.();
  });

  it('renders cards from the workspace store', async () => {
    render(<App />);
    await act(async () => {});
    expect(screen.getByText('プロジェクト概要')).toBeInTheDocument();
    expect(screen.getByText(/カード総数: 3/)).toBeInTheDocument();
  });

  it('cycles the selected card status via toolbar button', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-11-02T09:00:00.000Z'));
    render(<App />);
    await act(async () => {});

    expect(screen.getByText('Approved')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /ステータス切替/ });

    act(() => {
      button.click();
    });

    expect(screen.getByText('Deprecated')).toBeInTheDocument();
    expect(screen.queryByText('Approved')).not.toBeInTheDocument();
  });

  it('toggles theme via toolbar button', async () => {
    render(<App />);
    await act(async () => {});

    const initialButton = screen.getByRole('button', { name: /ライトモード/ });
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => {
      initialButton.click();
    });

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(screen.getByRole('button', { name: /ダークモード/ })).toBeInTheDocument();
  });

  it('saves workspace via Ctrl+S shortcut', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-11-03T09:00:00.000Z'));

    render(<App />);
    await act(async () => {});

    expect(screen.getByText('保存状態: ✓ 保存済み')).toBeInTheDocument();

    const statusButton = screen.getByRole('button', { name: /ステータス切替/ });
    act(() => {
      statusButton.click();
    });

    expect(screen.getByText('保存状態: ● 未保存')).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(window, { key: 's', ctrlKey: true });
      await Promise.resolve();
    });

    await waitFor(() => expect(saveWorkspaceMock).toHaveBeenCalledTimes(1));
    expect(saveWorkspaceMock.mock.calls[0][0]).toMatchObject({
      cards: expect.any(Array),
      savedAt: expect.any(String),
    });
    expect(screen.getByText(/保存状態: ✓ 保存済み/)).toBeInTheDocument();
  });

  it('changes split layout via keyboard shortcuts', async () => {
    render(<App />);
    await act(async () => {});

    const grid = screen.getByTestId('panel-grid');
    expect(grid).toHaveAttribute('data-split-mode', 'single');
    expect(screen.queryByText('トレーサビリティコネクタのプレビュー領域')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(window, { key: '\\', ctrlKey: true });
    });

    expect(grid).toHaveAttribute('data-split-mode', 'vertical');
    expect(screen.getByText('トレーサビリティコネクタのプレビュー領域')).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(window, { key: '\\', ctrlKey: true, shiftKey: true });
    });

    expect(grid).toHaveAttribute('data-split-mode', 'horizontal');

    await act(async () => {
      fireEvent.keyDown(window, { key: '\\', ctrlKey: true, shiftKey: true });
    });

    expect(grid).toHaveAttribute('data-split-mode', 'single');
    expect(screen.queryByText('トレーサビリティコネクタのプレビュー領域')).not.toBeInTheDocument();
  });

  it('opens search panel and focuses input via Ctrl+F shortcut', async () => {
    render(<App />);
    await act(async () => {});

    const toggleButton = screen.getByRole('button', { name: /検索/ });
    act(() => {
      toggleButton.click();
    });

    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

    await act(async () => {
      fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    });

    await waitFor(() => expect(toggleButton).toHaveAttribute('aria-expanded', 'true'));

    const searchField = screen.getByRole('searchbox', { name: /検索/ });
    await waitFor(() => expect(searchField).toHaveFocus());
  });
});
