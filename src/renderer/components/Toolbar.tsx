import React from 'react';
import { useAppStore } from '../store/useAppStore';

const Toolbar: React.FC = () => {
  const { sidebarVisible, toggleSidebar } = useAppStore();

  return (
    <div className="h-10 bg-secondary-100 dark:bg-secondary-800 border-b border-secondary-300 dark:border-secondary-700 flex items-center px-3 gap-2">
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        className="p-1.5 hover:bg-secondary-200 dark:hover:bg-secondary-700 rounded text-secondary-700 dark:text-secondary-300"
        title="Toggle Sidebar"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={
              sidebarVisible
                ? 'M11 19l-7-7 7-7m8 14l-7-7 7-7'
                : 'M13 5l7 7-7 7M5 5l7 7-7 7'
            }
          />
        </svg>
      </button>

      <div className="w-px h-6 bg-secondary-300 dark:bg-secondary-600" />

      {/* File operations */}
      <button
        className="p-1.5 hover:bg-secondary-200 dark:hover:bg-secondary-700 rounded text-secondary-700 dark:text-secondary-300"
        title="Open File (Ctrl+O)"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      </button>

      <button
        className="p-1.5 hover:bg-secondary-200 dark:hover:bg-secondary-700 rounded text-secondary-700 dark:text-secondary-300"
        title="Save (Ctrl+S)"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
          />
        </svg>
      </button>

      <div className="w-px h-6 bg-secondary-300 dark:bg-secondary-600" />

      {/* Edit operations */}
      <button
        className="p-1.5 hover:bg-secondary-200 dark:hover:bg-secondary-700 rounded text-secondary-700 dark:text-secondary-300"
        title="Undo (Ctrl+Z)"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
          />
        </svg>
      </button>

      <button
        className="p-1.5 hover:bg-secondary-200 dark:hover:bg-secondary-700 rounded text-secondary-700 dark:text-secondary-300"
        title="Redo (Ctrl+Y)"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"
          />
        </svg>
      </button>

      <div className="flex-1" />

      {/* Right side info */}
      <span className="text-xs text-secondary-600 dark:text-secondary-400">
        Phase 1: Project Setup
      </span>
    </div>
  );
};

export default Toolbar;
