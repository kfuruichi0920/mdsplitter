import React, { useEffect } from 'react';
import type { Card } from '../store/workspaceStore';
import { CARD_KIND_ICON, CARD_KIND_LABEL, CARD_STATUS_LABEL } from '../constants/cardPresentation';
import { calculateCardContentStatistics } from '../utils/cardUtils';

interface CardStatsDialogProps {
  card: Card;
  leftTraceCount: number;
  rightTraceCount: number;
  onClose: () => void;
}

const formatDateTime = (value?: string | null): string => {
  if (!value) {
    return '---';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '---';
  }
  return date.toLocaleString();
};

export const CardStatsDialog: React.FC<CardStatsDialogProps> = ({ card, leftTraceCount, rightTraceCount, onClose }) => {
  const stats = calculateCardContentStatistics(card);
  const totalTraces = leftTraceCount + rightTraceCount;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="modal-overlay card-stats-dialog__overlay" role="presentation" onClick={onClose}>
      <div
        className="card-stats-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-stats-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="card-stats-dialog__header">
          <div>
            <p className="card-stats-dialog__eyebrow">カード統計情報</p>
            <h2 id="card-stats-dialog-title" className="card-stats-dialog__title">
              {card.cardId ? `${card.cardId} / ${card.title}` : card.title}
            </h2>
          </div>
          <button type="button" className="card-stats-dialog__close" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </header>

        <section className="card-stats-dialog__section">
          <h3>基本情報</h3>
          <dl>
            <dt>カードID</dt>
            <dd>{card.cardId ?? '未設定'}</dd>
            <dt>UUID</dt>
            <dd className="card-stats-dialog__mono">{card.id}</dd>
            <dt>種別</dt>
            <dd>
              <span className="card-stats-dialog__icon" aria-hidden>
                {CARD_KIND_ICON[card.kind]}
              </span>
              {CARD_KIND_LABEL[card.kind]}
            </dd>
            <dt>ステータス</dt>
            <dd>{CARD_STATUS_LABEL[card.status]}</dd>
            <dt>作成日時</dt>
            <dd>{formatDateTime(card.createdAt)}</dd>
            <dt>最終更新</dt>
            <dd>{formatDateTime(card.updatedAt)}</dd>
          </dl>
        </section>

        <section className="card-stats-dialog__section">
          <h3>トレース・階層</h3>
          <dl>
            <dt>トレース総数</dt>
            <dd>{totalTraces}件</dd>
            <dt>左トレース</dt>
            <dd>{leftTraceCount}件</dd>
            <dt>右トレース</dt>
            <dd>{rightTraceCount}件</dd>
            <dt>階層レベル</dt>
            <dd>{card.level}</dd>
            <dt>子カード数</dt>
            <dd>{card.child_ids.length}件</dd>
          </dl>
        </section>

        <section className="card-stats-dialog__section">
          <h3>内容統計</h3>
          <dl>
            <dt>文字数</dt>
            <dd>{stats.charCount}文字</dd>
            <dt>単語数</dt>
            <dd>{stats.wordCount}語</dd>
            <dt>行数</dt>
            <dd>{stats.lineCount}行</dd>
          </dl>
        </section>

        <footer className="card-stats-dialog__footer">
          <button type="button" className="card-stats-dialog__close-button" onClick={onClose}>
            閉じる
          </button>
        </footer>
      </div>
    </div>
  );
};

CardStatsDialog.displayName = 'CardStatsDialog';
