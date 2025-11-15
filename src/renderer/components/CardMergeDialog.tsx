import React, { useEffect, useMemo, useState } from 'react';
import type { Card, CardKind, CardStatus } from '../store/workspaceStore';
import { CARD_KIND_VALUES, CARD_STATUS_SEQUENCE } from '@/shared/workspace';
import { CARD_KIND_ICON, CARD_KIND_LABEL, CARD_STATUS_LABEL } from '../constants/cardPresentation';

export interface CardMergeDialogPayload {
  title: string;
  body: string;
  status: CardStatus;
  kind: CardKind;
  cardId?: string;
  removeOriginals: boolean;
  inheritTraces: boolean;
}

interface CardMergeDialogProps {
  cards: Card[];
  isOpen: boolean;
  onCancel: () => void;
  onSubmit: (payload: CardMergeDialogPayload) => Promise<void> | void;
}

export const CardMergeDialog: React.FC<CardMergeDialogProps> = ({ cards, isOpen, onCancel, onSubmit }) => {
  const summaryItems = useMemo(() => cards.map((card) => ({
    id: card.id,
    cardId: card.cardId,
    title: card.title,
  })), [cards]);

  const defaultBody = useMemo(() => {
    return cards
      .map((card) => {
        const segments: string[] = [];
        if (card.title) {
          segments.push(card.title.trim());
        }
        if (card.body) {
          segments.push(card.body.trim());
        }
        return segments.filter(Boolean).join('\n');
      })
      .filter(Boolean)
      .join('\n\n');
  }, [cards]);

  const [cardId, setCardId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<CardKind>('paragraph');
  const [status, setStatus] = useState<CardStatus>('draft');
  const [removeOriginals, setRemoveOriginals] = useState(true);
  const [inheritTraces, setInheritTraces] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setCardId(cards[0]?.cardId ?? '');
    setTitle(cards[0]?.title ?? '');
    setBody(defaultBody);
    setKind(cards[0]?.kind ?? 'paragraph');
    setStatus(cards[0]?.status ?? 'draft');
    setRemoveOriginals(true);
    setInheritTraces(true);
  }, [cards, defaultBody, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onCancel]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        body,
        status,
        kind,
        cardId: cardId.trim() ? cardId.trim() : undefined,
        removeOriginals,
        inheritTraces,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="card-merge-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-merge-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="card-merge-dialog__header">
          <div>
            <p className="card-merge-dialog__eyebrow">カード統合</p>
            <h2 id="card-merge-dialog-title" className="card-merge-dialog__title">
              選択カードの統合
            </h2>
          </div>
          <button type="button" className="card-merge-dialog__close" onClick={onCancel} aria-label="閉じる">
            ✕
          </button>
        </header>

        <div className="card-merge-dialog__body">
          <section className="card-merge-dialog__section" aria-label="統合対象">
            <h3>統合対象カード ({summaryItems.length}件)</h3>
            <ul className="card-merge-dialog__list">
              {summaryItems.map((item) => (
                <li key={item.id}>
                  <span className="card-merge-dialog__badge">{item.cardId ?? item.id}</span>
                  <span>{item.title || '（無題）'}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card-merge-dialog__section" aria-label="統合後カード">
            <h3>統合後のカード情報</h3>
            <label className="card-merge-dialog__field">
              <span>カードID</span>
              <input
                type="text"
                value={cardId}
                onChange={(event) => setCardId(event.target.value)}
                placeholder="例: SPEC-010"
              />
            </label>
            <label className="card-merge-dialog__field">
              <span>タイトル</span>
              <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="統合後のタイトル" />
            </label>
            <label className="card-merge-dialog__field">
              <span>種別</span>
              <select value={kind} onChange={(event) => setKind(event.target.value as CardKind)}>
                {CARD_KIND_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {CARD_KIND_LABEL[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="card-merge-dialog__field">
              <span>ステータス</span>
              <select value={status} onChange={(event) => setStatus(event.target.value as CardStatus)}>
                {CARD_STATUS_SEQUENCE.map((value) => (
                  <option key={value} value={value}>
                    {CARD_STATUS_LABEL[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="card-merge-dialog__field">
              <span>本文</span>
              <textarea
                className="card-merge-dialog__textarea"
                rows={8}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </label>
          </section>

          <section className="card-merge-dialog__section" aria-label="オプション">
            <label className="card-merge-dialog__checkbox">
              <input type="checkbox" checked={removeOriginals} onChange={(event) => setRemoveOriginals(event.target.checked)} />
              元のカードを削除
            </label>
            <label className="card-merge-dialog__checkbox">
              <input type="checkbox" checked={inheritTraces} onChange={(event) => setInheritTraces(event.target.checked)} />
              トレース情報を引き継ぐ
            </label>
            <p className="card-merge-dialog__hint">同一階層かつ連続したカードのみ統合できます。子カードを持つ項目は対象外です。</p>
          </section>
        </div>

        <footer className="card-merge-dialog__footer">
          <button type="button" className="modal-button modal-button--secondary" onClick={onCancel} disabled={submitting}>
            キャンセル
          </button>
          <button
            type="button"
            className="modal-button modal-button--primary"
            onClick={handleSubmit}
            disabled={!title.trim() || submitting}
          >
            {submitting ? '統合中…' : '統合'}
          </button>
        </footer>
      </div>
    </div>
  );
};

CardMergeDialog.displayName = 'CardMergeDialog';
