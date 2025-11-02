import { act, render, screen } from '@testing-library/react';

import { defaultSettings, mergeSettings } from '@/shared/settings';

import { App } from './App';
import { resetWorkspaceStore } from './store/workspaceStore';
import { resetUiStore } from './store/uiStore';

describe('App', () => {
  const cloneSettings = () => JSON.parse(JSON.stringify(defaultSettings)) as typeof defaultSettings;
  let currentSettings = cloneSettings();

  beforeEach(() => {
    currentSettings = cloneSettings();
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
});
