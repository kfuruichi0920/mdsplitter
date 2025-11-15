import React from 'react';

interface CardDiffViewerProps {
  beforeTitle?: string;
  afterTitle?: string;
  beforeBody?: string;
  afterBody?: string;
}

export const CardDiffViewer: React.FC<CardDiffViewerProps> = ({ beforeTitle, afterTitle, beforeBody, afterBody }) => {
  return (
    <div className="card-diff-viewer">
      <div className="card-diff-viewer__column">
        <h4>Before</h4>
        <p className="card-diff-viewer__title">{beforeTitle ?? '—'}</p>
        <pre className="card-diff-viewer__body">{beforeBody ?? ''}</pre>
      </div>
      <div className="card-diff-viewer__column">
        <h4>After</h4>
        <p className="card-diff-viewer__title">{afterTitle ?? '—'}</p>
        <pre className="card-diff-viewer__body">{afterBody ?? ''}</pre>
      </div>
    </div>
  );
};

CardDiffViewer.displayName = 'CardDiffViewer';
