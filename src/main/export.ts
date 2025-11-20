/**
 * @file export.ts
 * @brief エクスポート処理の実装（メインプロセス）。
 */

import * as fs from 'fs';
import * as path from 'path';
import { dialog } from 'electron';
import type { Card } from '../shared/workspace';
import type { ExportFormat, ExportOptions } from '../shared/export';

/**
 * @brief カードをフィルタリングする。
 */
const filterCards = (cards: Card[], options: ExportOptions): Card[] => {
	return cards.filter((card) => {
		// 廃止カードの除外
		if (!options.includeDeprecated && card.status === 'deprecated') {
			return false;
		}
		// ステータスフィルタ
		if (options.statuses.length > 0 && !options.statuses.includes(card.status)) {
			return false;
		}
		// 種別フィルタ
		if (options.kinds.length > 0 && !options.kinds.includes(card.kind)) {
			return false;
		}
		return true;
	});
};

/**
 * @brief CSV形式のエスケープ処理。
 */
const escapeCsv = (field: string | number | boolean | undefined | null): string => {
	if (field === undefined || field === null) {
		return '';
	}
	const stringField = String(field);
	if (stringField.includes('"') || stringField.includes(',') || stringField.includes('\n')) {
		return `"${stringField.replace(/"/g, '""')}"`;
	}
	return stringField;
};

/**
 * @brief CSVエクスポート。
 */
const exportToCsv = (cards: Card[], filePath: string): void => {
	const header = ['ID', 'CardID', 'Title', 'Body', 'Status', 'Kind', 'ParentID', 'Level', 'HasLeftTrace', 'HasRightTrace', 'UpdatedAt'];
	const rows = cards.map((card) => [
		card.id,
		card.cardId,
		card.title,
		card.body,
		card.status,
		card.kind,
		card.parent_id,
		card.level,
		card.hasLeftTrace,
		card.hasRightTrace,
		card.updatedAt,
	].map(escapeCsv).join(','));

	const content = [header.join(','), ...rows].join('\n');
	fs.writeFileSync(filePath, content, 'utf-8');
};

/**
 * @brief 影響分析CSVエクスポート（簡易版）。
 * @details
 * 通常のCSVに加え、子カードIDリストなどを含める。
 * 要件定義では「影響範囲分析（CSV）」とあるが、詳細なトレース情報はTraceMatrix側で扱うため、
 * ここではカード自身が持つリンク情報（親子、兄弟）を出力する。
 */
const exportToImpactCsv = (cards: Card[], filePath: string): void => {
	const header = ['ID', 'CardID', 'Title', 'Status', 'ParentID', 'ChildIDs', 'PrevID', 'NextID', 'HasLeftTrace', 'HasRightTrace'];
	const rows = cards.map((card) => [
		card.id,
		card.cardId,
		card.title,
		card.status,
		card.parent_id,
		card.child_ids.join(';'),
		card.prev_id,
		card.next_id,
		card.hasLeftTrace,
		card.hasRightTrace,
	].map(escapeCsv).join(','));

	const content = [header.join(','), ...rows].join('\n');
	fs.writeFileSync(filePath, content, 'utf-8');
};

/**
 * @brief JSON-LDエクスポート。
 */
const exportToJsonLd = (cards: Card[], filePath: string): void => {
	const jsonLd = {
		'@context': 'https://schema.org',
		'@graph': cards.map((card) => ({
			'@type': 'SoftwareSourceCode', // 適切な型を選択
			'@id': card.id,
			'identifier': card.cardId,
			'name': card.title,
			'text': card.body,
			'status': card.status,
			'genre': card.kind,
			'dateModified': card.updatedAt,
			'isPartOf': card.parent_id ? { '@id': card.parent_id } : undefined,
		})),
	};
	fs.writeFileSync(filePath, JSON.stringify(jsonLd, null, 2), 'utf-8');
};

/**
 * @brief RDFエクスポート（Turtle形式）。
 * @details
 * 簡易的なTurtle形式での出力。
 */
const exportToRdf = (cards: Card[], filePath: string): void => {
	const prefixes = [
		'@prefix schema: <https://schema.org/> .',
		'@prefix ex: <http://example.org/cards/> .',
		'@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .',
	].join('\n');

	const triples = cards.map((card) => {
		const subject = `ex:${card.id}`;
		const lines = [
			`${subject} a schema:SoftwareSourceCode ;`,
			`  schema:identifier "${escapeRdf(card.cardId)}" ;`,
			`  schema:name "${escapeRdf(card.title)}" ;`,
			`  schema:text """${escapeRdfMultiline(card.body)}""" ;`,
			`  schema:creativeWorkStatus "${card.status}" ;`,
			`  schema:genre "${card.kind}" ;`,
			`  schema:dateModified "${card.updatedAt}"^^xsd:dateTime .`,
		];
		return lines.join('\n');
	}).join('\n\n');

	const content = `${prefixes}\n\n${triples}`;
	fs.writeFileSync(filePath, content, 'utf-8');
};

const escapeRdf = (str: string | undefined): string => {
	if (!str) return '';
	return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
};

const escapeRdfMultiline = (str: string | undefined): string => {
	if (!str) return '';
	return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
};

/**
 * @brief Markdownエクスポート。
 * @details
 * カードをMarkdownテキストに復元する。
 * 階層構造（レベル）に応じてヘッダーを付与するなどの処理が必要だが、
 * ここでは単純にタイトルと本文を並べる実装とする。
 * 本来は `markdown.ts` 等のロジックを共有すべきだが、メインプロセス側なので簡易実装する。
 */
const exportToMarkdown = (cards: Card[], filePath: string): void => {
	const content = cards.map((card) => {
		const headingPrefix = '#'.repeat(Math.max(1, card.level + 1)); // level 0 -> #
		let section = '';

		if (card.kind === 'heading') {
			section += `${headingPrefix} ${card.title}\n\n`;
		} else {
			// 見出し以外のカードでもタイトルがあれば表示するか？
			// 通常のMarkdown分割の逆変換と考えると、見出しカード以外は本文のみが自然かもしれないが、
			// カードのタイトル情報を失わないためにコメント等で入れるか、あるいは太字にするか。
			// ここではシンプルに本文のみ、ただしタイトルが本文に含まれていない場合はタイトルも出す等の判断が難しい。
			// 要件は「Markdown形式」なので、単純に結合する。
			if (card.title && card.title !== 'Paragraph' && !card.body.startsWith(card.title)) {
				// タイトルが意味のあるものなら出力
				section += `**${card.title}**\n\n`;
			}
		}

		section += `${card.body}\n\n`;
		return section;
	}).join('---\n\n'); // カード区切りを入れるか、単に結合するか。Markdownとして有効なのは単なる結合。

	// 区切り線なしで結合する
	const simpleContent = cards.map((card) => {
		if (card.kind === 'heading') {
			const level = Math.max(1, card.level + 1);
			return `${'#'.repeat(level)} ${card.title}\n\n${card.body}`;
		}
		return card.body;
	}).join('\n\n');

	fs.writeFileSync(filePath, simpleContent, 'utf-8');
};

/**
 * @brief エクスポート実行。
 */
export const exportCards = async (
	format: ExportFormat,
	options: ExportOptions,
	cards: Card[],
	defaultPath?: string
): Promise<boolean> => {
	const filteredCards = filterCards(cards, options);

	const { filePath } = await dialog.showSaveDialog({
		defaultPath: defaultPath || `export.${format === 'markdown' ? 'md' : format === 'json-ld' ? 'json' : format === 'rdf' ? 'ttl' : 'csv'}`,
		filters: [
			{ name: 'CSV', extensions: ['csv'] },
			{ name: 'Markdown', extensions: ['md'] },
			{ name: 'JSON-LD', extensions: ['json'] },
			{ name: 'RDF (Turtle)', extensions: ['ttl'] },
			{ name: 'All Files', extensions: ['*'] },
		],
	});

	if (!filePath) {
		return false;
	}

	try {
		switch (format) {
			case 'csv':
				exportToCsv(filteredCards, filePath);
				break;
			case 'impact-csv':
				exportToImpactCsv(filteredCards, filePath);
				break;
			case 'json-ld':
				exportToJsonLd(filteredCards, filePath);
				break;
			case 'rdf':
				exportToRdf(filteredCards, filePath);
				break;
			case 'markdown':
				exportToMarkdown(filteredCards, filePath);
				break;
		}
		return true;
	} catch (error) {
		console.error('Export failed:', error);
		throw error;
	}
};
