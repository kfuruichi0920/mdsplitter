import React from 'react';
import { Panel } from '@shared/types';

interface TabBarProps {
  tabs: Panel[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onSplitHorizontal: () => void;
  onSplitVertical: () => void;
}

const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  onTabClose,
  onSplitHorizontal,
  onSplitVertical,
}) => {
  return (
    <div className="flex items-center bg-secondary-100 dark:bg-secondary-700 border-b border-secondary-300 dark:border-secondary-600">
      {/* Tabs */}
      <div className="flex-1 flex overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex items-center gap-2 px-3 py-2 min-w-[120px] max-w-[200px] cursor-pointer
              border-r border-secondary-300 dark:border-secondary-600
              ${
                activeTabId === tab.id
                  ? 'bg-white dark:bg-secondary-800 text-secondary-900 dark:text-secondary-100'
                  : 'bg-secondary-50 dark:bg-secondary-700 text-secondary-600 dark:text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-650'
              }
            `}
          >
            <span className="flex-1 truncate text-sm">{tab.title}</span>
            {tab.isDirty && (
              <span className="w-2 h-2 rounded-full bg-primary-500" title="Unsaved changes" />
            )}
            {tabs.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                className="p-0.5 hover:bg-secondary-200 dark:hover:bg-secondary-600 rounded"
                title="Close tab"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Split buttons */}
      <div className="flex items-center gap-1 px-2">
        <button
          onClick={onSplitHorizontal}
          className="p-1.5 hover:bg-secondary-200 dark:hover:bg-secondary-600 rounded transition-colors"
          title="Split horizontally"
        >
          <svg className="w-4 h-4 text-secondary-600 dark:text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 4h6v16H9V4zm0 0H4v16h5M15 4h5v16h-5" />
          </svg>
        </button>
        <button
          onClick={onSplitVertical}
          className="p-1.5 hover:bg-secondary-200 dark:hover:bg-secondary-600 rounded transition-colors"
          title="Split vertically"
        >
          <svg className="w-4 h-4 text-secondary-600 dark:text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 9h16v6H4V9zm0 0V4h16v5M4 15v5h16v-5" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TabBar;
