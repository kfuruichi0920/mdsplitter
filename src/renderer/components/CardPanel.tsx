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

import { useCallback, useMemo, type KeyboardEvent } from 'react';
import type { Card, CardKind, CardStatus, PanelTabState } from '../store/workspaceStore';
import { useWorkspaceStore } from '../store/workspaceStore';

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

  const activeTab = useMemo<PanelTabState | null>(() => {
    if (!activeTabId) {
      return null;
    }
    return leafTabs.find((tab) => tab.id === activeTabId) ?? null;
  }, [activeTabId, leafTabs]);

  const cards = activeTab?.cards ?? [];
  const selectedCardId = activeTab?.selectedCardId ?? null;
  const cardCount = cards.length;

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
   * 既に選択済みの場合は何もしない。選択時は selectCard と onLog を呼ぶ。
   * @param card 対象カード。
   */
  const handleCardSelect = useCallback(
    (card: Card) => {
      if (card.id === selectedCardId) {
        return; //! 既に選択済みなら何もしない
      }
      if (!activeTabId) {
        return;
      }
      selectCard(leafId, activeTabId, card.id);
      onLog?.('INFO', `カード「${card.title}」を選択しました。`);
    },
    [activeTabId, leafId, onLog, selectCard, selectedCardId],
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
      handleCardSelect(card);
    },
    [handleCardSelect],
  );

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
          <button type="button" className="panel-toolbar__button">
            ⏬ 展開
          </button>
          <button type="button" className="panel-toolbar__button">
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
          <button type="button" className="panel-toolbar__button">
            ☰ コンパクト
          </button>
        </div>
        <div className="panel-toolbar__spacer" />
        <div className="panel-toolbar__meta">カード総数: {cardCount}</div>
      </div>

      {/* カード一覧: 各カードをリスト表示 */}
      <div className="panel-cards" role="list" id={activeTab ? `panel-${leafId}-${activeTab.id}` : undefined}>
        {cards.map((card) => {
          const isActive = card.id === selectedCardId;
          const leftConnectorClass = `card__connector${card.hasLeftTrace ? ' card__connector--active' : ''}`;
          const rightConnectorClass = `card__connector${card.hasRightTrace ? ' card__connector--active' : ''}`;
          return (
            <article
              key={card.id}
              className={`card${isActive ? ' card--active' : ''}`}
              aria-selected={isActive}
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
        {cards.length === 0 && (
          <div className="panel-cards__empty" role="note">
            表示するカードがありません。
          </div>
        )}
      </div>
    </div>
  );
};
