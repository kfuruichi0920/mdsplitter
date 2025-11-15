import React, { useEffect, useMemo, useState } from 'react';
import type { Card } from '../store/workspaceStore';
import { useHistoryStore } from '../store/historyStore';
import { CardDiffViewer } from './CardDiffViewer';
import { useWorkspaceStore } from '../store/workspaceStore';
import type { CardHistory, CardVersion } from '@/shared/history';

interface CardHistoryDialogProps {
  card: Card;
  fileName: string | null;
  leafId: string;
  tabId: string;
  cardIdentifier: string;
  isOpen: boolean;
  onClose: () => void;
}

export const CardHistoryDialog: React.FC<CardHistoryDialogProps> = ({ card, fileName, leafId, tabId, cardIdentifier, isOpen, onClose }) => {
  const loadHistory = useHistoryStore((state) => state.loadHistory);
  const histories = useHistoryStore((state) => state.histories);
  const status = useHistoryStore((state) => state.status);
  const updateCard = useWorkspaceStore((state) => state.updateCard);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const key = fileName ? `${fileName}::${cardIdentifier}` : null;
  const history: CardHistory | undefined = key ? histories[key] : undefined;
  const currentStatus = key ? status[key] : 'idle';
  const orderedVersions = useMemo(() => {
    if (!history) {
      return [] as CardVersion[];
    }
    return [...history.versions].sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));
  }, [history]);

  useEffect(() => {
    if (!isOpen || !fileName) {
      return;
    }
    void loadHistory(fileName, cardIdentifier);
  }, [cardIdentifier, fileName, isOpen, loadHistory]);

  useEffect(() => {
    if (orderedVersions.length === 0) {
      setSelectedVersionId(null);
      return;
    }
    if (!selectedVersionId) {
      setSelectedVersionId(orderedVersions[0].versionId);
    }
  }, [orderedVersions, selectedVersionId]);

  if (!isOpen) {
    return null;
  }

  const handleRestore = async () => {
    if (!fileName || !selectedVersionId) {
      return;
    }
    const target = orderedVersions.find((version) => version.versionId === selectedVersionId);
    if (!target) {
      return;
    }
    const snapshot = target.card;
    updateCard(leafId, tabId, card.id, {
      title: snapshot.title,
      body: snapshot.body,
      status: snapshot.status,
      kind: snapshot.kind,
      cardId: snapshot.cardId,
    }, {
      historyOperation: 'restore',
      historyContext: {
        restoredFromVersionId: target.versionId,
        restoredFromTimestamp: target.timestamp,
      },
    });
  };

  const selectedVersion: CardVersion | undefined = orderedVersions.find((version) => version.versionId === selectedVersionId);
  const diff = selectedVersion?.diff;

  const renderOperationLabel = (version: CardVersion): string => {
    const label = typeof version.operation === 'string' ? version.operation.toUpperCase() : 'UNKNOWN';
    if (version.operation === 'restore' && version.restoredFromTimestamp) {
      return `${label} (from ${new Date(version.restoredFromTimestamp).toLocaleString()})`;
    }
    return label;
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="card-history-dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <header className="card-history-dialog__header">
          <div>
            <p className="card-history-dialog__eyebrow">カード履歴</p>
            <h2 className="card-history-dialog__title">{card.cardId ?? card.title ?? 'カード'}</h2>
          </div>
          <button type="button" className="card-history-dialog__close" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </header>
        <div className="card-history-dialog__content">
          <aside className="card-history-dialog__sidebar">
            <h3>バージョン履歴</h3>
            {currentStatus === 'loading' ? (
              <p className="card-history-dialog__hint">読み込み中...</p>
            ) : orderedVersions.length > 0 ? (
              <ul className="card-history-dialog__list">
                {orderedVersions.map((version) => (
                  <li key={version.versionId}>
                    <button
                      type="button"
                      className={`card-history-dialog__list-button${selectedVersionId === version.versionId ? ' card-history-dialog__list-button--active' : ''}`}
                      onClick={() => setSelectedVersionId(version.versionId)}
                    >
                      <span className="card-history-dialog__list-title">{renderOperationLabel(version)}</span>
                      <span className="card-history-dialog__list-meta">{new Date(version.timestamp).toLocaleString()}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="card-history-dialog__hint">履歴はまだありません。</p>
            )}
          </aside>
          <section className="card-history-dialog__details">
            {selectedVersion ? (
              <>
                <div className="card-history-dialog__version-meta">
                  <p>
                    操作: <strong>{renderOperationLabel(selectedVersion)}</strong>
                  </p>
                  <p>日時: {new Date(selectedVersion.timestamp).toLocaleString()}</p>
                  {selectedVersion.operation === 'restore' && selectedVersion.restoredFromTimestamp ? (
                    <p>復元元: {new Date(selectedVersion.restoredFromTimestamp).toLocaleString()}</p>
                  ) : null}
                </div>
                <CardDiffViewer
                  beforeTitle={diff?.before?.title ?? selectedVersion.card.title}
                  afterTitle={selectedVersion.card.title}
                  beforeBody={diff?.before?.body ?? selectedVersion.card.body}
                  afterBody={selectedVersion.card.body}
                />
              </>
            ) : (
              <p className="card-history-dialog__hint">バージョンを選択してください。</p>
            )}
          </section>
        </div>
        <footer className="card-history-dialog__footer">
          <button type="button" className="modal-button modal-button--secondary" onClick={onClose}>
            閉じる
          </button>
          <button
            type="button"
            className="modal-button modal-button--primary"
            onClick={handleRestore}
            disabled={!selectedVersion || !history || selectedVersion.operation === 'delete'}
          >
            復元
          </button>
        </footer>
      </div>
    </div>
  );
};

CardHistoryDialog.displayName = 'CardHistoryDialog';
