import React, { useEffect } from 'react';
import { useErrorStore } from '../store/useErrorStore';

export const ErrorDialog: React.FC = () => {
  const { currentError, clearCurrentError } = useErrorStore();

  // Close dialog on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && currentError) {
        clearCurrentError();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentError, clearCurrentError]);

  if (!currentError) return null;

  const getSeverityStyles = () => {
    switch (currentError.severity) {
      case 'error':
        return {
          bg: 'bg-red-50 dark:bg-red-900/20',
          border: 'border-red-500',
          icon: '❌',
          text: 'text-red-700 dark:text-red-300',
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50 dark:bg-yellow-900/20',
          border: 'border-yellow-500',
          icon: '⚠️',
          text: 'text-yellow-700 dark:text-yellow-300',
        };
      case 'info':
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          border: 'border-blue-500',
          icon: 'ℹ️',
          text: 'text-blue-700 dark:text-blue-300',
        };
    }
  };

  const styles = getSeverityStyles();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className={`w-full max-w-md rounded-lg border-2 ${styles.border} ${styles.bg} p-6 shadow-xl`}
      >
        <div className="mb-4 flex items-start gap-3">
          <span className="text-2xl">{styles.icon}</span>
          <div className="flex-1">
            <h2 className={`text-lg font-semibold ${styles.text}`}>{currentError.title}</h2>
          </div>
          <button
            onClick={clearCurrentError}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <p className="text-gray-700 dark:text-gray-300">{currentError.message}</p>
        </div>

        {currentError.details && (
          <div className="mb-4">
            <details className="cursor-pointer">
              <summary className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                詳細
              </summary>
              <pre className="overflow-auto rounded bg-gray-100 p-2 text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                {currentError.details}
              </pre>
            </details>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={clearCurrentError}
            className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
