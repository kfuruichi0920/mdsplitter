import React from 'react';

const MainContent: React.FC = () => {
  return (
    <div className="flex-1 bg-white dark:bg-secondary-800 flex items-center justify-center">
      <div className="text-center max-w-2xl px-8">
        <div className="mb-6">
          <svg
            className="w-24 h-24 mx-auto text-primary-500 dark:text-primary-400"
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

        <h1 className="text-4xl font-bold text-secondary-800 dark:text-secondary-100 mb-3">
          Card Editor Application
        </h1>

        <p className="text-lg text-secondary-600 dark:text-secondary-400 mb-6">
          Transform text files into structured cards with visual editing and traceability
        </p>

        <div className="bg-secondary-100 dark:bg-secondary-700 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-secondary-800 dark:text-secondary-200 mb-3">
            Getting Started
          </h2>
          <div className="text-left text-sm text-secondary-700 dark:text-secondary-300 space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-primary-600 dark:text-primary-400 font-bold">1.</span>
              <span>Open a text or Markdown file (Ctrl+O)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary-600 dark:text-primary-400 font-bold">2.</span>
              <span>Convert it to card format using rules or LLM</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary-600 dark:text-primary-400 font-bold">3.</span>
              <span>Edit cards visually with drag & drop</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary-600 dark:text-primary-400 font-bold">4.</span>
              <span>Create traceability links between cards</span>
            </div>
          </div>
        </div>

        <div className="flex gap-4 justify-center">
          <button className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors">
            Open File
          </button>
          <button className="px-4 py-2 bg-secondary-200 dark:bg-secondary-700 hover:bg-secondary-300 dark:hover:bg-secondary-600 text-secondary-800 dark:text-secondary-200 rounded-lg font-medium transition-colors">
            View Documentation
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-secondary-300 dark:border-secondary-600">
          <p className="text-xs text-secondary-500 dark:text-secondary-500">
            Phase 1: Project Setup Complete ✓
          </p>
          <p className="text-xs text-secondary-500 dark:text-secondary-500 mt-1">
            Technology Stack: Electron + React + TypeScript + Tailwind CSS + Zustand
          </p>
        </div>
      </div>
    </div>
  );
};

export default MainContent;
