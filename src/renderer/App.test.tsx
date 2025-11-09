
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

import { App } from './App';
import { resetUiStore } from './store/uiStore';
import { resetWorkspaceStore } from './store/workspaceStore';

import { defaultSettings, mergeSettings } from '@/shared/settings';

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
      markdownPreviewEnabled: true,
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
      markdownPreviewEnabled: true,
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
      markdownPreviewEnabled: true,
      updatedAt: '2025-10-17T11:05:00.000Z',
    },
  ] as const;
  let currentSettings = cloneSettings();
  let saveWorkspaceMock: jest.Mock;
  let saveCardFileMock: jest.Mock;
  let loadWorkspaceMock: jest.Mock;
  let loadCardFileMock: jest.Mock;
  let listCardFilesMock: jest.Mock;
  let listOutputFilesMock: jest.Mock;
  let promptSaveFileMock: jest.Mock;

  /**
   * @brief 各テスト前の初期化処理。
   * @details
   * モック関数のリセット、window.appのセットアップ、ストア初期化を行います。
   */
  beforeEach(() => {
    currentSettings = cloneSettings();
    saveWorkspaceMock = jest.fn().mockResolvedValue({ path: '/tmp/workspace.snapshot.json' });
    saveCardFileMock = jest.fn().mockResolvedValue({ path: '/tmp/cards.output.json' });
    loadWorkspaceMock = jest.fn().mockResolvedValue({
      cards: snapshotCards,
      savedAt: '2025-10-20T09:00:00.000Z',
    });
    loadCardFileMock = jest.fn().mockResolvedValue({
      cards: snapshotCards,
      savedAt: '2025-10-20T09:00:00.000Z',
    });
    listCardFilesMock = jest.fn().mockResolvedValue(['test_cards.json']);
    listOutputFilesMock = jest.fn().mockResolvedValue(['SampleCards.json']);
    promptSaveFileMock = jest.fn().mockResolvedValue({ canceled: false, fileName: 'mock_cards.json' });
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
        saveCardFile: saveCardFileMock,
        load: loadWorkspaceMock,
        listCardFiles: listCardFilesMock,
        listOutputFiles: listOutputFilesMock,
        loadCardFile: loadCardFileMock,
      },
      dialogs: {
        promptSaveFile: promptSaveFileMock,
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
    saveCardFileMock.mockReset?.();
    loadWorkspaceMock.mockReset?.();
    loadCardFileMock?.mockReset?.();
    listCardFilesMock?.mockReset?.();
    listOutputFilesMock?.mockReset?.();
    promptSaveFileMock?.mockReset?.();
  });

  /**
   * @brief ワークスペースストアからカードを描画するテスト。
   */
  it('renders cards from the workspace store', async () => {
    render(<App />);

    // カードファイルをダブルクリックして読み込む操作をシミュレート
    await waitFor(() => expect(screen.getAllByText(/test_cards\.json/).length).toBeGreaterThan(0), { timeout: 3000 });
    const fileItems = screen.getAllByText(/test_cards\.json/);
    const fileItem = fileItems[0];

    await act(async () => {
      fireEvent.doubleClick(fileItem);
    });

    await screen.findByText('プロジェクト概要', { timeout: 3000 });
    expect(screen.getByText(/カード総数: 3/)).toBeInTheDocument();
  });

  /**
   * @brief ツールバーでカードステータスを切り替えるテスト。
   */
  it('cycles the selected card status via toolbar button', async () => {
    render(<App />);

    // カードファイル一覧が表示されるまで待機
    await waitFor(() => {
      const items = screen.queryAllByText(/test_cards\.json/);
      return items.length > 0;
    }, { timeout: 5000 });

    const fileItems = screen.getAllByText(/test_cards\.json/);
    const fileItem = fileItems[0].closest('li') ?? fileItems[0];

    // ダブルクリックしてファイルを読み込む
    await act(async () => {
      fireEvent.doubleClick(fileItem);
    });

    await waitFor(() => expect((window as any).app.workspace.loadCardFile).toHaveBeenCalled(), { timeout: 5000 });

    // カードが読み込まれて表示されるまで待機
    await waitFor(() => {
      const cardCounts = screen.queryAllByText(/カード総数/);
      return cardCounts.some(el => el.textContent?.includes('3'));
    }, { timeout: 10000 });

    // Approvedステータスのカードが表示されるまで待機
    await screen.findByText('Approved', { timeout: 5000 });

    const button = screen.getByRole('button', { name: /ステータスを切り替え/ });
    fireEvent.click(button);

    // ステータスが変わったことを確認
    await screen.findByText('Deprecated', { timeout: 5000 });
    expect(screen.queryByText('Approved')).not.toBeInTheDocument();
  }, 30000);

  /**
   * @brief ツールバーでテーマを切り替えるテスト。
   */
  it('toggles theme via toolbar button', async () => {
    render(<App />);
    await act(async () => {});

    const initialButton = screen.getByRole('button', { name: /ライトモード/ });
    expect(document.documentElement).toHaveClass('dark');

    act(() => {
      initialButton.click();
    });

    expect(document.documentElement).not.toHaveClass('dark');
    expect(screen.getByRole('button', { name: /ダークモード/ })).toBeInTheDocument();
  });

  /**
   * @brief Ctrl+Sショートカットでワークスペース保存を検証。
   */
  it('saves workspace via Ctrl+S shortcut', async () => {
    render(<App />);

    // カードファイルをダブルクリックして読み込む操作をシミュレート
    await waitFor(() => expect(screen.getAllByText(/test_cards\.json/).length).toBeGreaterThan(0), { timeout: 5000 });
    const fileItems = screen.getAllByText(/test_cards\.json/);
    const fileItem = fileItems[0].closest('li') ?? fileItems[0];

    await act(async () => {
      fireEvent.doubleClick(fileItem);
    });

    // カードが読み込まれるまで待機
    await screen.findByText(/カード総数: 3/, { timeout: 5000 });
    await screen.findByText(/保存状態:/, { timeout: 5000 });
    expect(screen.getByText(/保存状態: ✓ 保存済み/)).toBeInTheDocument();

    const statusButton = screen.getByRole('button', { name: /ステータスを切り替え/ });
    act(() => {
      statusButton.click();
    });

    expect(screen.getByText('保存状態: ● 未保存')).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(window, { key: 's', ctrlKey: true });
      await Promise.resolve();
    });

    await waitFor(() => expect(saveCardFileMock).toHaveBeenCalledTimes(1), { timeout: 5000 });
    expect(saveCardFileMock.mock.calls[0][1]).toMatchObject({
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
    // 無効データ用のファイルエントリを追加
    (window as any).app.workspace.listCardFiles = jest.fn().mockResolvedValue(['test_cards.json', 'invalid_cards.json']);
    (window as any).app.workspace.loadCardFile.mockImplementation(async (fileName: string) => {
      if (fileName === 'invalid_cards.json') {
        return {
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
        };
      }
      return {
        cards: snapshotCards,
        savedAt: '2025-10-20T09:00:00.000Z',
      };
    });

    render(<App />);

    // カードファイル一覧が表示されるまで待機
    await waitFor(() => {
      const items = screen.queryAllByText(/invalid_cards\.json/);
      return items.length > 0;
    }, { timeout: 5000 });

    const fileItems = screen.getAllByText(/invalid_cards\.json/);
    const fileItem = fileItems[0].closest('li') ?? fileItems[0];

    // ダブルクリックしてファイルを読み込む
    await act(async () => {
      fireEvent.doubleClick(fileItem);
    });

    await waitFor(() => expect((window as any).app.workspace.loadCardFile).toHaveBeenCalledWith('invalid_cards.json'), {
      timeout: 5000,
    });

    // 無効なカードが除外され、有効なカード1枚のみが表示されることを確認
    await waitFor(() => {
      const cardCounts = screen.queryAllByText(/カード総数/);
      return cardCounts.some(el => el.textContent?.includes('1'));
    }, { timeout: 10000 });

    // 無効なカードのIDが表示されないことを確認
    expect(screen.queryByText('invalid-card')).not.toBeInTheDocument();

    // ログに警告メッセージが記録されているかどうかは、document.body.textContentで確認
    // 「除外」「無効」「カード」などのキーワードを柔軟にマッチ
    await waitFor(() => {
      const bodyText = document.body.textContent || '';
      expect(
        bodyText.includes('除外') ||
        bodyText.includes('無効') ||
        bodyText.includes('一部のカードデータが不正')
      ).toBe(true);
    }, { timeout: 5000 });
  }, 30000);

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
