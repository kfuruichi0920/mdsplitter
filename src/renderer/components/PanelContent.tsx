import React, { useState, useEffect } from 'react';
import { Panel } from '@shared/types';
import { useAppStore } from '../store/useAppStore';
import { useCardStore } from '../store/useCardStore';
import TabBar from './TabBar';
import CardPanel from './CardPanel';

interface PanelContentProps {
  panel: Panel;
}

const PanelContent: React.FC<PanelContentProps> = ({ panel }) => {
  const { splitPanel, activePanel, setActivePanel } = useAppStore();
  const { cardFiles } = useCardStore();
  const [tabs, setTabs] = useState<Panel[]>([panel]);
  const [activeTabId, setActiveTabId] = useState(panel.id);

  // Update tabs when panel changes
  useEffect(() => {
    setTabs([panel]);
    setActiveTabId(panel.id);
  }, [panel.id]);

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

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Safety check: if no active tab found, use the first tab or the panel itself
  if (!activeTab) {
    console.warn('PanelContent: No active tab found', { tabs, activeTabId, panel });
    return (
      <div className="h-full flex flex-col border border-secondary-300 dark:border-secondary-700 bg-white dark:bg-secondary-800">
        <div className="flex items-center justify-center h-full text-red-500">
          Error: No active tab
        </div>
      </div>
    );
  }

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
          <CardPanel
            cardFile={
              activeTab.filePath ? cardFiles.get(activeTab.filePath) || null : null
            }
            filePath={activeTab.filePath}
          />
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
    <div className="h-full flex items-center justify-center p-8 bg-gradient-to-br from-secondary-50 via-white to-primary-50 dark:from-secondary-900 dark:via-secondary-800 dark:to-secondary-900">
      <div className="text-center max-w-lg">
        {/* Icon Container with gradient background */}
        <div className="mb-8 relative">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-primary-500 to-primary-600 dark:from-primary-400 dark:to-primary-500 rounded-2xl shadow-2xl flex items-center justify-center transform transition-transform hover:scale-105 hover:rotate-3 duration-300">
            <svg
              className="w-12 h-12 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          {/* Decorative blur effect */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-primary-500/20 rounded-full blur-3xl -z-10"></div>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-bold bg-gradient-to-r from-secondary-800 via-primary-600 to-secondary-800 dark:from-secondary-100 dark:via-primary-400 dark:to-secondary-100 bg-clip-text text-transparent mb-4 tracking-tight">
          Welcome to Card Editor
        </h1>

        {/* Subtitle */}
        <p className="text-lg text-secondary-600 dark:text-secondary-400 mb-8 leading-relaxed">
          Open a file or create a new panel to get started
        </p>

        {/* Action hints */}
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-3 text-sm text-secondary-500 dark:text-secondary-500 bg-white/60 dark:bg-secondary-800/60 rounded-lg px-4 py-3 backdrop-blur-sm border border-secondary-200/50 dark:border-secondary-700/50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>Use the split buttons above to divide this panel</span>
          </div>

          <div className="flex items-center justify-center gap-3 text-sm text-secondary-500 dark:text-secondary-500 bg-white/60 dark:bg-secondary-800/60 rounded-lg px-4 py-3 backdrop-blur-sm border border-secondary-200/50 dark:border-secondary-700/50">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span>Click "Open File" to load a card database</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PanelContent;
