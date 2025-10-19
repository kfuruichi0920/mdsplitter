import { create } from 'zustand';

export interface ErrorInfo {
  id: string;
  title: string;
  message: string;
  details?: string;
  timestamp: Date;
  severity: 'error' | 'warning' | 'info';
}

interface ErrorState {
  errors: ErrorInfo[];
  currentError: ErrorInfo | null;
  addError: (error: Omit<ErrorInfo, 'id' | 'timestamp'>) => void;
  showError: (title: string, message: string, details?: string) => void;
  showWarning: (title: string, message: string, details?: string) => void;
  showInfo: (title: string, message: string, details?: string) => void;
  clearError: (id: string) => void;
  clearCurrentError: () => void;
  clearAllErrors: () => void;
}

export const useErrorStore = create<ErrorState>((set) => ({
  errors: [],
  currentError: null,

  addError: (error) => {
    const newError: ErrorInfo = {
      ...error,
      id: `error-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
    };

    set((state) => ({
      errors: [...state.errors, newError],
      currentError: newError,
    }));
  },

  showError: (title, message, details) => {
    const error: ErrorInfo = {
      id: `error-${Date.now()}-${Math.random()}`,
      title,
      message,
      details,
      timestamp: new Date(),
      severity: 'error',
    };

    set((state) => ({
      errors: [...state.errors, error],
      currentError: error,
    }));
  },

  showWarning: (title, message, details) => {
    const error: ErrorInfo = {
      id: `error-${Date.now()}-${Math.random()}`,
      title,
      message,
      details,
      timestamp: new Date(),
      severity: 'warning',
    };

    set((state) => ({
      errors: [...state.errors, error],
      currentError: error,
    }));
  },

  showInfo: (title, message, details) => {
    const error: ErrorInfo = {
      id: `error-${Date.now()}-${Math.random()}`,
      title,
      message,
      details,
      timestamp: new Date(),
      severity: 'info',
    };

    set((state) => ({
      errors: [...state.errors, error],
      currentError: error,
    }));
  },

  clearError: (id) =>
    set((state) => ({
      errors: state.errors.filter((e) => e.id !== id),
      currentError: state.currentError?.id === id ? null : state.currentError,
    })),

  clearCurrentError: () =>
    set({
      currentError: null,
    }),

  clearAllErrors: () =>
    set({
      errors: [],
      currentError: null,
    }),
}));
