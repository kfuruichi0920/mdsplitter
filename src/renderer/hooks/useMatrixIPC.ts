import { useEffect } from 'react';

import { useMatrixStore } from '@/renderer/store/matrixStore';

const loadCards = async (fileName: string) => {
  const snapshot = await window.app.workspace.loadCardFile(fileName);
  return snapshot?.cards ?? [];
};

const loadRelations = async (leftFile: string, rightFile: string) => {
  const traceFile = await window.app.workspace.loadTraceFile(leftFile, rightFile);
  return traceFile?.payload.relations ?? [];
};

export const useMatrixIPC = (): void => {
  useEffect(() => {
    const handleInit = async (payload: { leftFile: string; rightFile: string; windowId: string }) => {
      const store = useMatrixStore.getState();
      store.initializeFromPayload(payload);
      try {
        const [leftCards, rightCards, relations] = await Promise.all([
          loadCards(payload.leftFile),
          loadCards(payload.rightFile),
          loadRelations(payload.leftFile, payload.rightFile),
        ]);
        useMatrixStore.getState().setCards('left', leftCards);
        useMatrixStore.getState().setCards('right', rightCards);
        useMatrixStore.getState().setRelations(relations);
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
      if (state.leftFile !== event.fileName && state.rightFile !== event.fileName) {
        return;
      }
      state.setHighlightedCardIds(event.selectedCardIds);
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
