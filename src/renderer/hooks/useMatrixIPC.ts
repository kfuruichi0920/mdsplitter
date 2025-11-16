import { useEffect } from 'react';

import type { WorkspaceSnapshot } from '@/shared/workspace';
import { useMatrixStore } from '@/renderer/store/matrixStore';

const loadCards = async (fileName: string) => {
  const workspace = window.app?.workspace;
  if (!workspace) {
    console.warn('[Matrix] workspace API is unavailable.');
    return [];
  }

  const safeLoadOutput = async (): Promise<WorkspaceSnapshot | null> => {
    if (!workspace.loadOutputFile) {
      return null;
    }
    try {
      return await workspace.loadOutputFile(fileName);
    } catch (error) {
      console.warn(`[Matrix] failed to load ${fileName} from _out`, error);
      return null;
    }
  };

  const snapshot = await safeLoadOutput();
  if (!snapshot) {
    console.warn(`[Matrix] card snapshot not found in _out for ${fileName}`);
  }
  return snapshot?.cards ?? [];
};

const loadTraceBundle = async (leftFile: string, rightFile: string) => {
  const traceFile = await window.app.workspace.loadTraceFile(leftFile, rightFile);
  return {
    relations: traceFile?.payload.relations ?? [],
    fileName: traceFile?.fileName ?? null,
    header: traceFile?.payload.header ?? null,
  };
};

export const useMatrixIPC = (): void => {
  useEffect(() => {
    const handleInit = async (payload: { leftFile: string; rightFile: string; windowId: string }) => {
      const store = useMatrixStore.getState();
      store.initializeFromPayload(payload);
      try {
        const [leftCards, rightCards, traceBundle] = await Promise.all([
          loadCards(payload.leftFile),
          loadCards(payload.rightFile),
          loadTraceBundle(payload.leftFile, payload.rightFile),
        ]);
        useMatrixStore.getState().setCards('left', leftCards);
        useMatrixStore.getState().setCards('right', rightCards);
        useMatrixStore.getState().setTraceMetadata(traceBundle.fileName, traceBundle.header);
        useMatrixStore.getState().setRelations(traceBundle.relations);
      } catch (error) {
        useMatrixStore.getState().setError(error instanceof Error ? error.message : 'マトリクス初期化に失敗しました');
      } finally {
        useMatrixStore.getState().finishLoading();
      }
    };

    const unsubscribeInit = window.app.matrix.onInit(handleInit);
    const unsubscribeTrace = window.app.matrix.onTraceChanged((event) => {
      useMatrixStore.getState().applyTraceChange(event);
    });
    const unsubscribeSelection = window.app.matrix.onCardSelectionChanged((event) => {
      const state = useMatrixStore.getState();
      if (state.leftFile === event.fileName) {
        state.setHighlightedRowCardIds(event.selectedCardIds);
      }
      if (state.rightFile === event.fileName) {
        state.setHighlightedColumnCardIds(event.selectedCardIds);
      }
    });

    const handleBeforeUnload = () => {
      const windowId = useMatrixStore.getState().windowId;
      if (windowId) {
        void window.app.matrix.close({ windowId }).catch(() => {
          /* noop */
        });
      }
      useMatrixStore.getState().reset();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubscribeInit();
      unsubscribeTrace();
      unsubscribeSelection();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
};
