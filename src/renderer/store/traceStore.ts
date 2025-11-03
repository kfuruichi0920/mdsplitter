import { create } from 'zustand';
import type { LoadedTraceabilityFile, TraceabilityLink } from '@/shared/traceability';
import { normalizeDirection } from '@/shared/traceability';

interface TraceCacheEntry {
  key: string;
  status: 'idle' | 'loading' | 'ready' | 'missing' | 'error';
  timestamp: number;
  links: TraceabilityLink[];
  sourceFileName?: string;
  error?: string;
}

interface TraceState {
  cache: Record<string, TraceCacheEntry>;
  loadTraceForPair: (leftFile: string, rightFile: string) => Promise<TraceCacheEntry>;
  getCached: (leftFile: string, rightFile: string) => TraceCacheEntry | undefined;
}

const toKey = (leftFile: string, rightFile: string): string => `${leftFile}|||${rightFile}`;

const convertLoadedFile = (
  leftFile: string,
  rightFile: string,
  file: LoadedTraceabilityFile,
): TraceCacheEntry => {
  const links: TraceabilityLink[] = [];
  const isSwapped = !(file.payload.left_file === leftFile && file.payload.right_file === rightFile);
  file.payload.relations.forEach((relation, index) => {
    const sourceIds = isSwapped ? relation.right_ids : relation.left_ids;
    const targetIds = isSwapped ? relation.left_ids : relation.right_ids;

    const baseDirection = normalizeDirection(relation.directed);
    const effectiveDirection = isSwapped
      ? baseDirection === 'forward'
        ? 'backward'
        : baseDirection === 'backward'
          ? 'forward'
          : 'bidirectional'
      : baseDirection;

    sourceIds.forEach((sourceId) => {
      targetIds.forEach((targetId) => {
        links.push({
          id: `${file.fileName}-${index}-${sourceId}-${targetId}`,
          sourceCardId: sourceId,
          targetCardId: targetId,
          relation: relation.type,
          direction: effectiveDirection,
        });
      });
    });
  });

  return {
    key: toKey(leftFile, rightFile),
    status: 'ready',
    timestamp: Date.now(),
    links,
    sourceFileName: file.fileName,
  } satisfies TraceCacheEntry;
};

export const useTraceStore = create<TraceState>()((set, get) => ({
  cache: {},
  getCached: (leftFile, rightFile) => {
    const key = toKey(leftFile, rightFile);
    return get().cache[key];
  },
  loadTraceForPair: async (leftFile, rightFile) => {
    const key = toKey(leftFile, rightFile);
    const cached = get().cache[key];
    if (cached && (cached.status === 'ready' || cached.status === 'missing')) {
      return cached;
    }

    set((state) => ({
      cache: {
        ...state.cache,
        [key]: {
          key,
          status: 'loading',
          timestamp: Date.now(),
          links: [],
        },
      },
    }));

    try {
      const result = await window.app.workspace.loadTraceFile(leftFile, rightFile);
      if (!result) {
        const entry: TraceCacheEntry = {
          key,
          status: 'missing',
          timestamp: Date.now(),
          links: [],
        };
        set((state) => ({ cache: { ...state.cache, [key]: entry } }));
        if (window.app?.log) {
          void window.app.log('info', `Trace file not found for pair: ${leftFile} / ${rightFile}`);
        }
        return entry;
      }
      const entry = convertLoadedFile(leftFile, rightFile, result);
      set((state) => ({ cache: { ...state.cache, [key]: entry } }));
      if (window.app?.log) {
        void window.app.log('info', `Trace file loaded: ${result.fileName}`);
      }
      return entry;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      const entry: TraceCacheEntry = {
        key,
        status: 'error',
        timestamp: Date.now(),
        links: [],
        error: message,
      };
      set((state) => ({ cache: { ...state.cache, [key]: entry } }));
      if (window.app?.log) {
        void window.app.log('error', `Trace file load failed for pair ${leftFile} / ${rightFile}: ${message}`);
      }
      return entry;
    }
  },
}));

export const resetTraceStore = (): void => {
  useTraceStore.setState({ cache: {} });
};
