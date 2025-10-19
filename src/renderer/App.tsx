import React from 'react';
import { useTheme } from './hooks/useTheme';
import { useAppStore } from './store/useAppStore';
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import StatusBar from './components/StatusBar';
import LogPanel from './components/LogPanel';
import { ErrorDialog } from './components/ErrorDialog';

const App: React.FC = () => {
  // Initialize theme
  useTheme();

  const { sidebarVisible, logPanelVisible } = useAppStore();

  return (
    <div className="h-screen w-screen flex flex-col bg-secondary-50 dark:bg-secondary-900">
      {/* Toolbar */}
      <Toolbar />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        {sidebarVisible && <Sidebar />}

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <MainContent />

          {/* Log panel */}
          {logPanelVisible && <LogPanel />}
        </div>
      </div>

      {/* Status bar */}
      <StatusBar />

      {/* Error dialog */}
      <ErrorDialog />
    </div>
  );
};

export default App;
