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
import type { Card, CardKind, CardStatus } from '../store/workspaceStore';
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
  const cards = useWorkspaceStore((state) => state.cards);
  const selectedCardId = useWorkspaceStore((state) => state.selectedCardId);
  const selectCard = useWorkspaceStore((state) => state.selectCard);

  const cardCount = cards.length;

  /**
   * @brief パネルクリック時の処理。
   */
  const handlePanelClick = useCallback(() => {
    onPanelClick?.(leafId);
  }, [leafId, onPanelClick]);

  /**
   * @brief パネルクローズ時の処理。
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
   * @param card 対象カード。
   */
  const handleCardSelect = useCallback(
    (card: Card) => {
      if (card.id === selectedCardId) {
        return;
      }
      selectCard(card.id);
      onLog?.('INFO', `カード「${card.title}」を選択しました。`);
    },
    [onLog, selectCard, selectedCardId],
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

  return (
    <div className="split-node" data-leaf-id={leafId} onClick={handlePanelClick}>
      {/* タブバー */}
      <div className="tab-bar">
        <button type="button" className="tab-bar__tab tab-bar__tab--active">
          📄 overview.md
        </button>
        <button type="button" className="tab-bar__tab">
          📄 detail.md ●
        </button>
        <button type="button" className="tab-bar__tab">
          ➕
        </button>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          className="tab-bar__close"
          onClick={handlePanelClose}
          aria-label="パネルを閉じる"
          title="パネルを閉じる"
        >
          ✕
        </button>
      </div>

      {/* パネルツールバー */}
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
          <input className="panel-toolbar__input" placeholder="👓 文字列フィルタ" />
          <button type="button" className="panel-toolbar__button">
            📚 カード種別
          </button>
          <button type="button" className="panel-toolbar__button">
            🧐 トレースのみ
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

      {/* カード一覧 */}
      <div className="panel-cards" role="list">
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
      </div>
    </div>
  );
};
