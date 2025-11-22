import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SearchDialog } from '../SearchDialog';
import { resetSearchStore } from '../../store/searchStore';
import type { SearchResult } from '../../utils/search';

const mockResults: SearchResult[] = [
  {
    id: 'r1',
    source: 'open',
    fileName: 'spec.json',
    tabId: 'tab-1',
    leafId: 'leaf-1',
    cardId: 'c1',
    cardTitle: 'プロジェクト概要',
    snippet: '概要と目的を記載',
    matchCount: 2,
  },
  {
    id: 'r2',
    source: 'open',
    fileName: 'spec.json',
    tabId: 'tab-1',
    leafId: 'leaf-1',
    cardId: 'c2',
    cardTitle: '詳細設計',
    snippet: '検索ダイアログの要件',
    matchCount: 1,
  },
];

describe('SearchDialog', () => {
  beforeEach(() => {
    resetSearchStore();
  });

  it('renders when open and focuses the keyword input', async () => {
    const executeSearch = jest.fn().mockResolvedValue({ results: mockResults, error: null });
    render(
      <SearchDialog
        isOpen
        onClose={() => undefined}
        onNavigate={() => undefined}
        executeSearch={executeSearch}
      />,
    );

    const input = screen.getByLabelText('検索キーワード');
    await waitFor(() => expect(input).toHaveFocus());
  });

  it('runs search and shows results, then navigates on click', async () => {
    const executeSearch = jest.fn().mockResolvedValue({ results: mockResults, error: null });
    const onNavigate = jest.fn();
    render(
      <SearchDialog
        isOpen
        onClose={() => undefined}
        onNavigate={onNavigate}
        executeSearch={executeSearch}
      />,
    );

    fireEvent.change(screen.getByLabelText('検索キーワード'), { target: { value: '概要' } });
    fireEvent.click(screen.getByRole('button', { name: '検索' }));

    await waitFor(() => expect(executeSearch).toHaveBeenCalledTimes(1));
    expect(executeSearch.mock.calls[0][0]).toMatchObject({ mode: 'text', text: '概要' });

    await waitFor(() => expect(screen.getByText('プロジェクト概要')).toBeInTheDocument());
    fireEvent.click(screen.getByText('詳細設計'));

    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ cardId: 'c2' }));
  });

  it('stores past searches as history tabs', async () => {
    const executeSearch = jest
      .fn()
      .mockResolvedValueOnce({ results: [mockResults[0]], error: null })
      .mockResolvedValueOnce({ results: [mockResults[1]], error: null });

    render(
      <SearchDialog
        isOpen
        onClose={() => undefined}
        onNavigate={() => undefined}
        executeSearch={executeSearch}
      />,
    );

    fireEvent.change(screen.getByLabelText('検索キーワード'), { target: { value: '概要' } });
    fireEvent.click(screen.getByRole('button', { name: '検索' }));
    await waitFor(() => expect(screen.getByText('プロジェクト概要')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('検索キーワード'), { target: { value: '設計' } });
    fireEvent.click(screen.getByRole('button', { name: '検索' }));
    await waitFor(() => expect(screen.getByText('詳細設計')).toBeInTheDocument());

    const historyTabs = screen.getAllByRole('tab');
    expect(historyTabs.length).toBeGreaterThanOrEqual(2);

    // 先頭タブを選択すると最初の結果が再表示される
    fireEvent.click(historyTabs[historyTabs.length - 1]);
    await waitFor(() => expect(screen.getByText('プロジェクト概要')).toBeInTheDocument());
  });
});
