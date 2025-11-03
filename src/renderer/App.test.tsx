
/**
 * @file App.test.tsx
 * @brief Appコンポーネントの統合テスト。
 * @details
 * ワークスペースのカード表示、ステータス切替、テーマ切替、保存・分割・検索パネル等の主要機能を網羅的に検証します。
 * @author K.Furuichi
 * @date 2025-11-02
 * @version 0.1
 * @copyright MIT
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { defaultSettings, mergeSettings } from '@/shared/settings';
import { App } from './App';
import { resetWorkspaceStore } from './store/workspaceStore';
import { resetUiStore } from './store/uiStore';

/**
 * @brief Appコンポーネントの統合テストケース群。
 */
describe('App', () => {
  const cloneSettings = () => JSON.parse(JSON.stringify(defaultSettings)) as typeof defaultSettings;
  const snapshotCards = [
    {
      id: 'card-001',
      title: 'プロジェクト概要',
      body: 'アプリケーションの目的と主要ユースケースを記述します。',
      status: 'approved',
      kind: 'heading',
      hasLeftTrace: true,
      hasRightTrace: true,
      updatedAt: '2020-10-19T05:30:00.000Z',
    },
    {
      id: 'card-002',
      title: '詳細設計の棚卸し',
      body: 'ユースケース一覧と詳細設計の整備方針をまとめます。',
      status: 'draft',
      kind: 'paragraph',
      hasLeftTrace: false,
      hasRightTrace: true,
      updatedAt: '2025-10-18T00:15:00.000Z',
    },
    {
      id: 'card-003',
      title: 'リスクアセスメント概要',
      body: '既知の運用リスクと緩和策を列挙します。',
      status: 'review',
      kind: 'bullet',
      hasLeftTrace: true,
      hasRightTrace: false,
      updatedAt: '2025-10-17T11:05:00.000Z',
    },
  ] as const;
  let currentSettings = cloneSettings();
  let saveWorkspaceMock: jest.Mock;
  let loadWorkspaceMock: jest.Mock;

  /**
   * @brief 各テスト前の初期化処理。
   * @details
   * モック関数のリセット、window.appのセットアップ、ストア初期化を行います。
   */
  beforeEach(() => {
    currentSettings = cloneSettings();
    saveWorkspaceMock = jest.fn().mockResolvedValue({ path: '/tmp/workspace.snapshot.json' });
    loadWorkspaceMock = jest.fn().mockResolvedValue({
      cards: snapshotCards,
      savedAt: '2025-10-20T09:00:00.000Z',
    });
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
        load: loadWorkspaceMock,
      },
    };

    act(() => {
      resetWorkspaceStore();
      resetUiStore();
    });
    jest.useRealTimers();
  });

  /**
   * @brief 各テスト後のクリーンアップ処理。
   * @details
   * window.appの削除、モックリセット、ストア初期化を行います。
   */
  afterEach(() => {
    jest.useRealTimers();
    act(() => {
      resetWorkspaceStore();
      resetUiStore();
    });
    delete (window as any).app;
    saveWorkspaceMock.mockReset?.();
    loadWorkspaceMock.mockReset?.();
  });

  /**
   * @brief ワークスペースストアからカードを描画するテスト。
   */
  it('renders cards from the workspace store', async () => {
    render(<App />);
    await act(async () => {});
    await waitFor(() => expect(loadWorkspaceMock).toHaveBeenCalled());
    expect(screen.getByText('プロジェクト概要')).toBeInTheDocument();
    expect(screen.getByText(/カード総数: 3/)).toBeInTheDocument();
  });

  /**
   * @brief ツールバーでカードステータスを切り替えるテスト。
   */
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

  /**
   * @brief ツールバーでテーマを切り替えるテスト。
   */
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

  /**
   * @brief Ctrl+Sショートカットでワークスペース保存を検証。
   */
  it('saves workspace via Ctrl+S shortcut', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2025-11-03T09:00:00.000Z'));

    render(<App />);
    await act(async () => {});
    await waitFor(() => expect(screen.getByText(/保存状態:/)).toBeInTheDocument());
    expect(screen.getByText(/保存状態: ✓ 保存済み/)).toBeInTheDocument();

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

  /**
   * @brief キーボードショートカットで分割レイアウトを変更するテスト。
   */
  it('changes split layout via keyboard shortcuts', async () => {
    render(<App />);
    await act(async () => {});

    //! 初期状態では単一の葉ノードのみ
    const initialLeaves = screen.getAllByTestId(/^split-leaf-/);
    expect(initialLeaves).toHaveLength(1);

    //! 左右分割
    await act(async () => {
      fireEvent.keyDown(window, { key: '\\', ctrlKey: true });
    });

    //! 分割後は2つの葉ノードが存在する
    const afterVerticalSplit = screen.getAllByTestId(/^split-leaf-/);
    expect(afterVerticalSplit).toHaveLength(2);

    //! 上下分割（アクティブな葉が設定されていないので、分割されない）
    await act(async () => {
      fireEvent.keyDown(window, { key: '\\', ctrlKey: true, shiftKey: true });
    });

    //! 分割されない（アクティブな葉がないため）
    const afterHorizontalSplit = screen.getAllByTestId(/^split-leaf-/);
    expect(afterHorizontalSplit).toHaveLength(2);

  });

  /**
   * @brief スナップショットロード時に無効カードが除去される警告を検証。
   */
  it('warns when invalid cards are removed during snapshot load', async () => {
    loadWorkspaceMock.mockResolvedValueOnce({
      cards: [
        { ...snapshotCards[0] },
        {
          id: 'invalid-card',
          title: '',
          body: 'invalid',
          status: 'deprecated',
          kind: 'heading',
          hasLeftTrace: true,
          hasRightTrace: false,
          updatedAt: 'invalid-date',
        },
      ],
      savedAt: '2025-11-03T09:00:00.000Z',
    });

    render(<App />);

    await waitFor(() =>
      expect(screen.getByText('保存済みワークスペースを読み込みました (無効カード 1 件)。')).toBeInTheDocument(),
    );
    expect(screen.getAllByText(/カード総数: 1/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('invalid-card')).not.toBeInTheDocument();
  });

  /**
   * @brief Ctrl+Fショートカットで検索パネルを開き、入力欄にフォーカスするテスト。
   */
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
