import React, { useCallback, useMemo, useState } from 'react';

import { TRACE_RELATION_KINDS, type TraceabilityRelation } from '@/shared/traceability';
import { useMatrixStore } from '@/renderer/store/matrixStore';
import { ContextMenu, type ContextMenuSection } from '@/renderer/components/ContextMenu';
import { TraceMatrixCell } from '@/renderer/components/TraceMatrixCell';
import { TraceMatrixHeader } from '@/renderer/components/TraceMatrixHeader';
import { TraceMatrixToolbar } from '@/renderer/components/TraceMatrixToolbar';
import { TraceMatrixFilterPanel } from '@/renderer/components/TraceMatrixFilterPanel';
import { buildRelationLookup, changeRelationKind, toggleTraceRelation } from '@/renderer/utils/matrixRelations';
import { exportMatrixToCSV } from '@/renderer/utils/matrixExport';

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
  const highlightedRowCardIds = useMatrixStore((state) => state.highlightedRowCardIds);
  const highlightedColumnCardIds = useMatrixStore((state) => state.highlightedColumnCardIds);
  const filter = useMatrixStore((state) => state.filter);
  const setRelations = useMatrixStore((state) => state.setRelations);
  const setTraceMetadata = useMatrixStore((state) => state.setTraceMetadata);
  const setError = useMatrixStore((state) => state.setError);
  const setFilterQuery = useMatrixStore((state) => state.setFilterQuery);
  const toggleFilterStatus = useMatrixStore((state) => state.toggleFilterStatus);
  const setTraceFocus = useMatrixStore((state) => state.setTraceFocus);
  const resetFilter = useMatrixStore((state) => state.resetFilter);

  const relationLookup = useMemo(() => buildRelationLookup(relations), [relations]);
  const rowHighlightSet = useMemo(() => new Set(highlightedRowCardIds), [highlightedRowCardIds]);
  const columnHighlightSet = useMemo(() => new Set(highlightedColumnCardIds), [highlightedColumnCardIds]);

  const filteredLeftCards = useMemo(() => {
    return leftCards.filter((card) => {
      if (filter.cardIdQuery && !(card.cardId ?? card.id).toLowerCase().includes(filter.cardIdQuery.toLowerCase())) {
        return false;
      }
      if (filter.titleQuery && !(card.title ?? '').toLowerCase().includes(filter.titleQuery.toLowerCase())) {
        return false;
      }
      if (!filter.status[card.status]) {
        return false;
      }
      if (filter.columnTraceFocus) {
        const key = makeCellKey(card.id, filter.columnTraceFocus);
        if (!relationLookup.has(key)) {
          return false;
        }
      }
      return true;
    });
  }, [leftCards, filter, relationLookup]);

  const filteredRightCards = useMemo(() => {
    return rightCards.filter((card) => {
      if (filter.cardIdQuery && !(card.cardId ?? card.id).toLowerCase().includes(filter.cardIdQuery.toLowerCase())) {
        return false;
      }
      if (filter.titleQuery && !(card.title ?? '').toLowerCase().includes(filter.titleQuery.toLowerCase())) {
        return false;
      }
      if (!filter.status[card.status]) {
        return false;
      }
      if (filter.rowTraceFocus) {
        const key = makeCellKey(filter.rowTraceFocus, card.id);
        if (!relationLookup.has(key)) {
          return false;
        }
      }
      return true;
    });
  }, [rightCards, filter, relationLookup]);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    leftCardId: string;
    rightCardId: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

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

  const broadcastSelection = useCallback((file: string | null, ids: string[]) => {
    if (!file || !window.app?.matrix) {
      return;
    }
    window.app.matrix.broadcastCardSelection({ fileName: file, selectedCardIds: ids, source: 'matrix-window' });
  }, []);

  const handleToggle = useCallback(
    (leftCardId: string, rightCardId: string) => {
      const previous = relations;
      const { next } = toggleTraceRelation(relations, leftCardId, rightCardId);
      setRelations(next);
      void persistRelations(next, previous);
      broadcastSelection(leftFile, [leftCardId]);
      broadcastSelection(rightFile, [rightCardId]);
    },
    [relations, setRelations, persistRelations, broadcastSelection, leftFile, rightFile],
  );

  const handleChangeKind = useCallback(
    (leftCardId: string, rightCardId: string, kind: (typeof TRACE_RELATION_KINDS)[number]) => {
      const previous = relations;
      const next = changeRelationKind(relations, leftCardId, rightCardId, kind);
      setRelations(next);
      void persistRelations(next, previous);
      broadcastSelection(leftFile, [leftCardId]);
      broadcastSelection(rightFile, [rightCardId]);
    },
    [relations, setRelations, persistRelations, broadcastSelection, leftFile, rightFile],
  );

  const gridTemplateColumns = useMemo(
    () => `200px repeat(${filteredRightCards.length}, minmax(120px, 1fr))`,
    [filteredRightCards.length],
  );

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

  const handleExport = useCallback(async () => {
    if (!leftFile || !rightFile) {
      return;
    }
    try {
      setExporting(true);
      setExportMessage(null);
      const csv = exportMatrixToCSV(leftCards, rightCards, relations);
      const suggestion = `${leftFile.replace(/\.md$/i, '')}_${rightFile.replace(/\.md$/i, '')}.csv`;
      const dialogApi = window.app?.dialogs?.promptSaveFile;
      if (!dialogApi) {
        setExportMessage('保存ダイアログAPIが利用できません。');
        return;
      }
      const result = await dialogApi({ defaultFileName: suggestion });
      if (!result || result.canceled || !result.fileName) {
        setExportMessage('エクスポートをキャンセルしました。');
        return;
      }
      await window.app.matrix.export({ fileName: result.fileName, content: csv, format: 'csv' });
      setExportMessage(`${result.fileName} にCSVを保存しました。`);
    } catch (error) {
      console.error('[TraceMatrixDialog] export failed', error);
      setExportMessage('エクスポートに失敗しました。');
    } finally {
      setExporting(false);
    }
  }, [leftCards, rightCards, relations, leftFile, rightFile]);

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
        onExport={handleExport}
      />
      {isSaving ? <p className="trace-matrix-status">保存中…</p> : null}
      {exporting ? <p className="trace-matrix-status">エクスポート中…</p> : null}
      {exportMessage ? <p className="trace-matrix-status">{exportMessage}</p> : null}
      <div className="trace-matrix-content">
        <div className="trace-matrix-grid" aria-live="polite">
          <div className="trace-matrix-grid__inner" style={{ gridTemplateColumns }}>
            <div className="trace-matrix-grid__corner">&nbsp;</div>
            {filteredRightCards.map((card) => (
              <div key={card.id} className="trace-matrix-grid__column-header">
                <span className="trace-matrix-grid__card-id">{card.cardId ?? card.id}</span>
                <span className="trace-matrix-grid__title">{card.title}</span>
              </div>
            ))}
            {filteredLeftCards.map((leftCard) => (
              <React.Fragment key={leftCard.id}>
                <div className="trace-matrix-grid__row-header">
                  <span className="trace-matrix-grid__card-id">{leftCard.cardId ?? leftCard.id}</span>
                  <span className="trace-matrix-grid__title">{leftCard.title}</span>
                </div>
                {filteredRightCards.map((rightCard) => {
                  const relation = relationLookup.get(makeCellKey(leftCard.id, rightCard.id));
                  return (
                    <TraceMatrixCell
                      key={`${leftCard.id}:${rightCard.id}`}
                      hasTrace={Boolean(relation)}
                      traceKind={relation?.type}
                      isRowHighlighted={rowHighlightSet.has(leftCard.id)}
                      isColumnHighlighted={columnHighlightSet.has(rightCard.id)}
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
        <TraceMatrixFilterPanel
          filter={filter}
          onQueryChange={setFilterQuery}
          onToggleStatus={toggleFilterStatus}
          onFocusRow={(id) => setTraceFocus('row', id)}
          onFocusColumn={(id) => setTraceFocus('column', id)}
          onReset={resetFilter}
          leftCards={leftCards}
          rightCards={rightCards}
        />
      </div>
      {contextMenu ? (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} sections={menuSections} onClose={() => setContextMenu(null)} />
      ) : null}
    </div>
  );
};

TraceMatrixDialog.displayName = 'TraceMatrixDialog';
