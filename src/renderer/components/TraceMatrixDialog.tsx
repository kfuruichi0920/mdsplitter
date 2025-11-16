import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { TRACE_RELATION_KINDS, type TraceabilityRelation } from '@/shared/traceability';
import type { Card } from '@/shared/workspace';
import { useMatrixStore } from '@/renderer/store/matrixStore';
import { useTraceStore } from '@/renderer/store/traceStore';
import { ContextMenu, type ContextMenuSection } from '@/renderer/components/ContextMenu';
import { TraceMatrixCell } from '@/renderer/components/TraceMatrixCell';
import { TraceMatrixHeader } from '@/renderer/components/TraceMatrixHeader';
import { TraceMatrixToolbar } from '@/renderer/components/TraceMatrixToolbar';
import { TraceMatrixFilterPanel } from '@/renderer/components/TraceMatrixFilterPanel';
import { changeRelationKind, makeRelationKey, toggleTraceRelation, updateRelationDirection, updateRelationMemo } from '@/renderer/utils/matrixRelations';
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
  const setCards = useMatrixStore((state) => state.setCards);
  const setTraceMetadata = useMatrixStore((state) => state.setTraceMetadata);
  const setError = useMatrixStore((state) => state.setError);
  const setFilterQuery = useMatrixStore((state) => state.setFilterQuery);
  const toggleFilterStatus = useMatrixStore((state) => state.toggleFilterStatus);
  const setTraceFocus = useMatrixStore((state) => state.setTraceFocus);
  const resetFilter = useMatrixStore((state) => state.resetFilter);
  const setHighlightedRowCardIds = useMatrixStore((state) => state.setHighlightedRowCardIds);
  const setHighlightedColumnCardIds = useMatrixStore((state) => state.setHighlightedColumnCardIds);
  const defaultRelationKind = useMatrixStore((state) => state.defaultRelationKind);
  const defaultDirection = useMatrixStore((state) => state.defaultDirection);
  const confirmMemoDeletion = useMatrixStore((state) => state.confirmMemoDeletion);
  const setDefaultRelationKind = useMatrixStore((state) => state.setDefaultRelationKind);
  const setDefaultDirection = useMatrixStore((state) => state.setDefaultDirection);
  const setConfirmMemoDeletion = useMatrixStore((state) => state.setConfirmMemoDeletion);

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

  const formatCardLabel = useCallback((card: Card): string => {
    const identifier = card.cardId ?? card.id;
    const title = card.title ? ` - ${card.title}` : '';
    return `${identifier}${title}`;
  }, []);

  const formatCardTooltip = useCallback((card: Card): string => {
    const identifier = card.cardId ?? card.id;
    const body = card.body?.trim() ?? '';
    const snippet = body ? `${body.slice(0, 120)}${body.length > 120 ? '…' : ''}` : '---';
    return `ID: ${identifier}\nステータス: ${card.status}\n本文: ${snippet}`;
  }, []);

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [memoEditor, setMemoEditor] = useState<{
    relationId: string;
    leftLabel: string;
    rightLabel: string;
    initialMemo: string;
  } | null>(null);

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

  const applyMemoUpdate = useCallback(
    (relationId: string, memoValue: string) => {
      const previous = useMatrixStore.getState().relations;
      const target = previous.find((relation) => relation.id === relationId);
      const normalized = memoValue.trim();
      if (!target) {
        return;
      }
      if ((target.memo ?? '') === normalized) {
        return;
      }
      const next = updateRelationMemo(previous, relationId, memoValue);
      setRelations(next);
      void persistRelations(next, previous);
    },
    [persistRelations, setRelations],
  );

  const openMemoEditor = useCallback(
    (relation: TraceabilityRelation, leftCard: Card, rightCard: Card) => {
      setMemoEditor({
        relationId: relation.id,
        leftLabel: formatCardLabel(leftCard),
        rightLabel: formatCardLabel(rightCard),
        initialMemo: relation.memo ?? '',
      });
    },
    [formatCardLabel],
  );

  const handleRefresh = useCallback(async () => {
    if (!leftFile || !rightFile) {
      return;
    }
    const workspace = window.app?.workspace;
    if (!workspace?.loadOutputFile || !workspace?.loadTraceFile) {
      setError('ワークスペースAPIが利用できません');
      return;
    }
    setIsRefreshing(true);
    try {
      const [leftSnapshot, rightSnapshot, traceResult] = await Promise.all([
        workspace.loadOutputFile(leftFile),
        workspace.loadOutputFile(rightFile),
        workspace.loadTraceFile(leftFile, rightFile),
      ]);
      setCards('left', leftSnapshot?.cards ?? []);
      setCards('right', rightSnapshot?.cards ?? []);
      if (traceResult) {
        setTraceMetadata(traceResult.fileName, traceResult.payload.header ?? null);
        setRelations(traceResult.payload.relations);
      } else {
        setTraceMetadata(null, null);
        setRelations([]);
      }
    } catch (error) {
      console.error('[TraceMatrixDialog] failed to refresh matrix data', error);
      setError(error instanceof Error ? error.message : '更新に失敗しました');
    } finally {
      setIsRefreshing(false);
    }
  }, [leftFile, rightFile, setCards, setError, setRelations, setTraceMetadata]);

  const handleMemoDialogSave = useCallback(
    (value: string) => {
      if (!memoEditor) {
        return;
      }
      applyMemoUpdate(memoEditor.relationId, value);
      setMemoEditor(null);
    },
    [applyMemoUpdate, memoEditor],
  );

  const handleMemoDialogClose = useCallback(() => {
    setMemoEditor(null);
  }, []);

  const handleDirectionChange = useCallback(
    (relationId: string, direction: TraceabilityRelation['directed']) => {
      const previous = useMatrixStore.getState().relations;
      const next = updateRelationDirection(previous, relationId, direction);
      if (next === previous) {
        return;
      }
      setRelations(next);
      void persistRelations(next, previous);
    },
    [persistRelations, setRelations],
  );

  const handleToggle = useCallback(
    (leftCardId: string, rightCardId: string) => {
      const previous = useMatrixStore.getState().relations;
      const relation = relationLookup.get(makeRelationKey(leftCardId, rightCardId));
      if (
        relation &&
        relation.memo &&
        confirmMemoDeletion &&
        relation.left_ids.length === 1 &&
        relation.right_ids.length === 1
      ) {
        const confirmed = window.confirm('このトレースにはメモが設定されています。削除するとメモも失われます。続行しますか?');
        if (!confirmed) {
          return;
        }
      }
      const { next } = toggleTraceRelation(previous, leftCardId, rightCardId, {
        defaultKind: defaultRelationKind,
        defaultDirection,
      });
      setRelations(next);
      void persistRelations(next, previous);
      broadcastSelection(leftFile, [leftCardId], 'row');
      broadcastSelection(rightFile, [rightCardId], 'column');
    },
    [broadcastSelection, confirmMemoDeletion, defaultDirection, defaultRelationKind, leftFile, relationLookup, persistRelations, rightFile, setRelations],
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
    const leftCard = leftCards.find((card) => card.id === contextMenu.leftCardId);
    const rightCard = rightCards.find((card) => card.id === contextMenu.rightCardId);
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
      {
        key: 'direction',
        title: '方向',
        items: DIRECTION_OPTIONS.map((direction) => ({
          key: direction,
          label: describeDirected(direction),
          onSelect: () => {
            if (currentRelation) {
              handleDirectionChange(currentRelation.id, direction);
            }
          },
          disabled: !currentRelation,
          closeOnSelect: true,
        })),
      },
      {
        key: 'memo',
        title: 'メモ',
        items: [
          {
            key: 'edit-memo',
            label: currentRelation?.memo ? 'メモを編集' : 'メモを追加',
            disabled: !currentRelation || !leftCard || !rightCard,
            onSelect: () => {
              if (!currentRelation || !leftCard || !rightCard) {
                return;
              }
              openMemoEditor(currentRelation, leftCard, rightCard);
            },
          },
          {
            key: 'clear-memo',
            label: 'メモをクリア',
            variant: 'danger',
            disabled: !currentRelation || !currentRelation.memo,
            onSelect: () => {
              if (!currentRelation) {
                return;
              }
              applyMemoUpdate(currentRelation.id, '');
            },
          },
        ],
      },
    ];
  }, [applyMemoUpdate, contextMenu, handleChangeKind, handleDirectionChange, leftCards, openMemoEditor, relationLookup, rightCards]);

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
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        onExportCSV={() => handleExport('csv')}
        onExportExcel={() => handleExport('excel')}
        defaultRelationKind={defaultRelationKind}
        defaultDirection={defaultDirection}
        onChangeDefaultRelationKind={setDefaultRelationKind}
        onChangeDefaultDirection={setDefaultDirection}
        confirmMemoDeletion={confirmMemoDeletion}
        onChangeConfirmMemoDeletion={setConfirmMemoDeletion}
      />
      {isSaving ? <p className="trace-matrix-status">保存中…</p> : null}
      {isRefreshing ? <p className="trace-matrix-status">更新中…</p> : null}
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
                      <button type="button" onClick={() => handleColumnHeaderClick(card)} title={formatCardTooltip(card)}>
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
                      <button type="button" onClick={() => handleRowHeaderClick(leftCard)} title={formatCardTooltip(leftCard)}>
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
                            direction={relation?.directed}
                            memo={relation?.memo}
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
      {memoEditor ? (
        <TraceMemoDialog
          leftLabel={memoEditor.leftLabel}
          rightLabel={memoEditor.rightLabel}
          initialValue={memoEditor.initialMemo}
          onSave={handleMemoDialogSave}
          onClose={handleMemoDialogClose}
        />
      ) : null}
    </div>
  );
};

interface TraceMemoDialogProps {
  leftLabel: string;
  rightLabel: string;
  initialValue: string;
  onSave: (value: string) => void;
  onClose: () => void;
}

const TraceMemoDialog: React.FC<TraceMemoDialogProps> = ({ leftLabel, rightLabel, initialValue, onSave, onClose }) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave(value);
  };

  return (
    <div className="trace-memo-dialog" role="dialog" aria-modal="true" aria-label="トレースメモ編集">
      <div className="trace-memo-dialog__backdrop" onClick={onClose} />
      <form className="trace-memo-dialog__body" onSubmit={handleSubmit}>
        <header className="trace-memo-dialog__header">
          <div>
            <p className="trace-memo-dialog__label">左</p>
            <p className="trace-memo-dialog__value">{leftLabel}</p>
          </div>
          <span className="trace-memo-dialog__arrow">⇔</span>
          <div>
            <p className="trace-memo-dialog__label">右</p>
            <p className="trace-memo-dialog__value">{rightLabel}</p>
          </div>
          <button type="button" className="trace-memo-dialog__close" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </header>
        <div className="trace-memo-dialog__content">
          <label className="trace-memo-dialog__field">
            <span>メモ</span>
            <textarea value={value} onChange={(event) => setValue(event.target.value)} rows={5} placeholder="コネクタに関する補足を入力" />
          </label>
        </div>
        <footer className="trace-memo-dialog__footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className="btn-primary">
            保存
          </button>
        </footer>
      </form>
    </div>
  );
};

TraceMatrixDialog.displayName = 'TraceMatrixDialog';

const DIRECTION_OPTIONS: TraceabilityRelation['directed'][] = ['left_to_right', 'right_to_left', 'bidirectional'];

const describeDirected = (value: TraceabilityRelation['directed']): string => {
  switch (value) {
    case 'right_to_left':
      return '列 → 行';
    case 'bidirectional':
      return '双方向';
    default:
      return '行 → 列';
  }
};
