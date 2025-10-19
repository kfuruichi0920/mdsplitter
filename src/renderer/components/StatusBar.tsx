import React from 'react';
import { useAppStore } from '../store/useAppStore';

const StatusBar: React.FC = () => {
  const { theme, setTheme, logPanelVisible, toggleLogPanel } = useAppStore();

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        );
      case 'dark':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        );
    }
  };

  const cycleTheme = () => {
    const themes: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  return (
    <div className="h-6 bg-primary-600 dark:bg-primary-700 text-white flex items-center px-3 text-xs gap-4">
      {/* Left side */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleLogPanel}
          className="flex items-center gap-1.5 hover:bg-primary-700 dark:hover:bg-primary-600 px-2 py-0.5 rounded"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          {logPanelVisible ? 'Hide Logs' : 'Show Logs'}
        </button>

        <div className="text-primary-200">0 errors, 0 warnings</div>
      </div>

      <div className="flex-1" />

      {/* Right side */}
      <div className="flex items-center gap-3">
        <div className="text-primary-200">UTF-8</div>
        <div className="text-primary-200">LF</div>

        <button
          onClick={cycleTheme}
          className="flex items-center gap-1.5 hover:bg-primary-700 dark:hover:bg-primary-600 px-2 py-0.5 rounded"
          title={`Theme: ${theme}`}
        >
          {getThemeIcon()}
          <span className="capitalize">{theme}</span>
        </button>
      </div>
    </div>
  );
};

export default StatusBar;
