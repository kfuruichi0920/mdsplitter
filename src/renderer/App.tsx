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
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

import {
  useWorkspaceStore,
  type Card,
  type CardKind,
  type CardStatus,
  type InsertPosition,
} from './store/workspaceStore';
import { useUiStore, type ThemeMode } from './store/uiStore';
import { useNotificationStore } from './store/notificationStore';
import { useSplitStore } from './store/splitStore';
import type { SplitNode } from './store/splitStore';
import type { AppSettings, LogLevel, ThemeModeSetting, ThemeSettings } from '@/shared/settings';
import { defaultSettings } from '@/shared/settings';
import { CARD_KIND_VALUES, CARD_STATUS_SEQUENCE } from '@/shared/workspace';
import type { WorkspaceSnapshot } from '@/shared/workspace';

import './styles.css';
import { NotificationCenter } from './components/NotificationCenter';
import { SplitContainer } from './components/SplitContainer';
import { CardPanel } from './components/CardPanel';
import { SettingsModal, type SettingsSection } from './components/SettingsModal';
import { applyThemeColors, applySplitterWidth } from './utils/themeUtils';

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

const cloneSettings = <T extends unknown>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

const resolveThemeMode = (mode: ThemeModeSetting): ThemeMode => {
  if (mode === 'system') {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode === 'dark' ? 'dark' : 'light';
};

/** ログエントリ構造体。 */
type LogEntry = {
  id: string; ///< 一意識別子。
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'; ///< ログレベル。
  message: string; ///< メッセージ本文。
  timestamp: Date; ///< 記録時刻。
};

const toLogLevel = (level: LogEntry['level']): LogLevel => level.toLowerCase() as LogLevel;

const applyThemeFromSettings = (
  themeConfig: ThemeSettings,
  requestedMode: ThemeModeSetting,
  setThemeStore: (mode: ThemeMode) => void,
) => {
  const resolved = resolveThemeMode(requestedMode);
  setThemeStore(resolved);
  const colors = resolved === 'dark' ? themeConfig.dark : themeConfig.light;
  applyThemeColors(colors);
  applySplitterWidth(themeConfig.splitterWidth);
  return resolved;
};

interface SettingsModalState {
  open: boolean;
  loading: boolean;
  saving: boolean;
  draft: AppSettings | null;
  section: SettingsSection;
  error: string | null;
  validationErrors: Record<string, string>;
}

const createSettingsModalState = (): SettingsModalState => ({
  open: false,
  loading: false,
  saving: false,
  draft: null,
  section: 'theme',
  error: null,
  validationErrors: {},
});

const validateSettingsDraft = (draft: AppSettings | null): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (!draft) {
    errors.general = '設定が読み込まれていません。';
    return errors;
  }

  if (draft.input.maxWarnSizeMB <= 0) {
    errors['input.maxWarnSizeMB'] = '1MB以上に設定してください。';
  }
  if (draft.input.maxAbortSizeMB <= draft.input.maxWarnSizeMB) {
    errors['input.maxAbortSizeMB'] = '中断サイズは警告サイズより大きくしてください。';
  }
  if (draft.logging.maxSizeMB <= 0) {
    errors['logging.maxSizeMB'] = '1MB以上に設定してください。';
  }
  if (draft.logging.maxFiles < 1) {
    errors['logging.maxFiles'] = '1以上の整数を入力してください。';
  }
  if (draft.theme.splitterWidth < 2 || draft.theme.splitterWidth > 12) {
    errors['theme.splitterWidth'] = '分割境界幅は2〜12pxの範囲で指定してください。';
  }

  return errors;
};

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
 * @brief 分割ノードツリーの最初の葉を取得する。
 * @param node 分割ノード。
 * @return 最初に見つかる葉ノードID、存在しなければ null。
 */
const findFirstLeafId = (node: SplitNode | null): string | null => {
  if (!node) {
    return null;
  }
  if (node.type === 'leaf') {
    return node.id;
  }
  return findFirstLeafId(node.first) ?? findFirstLeafId(node.second);
};

const normalizeOutputFileName = (input: string | null | undefined): string | null => {
  if (typeof input !== 'string') {
    return null;
  }
  const trimmed = input.trim();
  if (!trimmed || /[/\\]/.test(trimmed) || trimmed.includes('..')) {
    return null;
  }
  return trimmed.endsWith('.json') ? trimmed : `${trimmed}.json`;
};

const buildDefaultExportName = (): string => {
  const stamp = new Date().toISOString().replace(/[:]/g, '').split('.')[0];
  return `cards_export_${stamp}.json`;
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

  const [isSaving, setSaving] = useState<boolean>(false); ///< 保存処理中フラグ。
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [settingsModalState, setSettingsModalState] = useState<SettingsModalState>(createSettingsModalState);
  const tabs = useWorkspaceStore((state) => state.tabs);
  const leafs = useWorkspaceStore((state) => state.leafs);
  const openTab = useWorkspaceStore((state) => state.openTab);
  const cycleCardStatus = useWorkspaceStore((state) => state.cycleCardStatus);
  const closeLeafWorkspace = useWorkspaceStore((state) => state.closeLeaf);
  const markSaved = useWorkspaceStore((state) => state.markSaved);
  const setActiveTab = useWorkspaceStore((state) => state.setActiveTab);
  const addCard = useWorkspaceStore((state) => state.addCard);
  const deleteCards = useWorkspaceStore((state) => state.deleteCards);
  const copySelection = useWorkspaceStore((state) => state.copySelection);
  const pasteClipboard = useWorkspaceStore((state) => state.pasteClipboard);
  const hasClipboard = useWorkspaceStore((state) => state.hasClipboard);
  const undo = useWorkspaceStore((state) => state.undo);
  const redo = useWorkspaceStore((state) => state.redo);
  const canUndo = useWorkspaceStore((state) => state.canUndo);
  const canRedo = useWorkspaceStore((state) => state.canRedo);
  const renameTabFile = useWorkspaceStore((state) => state.renameTabFile);
  const theme = useUiStore((state) => state.theme);
  const setThemeStore = useUiStore((state) => state.setTheme);
  const notify = useNotificationStore((state) => state.add);
  const splitRoot = useSplitStore((state) => state.root);
  const splitLeaf = useSplitStore((state) => state.splitLeaf);
  const activeLeafId = useSplitStore((state) => state.activeLeafId);
  const setActiveLeaf = useSplitStore((state) => state.setActiveLeaf);
  const [isExplorerOpen, setExplorerOpen] = useState<boolean>(true); ///< エクスプローラ折畳状態。
  const [isSearchOpen, setSearchOpen] = useState<boolean>(true); ///< 検索パネル折畳状態。
  const [cardFiles, setCardFiles] = useState<string[]>([]); ///< カードファイル一覧。

  const allowedStatuses = useMemo(() => new Set<CardStatus>(CARD_STATUS_SEQUENCE), []);
  const allowedKinds = useMemo(() => new Set<CardKind>(CARD_KIND_VALUES as CardKind[]), []);

  const fallbackLeafId = useMemo(() => findFirstLeafId(splitRoot), [splitRoot]);
  const effectiveLeafId = activeLeafId ?? fallbackLeafId;
  const activeTab = useWorkspaceStore(
    useCallback((state) => {
      if (!effectiveLeafId) {
        return null;
      }
      const leaf = state.leafs[effectiveLeafId];
      if (!leaf?.activeTabId) {
        return null;
      }
      return state.tabs[leaf.activeTabId] ?? null;
    }, [effectiveLeafId]),
  );
  const activeTabId = activeTab?.id ?? null;
  const cards = activeTab?.cards ?? [];
  const selectedCardIds = activeTab?.selectedCardIds ?? new Set<string>();
  const selectedCount = selectedCardIds.size;
  const isDirty = activeTab?.isDirty ?? false;
  const lastSavedAt = useMemo(() => {
    if (!activeTab?.lastSavedAt) {
      return null;
    }
    const parsed = new Date(activeTab.lastSavedAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [activeTab?.lastSavedAt]);

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

        //! 階層情報のバリデーション（デフォルト値で補完）
        const parent_id = card.parent_id === null || typeof card.parent_id === 'string' ? card.parent_id : null;
        const child_ids = Array.isArray(card.child_ids) ? card.child_ids : [];
        const prev_id = card.prev_id === null || typeof card.prev_id === 'string' ? card.prev_id : null;
        const next_id = card.next_id === null || typeof card.next_id === 'string' ? card.next_id : null;
        const level = typeof card.level === 'number' ? card.level : 0;

        validCards.push({ ...card, parent_id, child_ids, prev_id, next_id, level });
      });

      return { validCards, invalidMessages };
    },
    [allowedKinds, allowedStatuses],
  );

  const selectedCard = useMemo<Card | null>(() => {
    const firstSelectedId = Array.from(selectedCardIds)[0];
    return cards.find((card) => card.id === firstSelectedId) ?? null;
  }, [cards, selectedCardIds]);

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

  const handleSettingsChange = useCallback((next: AppSettings) => {
    setSettingsModalState((prev) => ({
      ...prev,
      draft: next,
      validationErrors: {},
      error: null,
    }));
  }, []);

  const handleSettingsSectionChange = useCallback((nextSection: SettingsSection) => {
    setSettingsModalState((prev) => ({ ...prev, section: nextSection }));
  }, []);

  const previewThemeSettings = useCallback(
    (mode: ThemeModeSetting, themeSettings: ThemeSettings) => {
      applyThemeFromSettings(themeSettings, mode, setThemeStore);
    },
    [setThemeStore],
  );

  const closeSettingsModal = useCallback(
    (persistTheme: boolean) => {
      setSettingsModalState(createSettingsModalState());
      if (!persistTheme && appSettings) {
        applyThemeFromSettings(appSettings.theme, appSettings.theme.mode, setThemeStore);
      }
    },
    [appSettings, setThemeStore],
  );

  const handleSettingsOpen = useCallback(async () => {
    if (!window.app?.settings) {
      notify('warning', '設定APIが利用できません。');
      return;
    }
    setSettingsModalState({
      ...createSettingsModalState(),
      open: true,
      loading: true,
    });
    try {
      const loaded = await window.app.settings.load();
      setAppSettings(loaded);
      setSettingsModalState({
        ...createSettingsModalState(),
        open: true,
        draft: cloneSettings(loaded),
      });
    } catch (error) {
      console.error('[renderer] failed to open settings', error);
      notify('error', '設定の読み込みに失敗しました。');
      pushLog({
        id: `settings-modal-load-failed-${Date.now()}`,
        level: 'ERROR',
        message: '設定モーダルの読み込みに失敗しました。',
        timestamp: new Date(),
      });
      setSettingsModalState((prev) => ({
        ...prev,
        loading: false,
        error: '設定の読み込みに失敗しました。',
      }));
    }
  }, [notify, pushLog]);

  const handleClearRecent = useCallback(() => {
    setSettingsModalState((prev) => {
      if (!prev.draft || prev.draft.workspace.recentFiles.length === 0) {
        return prev;
      }
      return {
        ...prev,
        draft: {
          ...prev.draft,
          workspace: {
            ...prev.draft.workspace,
            recentFiles: [],
          },
        },
        validationErrors: {},
        error: null,
      };
    });
  }, []);

  const handleSettingsSave = useCallback(async () => {
    if (!window.app?.settings) {
      notify('warning', '設定APIが利用できません。');
      return;
    }
    const draft = settingsModalState.draft;
    const validation = validateSettingsDraft(draft);
    if (Object.keys(validation).length > 0) {
      setSettingsModalState((prev) => ({
        ...prev,
        validationErrors: validation,
        error: '入力内容を確認してください。',
      }));
      return;
    }
    if (!draft) {
      setSettingsModalState((prev) => ({ ...prev, error: '設定が読み込まれていません。' }));
      return;
    }
    setSettingsModalState((prev) => ({ ...prev, saving: true, error: null }));
    try {
      const updated = await window.app.settings.update(draft);
      setAppSettings(updated);
      applyThemeFromSettings(updated.theme, updated.theme.mode, setThemeStore);
      notify('success', '設定を保存しました。');
      pushLog({
        id: `settings-save-${Date.now()}`,
        level: 'INFO',
        message: '設定を保存しました。',
        timestamp: new Date(),
      });
      closeSettingsModal(true);
    } catch (error) {
      console.error('[renderer] failed to save settings', error);
      notify('error', '設定の保存に失敗しました。');
      pushLog({
        id: `settings-save-failed-${Date.now()}`,
        level: 'ERROR',
        message: '設定の保存に失敗しました。',
        timestamp: new Date(),
      });
      setSettingsModalState((prev) => ({ ...prev, saving: false, error: '設定の保存に失敗しました。' }));
    }
  }, [closeSettingsModal, notify, pushLog, setThemeStore, settingsModalState.draft]);

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
        setAppSettings(settings);
        applyThemeFromSettings(settings.theme, settings.theme.mode, setThemeStore);

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
  }, [pushLog, setAppSettings, setThemeStore, notify]);

  // 起動時の自動ファイル読み込みを削除: ユーザーがエクスプローラから選択した時のみ読み込む

  useEffect(() => {
    //! Tailwind ダークモード切替のため、html 要素へ `dark` クラスを付与する
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    //! カードファイル一覧を初期化
    const loadCardFiles = async () => {
      if (!window.app?.workspace?.listCardFiles) {
        return;
      }
      try {
        const files = await window.app.workspace.listCardFiles();
        setCardFiles(files);
        pushLog({
          id: `card-files-loaded-${Date.now()}`,
          level: 'INFO',
          message: `カードファイル一覧を読み込みました: ${files.length}件`,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('[App] failed to load card files', error);
        pushLog({
          id: `card-files-error-${Date.now()}`,
          level: 'ERROR',
          message: 'カードファイル一覧の読み込みに失敗しました',
          timestamp: new Date(),
        });
      }
    };

    void loadCardFiles();
  }, [pushLog]);

  useEffect(() => {
    //! アプリ終了時の未保存変更確認
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const hasUnsavedTabs = Object.values(tabs).some((tab) => tab.isDirty);
      if (hasUnsavedTabs) {
        event.preventDefault();
        event.returnValue = ''; // Chrome requires returnValue to be set
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [tabs]);

  /**
   * @brief ログエントリをプッシュするラッパー（CardPanel に渡す用）。
   * @param level ログレベル。
   * @param message メッセージ。
   */
  const handleLog = useCallback(
    (level: 'INFO' | 'WARN' | 'ERROR', message: string) => {
      pushLog({
        id: `${level.toLowerCase()}-${Date.now()}`,
        level,
        message,
        timestamp: new Date(),
      });
    },
    [pushLog],
  );

  /**
   * @brief パネルクリック時にアクティブ葉ノードを設定する。
   * @param leafId 葉ノードID。
   */
  const handlePanelClick = useCallback(
    (leafId: string) => {
      setActiveLeaf(leafId);
      pushLog({
        id: `panel-activate-${Date.now()}`,
        level: 'DEBUG',
        message: `パネル ${leafId} をアクティブにしました。`,
        timestamp: new Date(),
      });
    },
    [pushLog, setActiveLeaf],
  );

  /**
   * @brief パネルクローズ時に葉ノードを削除する。
   * @param leafId 葉ノードID。
   */
  const handlePanelClose = useCallback(
    (leafId: string) => {
      closeLeafWorkspace(leafId);
      const removeLeaf = useSplitStore.getState().removeLeaf;
      removeLeaf(leafId);
      const now = new Date();
      notify('info', 'パネルを閉じました。');
      pushLog({
        id: `panel-close-${now.valueOf()}`,
        level: 'INFO',
        message: `パネル ${leafId} を閉じました。`,
        timestamp: now,
      });
    },
    [closeLeafWorkspace, notify, pushLog],
  );

  /**
   * @brief カードファイルを読み込んでワークスペースに反映する。
   * @param fileName ファイル名。
   */
  const handleLoadCardFile = useCallback(
    async (fileName: string) => {
      if (!window.app?.workspace?.loadCardFile) {
        notify('error', 'カードファイル読み込み機能が利用できません。');
        return;
      }

      try {
        pushLog({
          id: `load-card-start-${Date.now()}`,
          level: 'INFO',
          message: `カードファイルを読み込んでいます: ${fileName}`,
          timestamp: new Date(),
        });

        const targetLeafId = activeLeafId ?? (splitRoot.type === 'leaf' ? splitRoot.id : null);
        if (!targetLeafId) {
          notify('warning', 'カードファイルを表示できるパネルがありません。対象パネルを選択してください。');
          pushLog({
            id: `load-card-no-leaf-${Date.now()}`,
            level: 'WARN',
            message: `カードファイル ${fileName} を割り当てるパネルがありません。`,
            timestamp: new Date(),
          });
          return;
        }

        // 同じファイルが既に開かれていて未保存変更がある場合は確認
        const existingTab = Object.values(tabs).find((tab) => tab.fileName === fileName);
        if (existingTab?.isDirty) {
          const confirmed = window.confirm(
            `ファイル「${fileName}」は既に開かれており、未保存の変更があります。\n\n再読み込みすると未保存の変更は失われます。続行しますか?`
          );
          if (!confirmed) {
            pushLog({
              id: `load-card-cancelled-${Date.now()}`,
              level: 'INFO',
              message: `ファイル ${fileName} の再読み込みをキャンセルしました。`,
              timestamp: new Date(),
            });
            return;
          }
        }

        const snapshot = await window.app.workspace.loadCardFile(fileName);
        if (!snapshot) {
          notify('error', `カードファイルの読み込みに失敗しました: ${fileName}`);
          pushLog({
            id: `load-card-failed-${Date.now()}`,
            level: 'ERROR',
            message: `カードファイルの読み込みに失敗しました: ${fileName}`,
            timestamp: new Date(),
          });
          return;
        }

        const { validCards, invalidMessages } = sanitizeSnapshotCards(snapshot.cards);

        if (invalidMessages.length > 0) {
          notify('warning', `一部のカードデータが不正です (${invalidMessages.length}件)`);
          pushLog({
            id: `load-card-invalid-${Date.now()}`,
            level: 'WARN',
            message: `無効なカードを除外しました: ${invalidMessages.join(', ')}`,
            timestamp: new Date(),
          });
        }

        const result = openTab(targetLeafId, fileName, validCards, {
          savedAt: snapshot.savedAt,
          title: fileName,
        });

        if (result.status === 'denied') {
          notify('warning', result.reason);
          pushLog({
            id: `load-card-denied-${Date.now()}`,
            level: 'WARN',
            message: result.reason,
            timestamp: new Date(),
          });
          return;
        }

        if (snapshot.savedAt && !Number.isNaN(Date.parse(snapshot.savedAt))) {
          markSaved(result.tabId, snapshot.savedAt);
        }

        notify('success', `カードファイルを読み込みました: ${fileName} (${validCards.length}枚)`);
        pushLog({
          id: `load-card-success-${Date.now()}`,
          level: 'INFO',
          message: `カードファイルを読み込みました: ${fileName} (${validCards.length}枚)`,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('[App] failed to load card file', error);
        notify('error', 'カードファイルの読み込み中にエラーが発生しました。');
        pushLog({
          id: `load-card-error-${Date.now()}`,
          level: 'ERROR',
          message: `カードファイル読み込みエラー: ${fileName}`,
          timestamp: new Date(),
        });
      }
    },
    [activeLeafId, markSaved, notify, openTab, pushLog, sanitizeSnapshotCards, splitRoot, tabs],
  );

  // 起動時の自動ファイル読み込みを削除: ユーザーがエクスプローラから選択した時のみ読み込む

  /**
   * @brief 選択カードのステータスを次段へ遷移させる。
   */
  const handleCycleStatus = useCallback(() => {
    const targetLeafId = effectiveLeafId;
    if (!selectedCard || !targetLeafId || !activeTabId) {
      pushLog({
        id: `cycle-missing-${Date.now()}`,
        level: 'WARN',
        message: 'ステータス更新対象のカードが選択されていません。',
        timestamp: new Date(),
      });
      return;
    }

    const nextStatus = cycleCardStatus(targetLeafId, activeTabId, selectedCard.id);
    if (!nextStatus) {
      pushLog({
        id: `cycle-missing-${Date.now()}`,
        level: 'WARN',
        message: 'ステータス更新対象のカードが見つかりませんでした。',
        timestamp: new Date(),
      });
      return;
    }

    pushLog({
      id: `cycle-${selectedCard.id}-${Date.now()}`,
      level: 'INFO',
      message: `カード「${selectedCard.title}」のステータスを ${nextStatus} に変更しました。`,
      timestamp: new Date(),
    });
  }, [activeTabId, cycleCardStatus, effectiveLeafId, pushLog, selectedCard]);

  /**
   * @brief テーマを切り替える。
   */
  const handleThemeToggle = useCallback(async () => {
    const nextThemeModeSetting: ThemeModeSetting = theme === 'dark' ? 'light' : 'dark';
    const previewTheme = appSettings?.theme ?? defaultSettings.theme;
    applyThemeFromSettings(previewTheme, nextThemeModeSetting, setThemeStore);

    if (!window.app?.settings) {
      notify('warning', '設定APIが利用できません。');
      return;
    }

    try {
      const updated = await window.app.settings.update({
        theme: {
          ...previewTheme,
          mode: nextThemeModeSetting,
        },
      });
      setAppSettings(updated);
      notify('success', `テーマを ${nextThemeModeSetting === 'dark' ? 'ダークモード' : 'ライトモード'} に切り替えました。`);
      pushLog({
        id: `theme-${Date.now()}`,
        level: 'INFO',
        message: `テーマを ${nextThemeModeSetting === 'dark' ? 'ダークモード' : 'ライトモード'} に切り替えました。`,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('[renderer] failed to update settings', error);
      notify('error', '設定の保存に失敗しました。コンソールログを確認してください。');
      pushLog({
        id: `settings-update-failed-${Date.now()}`,
        level: 'ERROR',
        message: '設定の保存に失敗しました。コンソールログを確認してください。',
        timestamp: new Date(),
      });
      if (appSettings) {
        applyThemeFromSettings(appSettings.theme, appSettings.theme.mode, setThemeStore);
      }
    }
  }, [appSettings, notify, pushLog, setThemeStore, theme]);

  const promptExportFileName = useCallback(
    (initialName?: string | null) => {
      const fallback = buildDefaultExportName();
      const suggestion = normalizeOutputFileName(initialName ?? '') ?? fallback;
      const input = window.prompt('保存するカードファイル名 (.json)', suggestion);
      if (input === null) {
        return null;
      }
      const normalized = normalizeOutputFileName(input);
      if (!normalized) {
        notify('error', 'ファイル名に使用できない文字が含まれています。');
        return null;
      }
      return normalized;
    },
    [notify],
  );

  const saveActiveTab = useCallback(
    async (options?: { explicitFileName?: string; renameTab?: boolean; force?: boolean }) => {
      const targetLeafId = effectiveLeafId;
      if (!activeTab || !activeTabId || !targetLeafId) {
        notify('warning', '保存対象のパネルが選択されていません。');
        pushLog({
          id: `save-no-target-${Date.now()}`,
          level: 'WARN',
          message: '保存対象のタブが存在しないため、保存をスキップしました。',
          timestamp: new Date(),
        });
        return false;
      }

      if (isSaving) {
        notify('info', '保存処理が進行中です。');
        return false;
      }

      if (!options?.force && !isDirty) {
        const now = new Date();
        notify('info', '保存対象の変更はありません。');
        pushLog({
          id: `save-skip-${now.valueOf()}`,
          level: 'INFO',
          message: '保存操作を実行しましたが未保存の変更はありませんでした。',
          timestamp: now,
        });
        return false;
      }

      const saveApi = window.app?.workspace?.saveCardFile;
      if (!saveApi) {
        const now = new Date();
        notify('error', 'カード保存APIが利用できません。再起動後に再試行してください。');
        pushLog({
          id: `save-missing-${now.valueOf()}`,
          level: 'ERROR',
          message: 'workspace.saveCardFile API が未定義のため保存を実行できませんでした。',
          timestamp: now,
        });
        return false;
      }

      let targetFileName: string | null = options?.explicitFileName ?? activeTab.fileName ?? null;
      if (!targetFileName) {
        targetFileName = promptExportFileName(activeTab.title ?? null);
        if (!targetFileName) {
          return false;
        }
      }

      const normalized = normalizeOutputFileName(targetFileName);
      if (!normalized) {
        notify('error', 'ファイル名に使用できない文字が含まれています。');
        return false;
      }

      const startedAt = new Date();
      setSaving(true);
      try {
        const snapshot: WorkspaceSnapshot = {
          cards,
          savedAt: startedAt.toISOString(),
        };
        const result = await saveApi(normalized, snapshot);
        markSaved(activeTabId, snapshot.savedAt);
        if (!activeTab.fileName || activeTab.fileName !== normalized || options?.renameTab) {
          renameTabFile(activeTab.id, normalized);
        }
        notify('success', `カードファイルを保存しました: ${normalized}`);
        pushLog({
          id: `save-${startedAt.valueOf()}`,
          level: 'INFO',
          message: `カードファイルを保存しました (出力: ${result?.path ?? normalized})。`,
          timestamp: startedAt,
        });
        return true;
      } catch (error) {
        console.error('[renderer] failed to save card file', error);
        const failedAt = new Date();
        notify('error', 'カードファイルの保存に失敗しました。ログを確認してください。');
        pushLog({
          id: `save-failed-${failedAt.valueOf()}`,
          level: 'ERROR',
          message: 'カードファイルの保存に失敗しました。コンソールログを確認してください。',
          timestamp: failedAt,
        });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [activeTab, activeTabId, cards, effectiveLeafId, isDirty, isSaving, markSaved, notify, promptExportFileName, pushLog, renameTabFile],
  );

  /**
   * @brief ワークスペースを上書き保存する。
   */
  const handleSave = useCallback(async () => {
    await saveActiveTab();
  }, [saveActiveTab]);

  /**
   * @brief 別名保存する。
   */
  const handleSaveAs = useCallback(async () => {
    const suggested = activeTab?.fileName ?? activeTab?.title ?? buildDefaultExportName();
    const requested = promptExportFileName(suggested);
    if (!requested) {
      notify('info', '保存をキャンセルしました。');
      return;
    }
    await saveActiveTab({ explicitFileName: requested, renameTab: true, force: true });
  }, [activeTab?.fileName, activeTab?.title, notify, promptExportFileName, saveActiveTab]);

  /**
   * @brief パネル分割を実行する。
   * @param direction 分割方向。
   */
  const handleSplit = useCallback(
    (direction: 'horizontal' | 'vertical') => {
      //! アクティブな葉ノードがあればそれを分割、なければルートを分割
      const targetLeafId = activeLeafId ?? splitRoot.id;
      if (splitRoot.type === 'split' && !activeLeafId) {
        notify('warning', '分割対象のパネルを選択してください。');
        pushLog({
          id: `split-no-target-${Date.now()}`,
          level: 'WARN',
          message: '分割対象のパネルが選択されていません。',
          timestamp: new Date(),
        });
        return;
      }

      splitLeaf(targetLeafId, direction);
      const now = new Date();
      const modeLabel = direction === 'vertical' ? '左右' : '上下';
      notify('info', `パネルを${modeLabel}分割しました。`);
      pushLog({
        id: `split-${direction}-${now.valueOf()}`,
        level: 'INFO',
        message: `パネルを${modeLabel}分割しました。`,
        timestamp: now,
      });
    },
    [activeLeafId, notify, pushLog, splitLeaf, splitRoot],
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
  const firstSelectedId = Array.from(selectedCardIds)[0] ?? null;
  const selectedDisplayNumber = toDisplayNumber(cards, firstSelectedId);
  const themeLabel = theme === 'dark' ? 'ダークモード' : 'ライトモード';
  const saveStatusText = isSaving
    ? '保存状態: ⏳ 保存中...'
    : isDirty
      ? '保存状態: ● 未保存'
      : `保存状態: ✓ 保存済み${lastSavedAt ? ` (${lastSavedAt.toLocaleTimeString()})` : ''}`;
  const isSettingsOpen = settingsModalState.open;

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

  const addCardViaShortcut = useCallback(
    (position: InsertPosition) => {
      if (!effectiveLeafId || !activeTabId) {
        notify('warning', 'カードを追加できるアクティブタブがありません。');
        return;
      }
      const created = addCard(effectiveLeafId, activeTabId, { position });
      if (created) {
        const label = position === 'before' ? '前' : position === 'child' ? '子' : '後';
        notify('info', `カードを${label}に追加しました。`);
        pushLog({
          id: `insert-${position}-${Date.now()}`,
          level: 'INFO',
          message: `カード「${created.title || created.id}」を${label}に追加しました。`,
          timestamp: new Date(),
        });
      } else {
        notify('warning', 'カードを追加できませんでした。');
      }
    },
    [activeTabId, addCard, effectiveLeafId, notify, pushLog],
  );

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      if (target.isContentEditable) {
        return true;
      }
      const tagName = target.tagName.toLowerCase();
      if (tagName === 'textarea' || tagName === 'select') {
        return true;
      }
      if (tagName === 'input') {
        const type = (target as HTMLInputElement).type?.toLowerCase() ?? 'text';
        const nonTextTypes = ['button', 'checkbox', 'radio', 'range', 'color', 'file', 'image', 'reset', 'submit', 'hidden'];
        return !nonTextTypes.includes(type);
      }
      return false;
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const platform = window.navigator?.platform ?? '';
      const isMac = platform.toLowerCase().includes('mac');
      const primaryPressed = isMac ? event.metaKey : event.ctrlKey;
      const key = event.key.toLowerCase();

      if (isSettingsOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeSettingsModal(false);
        }
        return;
      }

      if (primaryPressed) {
        if (!event.altKey) {
          if (key === ',' && !event.shiftKey) {
            event.preventDefault();
            handleSettingsOpen();
            return;
          }
          if (key === 'c' && !event.shiftKey) {
            event.preventDefault();
            if (!effectiveLeafId || !activeTabId) {
              notify('warning', 'コピーできるアクティブタブがありません。');
              return;
            }
            const count = copySelection(effectiveLeafId, activeTabId);
            if (count > 0) {
              notify('info', `${count}件のカードをコピーしました。`);
              pushLog({
                id: `copy-${Date.now()}`,
                level: 'INFO',
                message: `${count}件のカードをコピーしました。`,
                timestamp: new Date(),
              });
            } else {
              notify('info', 'コピーするカードが選択されていません。');
            }
            return;
          }

          if (key === 'v' && !event.shiftKey) {
            event.preventDefault();
            if (!effectiveLeafId || !activeTabId) {
              notify('warning', '貼り付けできるアクティブタブがありません。');
              return;
            }
            if (!hasClipboard()) {
              notify('info', 'クリップボードにカードがありません。');
              return;
            }
            const result = pasteClipboard(effectiveLeafId, activeTabId, { position: 'after' });
            if (result && result.inserted > 0) {
              notify('info', `${result.inserted}件のカードを貼り付けました。`);
              pushLog({
                id: `paste-${Date.now()}`,
                level: 'INFO',
                message: `${result.inserted}件のカードを貼り付けました。`,
                timestamp: new Date(),
              });
            }
            return;
          }

          if (key === 'z' && !event.shiftKey) {
            event.preventDefault();
            if (canUndo()) {
              const success = undo();
              if (success) {
                notify('info', '操作を取り消しました。');
                pushLog({
                  id: `undo-${Date.now()}`,
                  level: 'INFO',
                  message: '操作を取り消しました。',
                  timestamp: new Date(),
                });
              }
            } else {
              notify('info', '取り消す操作がありません。');
            }
            return;
          }

          if (key === 'y' || (key === 'z' && event.shiftKey)) {
            event.preventDefault();
            if (canRedo()) {
              const success = redo();
              if (success) {
                notify('info', '操作をやり直しました。');
                pushLog({
                  id: `redo-${Date.now()}`,
                  level: 'INFO',
                  message: '操作をやり直しました。',
                  timestamp: new Date(),
                });
              }
            } else {
              notify('info', 'やり直す操作がありません。');
            }
            return;
          }

          if (key === 's') {
            event.preventDefault();
            if (event.shiftKey) {
              void handleSaveAs();
            } else {
              void handleSave();
            }
            return;
          }

          if (key === 'f' && !event.shiftKey) {
            event.preventDefault();
            openSearchPanel();
            return;
          }

          if (event.key === '\\' && !event.shiftKey) {
            event.preventDefault();
            handleSplit('vertical');
            return;
          }

          if ((event.key === '\\' && event.shiftKey) || event.key === '|') {
            event.preventDefault();
            handleSplit('horizontal');
            return;
          }

          return;
        }

        if (event.altKey && !event.shiftKey) {
          if (event.key === 'ArrowUp' || key === 'arrowup') {
            event.preventDefault();
            addCardViaShortcut('before');
            return;
          }
          if (event.key === 'ArrowDown' || key === 'arrowdown') {
            event.preventDefault();
            addCardViaShortcut('after');
            return;
          }
          if (event.key === 'ArrowRight' || key === 'arrowright') {
            event.preventDefault();
            addCardViaShortcut('child');
            return;
          }
        }
      }

      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === 'Insert') {
        event.preventDefault();
        addCardViaShortcut('after');
        return;
      }

      if (event.key === 'Delete') {
        event.preventDefault();
        if (!effectiveLeafId || !activeTabId) {
          notify('warning', '削除できるカードがありません。');
          return;
        }
        if (selectedCount === 0) {
          notify('info', '削除対象のカードが選択されていません。');
          return;
        }
        const deleted = deleteCards(effectiveLeafId, activeTabId);
        if (deleted > 0) {
          notify('info', `${deleted}件のカードを削除しました。`);
          pushLog({
            id: `delete-card-${Date.now()}`,
            level: 'INFO',
            message: `${deleted}件のカードを削除しました。`,
            timestamp: new Date(),
          });
        } else {
          notify('info', '削除できるカードがありません。');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTabId,
    addCardViaShortcut,
    canRedo,
    canUndo,
    closeSettingsModal,
    copySelection,
    deleteCards,
    effectiveLeafId,
    handleSave,
    handleSaveAs,
    handleSettingsOpen,
    handleSplit,
    hasClipboard,
    isSettingsOpen,
    notify,
    openSearchPanel,
    pasteClipboard,
    pushLog,
    redo,
    selectedCount,
    undo,
  ]);

  return (
    <div className="app-shell" data-dragging={dragTarget ? 'true' : 'false'}>
      <NotificationCenter />
      <SettingsModal
        isOpen={settingsModalState.open}
        isLoading={settingsModalState.loading}
        isSaving={settingsModalState.saving}
        settings={settingsModalState.draft}
        section={settingsModalState.section}
        validationErrors={settingsModalState.validationErrors}
        errorMessage={settingsModalState.error}
        onSectionChange={handleSettingsSectionChange}
        onClose={() => closeSettingsModal(false)}
        onSave={handleSettingsSave}
        onChange={handleSettingsChange}
        onPreviewTheme={previewThemeSettings}
        onClearRecent={handleClearRecent}
      />
      <header className="menu-bar" role="menubar">
        <nav className="menu-bar__items">
          <button className="menu-bar__item" type="button">ファイル(F)</button>
          <button className="menu-bar__item" type="button" onClick={handleSettingsOpen}>編集(E)</button>
          <button className="menu-bar__item" type="button">表示(V)</button>
          <button className="menu-bar__item" type="button">ヘルプ(H)</button>
        </nav>
      </header>

      <section className="top-toolbar" aria-label="グローバルツールバー">
        <div className="toolbar-group">
          <button
            type="button"
            className="toolbar-button"
            title="ファイルを開く"
            aria-label="ファイルを開く"
          >
            📂
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={() => {
              void handleSave();
            }}
            disabled={isSaving}
            aria-disabled={isSaving}
            title="上書き保存 (Ctrl+S)"
            aria-label="上書き保存"
          >
            💾
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={() => {
              void handleSaveAs();
            }}
            disabled={isSaving}
            aria-disabled={isSaving}
            title="名前を付けて保存 (Ctrl+Shift+S)"
            aria-label="名前を付けて保存"
          >
            📝
          </button>
        </div>
        <div className="toolbar-group">
          <button type="button" className="toolbar-button" title="トレーサ表示切替" aria-label="トレーサ表示切替">⛓️</button>
          <button type="button" className="toolbar-button" title="トレースタイプフィルタ" aria-label="トレースタイプフィルタ">🧬</button>
          <button
            type="button"
            className="toolbar-button"
            onClick={handleCycleStatus}
            title="ステータスを切り替え"
            aria-label="ステータスを切り替え"
          >
            🔄
          </button>
        </div>
        <div className="toolbar-group">
          <button
            type="button"
            className="toolbar-button"
            onClick={() => handleSplit('horizontal')}
            title="上下分割"
            aria-label="上下分割"
          >
            ⇅
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={() => handleSplit('vertical')}
            title="左右分割"
            aria-label="左右分割"
          >
            ⇆
          </button>
        </div>
        <div className="toolbar-spacer" />
        <div className="toolbar-group toolbar-group--right">
          <button
            type="button"
            className="toolbar-button"
            onClick={handleThemeToggle}
            title={theme === 'dark' ? 'ライトモードに切替' : 'ダークモードに切替'}
            aria-label={theme === 'dark' ? 'ライトモードに切替' : 'ダークモードに切替'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
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
                    📁 _input
                    <ul role="group">
                      {cardFiles.length === 0 ? (
                        <li role="treeitem" className="sidebar__tree-empty">
                          カードファイルがありません
                        </li>
                      ) : (
                        cardFiles.map((file) => (
                          <li
                            key={file}
                            role="treeitem"
                            className="sidebar__tree-file"
                            onDoubleClick={() => handleLoadCardFile(file)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                void handleLoadCardFile(file);
                              }
                            }}
                            tabIndex={0}
                            title={`ダブルクリックして ${file} を読み込む`}
                          >
                            📄 {file}
                          </li>
                        ))
                      )}
                    </ul>
                  </li>
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
            <SplitContainer
              node={splitRoot}
              renderLeaf={(leafId, { isActive }) => (
                <CardPanel
                  leafId={leafId}
                  isActive={isActive}
                  onLog={handleLog}
                  onPanelClick={handlePanelClick}
                  onPanelClose={handlePanelClose}
                />
              )}
            />
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
