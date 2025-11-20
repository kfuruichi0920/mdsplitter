/**
 * @file ExportDialog.tsx
 * @brief カードエクスポート設定ダイアログ。
 */

import React, { useState } from 'react';
import type { ExportFormat, ExportOptions } from '@/shared/export';
import { CARD_KIND_VALUES, CARD_STATUS_SEQUENCE, type CardKind, type CardStatus } from '@/shared/workspace';

interface ExportDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onExport: (format: ExportFormat, options: ExportOptions) => void;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({ isOpen, onClose, onExport }) => {
	const [format, setFormat] = useState<ExportFormat>('csv');
	const [includeDeprecated, setIncludeDeprecated] = useState(false);
	const [selectedStatuses, setSelectedStatuses] = useState<Set<CardStatus>>(new Set());
	const [selectedKinds, setSelectedKinds] = useState<Set<CardKind>>(new Set());

	if (!isOpen) return null;

	const handleExport = () => {
		onExport(format, {
			includeDeprecated,
			statuses: Array.from(selectedStatuses),
			kinds: Array.from(selectedKinds),
		});
		onClose();
	};

	const toggleStatus = (status: CardStatus) => {
		const next = new Set(selectedStatuses);
		if (next.has(status)) {
			next.delete(status);
		} else {
			next.add(status);
		}
		setSelectedStatuses(next);
	};

	const toggleKind = (kind: CardKind) => {
		const next = new Set(selectedKinds);
		if (next.has(kind)) {
			next.delete(kind);
		} else {
			next.add(kind);
		}
		setSelectedKinds(next);
	};

	return (
		<div className="conversion-modal__backdrop" role="presentation">
			<div className="conversion-modal" role="dialog" aria-modal="true">
				<header className="conversion-modal__header">
					<h2>カード出力</h2>
					<button type="button" className="conversion-modal__close" onClick={onClose}>×</button>
				</header>

				<div className="conversion-modal__body">
					<section className="conversion-modal__section">
						<h3>1. 出力形式</h3>
						<div className="conversion-modal__radio-group">
							<label className="conversion-modal__radio-inline">
								<input type="radio" checked={format === 'csv'} onChange={() => setFormat('csv')} /> CSV
							</label>
							<label className="conversion-modal__radio-inline">
								<input type="radio" checked={format === 'impact-csv'} onChange={() => setFormat('impact-csv')} /> 影響分析 (CSV)
							</label>
							<label className="conversion-modal__radio-inline">
								<input type="radio" checked={format === 'json-ld'} onChange={() => setFormat('json-ld')} /> JSON-LD
							</label>
							<label className="conversion-modal__radio-inline">
								<input type="radio" checked={format === 'rdf'} onChange={() => setFormat('rdf')} /> RDF (Turtle)
							</label>
							<label className="conversion-modal__radio-inline">
								<input type="radio" checked={format === 'markdown'} onChange={() => setFormat('markdown')} /> Markdown
							</label>
						</div>
					</section>

					<section className="conversion-modal__section">
						<h3>2. フィルタオプション</h3>
						<div className="conversion-modal__field">
							<label className="conversion-modal__checkbox">
								<input
									type="checkbox"
									checked={includeDeprecated}
									onChange={(e) => setIncludeDeprecated(e.target.checked)}
								/>
								廃止カードを含める
							</label>
						</div>

						<div className="conversion-modal__field">
							<label>ステータス (選択なしですべて)</label>
							<div className="conversion-modal__checkbox-group">
								{CARD_STATUS_SEQUENCE.map((status) => (
									<label key={status} className="conversion-modal__checkbox-inline">
										<input
											type="checkbox"
											checked={selectedStatuses.has(status)}
											onChange={() => toggleStatus(status)}
										/>
										{status}
									</label>
								))}
							</div>
						</div>

						<div className="conversion-modal__field">
							<label>種別 (選択なしですべて)</label>
							<div className="conversion-modal__checkbox-group">
								{CARD_KIND_VALUES.map((kind) => (
									<label key={kind} className="conversion-modal__checkbox-inline">
										<input
											type="checkbox"
											checked={selectedKinds.has(kind)}
											onChange={() => toggleKind(kind)}
										/>
										{kind}
									</label>
								))}
							</div>
						</div>
					</section>
				</div>

				<footer className="conversion-modal__footer">
					<button type="button" className="btn-secondary" onClick={onClose}>キャンセル</button>
					<button type="button" className="btn-primary" onClick={handleExport}>出力</button>
				</footer>
			</div>
		</div>
	);
};
