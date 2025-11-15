import React, { useCallback, useMemo, useState } from 'react';

import { TRACE_RELATION_KINDS, type TraceabilityRelation } from '@/shared/traceability';
import { useMatrixStore } from '@/renderer/store/matrixStore';
import { ContextMenu, type ContextMenuSection } from '@/renderer/components/ContextMenu';
import { TraceMatrixCell } from '@/renderer/components/TraceMatrixCell';
import { TraceMatrixHeader } from '@/renderer/components/TraceMatrixHeader';
import { TraceMatrixToolbar } from '@/renderer/components/TraceMatrixToolbar';
import { buildRelationLookup, changeRelationKind, toggleTraceRelation } from '@/renderer/utils/matrixRelations';

const makeCellKey = (leftId: string, rightId: string) => `${leftId}::${rightId}`;

export const TraceMatrixDialog: React.FC = () => {
  const leftCards = useMatrixStore((state) => state.leftCards);
  const rightCards = useMatrixStore((state) => state.rightCards);
  const relations = useMatrixStore((state) => state.relations);
  const stats = useMatrixStore((state) => state.stats);
  const leftFile = useMatrixStore((state) => state.leftFile);
  const rightFile = useMatrixStore((state) => state.rightFile);
  const traceFileName = useMatrixStore((state) => state.traceFileName);
  const traceHeader = useMatrixStore((state) => state.traceHeader);
  const highlightedCardIds = useMatrixStore((state) => state.highlightedCardIds);
  const setRelations = useMatrixStore((state) => state.setRelations);
  const setTraceMetadata = useMatrixStore((state) => state.setTraceMetadata);
  const setError = useMatrixStore((state) => state.setError);

  const relationLookup = useMemo(() => buildRelationLookup(relations), [relations]);
  const highlightedSet = useMemo(() => new Set(highlightedCardIds), [highlightedCardIds]);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    leftCardId: string;
    rightCardId: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const persistRelations = useCallback(
    async (nextRelations: TraceabilityRelation[], previousRelations: TraceabilityRelation[]) => {
      if (!leftFile || !rightFile) {
        return;
      }
      setIsSaving(true);
      try {
        const result = await window.app.workspace.saveTraceFile({
          fileName: traceFileName ?? undefined,
          leftFile,
          rightFile,
          header: traceHeader ?? undefined,
          relations: nextRelations,
        });
        setTraceMetadata(result.fileName, result.header);
        window.app.matrix.broadcastTraceChange({ leftFile, rightFile, relations: nextRelations });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'トレースの保存に失敗しました';
        setError(message);
        setRelations(previousRelations);
      } finally {
        setIsSaving(false);
      }
    },
    [leftFile, rightFile, traceFileName, traceHeader, setTraceMetadata, setError, setRelations],
  );

  const handleToggle = useCallback(
    (leftCardId: string, rightCardId: string) => {
      const previous = relations;
      const { next } = toggleTraceRelation(relations, leftCardId, rightCardId);
      setRelations(next);
      void persistRelations(next, previous);
    },
    [relations, setRelations, persistRelations],
  );

  const handleChangeKind = useCallback(
    (leftCardId: string, rightCardId: string, kind: (typeof TRACE_RELATION_KINDS)[number]) => {
      const previous = relations;
      const next = changeRelationKind(relations, leftCardId, rightCardId, kind);
      setRelations(next);
      void persistRelations(next, previous);
    },
    [relations, setRelations, persistRelations],
  );

  const gridTemplateColumns = useMemo(() => `200px repeat(${rightCards.length}, minmax(120px, 1fr))`, [rightCards.length]);

  const menuSections: ContextMenuSection[] = useMemo(() => {
    if (!contextMenu) {
      return [];
    }
    const currentRelation = relationLookup.get(makeCellKey(contextMenu.leftCardId, contextMenu.rightCardId));
    return [
      {
        key: 'type',
        title: 'トレース種別',
        items: TRACE_RELATION_KINDS.map((kind) => ({
          key: kind,
          label: kind,
          onSelect: () => handleChangeKind(contextMenu.leftCardId, contextMenu.rightCardId, kind),
          disabled: !currentRelation,
          closeOnSelect: true,
        })),
      },
    ];
  }, [contextMenu, relationLookup, handleChangeKind]);

  return (
    <div className="trace-matrix-dialog">
      <TraceMatrixHeader
        leftFile={leftFile}
        rightFile={rightFile}
        leftCount={leftCards.length}
        rightCount={rightCards.length}
      />
      <TraceMatrixToolbar
        totalTraces={stats.totalTraces}
        untracedLeftCount={stats.untracedLeftCount}
        untracedRightCount={stats.untracedRightCount}
      />
      {isSaving ? <p className="trace-matrix-status">保存中…</p> : null}
      <div className="trace-matrix-grid" aria-live="polite">
        <div className="trace-matrix-grid__inner" style={{ gridTemplateColumns }}>
          <div className="trace-matrix-grid__corner">&nbsp;</div>
          {rightCards.map((card) => (
            <div key={card.id} className="trace-matrix-grid__column-header">
              <span className="trace-matrix-grid__card-id">{card.cardId ?? card.id}</span>
              <span className="trace-matrix-grid__title">{card.title}</span>
            </div>
          ))}
          {leftCards.map((leftCard) => (
            <React.Fragment key={leftCard.id}>
              <div className="trace-matrix-grid__row-header">
                <span className="trace-matrix-grid__card-id">{leftCard.cardId ?? leftCard.id}</span>
                <span className="trace-matrix-grid__title">{leftCard.title}</span>
              </div>
              {rightCards.map((rightCard) => {
                const relation = relationLookup.get(makeCellKey(leftCard.id, rightCard.id));
                return (
                  <TraceMatrixCell
                    key={`${leftCard.id}:${rightCard.id}`}
                    hasTrace={Boolean(relation)}
                    traceKind={relation?.type}
                    isRowHighlighted={highlightedSet.has(leftCard.id)}
                    isColumnHighlighted={highlightedSet.has(rightCard.id)}
                    onToggle={() => handleToggle(leftCard.id, rightCard.id)}
                    onContextMenu={(event) => {
                      setContextMenu({ x: event.clientX, y: event.clientY, leftCardId: leftCard.id, rightCardId: rightCard.id });
                    }}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      {contextMenu ? (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          sections={menuSections}
          onClose={() => setContextMenu(null)}
        />
      ) : null}
    </div>
  );
};

TraceMatrixDialog.displayName = 'TraceMatrixDialog';
