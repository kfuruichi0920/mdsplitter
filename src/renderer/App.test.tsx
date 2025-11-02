import { act, render, screen } from '@testing-library/react';

import { App } from './App';
import { resetWorkspaceStore } from './store/workspaceStore';

describe('App', () => {
  beforeEach(() => {
    act(() => {
      resetWorkspaceStore();
    });
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    act(() => {
      resetWorkspaceStore();
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
});
