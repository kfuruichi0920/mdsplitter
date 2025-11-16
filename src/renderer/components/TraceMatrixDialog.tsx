import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { FixedSizeGrid, type GridChildComponentProps } from 'react-window';

import { TRACE_RELATION_KINDS, type TraceabilityRelation } from '@/shared/traceability';
import type { Card } from '@/shared/workspace';
import { useMatrixStore } from '@/renderer/store/matrixStore';
import { ContextMenu, type ContextMenuSection } from '@/renderer/components/ContextMenu';
import { TraceMatrixCell } from '@/renderer/components/TraceMatrixCell';
import { TraceMatrixHeader } from '@/renderer/components/TraceMatrixHeader';
import { TraceMatrixToolbar } from '@/renderer/components/TraceMatrixToolbar';
import { TraceMatrixFilterPanel } from '@/renderer/components/TraceMatrixFilterPanel';
import { useMatrixGrid } from '@/renderer/hooks/useMatrixGrid';
import { changeRelationKind, makeRelationKey, toggleTraceRelation } from '@/renderer/utils/matrixRelations';
import { exportMatrixToCSV, exportMatrixToExcel } from '@/renderer/utils/matrixExport';

const ROW_HEADER_WIDTH = 200;
const COLUMN_WIDTH = 140;
const ROW_HEIGHT = 48;

export const TraceMatrixDialog: React.FC = () => {
  const leftCards = useMatrixStore((state) => state.leftCards);
  const rightCards = useMatrixStore((state) => state.rightCards);
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

  const { filteredLeftCards, filteredRightCards, relationLookup, headerColumns } = useMatrixGrid();
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
  const [scrollState, setScrollState] = useState({ left: 0, top: 0 });
  const gridBodyRef = useRef<HTMLDivElement>(null);
  const [gridSize, setGridSize] = useState({ width: 640, height: 480 });

  useEffect(() => {
    const measure = () => {
      const node = gridBodyRef.current;
      if (!node) {
        return;
      }
      setGridSize({ width: node.clientWidth, height: node.clientHeight });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    const node = gridBodyRef.current;
    if (!node) {
      return;
    }
    setGridSize({ width: node.clientWidth, height: node.clientHeight });
  }, [filteredLeftCards.length, filteredRightCards.length]);

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
      const previous = useMatrixStore.getState().relations;
      const { next } = toggleTraceRelation(previous, leftCardId, rightCardId);
      setRelations(next);
      void persistRelations(next, previous);
      broadcastSelection(leftFile, [leftCardId]);
      broadcastSelection(rightFile, [rightCardId]);
    },
    [setRelations, persistRelations, broadcastSelection, leftFile, rightFile],
  );

  const handleChangeKind = useCallback(
    (leftCardId: string, rightCardId: string, kind: (typeof TRACE_RELATION_KINDS)[number]) => {
      const previous = useMatrixStore.getState().relations;
      const next = changeRelationKind(previous, leftCardId, rightCardId, kind);
      setRelations(next);
      void persistRelations(next, previous);
      broadcastSelection(leftFile, [leftCardId]);
      broadcastSelection(rightFile, [rightCardId]);
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

  const cellRenderer = useCallback(
    ({ columnIndex, rowIndex, style }: GridChildComponentProps) => {
      const leftCard = filteredLeftCards[rowIndex];
      const rightCard = filteredRightCards[columnIndex];
      if (!leftCard || !rightCard) {
        return null;
      }
      const relation = relationLookup.get(makeRelationKey(leftCard.id, rightCard.id));
      return (
        <div style={style} className="trace-matrix-grid__cell-wrapper">
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
        </div>
      );
    },
    [filteredLeftCards, filteredRightCards, relationLookup, rowHighlightSet, columnHighlightSet, handleToggle],
  );

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
          <div className="trace-matrix-grid__column-header-row">
            <div className="trace-matrix-grid__corner" style={{ width: ROW_HEADER_WIDTH }}>&nbsp;</div>
            <div
              className="trace-matrix-grid__column-headers"
              style={{
                transform: `translateX(-${scrollState.left}px)`,
                width: headerColumns.length * COLUMN_WIDTH,
              }}
            >
              {headerColumns.map((header) => {
                const card = header.column.columnDef.meta?.card as Card | undefined;
                if (!card) {
                  return (
                    <div key={header.id} className="trace-matrix-grid__column-header" style={{ width: COLUMN_WIDTH }} />
                  );
                }
                return (
                  <div key={header.id} className="trace-matrix-grid__column-header" style={{ width: COLUMN_WIDTH }}>
                    <span className="trace-matrix-grid__card-id">{card.cardId ?? card.id}</span>
                    <span className="trace-matrix-grid__title">{card.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="trace-matrix-grid__body">
            <div
              className="trace-matrix-grid__row-headers"
              style={{ width: ROW_HEADER_WIDTH, transform: `translateY(-${scrollState.top}px)` }}
            >
              {filteredLeftCards.map((card) => (
                <div key={card.id} className="trace-matrix-grid__row-header" style={{ height: ROW_HEIGHT }}>
                  <span className="trace-matrix-grid__card-id">{card.cardId ?? card.id}</span>
                  <span className="trace-matrix-grid__title">{card.title}</span>
                </div>
              ))}
            </div>
            <div className="trace-matrix-grid__cells" ref={gridBodyRef}>
              {filteredLeftCards.length > 0 && filteredRightCards.length > 0 ? (
                <FixedSizeGrid
                  columnCount={filteredRightCards.length}
                  columnWidth={COLUMN_WIDTH}
                  height={Math.max(100, gridSize.height)}
                  rowCount={filteredLeftCards.length}
                  rowHeight={ROW_HEIGHT}
                  width={Math.max(100, gridSize.width)}
                  onScroll={({ scrollLeft, scrollTop }) => setScrollState({ left: scrollLeft, top: scrollTop })}
                >
                  {cellRenderer}
                </FixedSizeGrid>
              ) : (
                <div className="trace-matrix-status px-2">表示するセルがありません。</div>
              )}
            </div>
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
