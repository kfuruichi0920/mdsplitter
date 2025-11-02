import { act, render, screen } from '@testing-library/react';

import { App } from './App';
import { resetWorkspaceStore } from './store/workspaceStore';
import { resetUiStore } from './store/uiStore';

describe('App', () => {
  beforeEach(() => {
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
  });

  it('renders cards from the workspace store', () => {
    render(<App />);
    expect(screen.getByText('プロジェクト概要')).toBeInTheDocument();
    expect(screen.getByText(/カード総数: 3/)).toBeInTheDocument();
  });

  it('cycles the selected card status via toolbar button', () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-11-02T09:00:00.000Z'));
    render(<App />);

    expect(screen.getByText('Approved')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /ステータス切替/ });

    act(() => {
      button.click();
    });

    expect(screen.getByText('Deprecated')).toBeInTheDocument();
    expect(screen.queryByText('Approved')).not.toBeInTheDocument();
  });

  it('toggles theme via toolbar button', () => {
    render(<App />);

    const initialButton = screen.getByRole('button', { name: /ライトモード/ });
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => {
      initialButton.click();
    });

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(screen.getByRole('button', { name: /ダークモード/ })).toBeInTheDocument();
  });
});
