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
import type { CSSProperties, PointerEvent as ReactPointerEvent, FormEvent as ReactFormEvent } from 'react';
import { nanoid } from 'nanoid';
import { shallow } from 'zustand/shallow';

import {
  useWorkspaceStore,
  type Card,
  type CardKind,
  type CardStatus,
  type InsertPosition,
  type WorkspaceStore,
} from './store/workspaceStore';
import { useUiStore, type ThemeMode } from './store/uiStore';
import { useNotificationStore } from './store/notificationStore';
import { useSplitStore } from './store/splitStore';
import type { SplitNode } from './store/splitStore';
import { useTraceStore } from './store/traceStore';
import { useTracePreferenceStore } from './store/tracePreferenceStore';
import { usePanelEngagementStore } from './store/panelEngagementStore';
import type { AppSettings, ConverterStrategy, LogLevel, ThemeModeSetting, ThemeSettings } from '@/shared/settings';
import { defaultSettings } from '@/shared/settings';
import { CARD_KIND_VALUES, CARD_STATUS_SEQUENCE } from '@/shared/workspace';
import type { WorkspaceSnapshot } from '@/shared/workspace';
import { TRACE_RELATION_KINDS } from '@/shared/traceability';
import type { TraceDirection, TraceRelationKind, TraceabilityRelation } from '@/shared/traceability';

import './styles.css';
import { NotificationCenter } from './components/NotificationCenter';
import { SplitContainer } from './components/SplitContainer';
import { CardPanel } from './components/CardPanel';
import { SettingsModal, type SettingsSection } from './components/SettingsModal';
import { ConversionModal } from './components/ConversionModal';
import { UnsavedChangesDialog, type UnsavedChangesAction } from './components/UnsavedChangesDialog';
import { applyThemeColors, applySplitterWidth } from './utils/themeUtils';
import { findVerticalPairForLeaf } from './utils/traceLayout';
import { createSearchMatcher, buildSnippet } from './utils/search';
import { convertDocument } from '@/shared/conversion/pipeline';
import type { NormalizedDocument } from '@/shared/conversion/types';
import type { CardIdAssignmentRule, ConversionModalDisplayState, ConversionSourceSummary } from './types/conversion';

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

type SearchScope = 'current' | 'open' | 'input';

interface SearchResultItem {
  id: string;
  source: 'open' | 'input';
  fileName: string | null;
  tabId?: string;
  leafId?: string;
  cardId: string;
  cardTitle: string;
  snippet: string;
  matchCount: number;
}

const SEARCH_SCOPE_LABELS: Record<SearchScope, string> = {
  current: 'アクティブタブ',
  open: '開いているタブ',
  input: '_input ディレクトリ',
};

type ShortcutEntry = {
  keys: string;
  description: string;
};

type ShortcutGroup = {
  title: string;
  entries: ShortcutEntry[];
};

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'グローバルショートカット',
    entries: [
      { keys: 'Ctrl + S', description: 'アクティブカードファイルを保存' },
      { keys: 'Ctrl + Shift + S', description: '名前を付けて保存' },
      { keys: 'Ctrl + ,', description: '設定モーダルを開く' },
      { keys: 'Ctrl + F', description: '検索パネルを開いて検索を実行' },
      { keys: 'Ctrl + C / Ctrl + V', description: '選択カードをコピー / 貼り付け' },
      { keys: 'Ctrl + Z', description: '直前の操作を取り消し' },
      { keys: 'Ctrl + Y / Ctrl + Shift + Z', description: '取り消した操作をやり直し' },
      { keys: 'Ctrl + \\', description: 'カードパネルを左右に分割' },
      { keys: 'Ctrl + Shift + ｜ (または Ctrl + Shift + \\)', description: 'カードパネルを上下に分割' },
    ],
  },
  {
    title: 'カード挿入と編集',
    entries: [
      { keys: 'Alt + ↑', description: '選択カードの前にカードを追加' },
      { keys: 'Alt + ↓', description: '選択カードの後ろにカードを追加' },
      { keys: 'Alt + →', description: '選択カードの子カードとして追加' },
      { keys: 'Insert', description: '現在の選択位置の直後にカードを追加' },
      { keys: 'Delete', description: '選択カードを削除' },
      { keys: 'ダブルクリック', description: 'カードをインライン編集モードへ切替' },
    ],
  },
  {
    title: 'カードのコンテキストメニュー',
    entries: [
      { keys: '右クリック → ⬆︎ 前に追加', description: '基準カードの直前へ空カードを挿入' },
      { keys: '右クリック → ⬇︎ 後に追加', description: '基準カードの直後へ空カードを挿入' },
      { keys: '右クリック → ➡︎ 子として追加', description: '基準カードの子階層へ空カードを挿入' },
      { keys: '右クリック → 📋 コピー', description: '選択中カード群をコピー' },
      { keys: '右クリック → 貼り付け (前/後/子)', description: 'クリップボード内カードを指定位置へ挿入' },
    ],
  },
];

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

type TraceSelection = {
  fileName: string;
  cardIds: string[];
};

type TraceFlagPatch = Partial<Pick<Card, 'hasLeftTrace' | 'hasRightTrace'>>;

const gatherSelectionsForLeafs = (state: WorkspaceStore, leafIds: string[]): TraceSelection[] => {
  const selections: TraceSelection[] = [];
  leafIds.forEach((leafId) => {
    const leaf = state.leafs[leafId];
    if (!leaf?.activeTabId) {
      return;
    }
    const tab = state.tabs[leaf.activeTabId];
    if (!tab?.fileName || tab.selectedCardIds.size === 0) {
      return;
    }
    selections.push({ fileName: tab.fileName, cardIds: Array.from(tab.selectedCardIds) });
  });
  return selections;
};

const relationCardSet = (relations: TraceabilityRelation[], side: 'left' | 'right'): Set<string> => {
  const result = new Set<string>();
  relations.forEach((relation) => {
    const ids = side === 'left' ? relation.left_ids : relation.right_ids;
    ids.forEach((id) => result.add(id));
  });
  return result;
};

const buildTraceFlagUpdates = (
  prev: Set<string>,
  next: Set<string>,
  flag: 'hasLeftTrace' | 'hasRightTrace',
): Record<string, TraceFlagPatch> => {
  const updates: Record<string, TraceFlagPatch> = {};
  prev.forEach((id) => {
    if (!next.has(id)) {
      updates[id] = { ...updates[id], [flag]: false } as TraceFlagPatch;
    }
  });
  next.forEach((id) => {
    updates[id] = { ...updates[id], [flag]: true } as TraceFlagPatch;
  });
  return updates;
};

const toDirectedValue = (direction: TraceDirection): TraceabilityRelation['directed'] => {
  if (direction === 'forward') {
    return 'left_to_right';
  }
  if (direction === 'backward') {
    return 'right_to_left';
  }
  return 'bidirectional';
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

const summarizeContentPreview = (content: string): { preview: string; lineCount: number } => {
  const lines = content.split('\n');
  return {
    preview: lines.slice(0, 40).join('\n'),
    lineCount: lines.length,
  };
};

const toTimestampSlug = (date: Date): string => date.toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0];

const sanitizeBaseName = (baseName: string): string => {
  const fallback = 'converted';
  const safe = baseName.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+|-+$/g, '') || fallback;
  return safe.length > 48 ? safe.slice(0, 48) : safe;
};

const buildConvertedOutputFileName = (baseName: string, strategy: ConverterStrategy, date: Date): string => {
  const safeBase = sanitizeBaseName(baseName);
  const timestamp = toTimestampSlug(date);
  return `${safeBase}_${strategy}_${timestamp}.json`;
};

const isAbortError = (error: unknown): boolean => {
  if (!error) {
    return false;
  }
  if (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return true;
  }
  if (typeof (error as { code?: string }).code === 'string' && (error as { code?: string }).code === 'ABORT_ERR') {
    return true;
  }
  return false;
};

const formatHumanFileSize = (bytes: number): string => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
};

const buildConversionState = (strategy: ConverterStrategy): ConversionModalDisplayState => ({
  isOpen: false,
  picking: false,
  converting: false,
  cancelRequested: false,
  error: null,
  source: null,
  warnAcknowledged: false,
  selectedStrategy: strategy,
  progressPercent: 0,
  progressMessage: '待機中',
  // カードID設定のデフォルト値
  cardIdPrefix: '',
  cardIdStartNumber: 1,
  cardIdDigits: 3,
  cardIdAssignmentRule: 'all', // デフォルトを'all'に変更（すべてのカードにIDを付与）
});

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
  const traceFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const traceFilterPopoverRef = useRef<HTMLDivElement | null>(null);
  const conversionAbortControllerRef = useRef<AbortController | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(SIDEBAR_DEFAULT); ///< サイドバー幅。
  const [sidebarVisible, setSidebarVisible] = useState<boolean>(true); ///< サイドバー表示/非表示。
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
  const [logLevelFilter, setLogLevelFilter] = useState<'ALL' | LogEntry['level']>('ALL');
  const [logFilterKeyword, setLogFilterKeyword] = useState('');
  const displayedLogs = useMemo(() => {
    const keyword = logFilterKeyword.trim().toLowerCase();
    return logs.filter((entry) => {
      const levelMatch = logLevelFilter === 'ALL' || entry.level === logLevelFilter;
      const keywordMatch = keyword
        ? `${entry.message} ${entry.level}`.toLowerCase().includes(keyword)
        : true;
      return levelMatch && keywordMatch;
    });
  }, [logFilterKeyword, logLevelFilter, logs]);
  const logLevelOptions: Array<'ALL' | LogEntry['level']> = ['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'];
  const clearLogs = useCallback(() => {
    setLogs([
      {
        id: `log-clear-${Date.now()}`,
        level: 'INFO',
        message: 'ログをクリアしました。',
        timestamp: new Date(),
      },
    ]);
  }, []);

  const [isSaving, setSaving] = useState<boolean>(false); ///< 保存処理中フラグ。
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [settingsModalState, setSettingsModalState] = useState<SettingsModalState>(createSettingsModalState);
  const [conversionState, setConversionState] = useState<ConversionModalDisplayState>(() =>
    buildConversionState(defaultSettings.converter.strategy),
  );
  const updateConversionProgress = useCallback((percent: number, message: string) => {
    setConversionState((prev) => ({
      ...prev,
      progressPercent: Math.max(0, Math.min(100, Math.round(percent))),
      progressMessage: message,
    }));
  }, []);
  const tabs = useWorkspaceStore((state) => state.tabs);
  const leafs = useWorkspaceStore((state) => state.leafs);
  const openTab = useWorkspaceStore((state) => state.openTab);
  const createUntitledTab = useWorkspaceStore((state) => state.createUntitledTab);
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
  const isTraceVisible = useTracePreferenceStore((state) => state.isVisible);
  const toggleTraceVisibility = useTracePreferenceStore((state) => state.toggleVisibility);
  const excludeSelfTrace = useTracePreferenceStore((state) => state.excludeSelfTrace);
  const toggleTraceRecirculation = useTracePreferenceStore((state) => state.toggleExcludeSelfTrace);
  const showOffscreenConnectors = useTracePreferenceStore((state) => state.showOffscreenConnectors);
  const toggleOffscreenConnectors = useTracePreferenceStore((state) => state.toggleOffscreenConnectors);
  const enabledRelationKinds = useTracePreferenceStore((state) => state.enabledKinds, shallow);
  const toggleRelationKindPreference = useTracePreferenceStore((state) => state.toggleRelationKind);
  const setAllRelationKinds = useTracePreferenceStore((state) => state.setAllKinds);
  const creationRelationKind = useTracePreferenceStore((state) => state.creationRelationKind);
  const setCreationRelationKind = useTracePreferenceStore((state) => state.setCreationRelationKind);
  const theme = useUiStore((state) => state.theme);
  const setThemeStore = useUiStore((state) => state.setTheme);
  const markdownPreviewGlobalEnabled = useUiStore((state) => state.markdownPreviewGlobalEnabled);
  const toggleMarkdownPreviewGlobal = useUiStore((state) => state.toggleMarkdownPreviewGlobal);
  const notify = useNotificationStore((state) => state.add);
  const splitRoot = useSplitStore((state) => state.root);
  const splitLeaf = useSplitStore((state) => state.splitLeaf);
  const activeLeafId = useSplitStore((state) => state.activeLeafId);
  const setActiveLeaf = useSplitStore((state) => state.setActiveLeaf);
  const markPanelEngagement = usePanelEngagementStore((state) => state.handleSelectionTransition);
  const removePanelEngagement = usePanelEngagementStore((state) => state.removePanel);
  const [isExplorerOpen, setExplorerOpen] = useState<boolean>(true); ///< エクスプローラ折畳状態。
  const [isSearchOpen, setSearchOpen] = useState<boolean>(true); ///< 検索パネル折畳状態。
  const [cardFiles, setCardFiles] = useState<string[]>([]); ///< カードファイル一覧（_input）。
  const [outputFiles, setOutputFiles] = useState<string[]>([]); ///< 出力ファイル一覧（_out）。
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!appSettings) {
      return;
    }
    setConversionState((prev) => {
      if (prev.isOpen || prev.selectedStrategy === appSettings.converter.strategy) {
        return prev;
      }
      return { ...prev, selectedStrategy: appSettings.converter.strategy } satisfies ConversionModalDisplayState;
    });
  }, [appSettings]);

  useEffect(() => {
    if (!appSettings) {
      return;
    }
    setConversionState((prev) => {
      if (prev.isOpen || prev.selectedStrategy === appSettings.converter.strategy) {
        return prev;
      }
      return { ...prev, selectedStrategy: appSettings.converter.strategy } satisfies ConversionModalDisplayState;
    });
  }, [appSettings]);

  /**
   * @brief 未保存の変更確認IPCイベントリスナーを設定。
   * @details
   * メインプロセスからの未保存の変更確認要求を受け取り、
   * 未保存のタブがあればダイアログを表示する。
   */
  useEffect(() => {
    const handleCheckUnsavedChanges = () => {
      const dirtyTabsCount = Object.values(tabs).filter((tab) => tab.isDirty).length;

      if (dirtyTabsCount > 0) {
        //! 未保存のタブがある場合はダイアログを表示
        setUnsavedChangesDialogOpen(true);
      } else {
        //! 未保存のタブがない場合はそのまま終了を許可
        window.app.unsavedChanges.sendResponse({ action: 'discard' });
      }
    };

    window.app.unsavedChanges.onCheckUnsavedChanges(handleCheckUnsavedChanges);

    //! クリーンアップ関数は不要（ipcRenderer.onはリスナーを上書きするため）
  }, [tabs]);

  const [searchScope, setSearchScope] = useState<SearchScope>('current');
  const [searchUseRegex, setSearchUseRegex] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [traceBusy, setTraceBusy] = useState<boolean>(false); ///< トレース操作中フラグ。
  const [isTraceFilterOpen, setTraceFilterOpen] = useState<boolean>(false);
  const [isHelpOpen, setHelpOpen] = useState(false);
  const [isUnsavedChangesDialogOpen, setUnsavedChangesDialogOpen] = useState(false); ///< 未保存の変更確認ダイアログの表示状態。
  const [isSavingForClose, setSavingForClose] = useState(false); ///< クローズ前の保存処理中フラグ。
  const searchScopeEntries = useMemo(() => Object.entries(SEARCH_SCOPE_LABELS) as [SearchScope, string][], []);

  const allowedStatuses = useMemo(() => new Set<CardStatus>(CARD_STATUS_SEQUENCE), []);
  const allowedKinds = useMemo(() => new Set<CardKind>(CARD_KIND_VALUES as CardKind[]), []);
  const isRelationFilterDirty = useMemo(() => Object.values(enabledRelationKinds).some((value) => !value), [enabledRelationKinds]);

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

  /**
   * @brief 未保存のタブ数を計算。
   * @details
   * 全タブの isDirty フラグをチェックして、未保存のタブ数を返す。
   * @return 未保存のタブ数
   */
  const unsavedTabCount = useMemo(() => {
    return Object.values(tabs).filter((tab) => tab.isDirty).length;
  }, [tabs]);

  /**
   * @brief 未保存の変更に対するユーザーアクションを処理。
   * @details
   * - 'discard': 未保存の変更を破棄してアプリを終了
   * - 'apply': 未保存の変更を保存してアプリを終了
   * - 'cancel': アプリの終了をキャンセル
   * @param action ユーザーが選択したアクション
   */
  const handleUnsavedChangesAction = useCallback(
    async (action: UnsavedChangesAction) => {
      if (action === 'cancel') {
        //! 終了をキャンセル
        setUnsavedChangesDialogOpen(false);
        window.app.unsavedChanges.sendResponse({ action: 'cancel' });
        pushLog('info', 'アプリの終了をキャンセルしました');
        return;
      }

      if (action === 'discard') {
        //! 変更を破棄して終了
        setUnsavedChangesDialogOpen(false);
        window.app.unsavedChanges.sendResponse({ action: 'discard' });
        pushLog('info', '未保存の変更を破棄してアプリを終了します');
        return;
      }

      if (action === 'apply') {
        //! 変更を保存してから終了
        setUnsavedChangesDialogOpen(false);
        setSavingForClose(true);
        //! まず'apply'応答を送信してメインプロセスに通知
        window.app.unsavedChanges.sendResponse({ action: 'apply' });
        pushLog('info', '未保存の変更を保存してからアプリを終了します');

        try {
          //! 未保存のタブを全て保存
          const dirtyTabs = Object.values(tabs).filter((tab) => tab.isDirty);

          for (const tab of dirtyTabs) {
            if (!tab.fileName) {
              pushLog('warn', `タブ「${tab.title}」はファイル名が未設定のため保存をスキップしました`);
              continue;
            }

            const snapshot: WorkspaceSnapshot = {
              cards: tab.cards,
              savedAt: new Date().toISOString(),
            };

            await window.app.workspace.saveCardFile(tab.fileName, snapshot);
            markSaved(tab.id, snapshot.savedAt);
            pushLog('info', `カードファイル「${tab.fileName}」を保存しました`);
          }

          //! 全てのタブを保存後、終了準備完了を通知
          pushLog('info', '全ての変更を保存しました。アプリを終了します');
          window.app.unsavedChanges.notifySavedAndReadyToQuit();
        } catch (error) {
          pushLog('error', `保存中にエラーが発生しました: ${String(error)}`);
          notify('error', '保存に失敗しました。アプリの終了をキャンセルします');
          //! エラーが発生した場合は終了をキャンセル
          window.app.unsavedChanges.sendResponse({ action: 'cancel' });
        } finally {
          setSavingForClose(false);
        }
      }
    },
    [tabs, markSaved, pushLog, notify],
  );

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

  useEffect(() => {
    if (!isTraceFilterOpen) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        traceFilterPopoverRef.current?.contains(target) ||
        traceFilterButtonRef.current?.contains(target)
      ) {
        return;
      }
      setTraceFilterOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isTraceFilterOpen]);

  useEffect(() => {
    if (!isHelpOpen) {
      return;
    }
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setHelpOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [isHelpOpen]);

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

  const handleTraceMutation = useCallback(
    async (operation: { type: 'create'; direction: TraceDirection } | { type: 'delete' }) => {
      if (traceBusy) {
        notify('warning', '別のトレース操作を実行中です。完了をお待ちください。');
        return;
      }

      const context = findVerticalPairForLeaf(splitRoot, activeLeafId ?? null);
      if (!context) {
        notify('warning', '左右に並んだカードパネルが必要です。');
        return;
      }

      const workspaceState = useWorkspaceStore.getState();
      const leftSelections = gatherSelectionsForLeafs(workspaceState, context.leftLeafIds);
      const rightSelections = gatherSelectionsForLeafs(workspaceState, context.rightLeafIds);

      if (leftSelections.length !== 1 || rightSelections.length !== 1) {
        notify('warning', '左右それぞれのパネルでカードを選択してください。');
        return;
      }

      const leftSelection = leftSelections[0];
      const rightSelection = rightSelections[0];

      if (!leftSelection.fileName || !rightSelection.fileName) {
        notify('warning', '左右のパネルで有効なカードファイルを開いてください。');
        return;
      }

      if (leftSelection.fileName === rightSelection.fileName) {
        notify('warning', '同じファイル同士ではトレースを作成できません。');
        return;
      }

      setTraceBusy(true);
      try {
        const traceState = useTraceStore.getState();
        const beforeEntry = await traceState.loadTraceForPair(leftSelection.fileName, rightSelection.fileName);
        const prevLeftSet = relationCardSet(beforeEntry.relations, 'left');
        const prevRightSet = relationCardSet(beforeEntry.relations, 'right');

        let nextRelations = beforeEntry.relations.map((relation) => ({
          ...relation,
          left_ids: [...relation.left_ids],
          right_ids: [...relation.right_ids],
        }));
        let deltaCount = 0;

        if (operation.type === 'create') {
          const existingPairs = new Set(beforeEntry.links.map((link) => `${link.sourceCardId}:::${link.targetCardId}`));
          leftSelection.cardIds.forEach((sourceId) => {
            rightSelection.cardIds.forEach((targetId) => {
              const pairKey = `${sourceId}:::${targetId}`;
              if (existingPairs.has(pairKey)) {
                return;
              }
              nextRelations.push({
                id: nanoid(),
                left_ids: [sourceId],
                right_ids: [targetId],
                type: creationRelationKind,
                directed: toDirectedValue(operation.direction),
              });
              existingPairs.add(pairKey);
              deltaCount += 1;
            });
          });

          if (deltaCount === 0) {
            notify('info', '追加できるコネクタがありません。');
            return;
          }
        } else {
          const leftTargets = new Set(leftSelection.cardIds);
          const rightTargets = new Set(rightSelection.cardIds);
          nextRelations = nextRelations.filter((relation) => {
            const shouldRemove =
              relation.left_ids.some((id) => leftTargets.has(id)) &&
              relation.right_ids.some((id) => rightTargets.has(id));
            if (shouldRemove) {
              deltaCount += relation.left_ids.length * relation.right_ids.length;
            }
            return !shouldRemove;
          });

          if (deltaCount === 0) {
            notify('info', '削除対象のコネクタがありません。');
            return;
          }
        }

        const updatedEntry = await traceState.saveRelationsForPair({
          leftFile: leftSelection.fileName,
          rightFile: rightSelection.fileName,
          relations: nextRelations,
        });

        const nextLeftSet = relationCardSet(updatedEntry.relations, 'left');
        const nextRightSet = relationCardSet(updatedEntry.relations, 'right');
        const workspaceActions = useWorkspaceStore.getState();
        const leftUpdates = buildTraceFlagUpdates(prevLeftSet, nextLeftSet, 'hasRightTrace');
        const rightUpdates = buildTraceFlagUpdates(prevRightSet, nextRightSet, 'hasLeftTrace');

        if (Object.keys(leftUpdates).length > 0) {
          workspaceActions.setCardTraceFlags(leftSelection.fileName, leftUpdates);
        }
        if (Object.keys(rightUpdates).length > 0) {
          workspaceActions.setCardTraceFlags(rightSelection.fileName, rightUpdates);
        }

        const message =
          operation.type === 'create'
            ? `${deltaCount}件のコネクタを作成しました (${creationRelationKind}).`
            : `${deltaCount}件のコネクタを削除しました。`;
        notify('success', message);
        pushLog({
          id: `trace-${operation.type}-${Date.now()}`,
          level: 'INFO',
          message: `[Trace] ${leftSelection.fileName} ⇔ ${rightSelection.fileName}: ${message}`,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('[renderer] trace operation failed', error);
        notify('error', 'トレース操作に失敗しました。詳細はコンソールを確認してください。');
      } finally {
        setTraceBusy(false);
      }
    },
    [activeLeafId, creationRelationKind, notify, pushLog, splitRoot, traceBusy],
  );

  const handleTraceCreate = useCallback(
    (direction: TraceDirection) => {
      void handleTraceMutation({ type: 'create', direction });
    },
    [handleTraceMutation],
  );

  const handleTraceDelete = useCallback(() => {
    void handleTraceMutation({ type: 'delete' });
  }, [handleTraceMutation]);

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
    //! カードファイル一覧と出力ファイル一覧を初期化
    const loadFileList = async () => {
      if (!window.app?.workspace?.listCardFiles || !window.app?.workspace?.listOutputFiles) {
        return;
      }
      try {
        const [inputFiles, outFiles] = await Promise.all([
          window.app.workspace.listCardFiles(),
          window.app.workspace.listOutputFiles(),
        ]);
        setCardFiles(inputFiles);
        setOutputFiles(outFiles);
        pushLog({
          id: `file-list-loaded-${Date.now()}`,
          level: 'INFO',
          message: `ファイル一覧を読み込みました: _input=${inputFiles.length}件, _out=${outFiles.length}件`,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('[App] failed to load file list', error);
        pushLog({
          id: `file-list-error-${Date.now()}`,
          level: 'ERROR',
          message: 'ファイル一覧の読み込みに失敗しました',
          timestamp: new Date(),
        });
      }
    };

    void loadFileList();
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
   * @brief ファイル一覧を再読み込みする。
   */
  const refreshFileList = useCallback(async () => {
    if (!window.app?.workspace?.listCardFiles || !window.app?.workspace?.listOutputFiles) {
      return;
    }
    try {
      const [inputFiles, outFiles] = await Promise.all([
        window.app.workspace.listCardFiles(),
        window.app.workspace.listOutputFiles(),
      ]);
      setCardFiles(inputFiles);
      setOutputFiles(outFiles);
    } catch (error) {
      console.error('[App] failed to refresh file list', error);
    }
  }, []);

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
      const prevLeafId = useSplitStore.getState().activeLeafId;
      markPanelEngagement(prevLeafId ?? null, leafId, 'normal');
      setActiveLeaf(leafId);
      pushLog({
        id: `panel-activate-${Date.now()}`,
        level: 'DEBUG',
        message: `パネル ${leafId} をアクティブにしました。`,
        timestamp: new Date(),
      });
    },
    [markPanelEngagement, pushLog, setActiveLeaf],
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
      removePanelEngagement(leafId);
      const now = new Date();
      notify('info', 'パネルを閉じました。');
      pushLog({
        id: `panel-close-${now.valueOf()}`,
        level: 'INFO',
        message: `パネル ${leafId} を閉じました。`,
        timestamp: now,
      });
    },
    [closeLeafWorkspace, notify, pushLog, removePanelEngagement],
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

  /**
   * @brief 出力ファイル（_outディレクトリ）を読み込んでワークスペースに反映する。
   * @param fileName ファイル名。
   */
  const handleLoadOutputFile = useCallback(
    async (fileName: string) => {
      if (!window.app?.workspace?.loadOutputFile) {
        notify('error', '出力ファイル読み込み機能が利用できません。');
        return;
      }

      try {
        pushLog({
          id: `load-output-start-${Date.now()}`,
          level: 'INFO',
          message: `出力ファイルを読み込んでいます: ${fileName}`,
          timestamp: new Date(),
        });

        const targetLeafId = activeLeafId ?? (splitRoot.type === 'leaf' ? splitRoot.id : null);
        if (!targetLeafId) {
          notify('warning', 'ファイルを表示できるパネルがありません。対象パネルを選択してください。');
          pushLog({
            id: `load-output-no-leaf-${Date.now()}`,
            level: 'WARN',
            message: `出力ファイル ${fileName} を割り当てるパネルがありません。`,
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
              id: `load-output-cancelled-${Date.now()}`,
              level: 'INFO',
              message: `ファイル ${fileName} の再読み込みをキャンセルしました。`,
              timestamp: new Date(),
            });
            return;
          }
        }

        const snapshot = await window.app.workspace.loadOutputFile(fileName);
        if (!snapshot) {
          notify('error', `出力ファイルの読み込みに失敗しました: ${fileName}`);
          pushLog({
            id: `load-output-failed-${Date.now()}`,
            level: 'ERROR',
            message: `出力ファイルの読み込みに失敗しました: ${fileName}`,
            timestamp: new Date(),
          });
          return;
        }

        const { validCards, invalidMessages } = sanitizeSnapshotCards(snapshot.cards);

        if (invalidMessages.length > 0) {
          notify('warning', `一部のカードデータが不正です (${invalidMessages.length}件)`);
          pushLog({
            id: `load-output-invalid-${Date.now()}`,
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
            id: `load-output-denied-${Date.now()}`,
            level: 'WARN',
            message: result.reason,
            timestamp: new Date(),
          });
          return;
        }

        if (snapshot.savedAt && !Number.isNaN(Date.parse(snapshot.savedAt))) {
          markSaved(result.tabId, snapshot.savedAt);
        }

        notify('success', `出力ファイルを読み込みました: ${fileName} (${validCards.length}枚)`);
        pushLog({
          id: `load-output-success-${Date.now()}`,
          level: 'INFO',
          message: `出力ファイルを読み込みました: ${fileName} (${validCards.length}枚)`,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('[App] failed to load output file', error);
        notify('error', '出力ファイルの読み込み中にエラーが発生しました。');
        pushLog({
          id: `load-output-error-${Date.now()}`,
          level: 'ERROR',
          message: `出力ファイル読み込みエラー: ${fileName}`,
          timestamp: new Date(),
        });
      }
    },
    [activeLeafId, markSaved, notify, openTab, pushLog, sanitizeSnapshotCards, splitRoot, tabs],
  );

  const handleConversionFlowOpen = useCallback(() => {
    setConversionState((prev) => ({
      ...prev,
      isOpen: true,
      error: null,
      selectedStrategy: appSettings?.converter.strategy ?? prev.selectedStrategy,
      progressPercent: prev.converting ? prev.progressPercent : 0,
      progressMessage: prev.converting ? prev.progressMessage : '待機中',
    }));
  }, [appSettings]);

  const handleConversionFlowClose = useCallback(() => {
    let blocked = false;
    setConversionState((prev) => {
      if (prev.converting) {
        blocked = true;
        return prev;
      }
      return {
        ...buildConversionState(appSettings?.converter.strategy ?? prev.selectedStrategy),
        selectedStrategy: appSettings?.converter.strategy ?? prev.selectedStrategy,
      } satisfies ConversionModalDisplayState;
    });
    if (blocked) {
      notify('warning', '変換中は閉じられません。まず「変換を中断」を押してください。');
    }
  }, [appSettings, notify]);

  const handleConversionStrategyChange = useCallback(
    (strategy: ConverterStrategy) => {
      setConversionState((prev) => {
        if (prev.converting) {
          return prev;
        }
        return { ...prev, selectedStrategy: strategy } satisfies ConversionModalDisplayState;
      });
    },
    [],
  );

  const handleConversionWarningAck = useCallback((ack: boolean) => {
    setConversionState((prev) => ({ ...prev, warnAcknowledged: ack }));
  }, []);

  const handleCardIdPrefixChange = useCallback((prefix: string) => {
    setConversionState((prev) => ({ ...prev, cardIdPrefix: prefix }));
  }, []);

  const handleCardIdStartNumberChange = useCallback((startNumber: number) => {
    setConversionState((prev) => ({ ...prev, cardIdStartNumber: startNumber }));
  }, []);

  const handleCardIdDigitsChange = useCallback((digits: number) => {
    setConversionState((prev) => ({ ...prev, cardIdDigits: digits }));
  }, []);

  const handleCardIdAssignmentRuleChange = useCallback((rule: CardIdAssignmentRule) => {
    setConversionState((prev) => ({ ...prev, cardIdAssignmentRule: rule }));
  }, []);

  const handleConversionCancel = useCallback(() => {
    if (conversionState.converting) {
      setConversionState((prev) => ({ ...prev, cancelRequested: true, error: null }));
      const controller = conversionAbortControllerRef.current;
      if (controller && !controller.signal.aborted) {
        controller.abort();
      }
      return;
    }
    handleConversionFlowClose();
  }, [conversionState.converting, handleConversionFlowClose]);

  const handleConversionPickSource = useCallback(async () => {
    if (conversionState.converting) {
      notify('warning', '変換中は別の入力ファイルを選択できません。');
      return;
    }
    if (!window.app?.document?.pickSource) {
      notify('error', '入力ファイル取得APIが利用できません。');
      return;
    }
    setConversionState((prev) => ({ ...prev, picking: true, error: null, progressMessage: '入力ファイルを取得しています…' }));
    try {
      const result = await window.app.document.pickSource();
      if (!result || result.canceled) {
        setConversionState((prev) => ({ ...prev, picking: false }));
        return;
      }
      if ('error' in result) {
        setConversionState((prev) => ({ ...prev, picking: false, error: result.error.message }));
        notify('error', result.error.message);
        pushLog({
          id: `conversion-pick-error-${Date.now()}`,
          level: 'ERROR',
          message: `入力ファイルの読み込みに失敗しました: ${result.error.message}`,
          timestamp: new Date(),
        });
        return;
      }

      const doc = result.document;
      const { preview, lineCount } = summarizeContentPreview(doc.content);
      const summary: ConversionSourceSummary = {
        fileName: doc.fileName,
        baseName: doc.baseName,
        extension: doc.extension,
        sizeBytes: doc.sizeBytes,
        encoding: doc.encoding,
        isMarkdown: doc.isMarkdown,
        sizeStatus: doc.sizeStatus,
        content: doc.content,
        preview,
        lineCount,
        workspaceFileName: doc.workspaceFileName,
        workspacePath: doc.workspacePath,
      } satisfies ConversionSourceSummary;

      setConversionState((prev) => ({
        ...prev,
        picking: false,
        source: summary,
        warnAcknowledged: doc.sizeStatus !== 'warn',
        progressPercent: 0,
        progressMessage: '入力ファイルを読み込みました',
        cancelRequested: false,
        error: null,
      }));

      notify('success', `ファイルを読み込みました: ${doc.fileName}`);
      pushLog({
        id: `conversion-pick-${Date.now()}`,
        level: 'INFO',
        message: `入力ファイルを読み込みました: ${doc.fileName} (${formatHumanFileSize(doc.sizeBytes)})`,
        timestamp: new Date(),
      });
      await refreshFileList();
    } catch (error) {
      console.error('[App] failed to pick conversion source', error);
      setConversionState((prev) => ({ ...prev, picking: false, error: '入力ファイルの取得に失敗しました。' }));
      notify('error', '入力ファイルの取得に失敗しました。');
      pushLog({
        id: `conversion-pick-unexpected-${Date.now()}`,
        level: 'ERROR',
        message: '入力ファイルの取得中に予期せぬエラーが発生しました。',
        timestamp: new Date(),
      });
    }
  }, [conversionState.converting, notify, pushLog, refreshFileList]);

  const handleConversionExecute = useCallback(async () => {
    const source = conversionState.source;
    const strategy = conversionState.selectedStrategy;
    if (conversionState.converting) {
      return;
    }
    if (!source) {
      setConversionState((prev) => ({ ...prev, error: '入力ファイルを選択してください。' }));
      return;
    }
    if (source.sizeStatus === 'warn' && !conversionState.warnAcknowledged) {
      setConversionState((prev) => ({ ...prev, error: '警告に同意すると変換を実行できます。' }));
      return;
    }
    const targetLeafId = activeLeafId ?? (splitRoot.type === 'leaf' ? splitRoot.id : null);
    if (!targetLeafId) {
      notify('warning', 'カードを表示するパネルを選択してください。');
      pushLog({
        id: `conversion-no-panel-${Date.now()}`,
        level: 'WARN',
        message: 'カード変換結果を表示するパネルが見つかりません。',
        timestamp: new Date(),
      });
      return;
    }

    const normalized: NormalizedDocument = {
      fileName: source.fileName,
      baseName: source.baseName,
      extension: source.extension,
      content: source.content,
      isMarkdown: source.isMarkdown,
    } satisfies NormalizedDocument;

    const controller = new AbortController();
    conversionAbortControllerRef.current = controller;
    const startedAt = new Date();

    setConversionState((prev) => ({
      ...prev,
      converting: true,
      cancelRequested: false,
      error: null,
      progressPercent: Math.max(prev.progressPercent, 5),
      progressMessage: '変換ジョブを準備しています…',
    }));

    pushLog({
      id: `conversion-start-${startedAt.valueOf()}`,
      level: 'INFO',
      message: `カード変換を開始しました: ${source.fileName} (strategy=${strategy})`,
      timestamp: startedAt,
    });

    const normalizedDoc = normalized;

    try {
      const result = await convertDocument(normalizedDoc, strategy, {
        now: startedAt,
        signal: controller.signal,
        onProgress: (event) => {
          const phaseMessages: Record<string, string> = {
            prepare: '解析を準備しています…',
            convert: 'ドキュメントを解析しています…',
            complete: '変換結果を整えています…',
          };
          updateConversionProgress(event.percent, phaseMessages[event.phase] ?? '処理しています…');
        },
        // カードID自動付与設定を渡す
        cardIdOptions: {
          prefix: conversionState.cardIdPrefix,
          startNumber: conversionState.cardIdStartNumber,
          digits: conversionState.cardIdDigits,
          assignmentRule: conversionState.cardIdAssignmentRule,
        },
      });

      updateConversionProgress(80, 'カードファイルを保存しています…');

      const created = createUntitledTab(targetLeafId, {
        title: `${source.baseName}_${strategy}`,
        cards: result.cards,
      });
      if (!created) {
        throw new Error('タブの生成に失敗しました');
      }

      let savedFileName: string | null = null;
      let savedPath: string | null = null;
      const snapshot: WorkspaceSnapshot = {
        cards: result.cards,
        savedAt: startedAt.toISOString(),
      } satisfies WorkspaceSnapshot;

      if (window.app?.workspace?.saveCardFile) {
        try {
          const fileName = buildConvertedOutputFileName(source.baseName, strategy, startedAt);
          const response = await window.app.workspace.saveCardFile(fileName, snapshot);
          savedFileName = fileName;
          savedPath = response?.path ?? null;
          renameTabFile(created.id, fileName);
          markSaved(created.id, snapshot.savedAt);
        } catch (error) {
          console.error('[App] failed to persist converted cards', error);
          notify('warning', '変換結果の自動保存に失敗しました。カードは未保存タブとして保持します。');
        }
      }

      if (result.warnings.length > 0) {
        notify('warning', result.warnings.join('\n'));
      }

      notify('success', `カード変換が完了しました (${result.cards.length}枚)。${savedFileName ? `\n保存先: ${savedFileName}` : ''}`);
      pushLog({
        id: `conversion-success-${Date.now()}`,
        level: 'INFO',
        message: `カード変換成功: ${result.cards.length}枚 (strategy=${strategy}). 保存先: ${savedPath ?? savedFileName ?? '未保存'}`,
        timestamp: new Date(),
      });

      await refreshFileList();
      updateConversionProgress(100, '変換が完了しました');

      setConversionState((prev) => ({
        ...prev,
        converting: false,
        cancelRequested: false,
        isOpen: false,
        source: null,
        warnAcknowledged: false,
        error: null,
        progressPercent: 100,
        progressMessage: '変換が完了しました',
      }));
    } catch (error) {
      if (isAbortError(error)) {
        updateConversionProgress(100, '変換をキャンセルしました');
        setConversionState((prev) => ({ ...prev, converting: false, cancelRequested: false, error: null }));
        notify('info', 'カード変換をキャンセルしました。');
        pushLog({
          id: `conversion-cancel-${Date.now()}`,
          level: 'INFO',
          message: 'カード変換をキャンセルしました。',
          timestamp: new Date(),
        });
      } else {
        console.error('[App] card conversion failed', error);
        setConversionState((prev) => ({ ...prev, converting: false, cancelRequested: false, error: '変換処理に失敗しました。' }));
        notify('error', '変換処理に失敗しました。');
        pushLog({
          id: `conversion-failed-${Date.now()}`,
          level: 'ERROR',
          message: `カード変換に失敗しました: ${source.fileName}`,
          timestamp: new Date(),
        });
      }
    } finally {
      conversionAbortControllerRef.current = null;
    }
  }, [
    activeLeafId,
    conversionState.converting,
    conversionState.selectedStrategy,
    conversionState.source,
    conversionState.warnAcknowledged,
    createUntitledTab,
    markSaved,
    notify,
    pushLog,
    refreshFileList,
    renameTabFile,
    splitRoot,
    updateConversionProgress,
  ]);

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
    async (initialName?: string | null) => {
      const fallback = buildDefaultExportName();
      const suggestion = normalizeOutputFileName(initialName ?? '') ?? fallback;
      const dialogApi = window.app?.dialogs?.promptSaveFile;
      if (!dialogApi) {
        notify('error', '保存ダイアログAPIが利用できません。再起動後に再試行してください。');
        return null;
      }
      try {
        const result = await dialogApi({ defaultFileName: suggestion });
        if (!result || result.canceled || !result.fileName) {
          return null;
        }
        const normalized = normalizeOutputFileName(result.fileName);
        if (!normalized) {
          notify('error', 'ファイル名に使用できない文字が含まれています。');
          return null;
        }
        return normalized;
      } catch (error) {
        console.error('[renderer] failed to open save dialog', error);
        notify('error', '保存ダイアログの表示に失敗しました。');
        return null;
      }
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
        targetFileName = await promptExportFileName(activeTab.title ?? null);
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
        console.log('[saveActiveTab] Saving snapshot:', {
          fileName: normalized,
          cardCount: cards.length,
          cards: cards,
        });
        const result = await saveApi(normalized, snapshot);
        console.log('[saveActiveTab] Save result:', result);
        markSaved(activeTabId, snapshot.savedAt);
        if (!activeTab.fileName || activeTab.fileName !== normalized || options?.renameTab) {
          renameTabFile(activeTab.id, normalized);
        }
        const savedPath = result?.path ?? normalized;
        notify('success', `カードファイルを保存しました: ${normalized}\n保存先: ${savedPath}`);
        pushLog({
          id: `save-${startedAt.valueOf()}`,
          level: 'INFO',
          message: `カードファイルを保存しました (カード数: ${cards.length}件, 出力: ${savedPath})。`,
          timestamp: startedAt,
        });
        //! エクスプローラのファイル一覧を更新
        await refreshFileList();
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
    const requested = await promptExportFileName(suggested);
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
    if (!sidebarVisible) {
      return {
        gridTemplateColumns: 'minmax(0, 1fr)',
      } satisfies CSSProperties;
    }
    return {
      gridTemplateColumns: `${sidebarWidth}px ${V_SEPARATOR}px minmax(0, 1fr)`,
    } satisfies CSSProperties;
  }, [sidebarWidth, sidebarVisible]);

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

  /**
   * @brief サイドバー表示/非表示トグル。
   */
  const handleSidebarToggle = useCallback(() => {
    setSidebarVisible((prev) => {
      const next = !prev;
      const now = new Date();
      const message = next ? 'サイドバーを表示しました。' : 'サイドバーを非表示にしました。';
      notify('info', message);
      pushLog({
        id: `sidebar-toggle-${now.valueOf()}`,
        level: 'INFO',
        message,
        timestamp: now,
      });
      return next;
    });
  }, [notify, pushLog]);

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

  const executeSearch = useCallback(async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchError('検索キーワードを入力してください。');
      setSearchResults([]);
      return;
    }

    const matcher = createSearchMatcher(trimmed, searchUseRegex);
    if (!matcher.valid) {
      setSearchError(matcher.error ?? '検索条件が無効です。');
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      type Dataset = { source: 'open' | 'input'; tabId?: string; leafId?: string; fileName: string | null; cards: Card[] };
      const datasets: Dataset[] = [];
      const workspaceState = useWorkspaceStore.getState();

      if (searchScope === 'current') {
        const targetLeafId = effectiveLeafId;
        if (!targetLeafId) {
          setSearchError('検索対象のカードパネルが選択されていません。');
          setSearchResults([]);
          return;
        }
        const leafState = workspaceState.leafs[targetLeafId];
        const tabId = leafState?.activeTabId;
        if (!tabId) {
          setSearchError('アクティブなカードファイルがありません。');
          setSearchResults([]);
          return;
        }
        const tab = workspaceState.tabs[tabId];
        if (!tab) {
          setSearchError('アクティブタブが見つかりません。');
          setSearchResults([]);
          return;
        }
        datasets.push({ source: 'open', tabId, leafId: targetLeafId, fileName: tab.fileName, cards: tab.cards });
      } else if (searchScope === 'open') {
        Object.values(workspaceState.tabs).forEach((tab) => {
          datasets.push({ source: 'open', tabId: tab.id, leafId: tab.leafId, fileName: tab.fileName, cards: tab.cards });
        });
        if (datasets.length === 0) {
          setSearchError('開いているカードファイルがありません。');
          setSearchResults([]);
          return;
        }
      } else {
        if (!window.app?.workspace?.loadCardFile) {
          setSearchError('カードファイル読み込み機能が利用できません。');
          setSearchResults([]);
          return;
        }
        const listApi = window.app.workspace.listCardFiles?.bind(window.app.workspace);
        const fileList = cardFiles.length > 0 ? cardFiles : listApi ? await listApi() : [];
        for (const fileName of fileList) {
          try {
            const snapshot = await window.app.workspace.loadCardFile(fileName);
            if (snapshot?.cards) {
              datasets.push({ source: 'input', fileName, cards: snapshot.cards });
            }
          } catch (error) {
            console.error('[App] search load failed', fileName, error);
          }
        }
        if (datasets.length === 0) {
          setSearchError('検索対象となるカードファイルがありません。');
          setSearchResults([]);
          return;
        }
      }

      const nextResults: SearchResultItem[] = [];
      datasets.forEach((dataset) => {
        dataset.cards.forEach((card) => {
          const haystack = `${card.title ?? ''}\n${card.body ?? ''}`;
          const match = matcher.match(haystack);
          if (match.count > 0) {
            nextResults.push({
              id: `${dataset.fileName ?? dataset.tabId ?? 'untitled'}-${card.id}-${nextResults.length}`,
              source: dataset.source,
              fileName: dataset.fileName,
              tabId: dataset.tabId,
              leafId: dataset.leafId,
              cardId: card.id,
              cardTitle: card.title,
              snippet: buildSnippet(haystack, match),
              matchCount: match.count,
            });
          }
        });
      });

      setSearchResults(nextResults);
      setSearchError(nextResults.length === 0 ? '該当するカードがありません。' : null);
    } catch (error) {
      console.error('[App] search failed', error);
      setSearchError('検索処理中にエラーが発生しました。');
    } finally {
      setSearching(false);
    }
  }, [cardFiles, effectiveLeafId, searchQuery, searchScope, searchUseRegex]);

  const handleSearchResultNavigate = useCallback(
    async (result: SearchResultItem) => {
      const focusCard = (tabId: string, leafId: string, cardId: string) => {
        const store = useWorkspaceStore.getState();
        store.setActiveTab(leafId, tabId);
        store.selectCard(leafId, tabId, cardId);
        useSplitStore.getState().setActiveLeaf(leafId);
      };

      const workspaceState = useWorkspaceStore.getState();
      if (result.tabId && workspaceState.tabs[result.tabId]) {
        focusCard(result.tabId, workspaceState.tabs[result.tabId].leafId, result.cardId);
        return;
      }

      if (!result.fileName) {
        return;
      }

      const existingLeafId = workspaceState.fileToLeaf[result.fileName];
      if (existingLeafId) {
        const targetTab = Object.values(workspaceState.tabs).find((tab) => tab.fileName === result.fileName);
        if (targetTab) {
          focusCard(targetTab.id, targetTab.leafId, result.cardId);
          return;
        }
      }

      await handleLoadCardFile(result.fileName);
      const refreshed = useWorkspaceStore.getState();
      const leafId = refreshed.fileToLeaf[result.fileName];
      if (!leafId) {
        return;
      }
      const targetTab = Object.values(refreshed.tabs).find((tab) => tab.fileName === result.fileName && tab.leafId === leafId);
      if (targetTab) {
        focusCard(targetTab.id, leafId, result.cardId);
      }
    },
    [handleLoadCardFile],
  );

  const handleSearchSubmit = useCallback(
    (event: ReactFormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void executeSearch();
    },
    [executeSearch],
  );

  const handleSearchClear = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
  }, []);

  const searchStatusText = useMemo(() => {
    if (searching) {
      return '検索中...';
    }
    if (searchError) {
      return searchError;
    }
    if (searchResults.length === 0) {
      return 'まだ検索結果はありません';
    }
    return `${searchResults.length}件ヒット`;
  }, [searchError, searchResults.length, searching]);

  const searchStatusClass = useMemo(() => {
    return `sidebar__search-status${searchError ? ' sidebar__search-status--error' : ''}`;
  }, [searchError]);
  const canClearSearch = searchQuery.trim().length > 0 || searchResults.length > 0 || Boolean(searchError);

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
      const targetEditable = isEditableTarget(event.target);

      if (isSettingsOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeSettingsModal(false);
        }
        return;
      }

      if (primaryPressed) {
        if (targetEditable && !event.altKey && !event.shiftKey) {
          const passthroughKeys = ['c', 'v', 'x', 'a', 'z', 'y'];
          if (passthroughKeys.includes(key)) {
            return;
          }
        }

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

          if (key === 'b' && !event.shiftKey) {
            event.preventDefault();
            handleSidebarToggle();
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
    handleSidebarToggle,
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
      <UnsavedChangesDialog
        isOpen={isUnsavedChangesDialogOpen}
        unsavedTabCount={unsavedTabCount}
        isSaving={isSavingForClose}
        onAction={handleUnsavedChangesAction}
      />
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
      <ConversionModal
        state={conversionState}
        onClose={handleConversionFlowClose}
        onPickSource={handleConversionPickSource}
        onStrategyChange={handleConversionStrategyChange}
        onConvert={handleConversionExecute}
        onAcknowledgeWarning={handleConversionWarningAck}
        onCancelConversion={handleConversionCancel}
        onCardIdPrefixChange={handleCardIdPrefixChange}
        onCardIdStartNumberChange={handleCardIdStartNumberChange}
        onCardIdDigitsChange={handleCardIdDigitsChange}
        onCardIdAssignmentRuleChange={handleCardIdAssignmentRuleChange}
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
        <div className="toolbar-group toolbar-group--trace">
          <button
            type="button"
            className={`toolbar-button${sidebarVisible ? ' toolbar-button--active' : ''}`}
            title="サイドバー表示/非表示 (Ctrl+B)"
            aria-label="サイドバー表示/非表示"
            onClick={handleSidebarToggle}
          >
            🔖
          </button>
          <button
            type="button"
            className="toolbar-button"
            title="ファイルを開く"
            aria-label="ファイルを開く"
            onClick={handleConversionFlowOpen}
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
          <button
            type="button"
            className="toolbar-button"
            onClick={() => handleTraceCreate('forward')}
            disabled={traceBusy}
            aria-disabled={traceBusy}
            title="トレース👉作成"
            aria-label="トレース👉作成"
          >
            ➡️
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={() => handleTraceCreate('backward')}
            disabled={traceBusy}
            aria-disabled={traceBusy}
            title="トレース👈作成"
            aria-label="トレース👈作成"
          >
            ⬅️
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={() => handleTraceCreate('bidirectional')}
            disabled={traceBusy}
            aria-disabled={traceBusy}
            title="トレース⇔作成"
            aria-label="トレース⇔作成"
          >
            ↔️
          </button>
          <label className="toolbar-select" aria-label="トレース関係種別">
            <span className="sr-only">トレース関係種別</span>
            <select
              value={creationRelationKind}
              onChange={(event) => setCreationRelationKind(event.target.value as TraceRelationKind)}
            >
              {TRACE_RELATION_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="toolbar-button"
            onClick={handleTraceDelete}
            disabled={traceBusy}
            aria-disabled={traceBusy}
            title="トレース削除"
            aria-label="トレース削除"
          >
            💔
          </button>
          <button
            type="button"
            className={`toolbar-button${isTraceVisible ? ' toolbar-button--active' : ''}`}
            onClick={toggleTraceVisibility}
            title="トレース表示有効"
            aria-label="トレース表示有効"
          >
            ⛓️
          </button>
          <button
            type="button"
            className={`toolbar-button${excludeSelfTrace ? ' toolbar-button--active' : ''}`}
            onClick={toggleTraceRecirculation}
            title="トレース強調の還流許可 (ON: 自パネル除外)"
            aria-label="トレース強調の還流許可"
          >
            🔁
          </button>
          <button
            type="button"
            className={`toolbar-button${showOffscreenConnectors ? ' toolbar-button--active' : ''}`}
            onClick={toggleOffscreenConnectors}
            title="スクロール外カードのコネクタ表示"
            aria-label="スクロール外カードのコネクタ表示"
          >
            🛰️
          </button>
          <button
            type="button"
            className={`toolbar-button${markdownPreviewGlobalEnabled ? ' toolbar-button--active' : ''}`}
            onClick={toggleMarkdownPreviewGlobal}
            title="Markdownプレビュー一括切替"
            aria-label="Markdownプレビュー一括切替"
          >
            🅼
          </button>
          <button
            type="button"
            ref={traceFilterButtonRef}
            className={`toolbar-button${isRelationFilterDirty || isTraceFilterOpen ? ' toolbar-button--active' : ''}`}
            onClick={() => setTraceFilterOpen((prev) => !prev)}
            title="トレース種別表示フィルタ"
            aria-label="トレース種別表示フィルタ"
          >
            🧬
          </button>
          {isTraceFilterOpen ? (
            <div ref={traceFilterPopoverRef} className="trace-filter-popover">
              {TRACE_RELATION_KINDS.map((kind) => (
                <label key={kind} className="trace-filter-popover__item">
                  <input
                    type="checkbox"
                    checked={enabledRelationKinds[kind]}
                    onChange={() => toggleRelationKindPreference(kind)}
                  />
                  <span>{kind}</span>
                </label>
              ))}
              <div className="trace-filter-popover__actions">
                <button type="button" onClick={() => setAllRelationKinds(true)}>全選択</button>
                <button type="button" onClick={() => setAllRelationKinds(false)}>全解除</button>
              </div>
            </div>
          ) : null}
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
            className={`toolbar-button${isHelpOpen ? ' toolbar-button--active' : ''}`}
            onClick={() => setHelpOpen((prev) => !prev)}
            title="ショートカット/操作ヘルプ"
            aria-label="ショートカット/操作ヘルプを開く"
            aria-haspopup="dialog"
            aria-expanded={isHelpOpen}
          >
            ❔
          </button>
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
          {sidebarVisible && (
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
                  <li role="treeitem" aria-expanded="true">
                    📁 _out
                    <ul role="group">
                      {outputFiles.length === 0 ? (
                        <li role="treeitem" className="sidebar__tree-empty">
                          出力ファイルがありません
                        </li>
                      ) : (
                        outputFiles.map((file) => (
                          <li
                            key={file}
                            role="treeitem"
                            className="sidebar__tree-file"
                            onDoubleClick={() => handleLoadOutputFile(file)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                void handleLoadOutputFile(file);
                              }
                            }}
                            tabIndex={0}
                            title={`ダブルクリックして ${file} を読み込む (_out)`}
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
                <form className="sidebar__search-form" onSubmit={handleSearchSubmit}>
                  <label className="sidebar__label" htmlFor="sidebar-search">
                    🔍 検索
                  </label>
                  <input
                    id="sidebar-search"
                    ref={searchInputRef}
                    className="sidebar__search"
                    type="search"
                    autoComplete="off"
                    placeholder="キーワードを入力"
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      if (searchError) {
                        setSearchError(null);
                      }
                    }}
                  />
                  <div className="sidebar__search-options">
                    <label className="sidebar__search-field">
                      <span className="sidebar__search-field-label">検索範囲</span>
                      <select
                        className="sidebar__search-select"
                        value={searchScope}
                        onChange={(event) => setSearchScope(event.target.value as SearchScope)}
                      >
                        {searchScopeEntries.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="sidebar__search-field sidebar__search-field--checkbox">
                      <input
                        type="checkbox"
                        checked={searchUseRegex}
                        onChange={(event) => setSearchUseRegex(event.target.checked)}
                      />
                      <span>正規表現</span>
                    </label>
                  </div>
                  <div className="sidebar__search-actions">
                    <button
                      type="submit"
                      className="sidebar__search-button"
                      disabled={searching}
                    >
                      {searching ? '検索中…' : '検索実行'}
                    </button>
                    <button
                      type="button"
                      className="sidebar__search-button sidebar__search-button--ghost"
                      onClick={handleSearchClear}
                      disabled={!canClearSearch}
                    >
                      クリア
                    </button>
                  </div>
                  <div className={searchStatusClass} aria-live="polite">
                    {searchStatusText}
                  </div>
                </form>
                {searchResults.length > 0 ? (
                  <ul className="search-results" role="list">
                    {searchResults.map((result) => (
                      <li key={result.id}>
                        <button
                          type="button"
                          className="search-results__item"
                          onClick={() => {
                            void handleSearchResultNavigate(result);
                          }}
                        >
                          <div className="search-results__meta">
                            <span className="search-results__scope">{result.source === 'open' ? '開いているタブ' : '_input'}</span>
                            <span className="search-results__file">{result.fileName ?? '未保存タブ'}</span>
                            <span className="search-results__count">{result.matchCount}件</span>
                          </div>
                          <div className="search-results__title">{result.cardTitle || '無題カード'}</div>
                          <p className="search-results__snippet">{result.snippet || '（本文なし）'}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </aside>
          )}

          {sidebarVisible && (
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
          )}

          <section className="panels" aria-label="カードパネル領域">
            <div className="panels__body">
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
            </div>
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
            <div className="log-area__title">
              <span>動作ログ</span>
              <span className="log-area__counter">
                {displayedLogs.length} / {logs.length}
              </span>
            </div>
            <div className="log-area__filters">
              <label className="sr-only" htmlFor="log-level-filter">
                ログレベル
              </label>
              <select
                id="log-level-filter"
                className="log-area__select"
                value={logLevelFilter}
                onChange={(event) => setLogLevelFilter(event.target.value as (typeof logLevelOptions)[number])}
              >
                {logLevelOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'ALL' ? 'すべて' : option}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="log-keyword-filter">
                キーワード
              </label>
              <input
                id="log-keyword-filter"
                className="log-area__filter-input"
                type="search"
                placeholder="キーワード"
                value={logFilterKeyword}
                onChange={(event) => setLogFilterKeyword(event.target.value)}
              />
              <button type="button" className="log-area__clear" onClick={clearLogs}>
                ログをクリア
              </button>
            </div>
          </header>
          <pre className="log-area__body" aria-live="polite">
            {displayedLogs.length === 0 ? (
              <span key="log-empty">該当するログがありません。</span>
            ) : (
              displayedLogs.map((entry) => (
                <span key={entry.id}>
                  {`[${entry.timestamp.toLocaleString()}] ${entry.level}: ${entry.message}`}
                  {'\n'}
                </span>
              ))
            )}
          </pre>
        </section>
      </section>

      <footer className="status-bar" aria-label="ステータスバー">
        <div className="status-bar__section">
          <span>総カード数: {cardCount}</span>
          <span>選択カード: {selectedDisplayNumber}</span>
          <span>{saveStatusText}</span>
        </div>
        {conversionState.converting && (
          <div className="status-bar__section status-bar__section--progress">
            <span>
              変換中 ({conversionState.progressPercent}%) : {conversionState.progressMessage}
            </span>
          </div>
        )}
        <div className="status-bar__section status-bar__section--right">
          <span>文字コード: UTF-8</span>
          <span>テーマ: {themeLabel}</span>
          <span>接続状態: {ipcStatus}</span>
        </div>
      </footer>

      {isHelpOpen ? (
        <div className="help-overlay" role="dialog" aria-modal="true" aria-label="ショートカットと操作一覧">
          <div className="help-overlay__backdrop" onClick={() => setHelpOpen(false)} />
          <div className="help-overlay__panel" role="document">
            <header className="help-overlay__header">
              <h2>ショートカットと操作一覧</h2>
              <button type="button" className="help-overlay__close" onClick={() => setHelpOpen(false)} aria-label="ヘルプを閉じる">
                ✕
              </button>
            </header>
            <div className="help-overlay__body">
              {SHORTCUT_GROUPS.map((group) => (
                <section key={group.title} className="help-overlay__group">
                  <h3>{group.title}</h3>
                  <ul className="help-overlay__list">
                    {group.entries.map((entry) => (
                      <li key={`${group.title}-${entry.keys}`} className="help-overlay__item">
                        <span className="help-overlay__keys">{entry.keys}</span>
                        <span className="help-overlay__description">{entry.description}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
