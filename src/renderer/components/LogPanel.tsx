import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';

const LogPanel: React.FC = () => {
  const { logs, clearLogs, addLog } = useAppStore();
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new logs are added
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    // Add initial log
    addLog({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Application started',
    });
  }, []);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-error-600 dark:text-error-400';
      case 'warn':
        return 'text-warning-600 dark:text-warning-400';
      case 'debug':
        return 'text-secondary-500 dark:text-secondary-500';
      default:
        return 'text-secondary-700 dark:text-secondary-300';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return '✕';
      case 'warn':
        return '⚠';
      case 'debug':
        return '⚙';
      default:
        return 'ℹ';
    }
  };

  return (
    <div className="h-40 bg-secondary-50 dark:bg-secondary-900 border-t border-secondary-300 dark:border-secondary-700 flex flex-col">
      {/* Header */}
      <div className="h-8 flex items-center justify-between px-3 border-b border-secondary-300 dark:border-secondary-700">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-secondary-600 dark:text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
            Logs ({logs.length})
          </span>
        </div>
        <button
          onClick={clearLogs}
          className="text-xs px-2 py-0.5 hover:bg-secondary-200 dark:hover:bg-secondary-700 rounded text-secondary-600 dark:text-secondary-400"
        >
          Clear
        </button>
      </div>

      {/* Log content */}
      <div className="flex-1 overflow-y-auto font-mono text-xs p-2">
        {logs.length === 0 ? (
          <div className="text-secondary-500 dark:text-secondary-500 text-center py-4">
            No logs
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="flex gap-2 py-0.5 hover:bg-secondary-100 dark:hover:bg-secondary-800">
              <span className="text-secondary-500 dark:text-secondary-500">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className={getLevelColor(log.level)}>
                {getLevelIcon(log.level)}
              </span>
              <span className={getLevelColor(log.level)}>
                [{log.level.toUpperCase()}]
              </span>
              <span className="text-secondary-700 dark:text-secondary-300 flex-1">
                {log.message}
              </span>
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};

export default LogPanel;
