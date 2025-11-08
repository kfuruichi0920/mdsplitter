/**
 * @file CardPanel.tsx
 * @brief カードパネルコンポーネント。
 * @details
 * タブバー、パネルツールバー、カード一覧を含むカードパネルの UI を提供する。
 * 各分割ノード（葉ノード）に表示される。
 * @author K.Furuichi
 * @date 2025-11-03
 * @version 0.1
 * @copyright MIT
 */

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ChangeEvent } from 'react';
import type { Card, CardKind, CardStatus, PanelTabState, InsertPosition } from '../store/workspaceStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useUiStore } from '../store/uiStore';
import { useCardConnectorAnchor } from '../hooks/useConnectorLayout';

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
 * @brief カードパネルコンポーネントのプロパティ。
 */
export interface CardPanelProps {
  leafId: string; ///< 葉ノードID。
  isActive?: boolean; ///< アクティブ葉ノードかどうか。
  onLog?: (level: 'INFO' | 'WARN' | 'ERROR', message: string) => void; ///< ログ出力コールバック。
  onPanelClick?: (leafId: string) => void; ///< パネルクリック時のコールバック。
  onPanelClose?: (leafId: string) => void; ///< パネルクローズ時のコールバック。
}

/**
 * @brief カードパネルコンポーネント。
 * @details
 * タブバー、ツールバー、カード一覧を含むカードパネルを描画する。
 */
export const CardPanel = ({ leafId, isActive = false, onLog, onPanelClick, onPanelClose }: CardPanelProps) => {
  const panelScrollRef = useRef<HTMLDivElement | null>(null);
  const [draggedCardIds, setDraggedCardIds] = useState<string[]>([]);
  const [dropTarget, setDropTarget] = useState<{ cardId: string; position: 'before' | 'after' | 'child' } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ card: Card; x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const [toolbarInsertMode, setToolbarInsertMode] = useState<InsertPosition>('after');
  const [previewIndicator, setPreviewIndicator] = useState<{ cardId: string | null; position: InsertPosition; highlightIds: string[] } | null>(null);

  const leafTabs = useWorkspaceStore(
    useCallback((state) => {
      const leaf = state.leafs[leafId];
      if (!leaf) {
        return [] as PanelTabState[];
      }
      return leaf.tabIds
        .map((tabId) => state.tabs[tabId])
        .filter((tab): tab is PanelTabState => Boolean(tab));
    }, [leafId]),
  );
  const activeTabId = useWorkspaceStore(
    useCallback((state) => state.leafs[leafId]?.activeTabId ?? null, [leafId]),
  );
  const selectCard = useWorkspaceStore((state) => state.selectCard);
  const setActiveTab = useWorkspaceStore((state) => state.setActiveTab);
  const closeTab = useWorkspaceStore((state) => state.closeTab);
  const createUntitledTab = useWorkspaceStore((state) => state.createUntitledTab);
  const moveCards = useWorkspaceStore((state) => state.moveCards);
  const addCard = useWorkspaceStore((state) => state.addCard);
  const deleteCards = useWorkspaceStore((state) => state.deleteCards);
  const copySelection = useWorkspaceStore((state) => state.copySelection);
  const pasteClipboard = useWorkspaceStore((state) => state.pasteClipboard);
  const clipboardData = useWorkspaceStore((state) => state.clipboard);
  const lastInsertPreview = useWorkspaceStore(
    useCallback((state) => state.lastInsertPreview, []),
  );
  const setEditingCard = useWorkspaceStore((state) => state.setEditingCard);
  const updateCard = useWorkspaceStore((state) => state.updateCard);
  const cardDisplayMode = useUiStore((state) => state.cardDisplayMode);
  const toggleCardDisplayMode = useUiStore((state) => state.toggleCardDisplayMode);
  const hasClipboardItems = Boolean(clipboardData && clipboardData.length > 0);

  const activeTab = useMemo<PanelTabState | null>(() => {
    if (!activeTabId) {
      return null;
    }
    return leafTabs.find((tab) => tab.id === activeTabId) ?? null;
  }, [activeTabId, leafTabs]);

  const activeFileIdentifier = activeTab ? activeTab.fileName ?? `unsaved-${activeTab.id}` : '';

  useEffect(() => {
    if (!lastInsertPreview || !activeTabId) {
      return;
    }
    if (lastInsertPreview.leafId !== leafId || lastInsertPreview.tabId !== activeTabId) {
      return;
    }
    setPreviewIndicator({
      cardId: lastInsertPreview.cardId,
      position: lastInsertPreview.position,
      highlightIds: lastInsertPreview.highlightIds,
    });
    const timer = window.setTimeout(() => {
      setPreviewIndicator(null);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [lastInsertPreview, leafId, activeTabId]);

  const cards = activeTab?.cards ?? [];
  const selectedCardIds = activeTab?.selectedCardIds ?? new Set<string>();
  const expandedCardIds = activeTab?.expandedCardIds ?? new Set<string>();
  const editingCardId = activeTab?.editingCardId ?? null;
  const cardCount = cards.length;
  const hasSelection = selectedCardIds.size > 0;
  const visualDropTarget = dropTarget ?? previewIndicator;
  const highlightedIds = useMemo(() => new Set(previewIndicator?.highlightIds ?? []), [previewIndicator]);

  /**
   * @brief 階層構造を考慮して表示すべきカードをフィルタリングする。
   * @details
   * 親が折畳まれている場合、その子カードは表示しない。
   * @return 表示対象のカードリスト。
   */
  const visibleCards = useMemo(() => {
    const result: Card[] = [];
    const cardMap = new Map(cards.map((c) => [c.id, c]));

    /**
     * @brief カードとその子孫が表示可能かを判定する。
     * @param card 判定対象のカード。
     * @return 表示可能な場合true。
     */
    const isVisible = (card: Card): boolean => {
      if (!card.parent_id) {
        return true; //! ルートカードは常に表示
      }
      const parent = cardMap.get(card.parent_id);
      if (!parent) {
        return true; //! 親が見つからない場合は表示
      }
      if (!expandedCardIds.has(parent.id)) {
        return false; //! 親が折畳まれている場合は非表示
      }
      return isVisible(parent); //! 再帰的に祖先を確認
    };

    cards.forEach((card) => {
      if (isVisible(card)) {
        result.push(card);
      }
    });

    return result;
  }, [cards, expandedCardIds]);

  /**
   * @brief アクティブタブを変更する。
   * @param tabId タブID。
   */
  const handleTabActivate = useCallback(
    (tabId: string) => {
      setActiveTab(leafId, tabId);
      const target = leafTabs.find((tab) => tab.id === tabId);
      if (target) {
        onLog?.('INFO', `タブ「${target.title}」を表示しました。`);
      }
    },
    [leafId, leafTabs, onLog, setActiveTab],
  );

  /**
   * @brief タブを閉じる。
   * @param tabId タブID。
   */
  const handleTabClose = useCallback(
    (tabId: string) => {
      const target = leafTabs.find((tab) => tab.id === tabId);

      // 未保存変更がある場合は確認ダイアログを表示
      if (target?.isDirty) {
        const confirmed = window.confirm(
          `タブ「${target.title}」には未保存の変更があります。\n\n保存せずに閉じますか?`
        );
        if (!confirmed) {
          onLog?.('INFO', `タブ「${target.title}」のクローズをキャンセルしました。`);
          return;
        }
      }

      closeTab(leafId, tabId);
      if (target) {
        onLog?.('INFO', `タブ「${target.title}」を閉じました。`);
      }
    },
    [closeTab, leafId, leafTabs, onLog],
  );

  const handleCreateNewTab = useCallback(() => {
    const created = createUntitledTab(leafId);
    if (created) {
      onLog?.('INFO', `新規カードファイルを作成しました: ${created.title}`);
    }
  }, [createUntitledTab, leafId, onLog]);

  const handleAddCard = useCallback(() => {
    if (!activeTabId) {
      return;
    }
    const created = addCard(leafId, activeTabId, { position: toolbarInsertMode });
    if (!created) {
      onLog?.('WARN', 'カードを追加できませんでした。');
      return;
    }
    onLog?.('INFO', `カード「${created.title || '新規カード'}」を追加しました。（${toolbarInsertMode === 'before' ? '前' : toolbarInsertMode === 'child' ? '子' : '後'}に挿入）`);
  }, [activeTabId, addCard, leafId, onLog, toolbarInsertMode]);

  const handleDeleteCards = useCallback(() => {
    if (!activeTabId || selectedCardIds.size === 0) {
      return;
    }
    const confirmAvailable = typeof window !== 'undefined' && typeof window.confirm === 'function';
    if (confirmAvailable && !window.confirm('選択中のカードを削除します。よろしいですか？')) {
      return;
    }
    const deleted = deleteCards(leafId, activeTabId);
    if (deleted > 0) {
      onLog?.('INFO', `${deleted}件のカードを削除しました。`);
    } else {
      onLog?.('WARN', 'カードを削除できませんでした。');
    }
  }, [activeTabId, deleteCards, leafId, onLog, selectedCardIds]);

  const handleCardContextMenu = useCallback(
    (card: Card, event: React.MouseEvent) => {
      if (!activeTabId) {
        return;
      }
      if (!selectedCardIds.has(card.id)) {
        selectCard(leafId, activeTabId, card.id);
      }
      setContextMenu({ card, x: event.clientX, y: event.clientY });
    },
    [activeTabId, leafId, selectCard, selectedCardIds],
  );

  const handleContextAction = useCallback(
    (position: InsertPosition) => {
      if (!activeTabId || !contextMenu) {
        return;
      }
      const created = addCard(leafId, activeTabId, { anchorCardId: contextMenu.card.id, position });
      if (created) {
        onLog?.('INFO', `カード「${created.title || '新規カード'}」を${position === 'before' ? '前' : position === 'child' ? '子' : '後'}に追加しました。`);
      }
      setContextMenu(null);
    },
    [activeTabId, addCard, contextMenu, leafId, onLog],
  );

  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    const handleClose = (event: MouseEvent) => {
      if (contextMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setContextMenu(null);
    };
    const handleEsc = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };
    window.addEventListener('mousedown', handleClose);
    window.addEventListener('contextmenu', handleClose);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('mousedown', handleClose);
      window.removeEventListener('contextmenu', handleClose);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [contextMenu]);

  /**
   * @brief パネルクリック時の処理。
   * @details
   * パネル全体のクリックで onPanelClick コールバックを呼び出す。
   */
  const handlePanelClick = useCallback(() => {
    onPanelClick?.(leafId);
  }, [leafId, onPanelClick]);

  /**
   * @brief パネルクローズ時の処理。
   * @details
   * クリックイベントの伝播を防ぎ、onPanelClose コールバックを呼び出す。
   * @param event マウスイベント。
   */
  const handlePanelClose = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation(); //! パネルクリックイベントの伝播を防ぐ
      onPanelClose?.(leafId);
    },
    [leafId, onPanelClose],
  );

  /**
   * @brief カードを選択する。
   * @details
   * Ctrl/Cmdで複数選択、Shiftで範囲選択に対応。
   * @param card 対象カード。
   * @param event マウスイベント（Ctrl/Shift判定用）。
   */
  const handleCardSelect = useCallback(
    (card: Card, event?: React.MouseEvent) => {
      if (!activeTabId) {
        return;
      }

      const isCtrlOrCmd = event?.ctrlKey || event?.metaKey;
      const isShift = event?.shiftKey;

      if (isCtrlOrCmd) {
        //! Ctrl/Cmd+クリック: 複数選択トグル
        selectCard(leafId, activeTabId, card.id, { multi: true });
        onLog?.('INFO', `カード「${card.title}」を複数選択しました。`);
      } else if (isShift) {
        //! Shift+クリック: 範囲選択
        selectCard(leafId, activeTabId, card.id, { range: true });
        onLog?.('INFO', `カード「${card.title}」まで範囲選択しました。`);
      } else {
        //! 通常クリック: 単一選択
        if (selectedCardIds.size === 1 && selectedCardIds.has(card.id)) {
          return; //! 既に単一選択済みなら何もしない
        }
        selectCard(leafId, activeTabId, card.id);
        onLog?.('INFO', `カード「${card.title}」を選択しました。`);
      }
    },
    [activeTabId, leafId, onLog, selectCard, selectedCardIds],
  );

  /**
   * @brief キーボード操作でカードを選択する。
   * @details
   * Enter/Spaceキーでカード選択。その他キーは無視。
   * @param event キーイベント。
   * @param card 対象カード。
   */
  const handleCardKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>, card: Card) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return; //! 対象キー以外は無視
      }
      event.preventDefault();
      //! キーボードイベントをマウスイベント風に変換
      const pseudoEvent = {
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
      } as React.MouseEvent;
      handleCardSelect(card, pseudoEvent);
    },
    [handleCardSelect],
  );

  /**
   * @brief カード表示モードを切り替える。
   * @details
   * コンパクト/詳細モードをトグルし、ログに記録する。
   */
  const handleToggleDisplayMode = useCallback(() => {
    toggleCardDisplayMode();
    const nextMode = cardDisplayMode === 'detailed' ? 'コンパクト' : '詳細';
    onLog?.('INFO', `カード表示モードを「${nextMode}」に切り替えました。`);
  }, [cardDisplayMode, onLog, toggleCardDisplayMode]);

  /**
   * @brief 全カードを展開する。
   */
  const handleExpandAll = useCallback(() => {
    if (!activeTabId) return;
    useWorkspaceStore.getState().expandAll(leafId, activeTabId);
    onLog?.('INFO', 'すべてのカードを展開しました。');
  }, [activeTabId, leafId, onLog]);

  /**
   * @brief 全カードを折畳む。
   */
  const handleCollapseAll = useCallback(() => {
    if (!activeTabId) return;
    useWorkspaceStore.getState().collapseAll(leafId, activeTabId);
    onLog?.('INFO', 'すべてのカードを折畳みました。');
  }, [activeTabId, leafId, onLog]);

  const handleCopySelected = useCallback(() => {
    if (!activeTabId) {
      return;
    }
    const count = copySelection(leafId, activeTabId);
    if (count > 0) {
      onLog?.('INFO', `${count}件のカードをコピーしました。`);
    } else {
      onLog?.('WARN', 'コピーするカードが選択されていません。');
    }
    setContextMenu(null);
  }, [activeTabId, copySelection, leafId, onLog]);

  const handlePasteIntoSelection = useCallback(() => {
    if (!activeTabId) {
      return;
    }
    if (!hasClipboardItems) {
      onLog?.('WARN', '貼り付け可能なカードがありません。');
      return;
    }
    const result = pasteClipboard(leafId, activeTabId, { position: toolbarInsertMode });
    if (result && result.inserted > 0) {
      onLog?.('INFO', `${result.inserted}件のカードを貼り付けました。`);
    }
  }, [activeTabId, hasClipboardItems, leafId, onLog, pasteClipboard, toolbarInsertMode]);

  const handleContextPaste = useCallback(
    (position: InsertPosition, anchorId: string) => {
      if (!activeTabId) {
        setContextMenu(null);
        return;
      }
      if (!hasClipboardItems) {
        onLog?.('WARN', '貼り付け可能なカードがありません。');
        return;
      }
      const result = pasteClipboard(leafId, activeTabId, { position, anchorCardId: anchorId });
      if (result && result.inserted > 0) {
        onLog?.('INFO', `${result.inserted}件のカードを貼り付けました。`);
      }
      setContextMenu(null);
    },
    [activeTabId, hasClipboardItems, leafId, onLog, pasteClipboard],
  );

  /**
   * @brief ドラッグ開始時の処理。
   * @param cardId ドラッグ開始したカードID。
   */
  const handleDragStart = useCallback(
    (cardId: string) => {
      //! 選択中のカードをドラッグ対象にする
      const cardsToMove = selectedCardIds.has(cardId) ? Array.from(selectedCardIds) : [cardId];
      setDraggedCardIds(cardsToMove);
      onLog?.('INFO', `${cardsToMove.length}件のカードをドラッグ中...`);
    },
    [onLog, selectedCardIds],
  );

  /**
   * @brief ドラッグオーバー時の処理。
   * @param cardId ドラッグオーバーしたカードID。
   * @param position ドロップ位置。
   */
  const handleDragOver = useCallback(
    (cardId: string, position: 'before' | 'after' | 'child') => {
      setDropTarget({ cardId, position });
    },
    [],
  );

  /**
   * @brief ドロップ時の処理。
   */
  const handleDrop = useCallback(() => {
    if (!activeTabId || !dropTarget || draggedCardIds.length === 0) {
      setDraggedCardIds([]);
      setDropTarget(null);
      return;
    }

    const success = moveCards(leafId, activeTabId, draggedCardIds, dropTarget.cardId, dropTarget.position);
    if (success) {
      onLog?.('INFO', `${draggedCardIds.length}件のカードを移動しました。`);
    } else {
      onLog?.('WARN', 'カードの移動に失敗しました。');
    }

    setDraggedCardIds([]);
    setDropTarget(null);
  }, [activeTabId, draggedCardIds, dropTarget, leafId, moveCards, onLog]);

  /**
   * @brief ドラッグ終了時の処理。
   */
  const handleDragEnd = useCallback(() => {
    setDraggedCardIds([]);
    setDropTarget(null);
  }, []);

  /**
   * @brief カードをダブルクリックして編集モードに移行する。
   * @param card 対象カード。
   */
  const handleCardDoubleClick = useCallback(
    (card: Card) => {
      if (!activeTabId) {
        return;
      }
      setEditingCard(leafId, activeTabId, card.id);
      onLog?.('INFO', `カード「${card.title}」を編集モードにしました。`);
    },
    [activeTabId, leafId, onLog, setEditingCard],
  );

  /**
   * @brief カードの編集を確定する。
   * @param cardId 対象カードID。
   * @param patch カードの変更内容。
   */
  const handleUpdateCard = useCallback(
    (cardId: string, patch: { title?: string; body?: string }) => {
      if (!activeTabId) {
        return;
      }
      updateCard(leafId, activeTabId, cardId, patch);
      setEditingCard(leafId, activeTabId, null);
      onLog?.('INFO', 'カードの編集を保存しました。');
    },
    [activeTabId, leafId, onLog, setEditingCard, updateCard],
  );

  /**
   * @brief カードの編集をキャンセルする。
   */
  const handleCancelEdit = useCallback(() => {
    if (!activeTabId) {
      return;
    }
    setEditingCard(leafId, activeTabId, null);
    onLog?.('INFO', 'カードの編集をキャンセルしました。');
  }, [activeTabId, leafId, onLog, setEditingCard]);

  return (
    <div
      className={`split-node${isActive ? ' split-node--active' : ''}`}
      data-leaf-id={leafId}
      data-active={isActive ? 'true' : 'false'}
      onClick={handlePanelClick}
    >
      {/* タブバー: 各カードファイルのタブを表示 */}
      <div className="tab-bar" role="tablist" aria-label="カードファイルタブ">
        {leafTabs.length === 0 ? (
          <span className="tab-bar__empty">カードファイルが開かれていません</span>
        ) : (
          leafTabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const tabClass = `tab-bar__tab${isActive ? ' tab-bar__tab--active' : ''}`;
            return (
              <div key={tab.id} className="tab-bar__tab-container" data-tab-id={tab.id}>
                <button
                  type="button"
                  className={tabClass}
                  onClick={() => handleTabActivate(tab.id)}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`panel-${leafId}-${tab.id}`}
                  title={tab.title}
                >
                  <span aria-hidden="true">📄 </span>
                  <span className="tab-bar__tab-title">{tab.title}</span>
                  {tab.isDirty ? <span className="tab-bar__tab-dirty">●</span> : null}
                </button>
                <button
                  type="button"
                  className="tab-bar__tab-close"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleTabClose(tab.id);
                  }}
                  aria-label={`${tab.title} を閉じる`}
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
        <button
          type="button"
          className="tab-bar__tab tab-bar__tab--add"
          onClick={(event) => {
            event.stopPropagation();
            handleCreateNewTab();
          }}
          aria-label="新規カードファイルを作成"
          title="新規カードファイルを作成"
        >
          ➕
        </button>
        <div className="tab-bar__spacer" />
        <button
          type="button"
          className="tab-bar__close"
          onClick={(event) => {
            event.stopPropagation();
            onPanelClose?.(leafId);
          }}
          aria-label="パネルを閉じる"
          title="パネルを閉じる"
        >
          ✕
        </button>
      </div>

      {/* パネルツールバー: 各種操作ボタン・フィルタ・メタ情報 */}
      <div className="panel-toolbar">
        <div className="panel-toolbar__group">
          <button
            type="button"
            className="panel-toolbar__button"
            onClick={handleExpandAll}
            title="すべて展開"
            aria-label="すべて展開"
          >
            ⏬
          </button>
          <button
            type="button"
            className="panel-toolbar__button"
            onClick={handleCollapseAll}
            title="すべて折畳"
            aria-label="すべて折畳"
          >
            ⏫
          </button>
        </div>
        <div className="panel-toolbar__group">
          <button
            type="button"
            className="panel-toolbar__button"
            onClick={handleAddCard}
            disabled={!activeTabId}
            aria-disabled={!activeTabId}
            title={`選択中カードの${toolbarInsertMode === 'before' ? '前' : toolbarInsertMode === 'child' ? '子' : '後'}に追加`}
          >
            ➕
          </button>
          <label className="panel-toolbar__select-wrapper">
            <span className="sr-only">挿入モード</span>
            <select
              className="panel-toolbar__select"
              value={toolbarInsertMode}
              onChange={(event) => setToolbarInsertMode(event.target.value as InsertPosition)}
              aria-label="挿入モード"
            >
              <option value="before">前に追加</option>
              <option value="after">後に追加</option>
              <option value="child">子として追加</option>
            </select>
          </label>
          <button
            type="button"
            className="panel-toolbar__button"
            onClick={handleDeleteCards}
            disabled={!activeTabId || selectedCardIds.size === 0}
            aria-disabled={!activeTabId || selectedCardIds.size === 0}
            title="選択中カードを削除"
          >
            🗑️
          </button>
          <button
            type="button"
            className="panel-toolbar__button"
            onClick={handleCopySelected}
            disabled={!activeTabId || !hasSelection}
            aria-disabled={!activeTabId || !hasSelection}
            title="選択中カードをコピー (Ctrl+C)"
          >
            📋
          </button>
          <button
            type="button"
            className="panel-toolbar__button"
            onClick={handlePasteIntoSelection}
            disabled={!activeTabId || !hasClipboardItems}
            aria-disabled={!activeTabId || !hasClipboardItems}
            title="クリップボードを貼り付け (Ctrl+V)"
          >
            📥
          </button>
        </div>
        <div className="panel-toolbar__group">
          <input className="panel-toolbar__input" placeholder="🔍 文字列フィルタ" aria-label="文字列フィルタ" />
          <button type="button" className="panel-toolbar__button" title="カード種別フィルタ" aria-label="カード種別フィルタ">
            📚
          </button>
          <button type="button" className="panel-toolbar__button" title="トレースのみ表示" aria-label="トレースのみ表示">
            🪢
          </button>
        </div>
        <div className="panel-toolbar__group">
          <button
            type="button"
            className={`panel-toolbar__button${cardDisplayMode === 'compact' ? ' panel-toolbar__button--active' : ''}`}
            onClick={handleToggleDisplayMode}
            title={cardDisplayMode === 'detailed' ? 'コンパクト表示に切替' : '詳細表示に切替'}
            aria-label={cardDisplayMode === 'detailed' ? 'コンパクト表示に切替' : '詳細表示に切替'}
          >
            ☰
          </button>
        </div>
        <div className="panel-toolbar__spacer" />
        <div className="panel-toolbar__meta">カード総数: {cardCount}</div>
      </div>

      {/* カード一覧: 各カードをリスト表示 */}
      <div
        className="panel-cards"
        role="list"
        ref={panelScrollRef}
        id={activeTab ? `panel-${leafId}-${activeTab.id}` : undefined}
      >
        {visibleCards.map((card) => (
          <CardListItem
            key={card.id}
            card={card}
            leafId={leafId}
            fileName={activeFileIdentifier}
            isSelected={selectedCardIds.has(card.id)}
            isExpanded={expandedCardIds.has(card.id)}
            hasChildren={card.child_ids.length > 0}
            isEditing={editingCardId === card.id}
            displayMode={cardDisplayMode}
            onSelect={handleCardSelect}
            onKeyDown={handleCardKeyDown}
            onToggleExpand={() => {
              if (activeTabId) {
                useWorkspaceStore.getState().toggleCardExpanded(leafId, activeTabId, card.id);
              }
            }}
            onDoubleClick={handleCardDoubleClick}
            onUpdateCard={handleUpdateCard}
            onCancelEdit={handleCancelEdit}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            onContextMenu={handleCardContextMenu}
            panelScrollRef={panelScrollRef}
            currentDropTarget={visualDropTarget}
            draggedCardIds={draggedCardIds}
            highlightIds={highlightedIds}
          />
        ))}
        {visibleCards.length === 0 && cards.length > 0 && (
          <div className="panel-cards__empty" role="note">
            すべてのカードが折畳まれています。
          </div>
        )}
        {cards.length === 0 && (
          <div className="panel-cards__empty" role="note">
            表示するカードがありません。
          </div>
        )}
      </div>
      {contextMenu ? (
        <div
          ref={contextMenuRef}
          className="panel-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          role="menu"
        >
          <div className="panel-context-menu__section">
            <button type="button" className="panel-context-menu__item" onClick={() => handleContextAction('before')}>
              ⬆︎ 選択カードの前に追加
            </button>
            <button type="button" className="panel-context-menu__item" onClick={() => handleContextAction('after')}>
              ⬇︎ 選択カードの後に追加
            </button>
            <button type="button" className="panel-context-menu__item" onClick={() => handleContextAction('child')}>
              ➡︎ 子として追加
            </button>
          </div>
          <div className="panel-context-menu__divider" />
          <div className="panel-context-menu__section">
            <button type="button" className="panel-context-menu__item" onClick={handleCopySelected}>
              📋 選択中カードをコピー
            </button>
            <button
              type="button"
              className="panel-context-menu__item"
              onClick={() => handleContextPaste('before', contextMenu.card.id)}
              disabled={!hasClipboardItems}
            >
              ⬆︎ ここに貼り付け (前)
            </button>
            <button
              type="button"
              className="panel-context-menu__item"
              onClick={() => handleContextPaste('after', contextMenu.card.id)}
              disabled={!hasClipboardItems}
            >
              ⬇︎ ここに貼り付け (後)
            </button>
            <button
              type="button"
              className="panel-context-menu__item"
              onClick={() => handleContextPaste('child', contextMenu.card.id)}
              disabled={!hasClipboardItems}
            >
              ➡︎ 子として貼り付け
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

/**
 * @brief 編集可能なカードコンポーネントのプロパティ。
 */
interface EditableCardProps {
  card: Card;
  onSave: (cardId: string, patch: { title?: string; body?: string }) => void;
  onCancel: () => void;
}

/**
 * @brief 編集可能なカードコンポーネント。
 * @details
 * カードをインライン編集するためのUI。
 * タイトルと本文を編集可能で、Enter/Escapeキーによる確定/キャンセルに対応。
 */
const EditableCard = ({ card, onSave, onCancel }: EditableCardProps) => {
  const [title, setTitle] = useState(card.title);
  const [body, setBody] = useState(card.body);

  const handleTitleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  }, []);

  const handleBodyChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value);
  }, []);

  const handleSave = useCallback(() => {
    const patch: { title?: string; body?: string } = {};
    if (title !== card.title) {
      patch.title = title;
    }
    if (body !== card.body) {
      patch.body = body;
    }
    onSave(card.id, patch);
  }, [body, card.body, card.id, card.title, onSave, title]);

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave, onCancel],
  );

  //! 階層インデントのスタイル
  const indentStyle = { paddingLeft: `${12 + card.level * 24}px` };

  return (
    <article className="card card--editing" style={indentStyle} role="listitem">
      <header className="card__header">
        <span className="card__icon">{CARD_KIND_ICON[card.kind]}</span>
        <input
          type="text"
          className="card__title-input"
          value={title}
          onChange={handleTitleChange}
          onKeyDown={handleKeyDown}
          placeholder="カードタイトル"
          autoFocus
        />
      </header>
      <textarea
        className="card__body-input"
        value={body}
        onChange={handleBodyChange}
        onKeyDown={handleKeyDown}
        placeholder="カード本文"
        rows={5}
      />
      <footer className="card__footer card__footer--editing">
        <button type="button" className="card__button card__button--save" onClick={handleSave} title="保存 (Ctrl+Enter)">
          ✓ 保存
        </button>
        <button type="button" className="card__button card__button--cancel" onClick={onCancel} title="キャンセル (Escape)">
          ✕ キャンセル
        </button>
      </footer>
    </article>
  );
};

interface CardListItemProps {
  card: Card;
  isSelected: boolean; ///< 選択状態（複数選択対応）。
  isExpanded: boolean; ///< 展開状態（子を持つカードのみ有効）。
  hasChildren: boolean; ///< 子カードを持つかどうか。
  isEditing: boolean; ///< 編集モード中かどうか。
  leafId: string;
  fileName: string; ///< カードが属するファイル識別子（ファイル名またはタブID）。
  displayMode: 'detailed' | 'compact'; ///< カード表示モード。
  panelScrollRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (card: Card, event?: React.MouseEvent) => void; ///< 選択ハンドラ（イベント情報で複数選択判定）。
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>, card: Card) => void;
  onToggleExpand: () => void; ///< 展開/折畳トグルコールバック。
  onDoubleClick: (card: Card) => void; ///< ダブルクリックハンドラ（編集モード移行）。
  onUpdateCard: (cardId: string, patch: { title?: string; body?: string }) => void; ///< カード更新ハンドラ。
  onCancelEdit: () => void; ///< 編集キャンセルハンドラ。
  onDragStart?: (cardId: string) => void; ///< ドラッグ開始ハンドラ。
  onDragOver?: (cardId: string, position: 'before' | 'after' | 'child') => void; ///< ドラッグオーバーハンドラ。
  onDrop?: () => void; ///< ドロップハンドラ。
  onDragEnd?: () => void; ///< ドラッグ終了ハンドラ。
  onContextMenu?: (card: Card, event: React.MouseEvent) => void; ///< コンテキストメニューハンドラ。
  currentDropTarget?: { cardId: string | null; position: InsertPosition } | null;
  draggedCardIds?: string[];
  highlightIds?: Set<string>;
}

const CardListItem = ({
  card,
  isSelected,
  isExpanded,
  hasChildren,
  isEditing,
  leafId,
  fileName,
  displayMode,
  panelScrollRef,
  onSelect,
  onKeyDown,
  onToggleExpand,
  onDoubleClick,
  onUpdateCard,
  onCancelEdit,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onContextMenu,
  currentDropTarget,
  draggedCardIds,
  highlightIds,
}: CardListItemProps) => {
  const anchorRef = useCardConnectorAnchor({ cardId: card.id, leafId, fileName, scrollContainerRef: panelScrollRef });
  const leftConnectorClass = `card__connector${card.hasLeftTrace ? ' card__connector--active' : ''}`;
  const rightConnectorClass = `card__connector${card.hasRightTrace ? ' card__connector--active' : ''}`;

  //! 編集モードの場合はEditableCardを表示
  if (isEditing) {
    return <EditableCard card={card} onSave={onUpdateCard} onCancel={onCancelEdit} />;
  }

  //! 階層インデントのスタイル
  const indentStyle = { paddingLeft: `${12 + card.level * 24}px` };
  const dropBefore = currentDropTarget?.cardId === card.id && currentDropTarget.position === 'before';
  const dropAfter = currentDropTarget?.cardId === card.id && currentDropTarget.position === 'after';
  const dropChild = currentDropTarget?.cardId === card.id && currentDropTarget.position === 'child';
  const isDragging = draggedCardIds?.includes(card.id) ?? false;
  const isHighlighted = highlightIds?.has(card.id) ?? false;
  const baseClass = displayMode === 'compact' ? 'card card--compact' : 'card';
  const articleClassName = [
    baseClass,
    isSelected ? 'card--active' : '',
    isDragging ? 'card--dragging' : '',
    dropChild ? 'card--drop-child' : '',
    isHighlighted ? 'card--highlighted' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleDragStartInternal = (event: React.DragEvent<HTMLElement>) => {
    if (!onDragStart) {
      return;
    }
    event.stopPropagation();
    event.dataTransfer.effectAllowed = 'move';
    onDragStart(card.id);
  };

  const handleDragOverInternal = (event: React.DragEvent<HTMLElement>) => {
    if (!onDragOver) {
      return;
    }
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetY = event.clientY - rect.top;
    const threshold = rect.height * 0.25;
    let position: InsertPosition = 'child';
    if (offsetY < threshold) {
      position = 'before';
    } else if (offsetY > rect.height - threshold) {
      position = 'after';
    }
    onDragOver(card.id, position);
  };

  const handleDropInternal = (event: React.DragEvent<HTMLElement>) => {
    if (!onDrop) {
      return;
    }
    event.preventDefault();
    onDrop();
  };

  //! 展開/折畳ボタン
  const expandButton = hasChildren ? (
    <button
      type="button"
      className="card__expand-button"
      onClick={(e) => {
        e.stopPropagation();
        onToggleExpand();
      }}
      aria-label={isExpanded ? '折畳' : '展開'}
      title={isExpanded ? '折畳' : '展開'}
    >
      {isExpanded ? '▼' : '▶'}
    </button>
  ) : (
    <span className="card__expand-placeholder" />
  );

  const articleContent = displayMode === 'compact'
    ? (
        <>
          {expandButton}
          <span className={leftConnectorClass}>{connectorSymbol(card.hasLeftTrace)}</span>
          <span className="card__icon">{CARD_KIND_ICON[card.kind]}</span>
          <span className={CARD_STATUS_CLASS[card.status]}>{CARD_STATUS_LABEL[card.status]}</span>
          <span className="card__title card__title--truncate">{card.title}</span>
          <span className={rightConnectorClass}>{connectorSymbol(card.hasRightTrace)}</span>
        </>
      )
    : (
        <>
          <header className="card__header">
            {expandButton}
            <span className={leftConnectorClass}>{connectorSymbol(card.hasLeftTrace)}</span>
            <span className="card__icon">{CARD_KIND_ICON[card.kind]}</span>
            <span className={CARD_STATUS_CLASS[card.status]}>{CARD_STATUS_LABEL[card.status]}</span>
            <span className="card__title">{card.title}</span>
            <span className={rightConnectorClass}>{connectorSymbol(card.hasRightTrace)}</span>
          </header>
          <p className="card__body">{card.body}</p>
          <footer className="card__footer">最終更新: {formatUpdatedAt(card.updatedAt)}</footer>
        </>
      );

  return (
    <div className="card-list-item" data-card-id={card.id}>
      {dropBefore ? (
        <div className="card__drop-indicator card__drop-indicator--before" role="presentation">
          <span className="card__drop-indicator-label">ここに挿入（前）</span>
        </div>
      ) : null}
      <article
        className={articleClassName}
        style={indentStyle}
        aria-selected={isSelected}
        role="listitem"
        tabIndex={0}
        ref={anchorRef}
        draggable={Boolean(onDragStart)}
        onDragStart={handleDragStartInternal}
        onDragOver={handleDragOverInternal}
        onDrop={handleDropInternal}
        onDragEnd={() => {
          onDragEnd?.();
        }}
        onClick={(event) => onSelect(card, event)}
        onDoubleClick={() => onDoubleClick(card)}
        onKeyDown={(event) => onKeyDown(event, card)}
        onContextMenu={(event) => {
          if (onContextMenu) {
            event.preventDefault();
            onContextMenu(card, event);
          }
        }}
      >
        {articleContent}
        {dropChild ? (
          <div className="card__drop-child-overlay" role="presentation">
            <span className="card__drop-child-label">子として追加</span>
          </div>
        ) : null}
      </article>
      {dropAfter ? (
        <div className="card__drop-indicator card__drop-indicator--after" role="presentation">
          <span className="card__drop-indicator-label">ここに挿入（後）</span>
        </div>
      ) : null}
    </div>
  );
};
