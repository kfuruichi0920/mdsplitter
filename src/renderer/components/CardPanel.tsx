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

import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Card, CardKind, CardStatus, PanelTabState } from '../store/workspaceStore';
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
  onLog?: (level: 'INFO' | 'WARN' | 'ERROR', message: string) => void; ///< ログ出力コールバック。
  onPanelClick?: (leafId: string) => void; ///< パネルクリック時のコールバック。
  onPanelClose?: (leafId: string) => void; ///< パネルクローズ時のコールバック。
}

/**
 * @brief カードパネルコンポーネント。
 * @details
 * タブバー、ツールバー、カード一覧を含むカードパネルを描画する。
 */
export const CardPanel = ({ leafId, onLog, onPanelClick, onPanelClose }: CardPanelProps) => {
  const panelScrollRef = useRef<HTMLDivElement | null>(null);
  const [draggedCardIds, setDraggedCardIds] = useState<string[]>([]);
  const [dropTarget, setDropTarget] = useState<{ cardId: string; position: 'before' | 'after' | 'child' } | null>(null);

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
  const moveCards = useWorkspaceStore((state) => state.moveCards);
  const cardDisplayMode = useUiStore((state) => state.cardDisplayMode);
  const toggleCardDisplayMode = useUiStore((state) => state.toggleCardDisplayMode);

  const activeTab = useMemo<PanelTabState | null>(() => {
    if (!activeTabId) {
      return null;
    }
    return leafTabs.find((tab) => tab.id === activeTabId) ?? null;
  }, [activeTabId, leafTabs]);

  const cards = activeTab?.cards ?? [];
  const selectedCardIds = activeTab?.selectedCardIds ?? new Set<string>();
  const expandedCardIds = activeTab?.expandedCardIds ?? new Set<string>();
  const cardCount = cards.length;

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
      closeTab(leafId, tabId);
      if (target) {
        onLog?.('INFO', `タブ「${target.title}」を閉じました。`);
      }
    },
    [closeTab, leafId, leafTabs, onLog],
  );

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
    (event: KeyboardEvent<HTMLElement>, card: Card) => {
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

  return (
    <div className="split-node" data-leaf-id={leafId} onClick={handlePanelClick}>
      {/* タブバー: 各カードファイルのタブを表示 */}
      <div className="tab-bar" role="tablist" aria-label="カードファイルタブ">
        {leafTabs.length === 0 ? (
          <span className="tab-bar__empty">カードファイルが開かれていません</span>
        ) : (
          leafTabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const tabClass = `tab-bar__tab${isActive ? ' tab-bar__tab--active' : ''}`;
            const dirtyMark = tab.isDirty ? ' ●' : '';
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
        <button type="button" className="tab-bar__tab tab-bar__tab--add" disabled>
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
            ⏬ 展開
          </button>
          <button
            type="button"
            className="panel-toolbar__button"
            onClick={handleCollapseAll}
            title="すべて折畳"
            aria-label="すべて折畳"
          >
            ⏫ 折畳
          </button>
        </div>
        <div className="panel-toolbar__group">
          <input className="panel-toolbar__input" placeholder="� 文字列フィルタ" />
          <button type="button" className="panel-toolbar__button">
            📚 カード種別
          </button>
          <button type="button" className="panel-toolbar__button">
            � トレースのみ
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
            ☰ コンパクト
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
            fileName={activeTab?.fileName ?? ''}
            isSelected={selectedCardIds.has(card.id)}
            isExpanded={expandedCardIds.has(card.id)}
            hasChildren={card.child_ids.length > 0}
            displayMode={cardDisplayMode}
            onSelect={handleCardSelect}
            onKeyDown={handleCardKeyDown}
            onToggleExpand={() => {
              if (activeTabId) {
                useWorkspaceStore.getState().toggleCardExpanded(leafId, activeTabId, card.id);
              }
            }}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            panelScrollRef={panelScrollRef}
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
    </div>
  );
};

interface CardListItemProps {
  card: Card;
  isSelected: boolean; ///< 選択状態（複数選択対応）。
  isExpanded: boolean; ///< 展開状態（子を持つカードのみ有効）。
  hasChildren: boolean; ///< 子カードを持つかどうか。
  leafId: string;
  fileName: string; ///< カードが属するファイル名（コネクタ識別に使用）。
  displayMode: 'detailed' | 'compact'; ///< カード表示モード。
  panelScrollRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (card: Card, event?: React.MouseEvent) => void; ///< 選択ハンドラ（イベント情報で複数選択判定）。
  onKeyDown: (event: KeyboardEvent<HTMLElement>, card: Card) => void;
  onToggleExpand: () => void; ///< 展開/折畳トグルコールバック。
  onDragStart?: (cardId: string) => void; ///< ドラッグ開始ハンドラ。
  onDragOver?: (cardId: string, position: 'before' | 'after' | 'child') => void; ///< ドラッグオーバーハンドラ。
  onDrop?: () => void; ///< ドロップハンドラ。
  onDragEnd?: () => void; ///< ドラッグ終了ハンドラ。
}

const CardListItem = ({ card, isSelected, isExpanded, hasChildren, leafId, fileName, displayMode, panelScrollRef, onSelect, onKeyDown, onToggleExpand, onDragStart, onDragOver, onDrop, onDragEnd }: CardListItemProps) => {
  const anchorRef = useCardConnectorAnchor({ cardId: card.id, leafId, fileName, scrollContainerRef: panelScrollRef });
  const leftConnectorClass = `card__connector${card.hasLeftTrace ? ' card__connector--active' : ''}`;
  const rightConnectorClass = `card__connector${card.hasRightTrace ? ' card__connector--active' : ''}`;

  //! 階層インデントのスタイル
  const indentStyle = { paddingLeft: `${12 + card.level * 24}px` };

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

  //! コンパクト表示の場合は1行のみ表示
  if (displayMode === 'compact') {
    return (
      <article
        className={`card card--compact${isSelected ? ' card--active' : ''}`}
        style={indentStyle}
        aria-selected={isSelected}
        role="listitem"
        tabIndex={0}
        ref={anchorRef}
        onClick={(event) => onSelect(card, event)}
        onKeyDown={(event) => onKeyDown(event, card)}
      >
        {expandButton}
        <span className={leftConnectorClass}>{connectorSymbol(card.hasLeftTrace)}</span>
        <span className="card__icon">{CARD_KIND_ICON[card.kind]}</span>
        <span className={CARD_STATUS_CLASS[card.status]}>{CARD_STATUS_LABEL[card.status]}</span>
        <span className="card__title card__title--truncate">{card.title}</span>
        <span className={rightConnectorClass}>{connectorSymbol(card.hasRightTrace)}</span>
      </article>
    );
  }

  //! 詳細表示
  return (
    <article
      className={`card${isSelected ? ' card--active' : ''}`}
      style={indentStyle}
      aria-selected={isSelected}
      role="listitem"
      tabIndex={0}
      ref={anchorRef}
      onClick={(event) => onSelect(card, event)}
      onKeyDown={(event) => onKeyDown(event, card)}
    >
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
    </article>
  );
};
