/**
 * @file CardPanelView.tsx
 * @brief カードパネルビュー。
 * @details
 * 各分割パネルに表示されるカードビュー。
 * タブバー、ツールバー、カード一覧を含む。
 * @author K.Furuichi
 * @date 2025-11-03
 * @version 0.1
 * @copyright MIT
 */

import { type FC, useCallback } from 'react';
import { useSplitPaneStore } from '../store/splitPaneStore';
import { useWorkspaceStore } from '../store/workspaceStore';

/** カードパネルビューのプロパティ */
interface CardPanelViewProps {
  paneId: string;
}

/** カード種別に応じたアイコン */
const CARD_KIND_ICON: Record<string, string> = {
  heading: '🔖',
  paragraph: '📝',
  bullet: '📍',
  figure: '📊',
  table: '📅',
  test: '🧪',
  qa: '💬',
};

/** ステータスバッジ用クラス名マッピング */
const CARD_STATUS_CLASS: Record<string, string> = {
  draft: 'card__status card__status--draft',
  review: 'card__status card__status--review',
  approved: 'card__status card__status--approved',
  deprecated: 'card__status card__status--deprecated',
};

/** トレース接合点の記号 */
const connectorSymbol = (hasTrace: boolean): string => (hasTrace ? '●' : '○');

/** カードパネルビュー */
export const CardPanelView: FC<CardPanelViewProps> = ({ paneId }) => {
  const { root, setActivePane, splitPane } = useSplitPaneStore();
  const { cards, selectedCardId, selectCard } = useWorkspaceStore();

  // パネル情報を取得
  const findPane = useCallback((node: any, id: string): any => {
    if (node.id === id) return node;
    if (node.type === 'split') {
      for (const child of node.children) {
        const found = findPane(child, id);
        if (found) return found;
      }
    }
    return null;
  }, []);

  const pane = findPane(root, paneId);

  const handlePaneClick = useCallback(() => {
    setActivePane(paneId);
  }, [paneId, setActivePane]);

  const handleCardClick = useCallback(
    (cardId: string) => {
      selectCard(cardId);
    },
    [selectCard]
  );

  const handleSplitHorizontal = useCallback(() => {
    splitPane(paneId, 'horizontal');
  }, [paneId, splitPane]);

  const handleSplitVertical = useCallback(() => {
    splitPane(paneId, 'vertical');
  }, [paneId, splitPane]);

  if (!pane || pane.type !== 'leaf') {
    return <div className="w-full h-full bg-gray-100 dark:bg-gray-800">Invalid pane</div>;
  }

  return (
    <div
      className="card-panel-view w-full h-full flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
      onClick={handlePaneClick}
      data-pane-id={paneId}
    >
      {/* タブバー */}
      <div className="tab-bar h-9 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-2 gap-1">
        {pane.tabs.length === 0 ? (
          <span className="text-xs text-gray-500 dark:text-gray-400">No files open</span>
        ) : (
          pane.tabs.map((fileId, index) => (
            <div
              key={fileId}
              className={`tab px-3 py-1 text-xs rounded-t cursor-pointer ${
                index === pane.activeTabIndex
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {fileId}
            </div>
          ))
        )}
      </div>

      {/* ツールバー */}
      <div className="toolbar h-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-2 gap-2">
        <button
          onClick={handleSplitHorizontal}
          className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
          title="水平分割"
        >
          ⬌
        </button>
        <button
          onClick={handleSplitVertical}
          className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
          title="垂直分割"
        >
          ⬍
        </button>
        <div className="flex-1" />
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Pane: {paneId}
        </span>
      </div>

      {/* カード一覧 */}
      <div className="card-list flex-1 overflow-y-auto p-2 space-y-2">
        {cards.map((card) => {
          const isSelected = card.id === selectedCardId;
          return (
            <div
              key={card.id}
              className={`card p-3 rounded border cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-blue-50 dark:bg-blue-900 border-blue-500'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
              }`}
              onClick={() => handleCardClick(card.id)}
              data-card-id={card.id}
            >
              <div className="card-header flex items-center gap-2 mb-2">
                <span className="text-sm">{connectorSymbol(card.hasLeftTrace)}</span>
                <span className="text-lg">{CARD_KIND_ICON[card.kind] || '📄'}</span>
                <span className={CARD_STATUS_CLASS[card.status] || 'text-xs text-gray-500'}>
                  {card.status}
                </span>
                <div className="flex-1" />
                <span className="text-sm">{connectorSymbol(card.hasRightTrace)}</span>
              </div>
              <div className="card-title font-semibold text-sm mb-1">{card.title}</div>
              <div className="card-body text-xs text-gray-600 dark:text-gray-400">
                {card.body}
              </div>
              <div className="card-footer text-xs text-gray-400 dark:text-gray-500 mt-2">
                {new Date(card.updatedAt).toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
