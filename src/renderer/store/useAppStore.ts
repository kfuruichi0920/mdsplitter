import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { ThemeMode, AppSettings, Panel, PanelLayout, LogEntry } from '@shared/types';

interface AppState {
  // Theme
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;

  // Settings
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;

  // Panels
  openPanels: Panel[];
  activePanel: string | null;
  addPanel: (panel: Panel) => void;
  removePanel: (panelId: string) => void;
  setActivePanel: (panelId: string) => void;
  updatePanel: (panelId: string, updates: Partial<Panel>) => void;

  // Panel Layout
  panelLayout: PanelLayout | Panel | null;
  setPanelLayout: (layout: PanelLayout | Panel | null) => void;
  splitPanel: (panelId: string, direction: 'horizontal' | 'vertical') => void;

  // Logs
  logs: LogEntry[];
  addLog: (log: LogEntry) => void;
  clearLogs: () => void;

  // UI State
  sidebarVisible: boolean;
  toggleSidebar: () => void;
  logPanelVisible: boolean;
  toggleLogPanel: () => void;
}

const defaultSettings: AppSettings = {
  input: {
    maxWarnSizeMB: 10,
    maxAbortSizeMB: 200,
  },
  file: {
    encodingFallback: 'reject',
    normalizeNewline: true,
  },
  converter: {
    strategy: 'rule',
    timeoutMs: 60000,
  },
  llm: {
    provider: 'none',
    temperature: 0,
    allowCloud: false,
  },
  log: {
    logLevel: 'info',
    logRotation: {
      maxFileSizeMB: 10,
      maxFiles: 5,
      retentionDays: 30,
    },
  },
  history: {
    maxDepth: 1000,
    perFile: false,
    persistOnExit: false,
  },
  ui: {
    theme: 'system',
    font: {
      size: 14,
    },
    window: {
      startMaximized: false,
    },
    autoSave: {
      enabled: true,
      intervalMs: 30000,
    },
  },
  concurrency: {
    fileLocking: 'optimistic',
    maxOpenFiles: 32,
  },
  workDir: './workdir',
};

export const useAppStore = create<AppState>()(
  devtools(
    (set) => ({
      // Theme
      theme: 'system',
      setTheme: (theme) => set({ theme }),

      // Settings
      settings: defaultSettings,
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),

      // Panels
      openPanels: [],
      activePanel: null,
      addPanel: (panel) =>
        set((state) => ({
          openPanels: [...state.openPanels, panel],
          activePanel: panel.id,
        })),
      removePanel: (panelId) =>
        set((state) => ({
          openPanels: state.openPanels.filter((p) => p.id !== panelId),
          activePanel:
            state.activePanel === panelId
              ? state.openPanels[0]?.id || null
              : state.activePanel,
        })),
      setActivePanel: (panelId) => set({ activePanel: panelId }),
      updatePanel: (panelId, updates) =>
        set((state) => ({
          openPanels: state.openPanels.map((p) =>
            p.id === panelId ? { ...p, ...updates } : p
          ),
        })),

      // Panel Layout
      panelLayout: null,
      setPanelLayout: (layout) => set({ panelLayout: layout }),
      splitPanel: (panelId, direction) =>
        set((state) => {
          const splitRecursive = (
            node: PanelLayout | Panel | null
          ): PanelLayout | Panel | null => {
            if (!node) return null;

            // If this is the panel to split
            if ('type' in node && node.id === panelId) {
              const newPanel: Panel = {
                id: `panel-${Date.now()}`,
                type: 'welcome',
                title: 'New Panel',
              };

              return {
                id: `layout-${Date.now()}`,
                direction,
                children: [node, newPanel],
                sizes: [50, 50],
              };
            }

            // If this is a layout, recursively split children
            if ('direction' in node) {
              const newChildren = node.children.map(child => {
                const result = splitRecursive(child);
                return result !== null ? result : child;
              });

              return {
                ...node,
                children: newChildren,
              };
            }

            return node;
          };

          const newLayout = splitRecursive(state.panelLayout);
          console.log('Split panel:', { panelId, direction, oldLayout: state.panelLayout, newLayout });

          return {
            panelLayout: newLayout,
          };
        }),

      // Logs
      logs: [],
      addLog: (log) =>
        set((state) => ({
          logs: [...state.logs, log].slice(-1000), // Keep last 1000 logs
        })),
      clearLogs: () => set({ logs: [] }),

      // UI State
      sidebarVisible: true,
      toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),
      logPanelVisible: false,
      toggleLogPanel: () => set((state) => ({ logPanelVisible: !state.logPanelVisible })),
    }),
    { name: 'AppStore' }
  )
);
