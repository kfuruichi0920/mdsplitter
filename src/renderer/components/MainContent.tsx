import React, { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import SplitPane from './SplitPane';

const MainContent: React.FC = () => {
  const { panelLayout, setPanelLayout } = useAppStore();

  // Initialize with a single welcome panel
  useEffect(() => {
    if (!panelLayout) {
      setPanelLayout({
        id: 'panel-initial',
        type: 'welcome',
        title: 'Welcome',
      });
    }
  }, [panelLayout, setPanelLayout]);

  if (!panelLayout) {
    return (
      <div className="flex-1 bg-white dark:bg-secondary-800 flex items-center justify-center">
        <div className="text-secondary-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-secondary-200 dark:bg-secondary-900 overflow-hidden">
      <SplitPane layout={panelLayout} />
    </div>
  );
};

export default MainContent;
