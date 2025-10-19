import React, { useState } from 'react';

type SidebarTab = 'explorer' | 'search';

const Sidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('explorer');

  return (
    <div className="w-64 bg-secondary-50 dark:bg-secondary-900 border-r border-secondary-300 dark:border-secondary-700 flex flex-col">
      {/* Tab bar */}
      <div className="h-10 flex border-b border-secondary-300 dark:border-secondary-700">
        <button
          onClick={() => setActiveTab('explorer')}
          className={`flex-1 flex items-center justify-center gap-2 text-sm ${
            activeTab === 'explorer'
              ? 'bg-secondary-100 dark:bg-secondary-800 text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
              : 'text-secondary-600 dark:text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-800'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          Explorer
        </button>
        <button
          onClick={() => setActiveTab('search')}
          className={`flex-1 flex items-center justify-center gap-2 text-sm ${
            activeTab === 'search'
              ? 'bg-secondary-100 dark:bg-secondary-800 text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
              : 'text-secondary-600 dark:text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-800'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          Search
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'explorer' ? (
          <div className="text-secondary-600 dark:text-secondary-400 text-sm">
            <p className="mb-2 font-semibold">File Explorer</p>
            <p className="text-xs">No workspace folder open</p>
            <p className="text-xs mt-4">To be implemented in Phase 6</p>
          </div>
        ) : (
          <div className="text-secondary-600 dark:text-secondary-400 text-sm">
            <input
              type="text"
              placeholder="Search..."
              className="w-full px-3 py-1.5 text-sm bg-white dark:bg-secondary-800 border border-secondary-300 dark:border-secondary-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs mt-4">To be implemented in Phase 6</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
