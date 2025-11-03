/**
 * @file App.tsx
 * @brief mdsplitterアプリケーションのUIシェル骨格コンポーネント。
 * @details
 * メニューバーからステータスバーまでのレイアウトを構築し、Zustand ベースの
 * グローバルストアからカードダミーデータを取得して表示・更新する。サイドバーと
 * ログエリアはドラッグでリサイズ可能であり、IPC ハンドシェイクやストア操作を
 * ログエントリとして記録する。
 * @author K.Furuichi
 * @date 2025-11-02
 * @version 0.4
 * @copyright MIT
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';

import {
  getNextCardStatus,
  useWorkspaceStore,
  type Card,
  type CardKind,
  type CardStatus,
} from './store/workspaceStore';
import { useUiStore, type ThemeMode } from './store/uiStore';
import { useNotificationStore } from './store/notificationStore';
import {
  collectLeafIds,
  usePanelLayoutStore,
  type PanelLeafNode,
  type SplitDirection,
} from './store/panelLayoutStore';
import type { LogLevel } from '@/shared/settings';
import { CARD_KIND_VALUES, CARD_STATUS_SEQUENCE } from '@/shared/workspace';
import type { WorkspaceSnapshot } from '@/shared/workspace';

import './styles.css';
import { NotificationCenter } from './components/NotificationCenter';
import { SplitView, type LeafRenderHelpers } from './components/SplitView';

/** サイドバー幅のデフォルト (px)。 */
const SIDEBAR_DEFAULT = 240;
/** サイドバー幅の下限 (px)。 */
const SIDEBAR_MIN = 180;
/** サイドバー幅の上限 (px)。 */
const SIDEBAR_MAX = 480;
/** ログエリア高さのデフォルト (px)。 */
const LOG_DEFAULT = 112;
/** ログエリア高さの下限 (px)。 */
const LOG_MIN = 80;
/** ログエリア高さ調整時に確保するメイン領域の最小高さ (px)。 */
const MAIN_MIN_HEIGHT = 280;
/** 垂直セパレータ幅 (px)。 */
const V_SEPARATOR = 4;
/** 水平セパレータ高さ (px)。 */
const H_SEPARATOR = 4;

/** ステータスラベル表示用マッピング。 */
const CARD_STATUS_LABEL: Record<CardStatus, string> = {
  draft: 'Draft',
  review: 'Review',
  approved: 'Approved',
  deprecated: 'Deprecated',
};

/** ステータスバッジ用クラス名マッピング。 */
const CARD_STATUS_CLASS: Record<CardStatus, string> = {
  draft: 'card__status card__status--draft',
  review: 'card__status card__status--review',
  approved: 'card__status card__status--approved',
  deprecated: 'card__status card__status--deprecated',
};

/** カード種別に応じたアイコン。 */
const CARD_KIND_ICON: Record<CardKind, string> = {
  heading: '🔖',
  paragraph: '📝',
  bullet: '📍',
  figure: '📊',
  table: '📅',
  test: '🧪',
  qa: '💬',
};

/**
 * @brief トレース接合点の記号を返す。
 * @param hasTrace トレース有無。
 * @return 表示記号。
 */
const connectorSymbol = (hasTrace: boolean): string => (hasTrace ? '●' : '○');

/**
 * @brief ISO8601日時文字列をローカライズして表示する。
 * @param value ISO8601文字列。
 * @return ローカライズした日時文字列。
 */
const formatUpdatedAt = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '---';
  }
  return date.toLocaleString();
};

/**
 * @brief カードIDから `#001` 形式の番号を生成する。
 * @param cards カード配列。
 * @param id 対象ID。
 * @return ゼロ埋め番号文字列。
 */
const toDisplayNumber = (cards: Card[], id: string | null): string => {
  if (!id) {
    return '--';
  }
  const index = cards.findIndex((card) => card.id === id);
  if (index === -1) {
    return '--';
  }
  return `#${String(index + 1).padStart(3, '0')}`;
};

/** ログエントリ構造体。 */
type LogEntry = {
  id: string; ///< 一意識別子。
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'; ///< ログレベル。
  message: string; ///< メッセージ本文。
  timestamp: Date; ///< 記録時刻。
};

const toLogLevel = (level: LogEntry['level']): LogLevel => level.toLowerCase() as LogLevel;

/**
 * @brief 数値を指定範囲内に収める。
 * @param value 入力値。
 * @param minimum 下限値。
 * @param maximum 上限値。
 * @return 範囲内に収めた値。
 */
const clamp = (value: number, minimum: number, maximum: number): number => {
  //! clamp 演算: 最小値と最大値の間に収める
  return Math.min(Math.max(value, minimum), maximum);
};

/**
 * @brief React レンダラーメインコンポーネント。
 * @details
 * 起動時にメインプロセスへ ping を送信し、レイアウト骨格とログビューを初期化する。
 * Zustand ストアからカード情報を取得して描画し、カード選択及びステータス更新操作に
 * 追随して UI を更新する。
 * @return アプリケーションシェルの JSX。
 */
export const App = () => {
  const workspaceRef = useRef<HTMLDivElement | null>(null); ///< ワークスペース全体。
  const contentRef = useRef<HTMLDivElement | null>(null); ///< サイドバー+カード領域。
  const searchInputRef = useRef<HTMLInputElement | null>(null); ///< 検索入力フィールド。
  const [sidebarWidth, setSidebarWidth] = useState<number>(SIDEBAR_DEFAULT); ///< サイドバー幅。
  const [logHeight, setLogHeight] = useState<number>(LOG_DEFAULT); ///< ログエリア高さ。
  const [dragTarget, setDragTarget] = useState<'sidebar' | 'log' | null>(null); ///< ドラッグ中ターゲット。
  const [ipcStatus, setIpcStatus] = useState<string>('起動準備中...'); ///< IPC 状態メッセージ。
  const [logs, setLogs] = useState<LogEntry[]>(() => [
    {
      id: 'startup',
      level: 'INFO',
      message: 'UIシェルを初期化しました。',
      timestamp: new Date(),
    },
  ]);

  const [isDirty, setDirty] = useState<boolean>(false); ///< 未保存状態フラグ。
  const [isSaving, setSaving] = useState<boolean>(false); ///< 保存処理中フラグ。
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null); ///< 最終保存時刻。
  const cards = useWorkspaceStore((state) => state.cards);
  const selectedCardId = useWorkspaceStore((state) => state.selectedCardId);
  const selectCard = useWorkspaceStore((state) => state.selectCard);
  const cycleCardStatus = useWorkspaceStore((state) => state.cycleCardStatus);
  const hydrateWorkspace = useWorkspaceStore((state) => state.hydrate);
  const resetWorkspace = useWorkspaceStore((state) => state.reset);
  const splitActiveLeaf = usePanelLayoutStore((state) => state.splitActiveLeaf);
  const theme = useUiStore((state) => state.theme);
  const setThemeStore = useUiStore((state) => state.setTheme);
  const notify = useNotificationStore((state) => state.add);
  const [isExplorerOpen, setExplorerOpen] = useState<boolean>(true); ///< エクスプローラ折畳状態。
  const [isSearchOpen, setSearchOpen] = useState<boolean>(true); ///< 検索パネル折畳状態。
  const hasInitializedCards = useRef<boolean>(false); ///< 初期カードロード判定。

  const allowedStatuses = useMemo(() => new Set<CardStatus>(CARD_STATUS_SEQUENCE), []);
  const allowedKinds = useMemo(() => new Set<CardKind>(CARD_KIND_VALUES as CardKind[]), []);

  const sanitizeSnapshotCards = useCallback(
    (input: Card[]) => {
      const validCards: Card[] = [];
      const invalidMessages: string[] = [];

      input.forEach((card, index) => {
        if (!card || typeof card !== 'object') {
          invalidMessages.push(`index ${index}: カードデータが不正です`);
          return;
        }

        const cardId = typeof card.id === 'string' && card.id.trim() !== '' ? card.id : `index ${index}`;

        if (typeof card.id !== 'string' || card.id.trim() === '') {
          invalidMessages.push(`${cardId}: ID が空です`);
          return;
        }

        if (typeof card.title !== 'string' || card.title.trim() === '') {
          invalidMessages.push(`${cardId}: タイトルが空です`);
          return;
        }

        if (!allowedStatuses.has(card.status as CardStatus)) {
          invalidMessages.push(`${cardId}: 不正なステータス (${String(card.status)})`);
          return;
        }

        if (!allowedKinds.has(card.kind as CardKind)) {
          invalidMessages.push(`${cardId}: 不正なカード種別 (${String(card.kind)})`);
          return;
        }

        if (typeof card.body !== 'string') {
          invalidMessages.push(`${cardId}: 本文が文字列ではありません`);
          return;
        }

        if (typeof card.hasLeftTrace !== 'boolean' || typeof card.hasRightTrace !== 'boolean') {
          invalidMessages.push(`${cardId}: トレースフラグが不正です`);
          return;
        }

        if (typeof card.updatedAt !== 'string' || Number.isNaN(Date.parse(card.updatedAt))) {
          invalidMessages.push(`${cardId}: 更新日時が不正です`);
          return;
        }

        validCards.push(card);
      });

      return { validCards, invalidMessages };
    },
    [allowedKinds, allowedStatuses],
  );

  const selectedCard = useMemo<Card | null>(() => {
    return cards.find((card) => card.id === selectedCardId) ?? null;
  }, [cards, selectedCardId]);

  useEffect(() => {
    if (!hasInitializedCards.current) {
      hasInitializedCards.current = true;
      return;
    }
    setDirty(true);
  }, [cards]);

  /**
   * @brief ログエントリを追加する。
   * @param entry 追加するログ。
   */
  const pushLog = useCallback((entry: LogEntry): void => {
    setLogs((current) => [...current, entry]);
    if (window.app?.log) {
      void window.app.log(toLogLevel(entry.level), entry.message).catch((error) => {
        console.error('[renderer] failed to persist log', error);
      });
    }
  }, []);

  useEffect(() => {
    /**
     * @brief メインプロセスとのハンドシェイクを実行する。
     * @details
     * Electron IPC が未定義の場合は警告ログを残して終了する。
     */
    const bootstrap = async () => {
      const maybeApp = (window as Window & { app?: Window['app'] }).app; //! JSDOM 実行時の undefined を許容
      if (!maybeApp?.ping) {
        setIpcStatus('メインプロセスIPC未検出');
        pushLog({
          id: 'ipc-missing',
          level: 'WARN',
          message: 'window.app.ping が未定義のため、IPC ハンドシェイクをスキップしました。',
          timestamp: new Date(),
        });
        return;
      }

      try {
        setIpcStatus('ハンドシェイク送信中...'); //! 状態更新
        const result = await maybeApp.ping('renderer-ready'); //! メインプロセスへ Ping
        setIpcStatus('メインプロセスと接続済み'); //! 正常終了
        pushLog({
          id: 'ipc-success',
          level: 'INFO',
          message: `メインプロセスが ${new Date(result.timestamp).toLocaleTimeString()} に応答しました。`,
          timestamp: new Date(result.timestamp),
        });
      } catch (error) {
        console.error('[renderer] handshake failed', error); //! エラー内容を出力
        setIpcStatus('メインプロセスとの接続に失敗しました'); //! 状態を失敗に更新
        pushLog({
          id: 'ipc-failed',
          level: 'ERROR',
          message: 'IPC ハンドシェイクに失敗しました。コンソールログを確認してください。',
          timestamp: new Date(),
        });
      }
    };

    void bootstrap(); //! 副作用内で非同期処理を起動
  }, [pushLog]);

  useEffect(() => {
    const applySettings = async () => {
      if (!window.app?.settings) {
        pushLog({
          id: `settings-missing-${Date.now()}`,
          level: 'WARN',
          message: '設定APIが未定義のため、既定値を使用します。',
          timestamp: new Date(),
        });
        return;
      }

      try {
        const settings = await window.app.settings.load();
        const resolvedTheme: ThemeMode = settings.theme.mode === 'system'
          ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : (settings.theme.mode === 'dark' ? 'dark' : 'light');

        setThemeStore(resolvedTheme);
        notify('success', `設定を読み込みました (テーマ: ${settings.theme.mode}).`);
        pushLog({
          id: `settings-loaded-${Date.now()}`,
          level: 'INFO',
          message: `設定を読み込みました (テーマ: ${settings.theme.mode}).`,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('[renderer] failed to load settings', error);
        notify('error', '設定の読込に失敗しました。コンソールログを確認してください。');
        pushLog({
          id: `settings-load-failed-${Date.now()}`,
          level: 'ERROR',
          message: '設定の読込に失敗しました。コンソールログを確認してください。',
          timestamp: new Date(),
        });
      }
    };

    void applySettings();
  }, [pushLog, setThemeStore]);

  useEffect(() => {
    const loadWorkspace = async () => {
      const loadApi = window.app?.workspace?.load;
      if (!loadApi) {
        pushLog({
          id: `workspace-load-missing-${Date.now()}`,
          level: 'WARN',
          message: 'workspace.load API が未定義のため、ダミーカードを表示します。',
          timestamp: new Date(),
        });
        return;
      }

      try {
        const snapshot = await loadApi();
        if (!snapshot || !Array.isArray(snapshot.cards)) {
          pushLog({
            id: `workspace-load-empty-${Date.now()}`,
            level: 'INFO',
            message: '保存済みスナップショットが見つからないため、ダミーカードを表示します。',
            timestamp: new Date(),
          });
          return;
        }

        const { validCards, invalidMessages } = sanitizeSnapshotCards(snapshot.cards);
        const savedAtDate =
          snapshot.savedAt && !Number.isNaN(Date.parse(snapshot.savedAt))
            ? new Date(snapshot.savedAt)
            : null;
        const savedAtIssue = Boolean(snapshot.savedAt && !savedAtDate);

        if (validCards.length === 0) {
          hasInitializedCards.current = false;
          resetWorkspace();
          setDirty(false);
          setSaving(false);
          setLastSavedAt(null);
          notify('error', '保存済みデータに有効なカードが存在しなかったため、初期状態に戻しました。');
          pushLog({
            id: `workspace-load-invalid-${Date.now()}`,
            level: 'ERROR',
            message: '保存済みスナップショットに有効なカードが存在しなかったため、初期状態を維持しました。',
            timestamp: new Date(),
          });
          if (invalidMessages.length > 0) {
            pushLog({
              id: `workspace-load-invalid-list-${Date.now()}`,
              level: 'WARN',
              message: `除外理由: ${invalidMessages.join(' / ')}`,
              timestamp: new Date(),
            });
          }
          return;
        }

        hasInitializedCards.current = false;
        hydrateWorkspace(validCards);
        setDirty(false);
        setSaving(false);
        setLastSavedAt(savedAtDate);

        const issues: string[] = [];
        if (invalidMessages.length > 0) {
          issues.push(`無効カード ${invalidMessages.length} 件`);
        }
        if (savedAtIssue) {
          issues.push('保存時刻が不正');
        }

        const notifyLevel = issues.length > 0 ? 'warning' : 'success';
        let notifyMessage = issues.length > 0
          ? `保存済みワークスペースを読み込みました (${issues.join(' / ')})。`
          : '保存済みワークスペースを読み込みました。';
        notify(notifyLevel, notifyMessage);

        const logLevel = issues.length > 0 ? 'WARN' : 'INFO';
        pushLog({
          id: `workspace-loaded-${Date.now()}`,
          level: logLevel,
          message: notifyMessage,
          timestamp: new Date(),
        });

        if (invalidMessages.length > 0) {
          pushLog({
            id: `workspace-invalid-cards-${Date.now()}`,
            level: 'WARN',
            message: `除外したカード: ${invalidMessages.join(' / ')}`,
            timestamp: new Date(),
          });
        }
      } catch (error) {
        console.error('[renderer] failed to load workspace snapshot', error);
        notify('error', 'ワークスペースの読込に失敗しました。ログを確認してください。');
        pushLog({
          id: `workspace-load-failed-${Date.now()}`,
          level: 'ERROR',
          message: 'ワークスペースの読込に失敗しました。コンソールログを確認してください。',
          timestamp: new Date(),
        });
      }
    };

    void loadWorkspace();
  }, [hydrateWorkspace, notify, pushLog, resetWorkspace, sanitizeSnapshotCards]);

  useEffect(() => {
    //! Tailwind ダークモード切替のため、html 要素へ `dark` クラスを付与する
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  /**
   * @brief カードを選択する。
   * @param card 対象カード。
   */
  const handleCardSelect = useCallback(
    (card: Card) => {
      if (card.id === selectedCardId) {
        return;
      }
      selectCard(card.id);
      pushLog({
        id: `select-${card.id}-${Date.now()}`,
        level: 'INFO',
        message: `カード「${card.title}」を選択しました。`,
        timestamp: new Date(),
      });
    },
    [pushLog, selectCard, selectedCardId],
  );

  /**
   * @brief キーボード操作でカードを選択する。
   * @param event キーイベント。
   * @param card 対象カード。
   */
  const handleCardKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, card: Card) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
      handleCardSelect(card);
    },
    [handleCardSelect],
  );

  /**
   * @brief 選択カードのステータスを次段へ遷移させる。
   */
  const handleCycleStatus = useCallback(() => {
    if (!selectedCard) {
      pushLog({
        id: `cycle-missing-${Date.now()}`,
        level: 'WARN',
        message: 'ステータス更新対象のカードが選択されていません。',
        timestamp: new Date(),
      });
      return;
    }

    const nextStatus = getNextCardStatus(selectedCard.status);
    cycleCardStatus(selectedCard.id);
    pushLog({
      id: `cycle-${selectedCard.id}-${Date.now()}`,
      level: 'INFO',
      message: `カード「${selectedCard.title}」のステータスを ${CARD_STATUS_LABEL[nextStatus]} に変更しました。`,
      timestamp: new Date(),
    });
  }, [cycleCardStatus, pushLog, selectedCard]);

  /**
   * @brief テーマを切り替える。
   */
  const handleThemeToggle = useCallback(() => {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setThemeStore(nextTheme);

    if (window.app?.settings) {
      void window.app.settings
        .update({ theme: { mode: nextTheme } })
        .catch((error) => {
          console.error('[renderer] failed to update settings', error);
          notify('error', '設定の保存に失敗しました。コンソールログを確認してください。');
          pushLog({
            id: `settings-update-failed-${Date.now()}`,
            level: 'ERROR',
            message: '設定の保存に失敗しました。コンソールログを確認してください。',
            timestamp: new Date(),
          });
        });
    }

    notify('success', `テーマを ${nextTheme === 'dark' ? 'ダークモード' : 'ライトモード'} に切り替えました。`);
    pushLog({
      id: `theme-${Date.now()}`,
      level: 'INFO',
      message: `テーマを ${nextTheme === 'dark' ? 'ダークモード' : 'ライトモード'} に切り替えました。`,
      timestamp: new Date(),
    });
  }, [notify, pushLog, setThemeStore, theme]);

  /**
   * @brief ワークスペースを保存する。
   */
  const handleSave = useCallback(async () => {
    if (isSaving) {
      notify('info', '保存処理が進行中です。');
      return;
    }

    if (!isDirty) {
      const now = new Date();
      notify('info', '保存対象の変更はありません。');
      pushLog({
        id: `save-skip-${now.valueOf()}`,
        level: 'INFO',
        message: '保存操作を実行しましたが未保存の変更はありませんでした。',
        timestamp: now,
      });
      return;
    }

    const saveApi = window.app?.workspace?.save;
    if (!saveApi) {
      const now = new Date();
      notify('error', '保存APIが利用できません。再起動後に再試行してください。');
      pushLog({
        id: `save-missing-${now.valueOf()}`,
        level: 'ERROR',
        message: 'workspace.save API が未定義のため保存を実行できませんでした。',
        timestamp: now,
      });
      return;
    }

    const startedAt = new Date();
    setSaving(true);
    try {
      const snapshot: WorkspaceSnapshot = {
        cards,
        savedAt: startedAt.toISOString(),
      };

      const result = await saveApi(snapshot);
      setDirty(false);
      setLastSavedAt(startedAt);
      notify('success', 'ワークスペースを保存しました。');
      pushLog({
        id: `save-${startedAt.valueOf()}`,
        level: 'INFO',
        message: `ワークスペースを保存しました (出力: ${result?.path ?? '不明'})。`,
        timestamp: startedAt,
      });
    } catch (error) {
      console.error('[renderer] failed to save workspace', error);
      const failedAt = new Date();
      notify('error', 'ワークスペースの保存に失敗しました。ログを確認してください。');
      pushLog({
        id: `save-failed-${failedAt.valueOf()}`,
        level: 'ERROR',
        message: 'ワークスペースの保存に失敗しました。コンソールログを確認してください。',
        timestamp: failedAt,
      });
    } finally {
      setSaving(false);
    }
  }, [cards, isDirty, isSaving, notify, pushLog]);

  /**
   * @brief アクティブパネルを分割する。
   * @param direction 分割方向。
   */
  const handleSplitPanel = useCallback(
    (direction: SplitDirection) => {
      const before = collectLeafIds(usePanelLayoutStore.getState().root).length;
      splitActiveLeaf(direction);
      const after = collectLeafIds(usePanelLayoutStore.getState().root).length;
      if (after === before) {
        return;
      }
      const label = direction === 'vertical' ? '垂直' : '水平';
      const now = new Date();
      notify('info', `パネルを${label}分割しました。`);
      pushLog({
        id: `split-${direction}-${now.valueOf()}`,
        level: 'INFO',
        message: `パネルを${label}分割しました。`,
        timestamp: now,
      });
    },
    [notify, pushLog, splitActiveLeaf],
  );

  /**
   * @brief 検索パネルを開いて検索欄へフォーカスする。
   */
  const openSearchPanel = useCallback(() => {
    const focusInput = () => {
      window.setTimeout(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }, 0);
    };

    if (!isSearchOpen) {
      setSearchOpen(true);
      const now = new Date();
      notify('info', '検索パネルを表示しました。');
      pushLog({
        id: `search-open-${now.valueOf()}`,
        level: 'INFO',
        message: '検索パネルを表示しました。',
        timestamp: now,
      });
      focusInput();
      return;
    }

    focusInput();
  }, [isSearchOpen, notify, pushLog]);

  /** サイドバーとカード領域の列レイアウトスタイル。 */
  const contentStyle = useMemo<CSSProperties>(() => {
    return {
      gridTemplateColumns: `${sidebarWidth}px ${V_SEPARATOR}px minmax(0, 1fr)`,
    } satisfies CSSProperties;
  }, [sidebarWidth]);

  /** ワークスペースの行レイアウトスタイル。 */
  const workspaceStyle = useMemo<CSSProperties>(() => {
    return {
      gridTemplateRows: `minmax(${MAIN_MIN_HEIGHT}px, 1fr) ${H_SEPARATOR}px ${logHeight}px`,
    } satisfies CSSProperties;
  }, [logHeight]);

  /**
   * @brief サイドバーのリサイズ開始処理。
   * @param event PointerDown イベント。
   */
  const handleSidebarPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragTarget('sidebar');
    },
    [],
  );

  /**
   * @brief サイドバーのリサイズ処理。
   * @param event PointerMove イベント。
   */
  const handleSidebarPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (dragTarget !== 'sidebar') {
        return;
      }

      const host = contentRef.current;
      if (!host) {
        return;
      }

      const rect = host.getBoundingClientRect();
      const next = clamp(event.clientX - rect.left - V_SEPARATOR / 2, SIDEBAR_MIN, SIDEBAR_MAX);
      setSidebarWidth(next);
    },
    [dragTarget],
  );

  /**
   * @brief サイドバーのリサイズ終了処理。
   * @param event PointerUp イベント。
   */
  const handleSidebarPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (dragTarget !== 'sidebar') {
        return;
      }

      event.currentTarget.releasePointerCapture(event.pointerId);
      setDragTarget(null);
    },
    [dragTarget],
  );

  /**
   * @brief ログエリアのリサイズ開始処理。
   * @param event PointerDown イベント。
   */
  const handleLogPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragTarget('log');
    },
    [],
  );

  /**
   * @brief ログエリアのリサイズ処理。
   * @param event PointerMove イベント。
   */
  const handleLogPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (dragTarget !== 'log') {
        return;
      }

      const host = workspaceRef.current;
      if (!host) {
        return;
      }

      const rect = host.getBoundingClientRect();
      const available = rect.height - H_SEPARATOR - MAIN_MIN_HEIGHT;
      const maxHeight = Math.max(LOG_MIN, available);
      const offset = rect.bottom - event.clientY - H_SEPARATOR / 2;
      const next = clamp(offset, LOG_MIN, maxHeight);
      setLogHeight(next);
    },
    [dragTarget],
  );

  /**
   * @brief ログエリアのリサイズ終了処理。
   * @param event PointerUp イベント。
   */
  const handleLogPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (dragTarget !== 'log') {
        return;
      }

      event.currentTarget.releasePointerCapture(event.pointerId);
      setDragTarget(null);
    },
    [dragTarget],
  );

  const cardCount = cards.length;
  const selectedDisplayNumber = toDisplayNumber(cards, selectedCardId);
  const themeLabel = theme === 'dark' ? 'ダークモード' : 'ライトモード';
  const themeButtonLabel = theme === 'dark' ? '☀️ ライトモード' : '🌙 ダークモード';
  const saveStatusText = isSaving
    ? '保存状態: ⏳ 保存中...'
    : isDirty
      ? '保存状態: ● 未保存'
      : `保存状態: ✓ 保存済み${lastSavedAt ? ` (${lastSavedAt.toLocaleTimeString()})` : ''}`;

  const handleExplorerToggle = useCallback(() => {
    setExplorerOpen((prev) => !prev);
  }, []);

  const handleSearchToggle = useCallback(() => {
    if (isSearchOpen) {
      setSearchOpen(false);
      const now = new Date();
      notify('info', '検索パネルを非表示にしました。');
      pushLog({
        id: `search-close-${now.valueOf()}`,
        level: 'INFO',
        message: '検索パネルを非表示にしました。',
        timestamp: now,
      });
      return;
    }
    openSearchPanel();
  }, [isSearchOpen, notify, openSearchPanel, pushLog]);

  const renderPanelLeaf = useCallback(
    (_leaf: PanelLeafNode, { isActive }: LeafRenderHelpers) => {
      const nodeClass = `split-node${isActive ? ' split-node--active' : ''}`;
      return (
        <div className={nodeClass} role="group" aria-label="カードパネル">
          <div className="tab-bar">
            <button type="button" className="tab-bar__tab tab-bar__tab--active">📄 overview.md</button>
            <button type="button" className="tab-bar__tab">📄 detail.md ●</button>
            <button type="button" className="tab-bar__tab">➕</button>
          </div>

          <div className="panel-toolbar">
            <div className="panel-toolbar__group">
              <button type="button" className="panel-toolbar__button">⏬ 展開</button>
              <button type="button" className="panel-toolbar__button">⏫ 折畳</button>
            </div>
            <div className="panel-toolbar__group">
              <input className="panel-toolbar__input" placeholder="👓 文字列フィルタ" />
              <button type="button" className="panel-toolbar__button">📚 カード種別</button>
              <button type="button" className="panel-toolbar__button">🧐 トレースのみ</button>
            </div>
            <div className="panel-toolbar__group">
              <button type="button" className="panel-toolbar__button">☰ コンパクト</button>
            </div>
            <div className="panel-toolbar__spacer" />
            <div className="panel-toolbar__meta">カード総数: {cardCount}</div>
          </div>

          <div className="panel-cards" role="list">
            {cards.map((card) => {
              const isActiveCard = card.id === selectedCardId;
              const leftConnectorClass = `card__connector${card.hasLeftTrace ? ' card__connector--active' : ''}`;
              const rightConnectorClass = `card__connector${card.hasRightTrace ? ' card__connector--active' : ''}`;
              return (
                <article
                  key={card.id}
                  className={`card${isActiveCard ? ' card--active' : ''}`}
                  aria-selected={isActiveCard}
                  role="listitem"
                  tabIndex={0}
                  onClick={() => handleCardSelect(card)}
                  onKeyDown={(event) => handleCardKeyDown(event, card)}
                >
                  <header className="card__header">
                    <span className={leftConnectorClass}>{connectorSymbol(card.hasLeftTrace)}</span>
                    <span className="card__icon">{CARD_KIND_ICON[card.kind]}</span>
                    <span className={CARD_STATUS_CLASS[card.status]}>{CARD_STATUS_LABEL[card.status]}</span>
                    <span className="card__title">{card.title}</span>
                    <span className={rightConnectorClass}>{connectorSymbol(card.hasRightTrace)}</span>
                  </header>
                  <p className="card__body">{card.body}</p>
                  <footer className="card__footer">最終更新: {formatUpdatedAt(card.updatedAt)}</footer>
                </article>
              );
            })}
          </div>
        </div>
      );
    },
    [cardCount, cards, handleCardKeyDown, handleCardSelect, selectedCardId],
  );

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const platform = window.navigator?.platform ?? '';
      const isMac = platform.toLowerCase().includes('mac');
      const primaryPressed = isMac ? event.metaKey : event.ctrlKey;

      if (!primaryPressed) {
        return;
      }

      if (event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === 's' && !event.shiftKey) {
        event.preventDefault();
        void handleSave();
        return;
      }

      if (key === 'f' && !event.shiftKey) {
        event.preventDefault();
        openSearchPanel();
        return;
      }

      if (event.key === '\\' && !event.shiftKey) {
        event.preventDefault();
        handleSplitPanel('vertical');
        return;
      }

      if ((event.key === '\\' && event.shiftKey) || event.key === '|') {
        event.preventDefault();
        handleSplitPanel('horizontal');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleSplitPanel, openSearchPanel]);

  return (
    <div className="app-shell" data-dragging={dragTarget ? 'true' : 'false'}>
      <NotificationCenter />
      <header className="menu-bar" role="menubar">
        <nav className="menu-bar__items">
          <button className="menu-bar__item" type="button">ファイル(F)</button>
          <button className="menu-bar__item" type="button">編集(E)</button>
          <button className="menu-bar__item" type="button">表示(V)</button>
          <button className="menu-bar__item" type="button">ヘルプ(H)</button>
        </nav>
      </header>

      <section className="top-toolbar" aria-label="グローバルツールバー">
        <div className="toolbar-group">
          <button type="button" className="toolbar-button">📂 開く</button>
          <button
            type="button"
            className="toolbar-button"
            onClick={() => {
              void handleSave();
            }}
            disabled={isSaving}
            aria-disabled={isSaving}
          >
            💾 保存
          </button>
        </div>
        <div className="toolbar-group">
          <button type="button" className="toolbar-button">⛓️ トレース</button>
          <button type="button" className="toolbar-button">種別フィルタ</button>
          <button type="button" className="toolbar-button" onClick={handleCycleStatus}>
            🔄 ステータス切替
          </button>
        </div>
        <div className="toolbar-group">
          <button
            type="button"
            className="toolbar-button"
            onClick={() => handleSplitPanel('horizontal')}
          >
            ⇅ 水平分割
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={() => handleSplitPanel('vertical')}
          >
            ⇆ 垂直分割
          </button>
        </div>
        <div className="toolbar-spacer" />
        <div className="toolbar-group toolbar-group--right">
          <button type="button" className="toolbar-button" onClick={handleThemeToggle}>
            {themeButtonLabel}
          </button>
        </div>
      </section>

      <section
        className="workspace"
        ref={workspaceRef}
        style={workspaceStyle}
        aria-label="コンテンツワークスペース"
      >
        <div className="workspace__content" ref={contentRef} style={contentStyle}>
          <aside className="sidebar" aria-label="エクスプローラと検索">
            <div className="sidebar__section">
              <button
                type="button"
                className="sidebar__section-toggle"
                onClick={handleExplorerToggle}
                aria-expanded={isExplorerOpen}
                aria-controls="sidebar-explorer"
              >
                <span className="sidebar__toggle-icon">{isExplorerOpen ? '▾' : '▸'}</span>
                <span className="sidebar__header">エクスプローラ</span>
              </button>
              <div
                id="sidebar-explorer"
                className={`sidebar__content${isExplorerOpen ? '' : ' sidebar__content--collapsed'}`}
                role="region"
                aria-hidden={!isExplorerOpen}
              >
                <ul className="sidebar__tree" role="tree">
                  <li role="treeitem" aria-expanded="true">
                    📁 requirements
                    <ul role="group">
                      <li role="treeitem">📄 system.md</li>
                      <li role="treeitem">📄 ui.md</li>
                    </ul>
                  </li>
                  <li role="treeitem">📁 outputs</li>
                </ul>
              </div>
            </div>
            <div className="sidebar__section sidebar__section--search">
              <button
                type="button"
                className="sidebar__section-toggle"
                onClick={handleSearchToggle}
                aria-expanded={isSearchOpen}
                aria-controls="sidebar-search-panel"
              >
                <span className="sidebar__toggle-icon">{isSearchOpen ? '▾' : '▸'}</span>
                <span className="sidebar__header">検索</span>
              </button>
              <div
                id="sidebar-search-panel"
                className={`sidebar__content sidebar__content--search${isSearchOpen ? '' : ' sidebar__content--collapsed'}`}
                role="region"
                aria-hidden={!isSearchOpen}
              >
                <label className="sidebar__label" htmlFor="sidebar-search">
                  🔍 検索
                </label>
                <input
                  id="sidebar-search"
                  ref={searchInputRef}
                  className="sidebar__search"
                  type="search"
                  placeholder="キーワードを入力"
                />
              </div>
            </div>
          </aside>

          <div
            className="workspace__separator workspace__separator--vertical"
            role="separator"
            aria-orientation="vertical"
            aria-valuemin={SIDEBAR_MIN}
            aria-valuemax={SIDEBAR_MAX}
            aria-valuenow={sidebarWidth}
            onPointerDown={handleSidebarPointerDown}
            onPointerMove={handleSidebarPointerMove}
            onPointerUp={handleSidebarPointerUp}
          />

          <section className="panels" aria-label="カードパネル領域">
            <SplitView renderLeaf={renderPanelLeaf} />
          </section>
        </div>

        <div
          className="workspace__separator workspace__separator--horizontal"
          role="separator"
          aria-orientation="horizontal"
          aria-valuemin={LOG_MIN}
          aria-valuemax={999}
          aria-valuenow={Math.round(logHeight)}
          onPointerDown={handleLogPointerDown}
          onPointerMove={handleLogPointerMove}
          onPointerUp={handleLogPointerUp}
        />

        <section className="log-area" aria-label="動作ログ">
          <header className="log-area__header">
            <span>動作ログ</span>
            <button
              type="button"
              className="log-area__clear"
              onClick={() =>
                setLogs([
                  {
                    id: `log-clear-${Date.now()}`,
                    level: 'INFO',
                    message: 'ログをクリアしました。',
                    timestamp: new Date(),
                  },
                ])
              }
            >
              クリア
            </button>
          </header>
          <pre className="log-area__body" aria-live="polite">
            {logs.map((entry) => (
              <span key={entry.id}>
                {`[${entry.timestamp.toLocaleString()}] ${entry.level}: ${entry.message}`}
                {'\n'}
              </span>
            ))}
          </pre>
        </section>
      </section>

      <footer className="status-bar" aria-label="ステータスバー">
        <div className="status-bar__section">
          <span>総カード数: {cardCount}</span>
          <span>選択カード: {selectedDisplayNumber}</span>
          <span>{saveStatusText}</span>
        </div>
        <div className="status-bar__section status-bar__section--right">
          <span>文字コード: UTF-8</span>
          <span>テーマ: {themeLabel}</span>
          <span>接続状態: {ipcStatus}</span>
        </div>
      </footer>
    </div>
  );
};
