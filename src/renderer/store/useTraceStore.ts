import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { TraceFile, TraceRelation, TraceRelationType, TraceDirection } from '@shared/types';

interface TraceState {
  // Trace files
  traceFiles: Map<string, TraceFile>; // key: `${leftFilePath}:${rightFilePath}`
  activeTraceFile: string | null;

  // Trace operations
  loadTraceFile: (key: string, traceFile: TraceFile) => void;
  unloadTraceFile: (key: string) => void;
  setActiveTraceFile: (key: string | null) => void;

  // Trace relation operations
  addTraceRelation: (
    key: string,
    leftIds: string[],
    rightIds: string[],
    type: TraceRelationType,
    directed: TraceDirection,
    memo?: string
  ) => void;
  updateTraceRelation: (key: string, relationId: string, updates: Partial<TraceRelation>) => void;
  deleteTraceRelation: (key: string, relationId: string) => void;

  // Selection
  selectedTraceRelations: Set<string>;
  selectTraceRelation: (relationId: string, multi?: boolean) => void;
  deselectTraceRelation: (relationId: string) => void;
  clearSelection: () => void;

  // Display settings
  traceVisible: boolean;
  setTraceVisible: (visible: boolean) => void;
  traceTypeFilter: TraceRelationType[];
  setTraceTypeFilter: (types: TraceRelationType[]) => void;
}

export const useTraceStore = create<TraceState>()(
  devtools(
    (set) => ({
      // Trace files
      traceFiles: new Map(),
      activeTraceFile: null,

      // Trace operations
      loadTraceFile: (key, traceFile) =>
        set((state) => {
          const newTraceFiles = new Map(state.traceFiles);
          newTraceFiles.set(key, traceFile);
          return {
            traceFiles: newTraceFiles,
            activeTraceFile: key,
          };
        }),

      unloadTraceFile: (key) =>
        set((state) => {
          const newTraceFiles = new Map(state.traceFiles);
          newTraceFiles.delete(key);
          return {
            traceFiles: newTraceFiles,
            activeTraceFile: state.activeTraceFile === key ? null : state.activeTraceFile,
          };
        }),

      setActiveTraceFile: (key) => set({ activeTraceFile: key }),

      // Trace relation operations
      addTraceRelation: (key, leftIds, rightIds, type, directed, memo) =>
        set((state) => {
          const traceFile = state.traceFiles.get(key);
          if (!traceFile) return state;

          const newRelation: TraceRelation = {
            id: crypto.randomUUID(),
            left_ids: leftIds,
            right_ids: rightIds,
            type,
            directed,
            memo,
          };

          const newTraceFiles = new Map(state.traceFiles);
          newTraceFiles.set(key, {
            ...traceFile,
            body: [...traceFile.body, newRelation],
            header: {
              ...traceFile.header,
              updatedAt: new Date().toISOString(),
            },
          });

          return { traceFiles: newTraceFiles };
        }),

      updateTraceRelation: (key, relationId, updates) =>
        set((state) => {
          const traceFile = state.traceFiles.get(key);
          if (!traceFile) return state;

          const updatedRelations = traceFile.body.map((relation) =>
            relation.id === relationId ? { ...relation, ...updates } : relation
          );

          const newTraceFiles = new Map(state.traceFiles);
          newTraceFiles.set(key, {
            ...traceFile,
            body: updatedRelations,
            header: {
              ...traceFile.header,
              updatedAt: new Date().toISOString(),
            },
          });

          return { traceFiles: newTraceFiles };
        }),

      deleteTraceRelation: (key, relationId) =>
        set((state) => {
          const traceFile = state.traceFiles.get(key);
          if (!traceFile) return state;

          const updatedRelations = traceFile.body.filter((relation) => relation.id !== relationId);
          const newTraceFiles = new Map(state.traceFiles);
          newTraceFiles.set(key, {
            ...traceFile,
            body: updatedRelations,
            header: {
              ...traceFile.header,
              updatedAt: new Date().toISOString(),
            },
          });

          return { traceFiles: newTraceFiles };
        }),

      // Selection
      selectedTraceRelations: new Set(),
      selectTraceRelation: (relationId, multi = false) =>
        set((state) => {
          const newSelection = multi ? new Set(state.selectedTraceRelations) : new Set<string>();
          if (multi && newSelection.has(relationId)) {
            newSelection.delete(relationId);
          } else {
            newSelection.add(relationId);
          }
          return { selectedTraceRelations: newSelection };
        }),

      deselectTraceRelation: (relationId) =>
        set((state) => {
          const newSelection = new Set(state.selectedTraceRelations);
          newSelection.delete(relationId);
          return { selectedTraceRelations: newSelection };
        }),

      clearSelection: () => set({ selectedTraceRelations: new Set() }),

      // Display settings
      traceVisible: true,
      setTraceVisible: (visible) => set({ traceVisible: visible }),
      traceTypeFilter: ['trace', 'refines', 'tests', 'duplicates', 'satisfy', 'relate', 'specialize'],
      setTraceTypeFilter: (types) => set({ traceTypeFilter: types }),
    }),
    { name: 'TraceStore' }
  )
);
