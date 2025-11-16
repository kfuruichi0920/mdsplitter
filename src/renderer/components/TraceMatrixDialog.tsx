import React, { useCallback, useMemo, useState } from 'react';

import { TRACE_RELATION_KINDS, type TraceabilityRelation } from '@/shared/traceability';
import type { Card } from '@/shared/workspace';
import { useMatrixStore } from '@/renderer/store/matrixStore';
import { useTraceStore } from '@/renderer/store/traceStore';
import { ContextMenu, type ContextMenuSection } from '@/renderer/components/ContextMenu';
import { TraceMatrixCell } from '@/renderer/components/TraceMatrixCell';
import { TraceMatrixHeader } from '@/renderer/components/TraceMatrixHeader';
import { TraceMatrixToolbar } from '@/renderer/components/TraceMatrixToolbar';
import { TraceMatrixFilterPanel } from '@/renderer/components/TraceMatrixFilterPanel';
import { changeRelationKind, makeRelationKey, toggleTraceRelation } from '@/renderer/utils/matrixRelations';
import { exportMatrixToCSV, exportMatrixToExcel } from '@/renderer/utils/matrixExport';

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
  const setHighlightedRowCardIds = useMatrixStore((state) => state.setHighlightedRowCardIds);
  const setHighlightedColumnCardIds = useMatrixStore((state) => state.setHighlightedColumnCardIds);

  const relationLookup = useMemo(() => {
    const map = new Map<string, TraceabilityRelation>();
    relations.forEach((relation) => {
      relation.left_ids.forEach((leftId) => {
        relation.right_ids.forEach((rightId) => {
          map.set(makeRelationKey(leftId, rightId), relation);
        });
      });
    });
    return map;
  }, [relations]);

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
        const key = makeRelationKey(card.id, filter.columnTraceFocus);
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
        const key = makeRelationKey(filter.rowTraceFocus, card.id);
        if (!relationLookup.has(key)) {
          return false;
        }
      }
      return true;
    });
  }, [rightCards, filter, relationLookup]);

  const rowHighlightSet = useMemo(() => new Set(highlightedRowCardIds), [highlightedRowCardIds]);
  const columnHighlightSet = useMemo(() => new Set(highlightedColumnCardIds), [highlightedColumnCardIds]);

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
        useTraceStore.getState().loadTraceForPair(leftFile, rightFile).catch((error) => {
          console.warn('[TraceMatrixDialog] failed to refresh trace store', error);
        });
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

  const broadcastSelection = useCallback((file: string | null, ids: string[], side: 'row' | 'column') => {
    if (!file || !window.app?.matrix) {
      return;
    }
    window.app.matrix.broadcastCardSelection({ fileName: file, selectedCardIds: ids, source: 'matrix-window' });
    if (side === 'row') {
      setHighlightedRowCardIds(ids);
    } else {
      setHighlightedColumnCardIds(ids);
    }
  }, [setHighlightedRowCardIds, setHighlightedColumnCardIds]);

  const handleToggle = useCallback(
    (leftCardId: string, rightCardId: string) => {
      const previous = useMatrixStore.getState().relations;
      const { next } = toggleTraceRelation(previous, leftCardId, rightCardId);
      setRelations(next);
      void persistRelations(next, previous);
      broadcastSelection(leftFile, [leftCardId], 'row');
      broadcastSelection(rightFile, [rightCardId], 'column');
    },
    [setRelations, persistRelations, broadcastSelection, leftFile, rightFile],
  );

  const handleChangeKind = useCallback(
    (leftCardId: string, rightCardId: string, kind: (typeof TRACE_RELATION_KINDS)[number]) => {
      const previous = useMatrixStore.getState().relations;
      const next = changeRelationKind(previous, leftCardId, rightCardId, kind);
      setRelations(next);
      void persistRelations(next, previous);
      broadcastSelection(leftFile, [leftCardId], 'row');
      broadcastSelection(rightFile, [rightCardId], 'column');
    },
    [setRelations, persistRelations, broadcastSelection, leftFile, rightFile],
  );

  const menuSections: ContextMenuSection[] = useMemo(() => {
    if (!contextMenu) {
      return [];
    }
    const currentRelation = relationLookup.get(makeRelationKey(contextMenu.leftCardId, contextMenu.rightCardId));
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

  const handleExport = useCallback(
    async (format: 'csv' | 'excel') => {
      if (!leftFile || !rightFile) {
        setExportMessage('ファイル選択が必要です。');
        return;
      }
      const dialogApi = window.app?.dialogs?.promptSaveFile;
      if (!dialogApi) {
        setExportMessage('保存ダイアログAPIが利用できません。');
        return;
      }
      try {
        setExporting(true);
        setExportMessage(null);
        const defaultBase = `${leftFile.replace(/\.md$/i, '')}_${rightFile.replace(/\.md$/i, '')}`;
        const suggestedName = format === 'csv' ? `${defaultBase}.csv` : `${defaultBase}.xlsx`;
        const result = await dialogApi({ defaultFileName: suggestedName });
        if (!result || result.canceled || !result.fileName) {
          setExportMessage('エクスポートをキャンセルしました。');
          return;
        }
        const normalized = format === 'csv'
          ? result.fileName.endsWith('.csv') ? result.fileName : `${result.fileName}.csv`
          : result.fileName.endsWith('.xlsx') ? result.fileName : `${result.fileName}.xlsx`;
        if (format === 'csv') {
          const csv = exportMatrixToCSV(leftCards, rightCards, useMatrixStore.getState().relations);
          await window.app.matrix.export({ fileName: normalized, content: csv, format: 'csv', encoding: 'utf8' });
          setExportMessage(`${normalized} にCSVを保存しました。`);
        } else {
          const base64 = exportMatrixToExcel(leftCards, rightCards, useMatrixStore.getState().relations);
          await window.app.matrix.export({ fileName: normalized, content: base64, format: 'excel', encoding: 'base64' });
          setExportMessage(`${normalized} にExcelを保存しました。`);
        }
      } catch (error) {
        console.error('[TraceMatrixDialog] export failed', error);
        setExportMessage('エクスポートに失敗しました。');
      } finally {
        setExporting(false);
      }
    },
    [leftCards, rightCards, leftFile, rightFile],
  );

  const handleRowHeaderClick = useCallback((card: Card) => {
    broadcastSelection(leftFile, [card.id], 'row');
  }, [broadcastSelection, leftFile]);

  const handleColumnHeaderClick = useCallback((card: Card) => {
    broadcastSelection(rightFile, [card.id], 'column');
  }, [broadcastSelection, rightFile]);

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
        onExportCSV={() => handleExport('csv')}
        onExportExcel={() => handleExport('excel')}
      />
      {isSaving ? <p className="trace-matrix-status">保存中…</p> : null}
      {exporting ? <p className="trace-matrix-status">エクスポート中…</p> : null}
      {exportMessage ? <p className="trace-matrix-status">{exportMessage}</p> : null}
      <div className="trace-matrix-content">
        <div className="trace-matrix-grid">
          <div className="trace-matrix-grid__scroll">
            <table className="trace-matrix-table">
              <thead>
                <tr>
                  <th className="trace-matrix-table__corner" />
                  {filteredRightCards.map((card) => (
                    <th key={card.id} className="trace-matrix-table__column-header">
                      <button type="button" onClick={() => handleColumnHeaderClick(card)}>
                        <span className="trace-matrix-grid__card-id">{card.cardId ?? card.id}</span>
                        <span className="trace-matrix-grid__title">{card.title}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLeftCards.map((leftCard) => (
                  <tr key={leftCard.id}>
                    <th className="trace-matrix-table__row-header" scope="row">
                      <button type="button" onClick={() => handleRowHeaderClick(leftCard)}>
                        <span className="trace-matrix-grid__card-id">{leftCard.cardId ?? leftCard.id}</span>
                        <span className="trace-matrix-grid__title">{leftCard.title}</span>
                      </button>
                    </th>
                    {filteredRightCards.map((rightCard) => {
                      const relation = relationLookup.get(makeRelationKey(leftCard.id, rightCard.id));
                      return (
                        <td key={`${leftCard.id}:${rightCard.id}`} className="trace-matrix-table__cell">
                          <TraceMatrixCell
                            hasTrace={Boolean(relation)}
                            traceKind={relation?.type}
                            isRowHighlighted={rowHighlightSet.has(leftCard.id)}
                            isColumnHighlighted={columnHighlightSet.has(rightCard.id)}
                            onToggle={() => handleToggle(leftCard.id, rightCard.id)}
                            onContextMenu={(event) => {
                              setContextMenu({ x: event.clientX, y: event.clientY, leftCardId: leftCard.id, rightCardId: rightCard.id });
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredLeftCards.length === 0 || filteredRightCards.length === 0 ? (
              <p className="trace-matrix-status px-2">表示するセルがありません。</p>
            ) : null}
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
