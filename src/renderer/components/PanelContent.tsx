import React, { useState } from 'react';
import { Panel } from '@shared/types';
import { useAppStore } from '../store/useAppStore';
import TabBar from './TabBar';

interface PanelContentProps {
  panel: Panel;
}

const PanelContent: React.FC<PanelContentProps> = ({ panel }) => {
  const { splitPanel, activePanel, setActivePanel } = useAppStore();
  const [tabs, setTabs] = useState<Panel[]>([panel]);
  const [activeTabId, setActiveTabId] = useState(panel.id);

  const isActive = activePanel === panel.id;

  const handleSplitHorizontal = () => {
    splitPanel(panel.id, 'horizontal');
  };

  const handleSplitVertical = () => {
    splitPanel(panel.id, 'vertical');
  };

  const handlePanelClick = () => {
    setActivePanel(panel.id);
  };

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  return (
    <div
      className={`h-full flex flex-col border ${
        isActive
          ? 'border-primary-500 dark:border-primary-600'
          : 'border-secondary-300 dark:border-secondary-700'
      } bg-white dark:bg-secondary-800`}
      onClick={handlePanelClick}
    >
      {/* Tab bar */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabChange={setActiveTabId}
        onTabClose={(tabId) => {
          const newTabs = tabs.filter((t) => t.id !== tabId);
          setTabs(newTabs);
          if (activeTabId === tabId && newTabs.length > 0) {
            setActiveTabId(newTabs[0].id);
          }
        }}
        onSplitHorizontal={handleSplitHorizontal}
        onSplitVertical={handleSplitVertical}
      />

      {/* Panel content */}
      <div className="flex-1 overflow-auto">
        {activeTab.type === 'welcome' && <WelcomeContent />}
        {activeTab.type === 'card' && (
          <div className="p-4 text-secondary-700 dark:text-secondary-300">
            Card Panel: {activeTab.title}
            {activeTab.filePath && (
              <div className="text-xs text-secondary-500 mt-1">{activeTab.filePath}</div>
            )}
          </div>
        )}
        {activeTab.type === 'editor' && (
          <div className="p-4 text-secondary-700 dark:text-secondary-300">
            Editor Panel: {activeTab.title}
          </div>
        )}
      </div>
    </div>
  );
};

const WelcomeContent: React.FC = () => {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="mb-4">
          <svg
            className="w-16 h-16 mx-auto text-primary-500 dark:text-primary-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </div>

        <h3 className="text-xl font-semibold text-secondary-800 dark:text-secondary-100 mb-2">
          Welcome to Card Editor
        </h3>

        <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-4">
          Open a file or create a new panel to get started
        </p>

        <div className="text-xs text-secondary-500 dark:text-secondary-500">
          Use the split buttons above to divide this panel
        </div>
      </div>
    </div>
  );
};

export default PanelContent;
