/**
 * @file CardPanel.tsx
 * @brief カードパネルコンポーネント。
 * @details
 * タブバー、パネルツールバー、カード一覧を含むカードパネルの UI を提供する。
 * 各分割ノード（葉ノード）に表示される。
 * @author K.Furuichi
 * @date 2025-11-03
 * @version 0.1
 * @copyright MIT
 */

import React, { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ChangeEvent } from 'react';
import { shallow } from 'zustand/shallow';
import type { Card, CardKind, CardPatch, CardStatus, PanelTabState, InsertPosition } from '../store/workspaceStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useUiStore } from '../store/uiStore';
import { useCardConnectorAnchor } from '../hooks/useConnectorLayout';
import { useTraceStore, aggregateCountsForFile, type TraceSeed } from '../store/traceStore';
import { useTracePreferenceStore, makeCardKey, type TraceConnectorSide } from '../store/tracePreferenceStore';
import { usePanelEngagementStore, type PanelVisualState } from '../store/panelEngagementStore';
import { useSplitStore } from '../store/splitStore';
import { renderMarkdownToHtml } from '../utils/markdown';
import { CARD_KIND_VALUES, parseCardId } from '@/shared/workspace';
import { CARD_KIND_ICON, CARD_STATUS_CLASS, CARD_STATUS_LABEL } from '../constants/cardPresentation';
import { useVirtualizedCards } from '../hooks/useVirtualizedCards';
import { countUntracedCards } from '../utils/cardUtils';
import { ContextMenu, type ContextMenuSection } from './ContextMenu';
import { CardStatsDialog } from './CardStatsDialog';
import { CardMergeDialog, type CardMergeDialogPayload } from './CardMergeDialog';
import { CardHistoryDialog } from './CardHistoryDialog';
import { MatrixLaunchDialog } from './MatrixLaunchDialog';
import { ExportDialog } from './ExportDialog';
import type { TraceabilityRelation } from '@/shared/traceability';

const createKindFilterState = (): Record<CardKind, boolean> => {
	return CARD_KIND_VALUES.reduce<Record<CardKind, boolean>>((acc, kind) => {
		acc[kind] = true;
		return acc;
	}, {} as Record<CardKind, boolean>);
};

/**
 * @brief トレース接合点の記号を返す。
 * @param hasTrace トレース有無。
 * @return 表示記号。
 */
const connectorSymbol = (hasTrace: boolean): string => (hasTrace ? '●' : '○');

interface MergeValidation {
	canMerge: boolean;
	reason?: string;
	cards: Card[];
}

const replaceIdsInArray = (ids: string[], sourceSet: Set<string>, targetId: string): { updated: boolean; values: string[] } => {
	let updated = false;
	const values: string[] = [];
	const seen = new Set<string>();
	ids.forEach((id) => {
		const nextId = sourceSet.has(id) ? targetId : id;
		if (sourceSet.has(id)) {
			updated = true;
		}
		if (!seen.has(nextId)) {
			seen.add(nextId);
			values.push(nextId);
		}
	});
	return { updated, values };
};

/**
 * @brief ISO8601日時文字列をローカライズして表示する。
 * @param value ISO8601文字列。
 * @return ローカライズした日時文字列。
 */
const formatUpdatedAt = (value: string): string => {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return '---';
	}
	return date.toLocaleString();
};

/**
 * @brief カードパネルコンポーネントのプロパティ。
 */
export interface CardPanelProps {
	leafId: string; ///< 葉ノードID。
	isActive?: boolean; ///< アクティブ葉ノードかどうか。
	onLog?: (level: 'INFO' | 'WARN' | 'ERROR', message: string) => void; ///< ログ出力コールバック。
	onPanelClick?: (leafId: string) => void; ///< パネルクリック時のコールバック。
	onPanelClose?: (leafId: string) => void; ///< パネルクローズ時のコールバック。
}

/**
 * @brief カードパネルコンポーネント。
 * @details
 * タブバー、ツールバー、カード一覧を含むカードパネルを描画する。
 */
export const CardPanel = ({ leafId, isActive = false, onLog, onPanelClick, onPanelClose }: CardPanelProps) => {
	const panelScrollRef = useRef<HTMLDivElement | null>(null);
	const [draggedCardIds, setDraggedCardIds] = useState<string[]>([]);
	const [dropTarget, setDropTarget] = useState<{ cardId: string; position: 'before' | 'after' | 'child' } | null>(null);
	const [contextMenu, setContextMenu] = useState<{ card: Card; x: number; y: number } | null>(null);
	const [statsTargetCardId, setStatsTargetCardId] = useState<string | null>(null);
	const [toolbarInsertMode, setToolbarInsertMode] = useState<InsertPosition>('after');
	const [isMergeDialogOpen, setMergeDialogOpen] = useState(false);
	const [mergeDialogCards, setMergeDialogCards] = useState<Card[]>([]);
	const [historyDialogCardId, setHistoryDialogCardId] = useState<string | null>(null);
	const [previewIndicator, setPreviewIndicator] = useState<{ cardId: string | null; position: InsertPosition; highlightIds: string[] } | null>(null);
	const [filterText, setFilterText] = useState('');
	const [kindFilter, setKindFilter] = useState<Record<CardKind, boolean>>(() => createKindFilterState());
	const [isKindFilterOpen, setKindFilterOpen] = useState(false);
	const kindFilterButtonRef = useRef<HTMLButtonElement | null>(null);
	const kindFilterPopoverRef = useRef<HTMLDivElement | null>(null);
	const [isBulkPrefixEditOpen, setIsBulkPrefixEditOpen] = useState(false);
	const [bulkPrefixOldValue, setBulkPrefixOldValue] = useState('');
	const [bulkPrefixNewValue, setBulkPrefixNewValue] = useState('');
	const [untracedFilter, setUntracedFilter] = useState<'none' | 'left' | 'right' | 'both'>('none');
	const [isExportDialogOpen, setExportDialogOpen] = useState(false);
	const handleFilterTextChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setFilterText(event.target.value);
	}, []);
	const toggleKindFilterValue = useCallback((kind: CardKind) => {
		setKindFilter((prev) => ({ ...prev, [kind]: !prev[kind] }));
	}, []);
	const applyKindFilterAll = useCallback((value: boolean) => {
		setKindFilter(() => {
			const next: Record<CardKind, boolean> = {} as Record<CardKind, boolean>;
			CARD_KIND_VALUES.forEach((kind) => {
				next[kind] = value;
			});
			return next;
		});
	}, []);

	/**
	 * @brief 未トレースフィルタを切り替える。
	 * @param side フィルタ対象のトレース方向。
	 */
	const toggleUntracedFilter = useCallback((side: 'left' | 'right') => {
		setUntracedFilter((prev) => {
			if (prev === 'none') {
				return side;
			}
			if (prev === side) {
				return 'none';
			}
			if (prev === 'both') {
				return side === 'left' ? 'right' : 'left';
			}
			return 'both';
		});
	}, []);

	const leafTabs = useWorkspaceStore(
		useCallback((state) => {
			const leaf = state.leafs[leafId];
			if (!leaf) {
				return [] as PanelTabState[];
			}
			return leaf.tabIds
				.map((tabId) => state.tabs[tabId])
				.filter((tab): tab is PanelTabState => Boolean(tab));
		}, [leafId]),
	);
	const activeTabId = useWorkspaceStore(
		useCallback((state) => state.leafs[leafId]?.activeTabId ?? null, [leafId]),
	);
	const selectCard = useWorkspaceStore((state) => state.selectCard);
	const clearSelection = useWorkspaceStore((state) => state.clearSelection);
	const setActiveTab = useWorkspaceStore((state) => state.setActiveTab);
	const closeTab = useWorkspaceStore((state) => state.closeTab);
	const createUntitledTab = useWorkspaceStore((state) => state.createUntitledTab);
	const moveCards = useWorkspaceStore((state) => state.moveCards);
	const addCard = useWorkspaceStore((state) => state.addCard);
	const deleteCards = useWorkspaceStore((state) => state.deleteCards);
	const copySelection = useWorkspaceStore((state) => state.copySelection);
	const pasteClipboard = useWorkspaceStore((state) => state.pasteClipboard);
	const mergeCardsAction = useWorkspaceStore((state) => state.mergeCards);
	const clipboardData = useWorkspaceStore((state) => state.clipboard);
	const lastInsertPreview = useWorkspaceStore(
		useCallback((state) => state.lastInsertPreview, []),
	);
	const setEditingCard = useWorkspaceStore((state) => state.setEditingCard);
	const updateCard = useWorkspaceStore((state) => state.updateCard);
	const toggleTabDisplayMode = useWorkspaceStore((state) => state.toggleTabDisplayMode);
	const markdownPreviewGlobalEnabled = useUiStore((state) => state.markdownPreviewGlobalEnabled);
	const hasClipboardItems = Boolean(clipboardData && clipboardData.length > 0);
	const panelFocusState = usePanelEngagementStore((state) => state.states[leafId] ?? (isActive ? 'active' : 'inactive'));
	const panelSelectionTransition = usePanelEngagementStore((state) => state.handleSelectionTransition);
	const toggleCardMarkdownPreview = useWorkspaceStore((state) => state.toggleCardMarkdownPreview);
	const tabsSnapshot = useWorkspaceStore((state) => state.tabs);

	const activeTab = useMemo<PanelTabState | null>(() => {
		if (!activeTabId) {
			return null;
		}
		return leafTabs.find((tab) => tab.id === activeTabId) ?? null;
	}, [activeTabId, leafTabs]);

	const cardDisplayMode = activeTab?.displayMode ?? 'detailed';
	const activeFileIdentifier = activeTab ? activeTab.fileName ?? `unsaved-${activeTab.id}` : '';
	const activeFileName = activeTab?.fileName ?? null;
	const openFileNames = useMemo(() => {
		const names = new Set<string>();
		Object.values(tabsSnapshot).forEach((tab) => {
			if (tab?.fileName) {
				names.add(tab.fileName);
			}
		});
		return names;
	}, [tabsSnapshot]);

	const traceCounts = useTraceStore(
		useCallback(
			(state) =>
				activeFileName
					? aggregateCountsForFile(state.cache, activeFileName, { restrictToFiles: openFileNames })
					: { left: {}, right: {} },
			[activeFileName, openFileNames],
		),
		shallow,
	);
	const leftTraceCounts = traceCounts.left ?? {};
	const rightTraceCounts = traceCounts.right ?? {};
	const totalTraceCounts = useMemo(() => {
		const totals: Record<string, number> = {};
		Object.entries(leftTraceCounts).forEach(([id, count]) => {
			totals[id] = (totals[id] ?? 0) + count;
		});
		Object.entries(rightTraceCounts).forEach(([id, count]) => {
			totals[id] = (totals[id] ?? 0) + count;
		});
		return totals;
	}, [leftTraceCounts, rightTraceCounts]);

	useEffect(() => {
		if (!lastInsertPreview || !activeTabId) {
			return;
		}
		if (lastInsertPreview.leafId !== leafId || lastInsertPreview.tabId !== activeTabId) {
			return;
		}
		setPreviewIndicator({
			cardId: lastInsertPreview.cardId,
			position: lastInsertPreview.position,
			highlightIds: lastInsertPreview.highlightIds,
		});
		const timer = window.setTimeout(() => {
			setPreviewIndicator(null);
		}, 1200);
		return () => window.clearTimeout(timer);
	}, [lastInsertPreview, leafId, activeTabId]);

	const cards = activeTab?.cards ?? [];
	const dirtyCardIds = activeTab?.dirtyCardIds ?? new Set<string>();
	const selectedCardIds = activeTab?.selectedCardIds ?? new Set<string>();
	const selectedCardsList = useMemo(() => cards.filter((card) => selectedCardIds.has(card.id)), [cards, selectedCardIds]);
	const expandedCardIds = activeTab?.expandedCardIds ?? new Set<string>();
	const editingCardId = activeTab?.editingCardId ?? null;
	const cardCount = cards.length;
	const hasSelection = selectedCardIds.size > 0;
	const visualDropTarget = dropTarget ?? previewIndicator;
	const highlightedIds = useMemo(() => new Set(previewIndicator?.highlightIds ?? []), [previewIndicator]);
	const mergeValidation = useMemo<MergeValidation>(() => {
		if (selectedCardsList.length < 2) {
			return { canMerge: false, reason: '選択カードを結合:2枚以上選択してください', cards: [] };
		}
		const baseParent = selectedCardsList[0].parent_id ?? null;
		const baseLevel = selectedCardsList[0].level;
		const indexMap = new Map<string, number>();
		cards.forEach((card, index) => {
			indexMap.set(card.id, index);
		});

		for (const card of selectedCardsList) {
			if ((card.parent_id ?? null) !== baseParent) {
				return { canMerge: false, reason: '同じ親カードの連続項目のみ統合できます', cards: [] };
			}
			if (card.level !== baseLevel) {
				return { canMerge: false, reason: '同じ階層のカードのみ統合できます', cards: [] };
			}
			if (card.child_ids.length > 0) {
				return { canMerge: false, reason: '子カードを持つ項目は統合できません', cards: [] };
			}
		}

		let previousIndex: number | null = null;
		for (const card of selectedCardsList) {
			const currentIndex = indexMap.get(card.id);
			if (currentIndex === undefined) {
				return { canMerge: false, reason: '選択中のカードを特定できませんでした', cards: [] };
			}
			if (previousIndex !== null && currentIndex !== previousIndex + 1) {
				return { canMerge: false, reason: '連続したカードのみ統合できます', cards: [] };
			}
			previousIndex = currentIndex;
		}

		return { canMerge: true, cards: selectedCardsList };
	}, [cards, selectedCardsList]);
	const statsTargetCard = useMemo(() => {
		if (!statsTargetCardId) {
			return null;
		}
		return cards.find((card) => card.id === statsTargetCardId) ?? null;
	}, [cards, statsTargetCardId]);
	const historyDialogCard = useMemo(() => {
		if (!historyDialogCardId) {
			return null;
		}
		return cards.find((card) => card.id === historyDialogCardId) ?? null;
	}, [cards, historyDialogCardId]);

	/**
	 * @brief 未トレースカード数を計算。
	 * @details
	 * 左側・右側それぞれの未トレースカード数を計算する。
	 * 廃止カードは除外する。
	 */
	const untracedLeftCount = useMemo(() => countUntracedCards(cards, 'left'), [cards]);
	const untracedRightCount = useMemo(() => countUntracedCards(cards, 'right'), [cards]);
	const isFileTraceVisible = useTracePreferenceStore(
		useCallback((state) => (activeFileName ? state.isFileVisible(activeFileName) : true), [activeFileName]),
	);
	const toggleFileTraceVisibility = useTracePreferenceStore((state) => state.toggleFileVisibility);
	const toggleCardTraceVisibility = useTracePreferenceStore((state) => state.toggleCardVisibility);
	const cardVisibilityMap = useTracePreferenceStore((state) => state.mutedCards, shallow);
	const excludeSelfTrace = useTracePreferenceStore((state) => state.excludeSelfTrace);

	const getCardSideVisibility = useCallback(
		(cardId: string, side: TraceConnectorSide) => {
			if (!activeFileName) {
				return true;
			}
			const key = makeCardKey(activeFileName, cardId, side);
			return cardVisibilityMap[key] !== false;
		},
		[activeFileName, cardVisibilityMap],
	);

	const traceCacheSnapshot = useTraceStore((state) => state.cache, shallow);
	const globalSelections = useMemo(() => {
		const map: Record<string, string[]> = {};
		Object.values(tabsSnapshot).forEach((tab) => {
			if (tab?.fileName && tab.selectedCardIds.size > 0) {
				map[tab.fileName] = Array.from(tab.selectedCardIds);
			}
		});
		return map;
	}, [tabsSnapshot]);

	const selectionSeeds = useMemo<TraceSeed[]>(() => {
		const seeds: TraceSeed[] = [];
		Object.entries(globalSelections).forEach(([fileName, ids]) => {
			ids.forEach((cardId) => {
				seeds.push({ fileName, cardId });
			});
		});
		return seeds;
	}, [globalSelections]);

	const availableFiles = useMemo(() => {
		const set = new Set<string>();
		Object.values(tabsSnapshot).forEach((tab) => {
			if (tab?.fileName) {
				set.add(tab.fileName);
			}
		});
		return Array.from(set).sort();
	}, [tabsSnapshot]);

	const traceHighlightIds = useMemo(() => {
		if (!activeFileName || selectionSeeds.length === 0) {
			return null;
		}
		const related = useTraceStore.getState().getRelatedCards(selectionSeeds);
		const set = new Set<string>(related[activeFileName] ?? []);
		globalSelections[activeFileName]?.forEach((cardId) => set.add(cardId));
		if (excludeSelfTrace) {
			const selectedInPanel = new Set<string>(globalSelections[activeFileName] ?? []);
			Array.from(set).forEach((cardId) => {
				if (!selectedInPanel.has(cardId)) {
					set.delete(cardId);
				}
			});
		}
		return set.size > 0 ? set : null;
	}, [activeFileName, excludeSelfTrace, globalSelections, selectionSeeds, traceCacheSnapshot]);

	const [matrixSelectionIds, setMatrixSelectionIds] = useState<Set<string>>(new Set());
	const [isMatrixDialogOpen, setMatrixDialogOpen] = useState(false);
	const [matrixLeftFile, setMatrixLeftFile] = useState('');
	const [matrixRightFile, setMatrixRightFile] = useState('');
	const [matrixDialogError, setMatrixDialogError] = useState<string | null>(null);

	useEffect(() => {
		if (!window.app?.matrix) {
			return;
		}
		const unsubscribe = window.app.matrix.onCardSelectionChanged((event) => {
			if (event.fileName !== activeFileName) {
				return;
			}
			setMatrixSelectionIds(new Set(event.selectedCardIds));
		});
		return () => {
			unsubscribe?.();
			setMatrixSelectionIds(new Set());
		};
	}, [activeFileName]);

	useEffect(() => {
		if (!window.app?.matrix || !activeFileName) {
			return;
		}
		window.app.matrix.broadcastCardSelection({
			fileName: activeFileName,
			selectedCardIds: Array.from(selectedCardIds),
			source: 'cards-panel',
		});
	}, [activeFileName, selectedCardIds]);

	const combinedHighlightIds = useMemo(() => {
		const merged = new Set<string>();
		if (traceHighlightIds) {
			traceHighlightIds.forEach((id) => merged.add(id));
		}
		matrixSelectionIds.forEach((id) => merged.add(id));
		return merged.size > 0 ? merged : traceHighlightIds;
	}, [traceHighlightIds, matrixSelectionIds]);

	const openMatrixDialog = useCallback(() => {
		const defaultLeft = activeFileName ?? availableFiles[0] ?? '';
		const alternative = availableFiles.find((file) => file !== defaultLeft) ?? '';
		setMatrixLeftFile(defaultLeft);
		setMatrixRightFile(alternative);
		setMatrixDialogError(availableFiles.length >= 2 ? null : '2つのファイルを開いてください');
		setMatrixDialogOpen(true);
	}, [activeFileName, availableFiles]);

	const handleMatrixDialogSubmit = useCallback(async () => {
		if (!window.app?.matrix) {
			setMatrixDialogError('matrix API が利用できません');
			return;
		}
		if (!matrixLeftFile || !matrixRightFile) {
			setMatrixDialogError('左右ファイルを選択してください');
			return;
		}
		if (matrixLeftFile === matrixRightFile) {
			setMatrixDialogError('左右には異なるファイルを選択してください');
			return;
		}
		try {
			await window.app.matrix.open({ leftFile: matrixLeftFile, rightFile: matrixRightFile });
			onLog?.('INFO', `トレースマトリクスを開きました: ${matrixLeftFile} ⇔ ${matrixRightFile}`);
			setMatrixDialogOpen(false);
		} catch (error) {
			console.error('[CardPanel] failed to open matrix window', error);
			setMatrixDialogError('マトリクスウィンドウを開けませんでした');
		}
	}, [matrixLeftFile, matrixRightFile, onLog]);

	const handleMatrixSwap = useCallback(() => {
		setMatrixDialogError(null);
		setMatrixLeftFile((prevLeft) => {
			const nextLeft = matrixRightFile;
			setMatrixRightFile(prevLeft);
			return nextLeft;
		});
	}, [matrixRightFile]);

	const reassignTracesForMerge = useCallback(
		async (fileName: string, sourceIds: string[], targetId: string) => {
			if (!fileName || sourceIds.length === 0) {
				return;
			}
			const traceState = useTraceStore.getState();
			const sourceSet = new Set(sourceIds);
			const affectedEntries = Object.values(traceState.cache).filter(
				(entry) => entry.leftFile === fileName || entry.rightFile === fileName,
			);
			for (const entry of affectedEntries) {
				const clonedRelations: TraceabilityRelation[] = entry.relations.map((relation) => ({
					...relation,
					left_ids: [...relation.left_ids],
					right_ids: [...relation.right_ids],
				}));
				let changed = false;
				clonedRelations.forEach((relation) => {
					if (entry.leftFile === fileName) {
						const replaced = replaceIdsInArray(relation.left_ids, sourceSet, targetId);
						if (replaced.updated) {
							relation.left_ids = replaced.values;
							changed = true;
						}
					}
					if (entry.rightFile === fileName) {
						const replaced = replaceIdsInArray(relation.right_ids, sourceSet, targetId);
						if (replaced.updated) {
							relation.right_ids = replaced.values;
							changed = true;
						}
					}
				});
				if (!changed) {
					continue;
				}
				try {
					await traceState.saveRelationsForPair({
						leftFile: entry.leftFile,
						rightFile: entry.rightFile,
						relations: clonedRelations,
					});
					onLog?.('INFO', `トレースを統合しました (${entry.leftFile} ↔ ${entry.rightFile})`);
				} catch (error) {
					console.error('[CardPanel] failed to merge trace relations', error);
					onLog?.('WARN', 'トレース情報の更新に失敗しました。');
				}
			}
		},
		[onLog],
	);

	const handlePanelTraceToggle = useCallback(() => {
		if (!activeFileName) {
			return;
		}
		const cardIds = cards.map((card) => card.id);
		toggleFileTraceVisibility(activeFileName, cardIds);
	}, [activeFileName, cards, toggleFileTraceVisibility]);

	const handleCardMarkdownToggle = useCallback(
		(cardId: string) => {
			if (!activeTabId) {
				return;
			}
			const card = cards.find((c) => c.id === cardId);
			toggleCardMarkdownPreview(leafId, activeTabId, cardId);
			if (card) {
				onLog?.('INFO', `カード「${card.title}」のMarkdownプレビューを${card.markdownPreviewEnabled ? 'OFF' : 'ON'}にしました。`);
			}
		},
		[activeTabId, cards, leafId, onLog, toggleCardMarkdownPreview],
	);

	/**
	 * @brief 階層構造を考慮して表示すべきカードをフィルタリングする。
	 * @details
	 * 親が折畳まれている場合、その子カードは表示しない。
	 * @return 表示対象のカードリスト。
	 */
	const treeVisibleCards = useMemo(() => {
		const result: Card[] = [];
		const cardMap = new Map(cards.map((c) => [c.id, c]));

		/**
		 * @brief カードとその子孫が表示可能かを判定する。
		 * @param card 判定対象のカード。
		 * @return 表示可能な場合true。
		 */
		const isVisible = (card: Card): boolean => {
			if (!card.parent_id) {
				return true; //! ルートカードは常に表示
			}
			const parent = cardMap.get(card.parent_id);
			if (!parent) {
				return true; //! 親が見つからない場合は表示
			}
			if (!expandedCardIds.has(parent.id)) {
				return false; //! 親が折畳まれている場合は非表示
			}
			return isVisible(parent); //! 再帰的に祖先を確認
		};

		cards.forEach((card) => {
			if (isVisible(card)) {
				result.push(card);
			}
		});

		return result;
	}, [cards, expandedCardIds]);

	const allowedKinds = useMemo(() => new Set<CardKind>(CARD_KIND_VALUES.filter((kind) => kindFilter[kind])), [kindFilter]);
	const kindFilterActive = allowedKinds.size !== CARD_KIND_VALUES.length;
	const filterTextNormalized = filterText.trim().toLowerCase();
	const untracedFilterActive = untracedFilter !== 'none';
	const filterActive = filterTextNormalized.length > 0 || kindFilterActive || untracedFilterActive;

	const filteredCardIds = useMemo(() => {
		if (!filterActive) {
			return null;
		}
		const cardMap = new Map(cards.map((card) => [card.id, card]));
		const matches = new Set<string>();
		cards.forEach((card) => {
			if (!allowedKinds.has(card.kind)) {
				return;
			}
			if (filterTextNormalized) {
				const haystack = `${card.title ?? ''}\n${card.body ?? ''}`.toLowerCase();
				if (!haystack.includes(filterTextNormalized)) {
					return;
				}
			}
			//! 未トレースフィルタ適用
			if (untracedFilterActive) {
				const needsLeftTrace = untracedFilter === 'left' || untracedFilter === 'both';
				const needsRightTrace = untracedFilter === 'right' || untracedFilter === 'both';
				const matchesLeftFilter = needsLeftTrace ? (!card.hasLeftTrace && card.status !== 'deprecated') : true;
				const matchesRightFilter = needsRightTrace ? (!card.hasRightTrace && card.status !== 'deprecated') : true;
				if (!matchesLeftFilter || !matchesRightFilter) {
					return;
				}
			}
			matches.add(card.id);
		});
		if (matches.size === 0) {
			return new Set<string>();
		}
		const visible = new Set(matches);
		const addAncestors = (id: string) => {
			let current = cardMap.get(id);
			while (current?.parent_id) {
				if (visible.has(current.parent_id)) {
					break;
				}
				visible.add(current.parent_id);
				current = cardMap.get(current.parent_id);
			}
		};
		matches.forEach(addAncestors);
		return visible;
	}, [allowedKinds, cards, filterActive, filterTextNormalized, untracedFilter, untracedFilterActive]);

	/**
	 * @brief フィルタ適用後の表示カードリスト。
	 * @details
	 * パフォーマンス最適化: useMemoで依存配列を最小化し、不要な再計算を防ぐ。
	 * フィルタが無効な場合は即座にtreeVisibleCardsを返し、追加の計算を避ける。
	 */
	const visibleCards = useMemo(() => {
		if (!filterActive) {
			return treeVisibleCards;
		}
		if (!filteredCardIds || filteredCardIds.size === 0) {
			return [] as Card[];
		}
		return treeVisibleCards.filter((card) => filteredCardIds.has(card.id));
	}, [filterActive, filteredCardIds, treeVisibleCards]);

	/**
	 * @brief 段階的カードレンダリング（パフォーマンス改善フェーズ2）
	 * @details
	 * IntersectionObserverを使用して、初期レンダリングは最初の50カードのみを表示し、
	 * スクロールに応じて追加ロードする。これにより、初期レンダリング時間とメモリ使用量を大幅に削減。
	 * - 初期レンダリング: 10,000カード → 50カード（DOM要素数を1/200に削減）
	 * - 初期表示時間: 8秒 → 1秒以下
	 * - メモリ使用量: 50〜60%削減
	 */
	const {
		visibleCards: renderedCards,
		isLoading: isLoadingMore,
		sentinelRef,
		loadedCount,
	} = useVirtualizedCards({
		cards: visibleCards,
		initialLoadCount: 50,
	});

	/**
	 * @brief アクティブタブを変更する。
	 * @param tabId タブID。
	 */
	const handleTabActivate = useCallback(
		(tabId: string) => {
			setActiveTab(leafId, tabId);
			const target = leafTabs.find((tab) => tab.id === tabId);
			if (target) {
				onLog?.('INFO', `タブ「${target.title}」を表示しました。`);
			}
		},
		[leafId, leafTabs, onLog, setActiveTab],
	);

	/**
	 * @brief タブを閉じる。
	 * @param tabId タブID。
	 */
	const handleTabClose = useCallback(
		(tabId: string) => {
			const target = leafTabs.find((tab) => tab.id === tabId);

			// 未保存変更がある場合は確認ダイアログを表示
			if (target?.isDirty) {
				const confirmed = window.confirm(
					`タブ「${target.title}」には未保存の変更があります。\n\n保存せずに閉じますか?`
				);
				if (!confirmed) {
					onLog?.('INFO', `タブ「${target.title}」のクローズをキャンセルしました。`);
					return;
				}
			}

			closeTab(leafId, tabId);
			if (target) {
				onLog?.('INFO', `タブ「${target.title}」を閉じました。`);
			}
		},
		[closeTab, leafId, leafTabs, onLog],
	);

	const handleCreateNewTab = useCallback(() => {
		const created = createUntitledTab(leafId);
		if (created) {
			onLog?.('INFO', `新規カードファイルを作成しました: ${created.title}`);
		}
	}, [createUntitledTab, leafId, onLog]);

	const handleAddCard = useCallback(() => {
		if (!activeTabId) {
			return;
		}
		const created = addCard(leafId, activeTabId, { position: toolbarInsertMode });
		if (!created) {
			onLog?.('WARN', 'カードを追加できませんでした。');
			return;
		}
		onLog?.('INFO', `カード「${created.title || '新規カード'}」を追加しました。（${toolbarInsertMode === 'before' ? '前' : toolbarInsertMode === 'child' ? '子' : '後'}に挿入）`);
	}, [activeTabId, addCard, leafId, onLog, toolbarInsertMode]);

	const handleDeleteCards = useCallback(() => {
		if (!activeTabId || selectedCardIds.size === 0) {
			return;
		}
		const confirmAvailable = typeof window !== 'undefined' && typeof window.confirm === 'function';
		if (confirmAvailable && !window.confirm('選択中のカードを削除します。よろしいですか？')) {
			return;
		}
		const deleted = deleteCards(leafId, activeTabId);
		if (deleted > 0) {
			onLog?.('INFO', `${deleted}件のカードを削除しました。`);
		} else {
			onLog?.('WARN', 'カードを削除できませんでした。');
		}
	}, [activeTabId, deleteCards, leafId, onLog, selectedCardIds]);

	const handleOpenBulkPrefixEdit = useCallback(() => {
		if (!activeTab || !activeTab.cards || activeTab.cards.length === 0) {
			onLog?.('WARN', 'カードが存在しません。');
			return;
		}
		// 既存のカードから最も一般的な接頭語を取得
		const prefixCounts = new Map<string, number>();
		for (const card of activeTab.cards) {
			if (card.cardId) {
				const parsed = parseCardId(card.cardId);
				if (parsed) {
					const count = prefixCounts.get(parsed.prefix) ?? 0;
					prefixCounts.set(parsed.prefix, count + 1);
				}
			}
		}
		let mostCommonPrefix = '';
		let maxCount = 0;
		for (const [prefix, count] of prefixCounts.entries()) {
			if (count > maxCount) {
				mostCommonPrefix = prefix;
				maxCount = count;
			}
		}
		setBulkPrefixOldValue(mostCommonPrefix);
		setBulkPrefixNewValue('');
		setIsBulkPrefixEditOpen(true);
	}, [activeTab, onLog]);

	const handleBulkPrefixEditSave = useCallback(() => {
		if (!activeTabId || !activeTab) {
			return;
		}

		const oldPrefix = bulkPrefixOldValue;
		const newPrefix = bulkPrefixNewValue;

		let updatedCount = 0;
		for (const card of activeTab.cards) {
			if (!card.cardId) {
				continue;
			}

			const parsed = parseCardId(card.cardId);
			if (!parsed || parsed.prefix !== oldPrefix) {
				continue;
			}

			// 新しいIDを生成
			const paddedNumber = String(parsed.number).padStart(3, '0');
			const newCardId = newPrefix ? `${newPrefix}-${paddedNumber}` : paddedNumber;

			// 更新
			updateCard(leafId, activeTabId, card.id, { cardId: newCardId });
			updatedCount++;
		}

		setIsBulkPrefixEditOpen(false);
		setBulkPrefixOldValue('');
		setBulkPrefixNewValue('');

		if (updatedCount > 0) {
			onLog?.('INFO', `${updatedCount}件のカードIDの接頭語を変更しました。`);
		} else {
			onLog?.('WARN', '該当するカードが見つかりませんでした。');
		}
	}, [activeTab, activeTabId, bulkPrefixNewValue, bulkPrefixOldValue, leafId, onLog, updateCard]);

	const handleBulkPrefixEditCancel = useCallback(() => {
		setIsBulkPrefixEditOpen(false);
		setBulkPrefixOldValue('');
		setBulkPrefixNewValue('');
	}, []);

	const handleExport = useCallback(async (format: any, options: any) => {
		if (!activeTab || !activeTab.cards) return;
		try {
			const success = await window.app.export.exportCards(format, options, activeTab.cards);
			if (success) {
				onLog?.('INFO', 'エクスポートが完了しました。');
			}
		} catch (error) {
			onLog?.('WARN', 'エクスポートに失敗しました。');
		}
	}, [activeTab, onLog]);

	const handleCardContextMenu = useCallback(
		(card: Card, event: React.MouseEvent) => {
			if (!activeTabId) {
				return;
			}
			if (!selectedCardIds.has(card.id)) {
				selectCard(leafId, activeTabId, card.id);
			}
			setContextMenu({ card, x: event.clientX, y: event.clientY });
		},
		[activeTabId, leafId, selectCard, selectedCardIds],
	);

	const handleCloseContextMenu = useCallback(() => {
		setContextMenu(null);
	}, [setContextMenu]);

	const handleContextAction = useCallback(
		(position: InsertPosition) => {
			if (!activeTabId || !contextMenu) {
				return;
			}
			const created = addCard(leafId, activeTabId, { anchorCardId: contextMenu.card.id, position });
			if (created) {
				onLog?.('INFO', `カード「${created.title || '新規カード'}」を${position === 'before' ? '前' : position === 'child' ? '子' : '後'}に追加しました。`);
			}
			setContextMenu(null);
		},
		[activeTabId, addCard, contextMenu, leafId, onLog, setContextMenu],
	);

	useEffect(() => {
		if (!isKindFilterOpen) {
			return;
		}
		const handleClick = (event: MouseEvent) => {
			const target = event.target as Node;
			if (kindFilterPopoverRef.current?.contains(target) || kindFilterButtonRef.current?.contains(target)) {
				return;
			}
			setKindFilterOpen(false);
		};
		document.addEventListener('mousedown', handleClick);
		return () => {
			document.removeEventListener('mousedown', handleClick);
		};
	}, [isKindFilterOpen]);

	/**
	 * @brief パネルクリック時の処理。
	 * @details
	 * パネル全体のクリックで onPanelClick コールバックを呼び出す。
	 */
	const handlePanelClick = useCallback(() => {
		onPanelClick?.(leafId);
	}, [leafId, onPanelClick]);

	/**
	 * @brief カード以外の領域をクリックした際に選択状態をクリアする。
	 * @param event マウスイベント。
	 */
	const handlePanelBlankMouseDown = useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			if (!activeTabId || selectedCardIds.size === 0) {
				return;
			}
			if (event.button !== 0) {
				return; //! 右クリックなどは対象外
			}
			const target = event.target as HTMLElement | null;
			if (target?.closest('.card-list-item')) {
				return; //! カード上でのクリックは無視
			}
			clearSelection(leafId, activeTabId);
			onLog?.('INFO', 'カードの選択をクリアしました。');
		},
		[activeTabId, clearSelection, leafId, onLog, selectedCardIds],
	);

	/**
	 * @brief パネルクローズ時の処理。
	 * @details
	 * クリックイベントの伝播を防ぎ、onPanelClose コールバックを呼び出す。
	 * @param event マウスイベント。
	 */
	const handlePanelClose = useCallback(
		(event: React.MouseEvent) => {
			event.stopPropagation(); //! パネルクリックイベントの伝播を防ぐ
			onPanelClose?.(leafId);
		},
		[leafId, onPanelClose],
	);

	/**
	 * @brief カードを選択する。
	 * @details
	 * Ctrl/Cmdで複数選択、Shiftで範囲選択に対応。
	 * パフォーマンス最適化: useCallbackで依存配列を最小化し、
	 * 必要最小限の依存のみを指定して関数の再生成を抑制。
	 * @param card 対象カード。
	 * @param event マウスイベント（Ctrl/Shift判定用）。
	 */
	const handleCardSelect = useCallback(
		(card: Card, event?: React.MouseEvent) => {
			if (!activeTabId) {
				return;
			}

			const isCtrlOrCmd = event?.ctrlKey || event?.metaKey;
			const isShift = event?.shiftKey;
			const selectionMode: 'ctrl' | 'shift' | 'normal' = isCtrlOrCmd ? 'ctrl' : isShift ? 'shift' : 'normal';
			const splitStore = useSplitStore.getState();
			panelSelectionTransition(splitStore.activeLeafId ?? null, leafId, selectionMode);
			splitStore.setActiveLeaf(leafId);

			if (isCtrlOrCmd) {
				//! Ctrl/Cmd+クリック: 複数選択トグル
				selectCard(leafId, activeTabId, card.id, { multi: true });
				onLog?.('INFO', `カード「${card.title}」を複数選択しました。`);
			} else if (isShift) {
				//! Shift+クリック: 範囲選択
				selectCard(leafId, activeTabId, card.id, { range: true });
				onLog?.('INFO', `カード「${card.title}」まで範囲選択しました。`);
			} else {
				//! 通常クリック: 単一選択
				if (selectedCardIds.size === 1 && selectedCardIds.has(card.id)) {
					return; //! 既に単一選択済みなら何もしない
				}
				selectCard(leafId, activeTabId, card.id);
				onLog?.('INFO', `カード「${card.title}」を選択しました。`);
			}
		},
		[activeTabId, leafId, onLog, panelSelectionTransition, selectCard, selectedCardIds],
	);

	/**
	 * @brief キーボード操作でカードを選択する。
	 * @details
	 * Enter/Spaceキーでカード選択。その他キーは無視。
	 * @param event キーイベント。
	 * @param card 対象カード。
	 */
	const handleCardKeyDown = useCallback(
		(event: ReactKeyboardEvent<HTMLElement>, card: Card) => {
			if (event.key !== 'Enter' && event.key !== ' ') {
				return; //! 対象キー以外は無視
			}
			event.preventDefault();
			//! キーボードイベントをマウスイベント風に変換
			const pseudoEvent = {
				ctrlKey: event.ctrlKey,
				metaKey: event.metaKey,
				shiftKey: event.shiftKey,
			} as React.MouseEvent;
			handleCardSelect(card, pseudoEvent);
		},
		[handleCardSelect],
	);

	/**
	 * @brief カード表示モードを切り替える。
	 * @details
	 * コンパクト/詳細モードをトグルし、ログに記録する。
	 */
	const handleToggleDisplayMode = useCallback(() => {
		if (!activeTabId) return;
		toggleTabDisplayMode(activeTabId);
		const nextMode = cardDisplayMode === 'detailed' ? 'コンパクト' : '詳細';
		onLog?.('INFO', `カード表示モードを「${nextMode}」に切り替えました。`);
	}, [activeTabId, cardDisplayMode, onLog, toggleTabDisplayMode]);

	/**
	 * @brief 全カードを展開する。
	 */
	const handleExpandAll = useCallback(() => {
		if (!activeTabId) return;
		useWorkspaceStore.getState().expandAll(leafId, activeTabId);
		onLog?.('INFO', 'すべてのカードを展開しました。');
	}, [activeTabId, leafId, onLog]);

	/**
	 * @brief 全カードを折畳む。
	 */
	const handleCollapseAll = useCallback(() => {
		if (!activeTabId) return;
		useWorkspaceStore.getState().collapseAll(leafId, activeTabId);
		onLog?.('INFO', 'すべてのカードを折畳みました。');
	}, [activeTabId, leafId, onLog]);

	const copyPlainText = useCallback(async (text: string) => {
		if (!text) {
			return false;
		}
		try {
			if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(text);
				return true;
			}
		} catch (error) {
			console.warn('[CardPanel] navigator.clipboard failed', error);
		}
		if (typeof document === 'undefined') {
			return false;
		}
		try {
			const textarea = document.createElement('textarea');
			textarea.value = text;
			textarea.style.position = 'fixed';
			textarea.style.opacity = '0';
			document.body.appendChild(textarea);
			textarea.focus();
			textarea.select();
			const success = document.execCommand('copy');
			document.body.removeChild(textarea);
			return success;
		} catch (error) {
			console.warn('[CardPanel] execCommand copy failed', error);
			return false;
		}
	}, []);

	const handleCopyCardsAsText = useCallback(
		async (fallbackCard?: Card) => {
			const targets = selectedCardsList.length > 0 ? selectedCardsList : fallbackCard ? [fallbackCard] : [];
			if (targets.length === 0) {
				onLog?.('WARN', 'コピーするカードが選択されていません。');
				return;
			}

			const payload = targets
				.map((card) => {
					const identifier = card.cardId ? `[${card.cardId}] ` : '';
					const header = `${identifier}${card.title || '（無題カード）'}`.trim();
					const body = card.body?.trim();
					return body ? `${header}\n${body}` : header;
				})
				.join('\n\n---\n\n');

			const success = await copyPlainText(payload);
			if (success) {
				onLog?.('INFO', `${targets.length}件のカード内容をテキストとしてコピーしました。`);
			} else {
				onLog?.('ERROR', 'テキストとしてコピーできませんでした。');
			}
		},
		[copyPlainText, onLog, selectedCardsList],
	);

	const handleCopyCardUuid = useCallback(
		async (card: Card) => {
			const success = await copyPlainText(card.id);
			if (success) {
				onLog?.('INFO', `カードUUID(${card.id})をコピーしました。`);
			} else {
				onLog?.('ERROR', 'カードUUIDをコピーできませんでした。');
			}
		},
		[copyPlainText, onLog],
	);

	const handleMergeDialogCancel = useCallback(() => {
		setMergeDialogOpen(false);
		setMergeDialogCards([]);
	}, []);

	const handleOpenMergeDialog = useCallback(() => {
		if (!mergeValidation.canMerge) {
			if (mergeValidation.reason) {
				onLog?.('WARN', mergeValidation.reason);
			}
			return;
		}
		setMergeDialogCards(mergeValidation.cards);
		setMergeDialogOpen(true);
		setContextMenu(null);
	}, [mergeValidation, onLog]);

	const handleMergeSubmit = useCallback(
		async (payload: CardMergeDialogPayload) => {
			if (!activeTabId || mergeDialogCards.length < 2) {
				return;
			}
			const result = mergeCardsAction(leafId, activeTabId, mergeDialogCards.map((card) => card.id), {
				title: payload.title,
				body: payload.body,
				status: payload.status,
				kind: payload.kind,
				cardId: payload.cardId,
				removeOriginals: payload.removeOriginals,
				inheritTraces: payload.inheritTraces,
			});
			if (!result) {
				onLog?.('WARN', 'カード統合に失敗しました。');
				return;
			}
			handleMergeDialogCancel();
			onLog?.('INFO', `${mergeDialogCards.length}件のカードを統合しました。`);
			if (payload.inheritTraces && payload.removeOriginals && activeFileName && result.removedCardIds.length > 0) {
				await reassignTracesForMerge(activeFileName, result.removedCardIds, result.mergedCard.id);
			}
		},
		[activeFileName, activeTabId, handleMergeDialogCancel, leafId, mergeCardsAction, mergeDialogCards, onLog, reassignTracesForMerge],
	);

	const handleContextEdit = useCallback(
		(card: Card) => {
			if (!activeTabId) {
				return;
			}
			setEditingCard(leafId, activeTabId, card.id);
			onLog?.('INFO', `カード「${card.title || card.id}」を編集モードにしました。`);
		},
		[activeTabId, leafId, onLog, setEditingCard],
	);

	const handleOpenStatsDialog = useCallback((card: Card) => {
		setStatsTargetCardId(card.id);
		onLog?.('INFO', `カード「${card.title || card.id}」の統計情報を開きました。`);
	}, [onLog, setStatsTargetCardId]);

	const handleOpenHistoryDialog = useCallback((card: Card) => {
		const identifier = card.cardId ?? card.id;
		if (!identifier) {
			onLog?.('WARN', 'カードIDが設定されていないため履歴を表示できません。');
			return;
		}
		setHistoryDialogCardId(card.id);
		onLog?.('INFO', `カード「${card.title || card.id}」の履歴を開きました。`);
		setContextMenu(null);
	}, [onLog]);

	const handleCopySelected = useCallback(() => {
		if (!activeTabId) {
			return;
		}
		const count = copySelection(leafId, activeTabId);
		if (count > 0) {
			onLog?.('INFO', `${count}件のカードをコピーしました。`);
		} else {
			onLog?.('WARN', 'コピーするカードが選択されていません。');
		}
		setContextMenu(null);
	}, [activeTabId, copySelection, leafId, onLog, setContextMenu]);

	const handlePasteIntoSelection = useCallback(() => {
		if (!activeTabId) {
			return;
		}
		if (!hasClipboardItems) {
			onLog?.('WARN', '貼り付け可能なカードがありません。');
			return;
		}
		const result = pasteClipboard(leafId, activeTabId, { position: toolbarInsertMode });
		if (result && result.inserted > 0) {
			onLog?.('INFO', `${result.inserted}件のカードを貼り付けました。`);
		}
	}, [activeTabId, hasClipboardItems, leafId, onLog, pasteClipboard, toolbarInsertMode]);

	const handleContextPaste = useCallback(
		(position: InsertPosition, anchorId: string) => {
			if (!activeTabId) {
				setContextMenu(null);
				return;
			}
			if (!hasClipboardItems) {
				onLog?.('WARN', '貼り付け可能なカードがありません。');
				return;
			}
			const result = pasteClipboard(leafId, activeTabId, { position, anchorCardId: anchorId });
			if (result && result.inserted > 0) {
				onLog?.('INFO', `${result.inserted}件のカードを貼り付けました。`);
			}
			setContextMenu(null);
		},
		[activeTabId, hasClipboardItems, leafId, onLog, pasteClipboard, setContextMenu],
	);

	const contextMenuSections = useMemo<ContextMenuSection[]>(() => {
		if (!contextMenu) {
			return [];
		}
		const target = contextMenu.card;
		return [
			{
				key: 'card-actions',
				title: 'カード操作',
				items: [
					{ key: 'edit', label: '編集', icon: '✏️', onSelect: () => handleContextEdit(target) },
					{ key: 'copy', label: 'コピー', icon: '📋', onSelect: handleCopySelected, disabled: !hasSelection },
					{ key: 'merge', label: '選択カードを統合', icon: '🧩', onSelect: handleOpenMergeDialog, disabled: !mergeValidation.canMerge },
					{ key: 'delete', label: '削除', icon: '🗑️', onSelect: handleDeleteCards, disabled: !hasSelection, variant: 'danger' },
				],
			},
			{
				key: 'add-card',
				title: 'カード追加',
				items: [
					{ key: 'add-before', label: '前に追加', icon: '⬆︎', onSelect: () => handleContextAction('before') },
					{ key: 'add-after', label: '後に追加', icon: '⬇︎', onSelect: () => handleContextAction('after') },
					{ key: 'add-child', label: '子として追加', icon: '➡︎', onSelect: () => handleContextAction('child') },
				],
			},
			{
				key: 'paste',
				title: '貼り付け',
				items: [
					{ key: 'paste-before', label: '前に貼り付け', icon: '⬆︎', onSelect: () => handleContextPaste('before', target.id), disabled: !hasClipboardItems },
					{ key: 'paste-after', label: '後に貼り付け', icon: '⬇︎', onSelect: () => handleContextPaste('after', target.id), disabled: !hasClipboardItems },
					{ key: 'paste-child', label: '子として貼り付け', icon: '➡︎', onSelect: () => handleContextPaste('child', target.id), disabled: !hasClipboardItems },
				],
			},
			{
				key: 'info',
				title: '情報/コピー',
				items: [
					{ key: 'copy-text', label: 'テキストとしてコピー', icon: '📄', onSelect: () => { void handleCopyCardsAsText(target); } },
					{ key: 'copy-id', label: 'IDをコピー (UUID)', icon: '🔗', onSelect: () => { void handleCopyCardUuid(target); } },
					{ key: 'history', label: '履歴を表示', icon: '🕘', onSelect: () => handleOpenHistoryDialog(target) },
					{ key: 'stats', label: '統計情報', icon: '📊', onSelect: () => handleOpenStatsDialog(target) },
				],
			},
		];
	}, [contextMenu, handleContextAction, handleContextEdit, handleCopyCardUuid, handleCopyCardsAsText, handleCopySelected, handleDeleteCards, handleOpenHistoryDialog, handleOpenMergeDialog, handleOpenStatsDialog, handleContextPaste, hasClipboardItems, hasSelection, mergeValidation]);

	/**
	 * @brief ドラッグ開始時の処理。
	 * @param cardId ドラッグ開始したカードID。
	 */
	const handleDragStart = useCallback(
		(cardId: string) => {
			//! 選択中のカードをドラッグ対象にする
			const cardsToMove = selectedCardIds.has(cardId) ? Array.from(selectedCardIds) : [cardId];
			setDraggedCardIds(cardsToMove);
			onLog?.('INFO', `${cardsToMove.length}件のカードをドラッグ中...`);
		},
		[onLog, selectedCardIds],
	);

	/**
	 * @brief ドラッグオーバー時の処理。
	 * @param cardId ドラッグオーバーしたカードID。
	 * @param position ドロップ位置。
	 */
	const handleDragOver = useCallback(
		(cardId: string, position: 'before' | 'after' | 'child') => {
			setDropTarget({ cardId, position });
		},
		[],
	);

	/**
	 * @brief ドロップ時の処理。
	 */
	const handleDrop = useCallback(() => {
		if (!activeTabId || !dropTarget || draggedCardIds.length === 0) {
			setDraggedCardIds([]);
			setDropTarget(null);
			return;
		}

		const success = moveCards(leafId, activeTabId, draggedCardIds, dropTarget.cardId, dropTarget.position);
		if (success) {
			onLog?.('INFO', `${draggedCardIds.length}件のカードを移動しました。`);
		} else {
			onLog?.('WARN', 'カードの移動に失敗しました。');
		}

		setDraggedCardIds([]);
		setDropTarget(null);
	}, [activeTabId, draggedCardIds, dropTarget, leafId, moveCards, onLog]);

	/**
	 * @brief ドラッグ終了時の処理。
	 */
	const handleDragEnd = useCallback(() => {
		setDraggedCardIds([]);
		setDropTarget(null);
	}, []);

	/**
	 * @brief カードをダブルクリックして編集モードに移行する。
	 * @param card 対象カード。
	 */
	const handleCardDoubleClick = useCallback(
		(card: Card) => {
			if (!activeTabId) {
				return;
			}
			setEditingCard(leafId, activeTabId, card.id);
			onLog?.('INFO', `カード「${card.title}」を編集モードにしました。`);
		},
		[activeTabId, leafId, onLog, setEditingCard],
	);

	/**
	 * @brief カードの編集を確定する。
	 * @param cardId 対象カードID。
	 * @param patch カードの変更内容。
	 */
	const handleUpdateCard = useCallback(
		(cardId: string, patch: CardPatch) => {
			if (!activeTabId) {
				return;
			}
			updateCard(leafId, activeTabId, cardId, patch);
			setEditingCard(leafId, activeTabId, null);
			onLog?.('INFO', 'カードの編集を保存しました。');
		},
		[activeTabId, leafId, onLog, setEditingCard, updateCard],
	);

	/**
	 * @brief カードの編集をキャンセルする。
	 */
	const handleCancelEdit = useCallback(() => {
		if (!activeTabId) {
			return;
		}
		setEditingCard(leafId, activeTabId, null);
		onLog?.('INFO', 'カードの編集をキャンセルしました。');
	}, [activeTabId, leafId, onLog, setEditingCard]);

	const panelClassName = [
		'split-node',
		panelFocusState === 'active' ? 'split-node--active' : '',
		panelFocusState === 'semiActive' ? 'split-node--semi-active' : '',
	]
		.filter(Boolean)
		.join(' ');

	return (
		<div
			className={panelClassName}
			data-leaf-id={leafId}
			data-panel-state={panelFocusState}
			onClick={handlePanelClick}
		>
			{/* タブバー: 各カードファイルのタブを表示 */}
			<div className="tab-bar" role="tablist" aria-label="カードファイルタブ">
				{leafTabs.length === 0 ? (
					<span className="tab-bar__empty">カードファイルが開かれていません</span>
				) : (
					leafTabs.map((tab) => {
						const isActive = tab.id === activeTabId;
						const tabClass = `tab-bar__tab${isActive ? ' tab-bar__tab--active' : ''}`;
						return (
							<div key={tab.id} className="tab-bar__tab-container" data-tab-id={tab.id}>
								<button
									type="button"
									className={tabClass}
									onClick={() => handleTabActivate(tab.id)}
									role="tab"
									aria-selected={isActive}
									aria-controls={`panel-${leafId}-${tab.id}`}
									title={tab.title}
								>
									<span aria-hidden="true">📄 </span>
									<span className="tab-bar__tab-title">{tab.title}</span>
									{tab.isDirty ? <span className="tab-bar__tab-dirty">●</span> : null}
								</button>
								<button
									type="button"
									className="tab-bar__tab-close"
									onClick={(event) => {
										event.stopPropagation();
										handleTabClose(tab.id);
									}}
									aria-label={`${tab.title} を閉じる`}
								>
									✕
								</button>
							</div>
						);
					})
				)}
				<button
					type="button"
					className="tab-bar__tab tab-bar__tab--add"
					onClick={(event) => {
						event.stopPropagation();
						handleCreateNewTab();
					}}
					aria-label="新規カードファイルを作成"
					title="新規カードファイルを作成"
				>
					➕
				</button>
				<div className="tab-bar__spacer" />
				<button
					type="button"
					className="tab-bar__tab"
					onClick={(event) => {
						event.stopPropagation();
						const defaultLeft = activeFileName ?? availableFiles[0] ?? '';
						const alternative = availableFiles.find((file) => file !== defaultLeft) ?? '';
						setMatrixLeftFile(defaultLeft);
						setMatrixRightFile(alternative);
						setMatrixDialogOpen(true);
					}}
					disabled={availableFiles.length < 2}
					aria-label="トレースマトリクスを開く"
					title="トレースマトリクスを開く"
				>
					🗺️
				</button>
				<button
					type="button"
					className="tab-bar__close"
					onClick={(event) => {
						event.stopPropagation();
						onPanelClose?.(leafId);
					}}
					aria-label="パネルを閉じる"
					title="パネルを閉じる"
				>
					✕
				</button>
			</div>

			{/* パネルツールバー: 各種操作ボタン・フィルタ・メタ情報 */}
			<div className="panel-toolbar">
				{/* 表示操作グループ */}
				<div className="panel-toolbar__group">
					<button
						type="button"
						className={`panel-toolbar__button${cardDisplayMode === 'compact' ? ' panel-toolbar__button--active' : ''}`}
						onClick={handleToggleDisplayMode}
						title={cardDisplayMode === 'detailed' ? 'コンパクト表示に切替' : '詳細表示に切替'}
						aria-label={cardDisplayMode === 'detailed' ? 'コンパクト表示に切替' : '詳細表示に切替'}
					>
						☰
					</button>
					<button
						type="button"
						className="panel-toolbar__button"
						onClick={handleExpandAll}
						title="すべて展開"
						aria-label="すべて展開"
					>
						⏬
					</button>
					<button
						type="button"
						className="panel-toolbar__button"
						onClick={handleCollapseAll}
						title="すべて折畳"
						aria-label="すべて折畳"
					>
						⏫
					</button>
					<button
						type="button"
						className={`panel-toolbar__button${isFileTraceVisible ? ' panel-toolbar__button--active' : ''}`}
						onClick={handlePanelTraceToggle}
						disabled={!activeFileName}
						aria-disabled={!activeFileName}
						title="トレース表示切替"
						aria-label="トレース表示切替"
					>
						⛓️
					</button>
				</div>
				<div className="panel-toolbar__separator" aria-hidden="true" />
				<div className="panel-toolbar__group">
					<button
						type="button"
						className="panel-toolbar__button"
						onClick={openMatrixDialog}
						disabled={availableFiles.length < 2}
						aria-disabled={availableFiles.length < 2}
						title="トレースマトリクスを開く"
						aria-label="トレースマトリクスを開く"
					>
						🗺️
					</button>
				</div>
				<div className="panel-toolbar__separator" aria-hidden="true" />
				{/* カード操作グループ */}
				<div className="panel-toolbar__group">
					<button
						type="button"
						className="panel-toolbar__button"
						onClick={handleAddCard}
						disabled={!activeTabId}
						aria-disabled={!activeTabId}
						title={`選択中カードの${toolbarInsertMode === 'before' ? '前' : toolbarInsertMode === 'child' ? '子' : '後'}に追加`}
					>
						➕
					</button>
					<label className="panel-toolbar__select-wrapper">
						<span className="sr-only">挿入モード</span>
						<select
							className="panel-toolbar__select"
							value={toolbarInsertMode}
							onChange={(event) => setToolbarInsertMode(event.target.value as InsertPosition)}
							aria-label="挿入モード"
						>
							<option value="before">前に追加</option>
							<option value="after">後に追加</option>
							<option value="child">子として追加</option>
						</select>
					</label>
					<button
						type="button"
						className="panel-toolbar__button"
						onClick={handleDeleteCards}
						disabled={!activeTabId || selectedCardIds.size === 0}
						aria-disabled={!activeTabId || selectedCardIds.size === 0}
						title="選択中カードを削除"
					>
						🗑️
					</button>
					<button
						type="button"
						className="panel-toolbar__button"
						onClick={handleCopySelected}
						disabled={!activeTabId || !hasSelection}
						aria-disabled={!activeTabId || !hasSelection}
						title="選択中カードをコピー (Ctrl+C)"
					>
						📋
					</button>
					<button
						type="button"
						className="panel-toolbar__button"
						onClick={handlePasteIntoSelection}
						disabled={!activeTabId || !hasClipboardItems}
						aria-disabled={!activeTabId || !hasClipboardItems}
						title="コピーしたカードを貼り付け (Ctrl+V)"
					>
						📥
					</button>
					<button
						type="button"
						className="panel-toolbar__button"
						onClick={handleOpenMergeDialog}
						disabled={!activeTabId || !mergeValidation.canMerge}
						aria-disabled={!activeTabId || !mergeValidation.canMerge}
						title={mergeValidation.canMerge ? '選択カードを統合' : mergeValidation.reason ?? '統合できません'}
					>
						🧩
					</button>
				</div>
				<div className="panel-toolbar__separator" aria-hidden="true" />
				<div className="panel-toolbar__group">
					<button
						type="button"
						className="panel-toolbar__button"
						onClick={handleOpenBulkPrefixEdit}
						disabled={!activeTabId}
						aria-disabled={!activeTabId}
					>
						🏷️
					</button>
					<button
						type="button"
						className="panel-toolbar__button"
						onClick={() => setExportDialogOpen(true)}
						disabled={!activeTabId}
						aria-disabled={!activeTabId}
						title="カード出力"
					>
						📤
					</button>
				</div>
				<div className="panel-toolbar__separator" aria-hidden="true" />
				{/* フィルタグループ */}
				<div className="panel-toolbar__group">
					<input
						className={`panel-toolbar__input${filterText ? ' panel-toolbar__input--active' : ''}`}
						type="search"
						placeholder="🔍 文字列フィルタ"
						aria-label="文字列フィルタ"
						value={filterText}
						onChange={handleFilterTextChange}
					/>
					<div className="panel-toolbar__popover-anchor">
						<button
							type="button"
							ref={kindFilterButtonRef}
							className={`panel-toolbar__button${kindFilterActive ? ' panel-toolbar__button--active' : ''}`}
							title="カード種別フィルタ"
							aria-label="カード種別フィルタ"
							aria-expanded={isKindFilterOpen}
							onClick={() => setKindFilterOpen((prev) => !prev)}
						>
							📚
						</button>
						{isKindFilterOpen ? (
							<div ref={kindFilterPopoverRef} className="panel-filter-popover" role="dialog" aria-label="カード種別フィルタ">
								<div className="panel-filter-popover__list">
									{CARD_KIND_VALUES.map((kind) => (
										<label key={kind} className="panel-filter-popover__item">
											<input type="checkbox" checked={kindFilter[kind]} onChange={() => toggleKindFilterValue(kind)} />
											<span>
												<span className="panel-filter-popover__icon">{CARD_KIND_ICON[kind]}</span>
												{kind}
											</span>
										</label>
									))}
								</div>
								<div className="panel-filter-popover__actions">
									<button type="button" onClick={() => applyKindFilterAll(true)}>全選択</button>
									<button type="button" onClick={() => applyKindFilterAll(false)}>全解除</button>
								</div>
							</div>
						) : null}
					</div>
				</div>
				<div className="panel-toolbar__spacer" />
				<div className="panel-toolbar__meta">
					カード総数: {cardCount}
					{filterActive ? `（表示: ${visibleCards.length}）` : ''}
					{cardCount > 0 && (
						<>
							{' | '}
							<span
								title="左側未トレースカード数をクリックでフィルタ / 右側未トレースカード数をクリックでフィルタ"
								style={{ display: 'inline-flex', gap: '0.5em', alignItems: 'center' }}
							>
								<span>未トレース:</span>
								<button
									type="button"
									className={`panel-toolbar__stat-button${untracedFilter === 'left' || untracedFilter === 'both' ? ' panel-toolbar__stat-button--active' : ''}`}
									onClick={() => {
										toggleUntracedFilter('left');
										onLog?.('INFO', `左側未トレースフィルタを${untracedFilter === 'left' ? '解除' : '適用'}しました。`);
									}}
									title="クリックして左側未トレースのみ表示"
									style={{
										background: 'transparent',
										border: 'none',
										cursor: 'pointer',
										textDecoration: untracedFilter === 'left' || untracedFilter === 'both' ? 'underline' : 'none',
										fontWeight: untracedFilter === 'left' || untracedFilter === 'both' ? 'bold' : 'normal',
										color: 'inherit',
										padding: '0',
									}}
								>
									{untracedLeftCount}
								</button>
								<span>/</span>
								<button
									type="button"
									className={`panel-toolbar__stat-button${untracedFilter === 'right' || untracedFilter === 'both' ? ' panel-toolbar__stat-button--active' : ''}`}
									onClick={() => {
										toggleUntracedFilter('right');
										onLog?.('INFO', `右側未トレースフィルタを${untracedFilter === 'right' ? '解除' : '適用'}しました。`);
									}}
									title="クリックして右側未トレースのみ表示"
									style={{
										background: 'transparent',
										border: 'none',
										cursor: 'pointer',
										textDecoration: untracedFilter === 'right' || untracedFilter === 'both' ? 'underline' : 'none',
										fontWeight: untracedFilter === 'right' || untracedFilter === 'both' ? 'bold' : 'normal',
										color: 'inherit',
										padding: '0',
									}}
								>
									{untracedRightCount}
								</button>
							</span>
						</>
					)}
				</div>
			</div>

			{/* カード一覧: 各カードをリスト表示 */}
			<div
				className="panel-cards"
				role="list"
				ref={panelScrollRef}
				id={activeTab ? `panel-${leafId}-${activeTab.id}` : undefined}
				onMouseDown={handlePanelBlankMouseDown}
			>
				{renderedCards.map((card) => (
					<CardListItem
						key={card.id}
						card={card}
						leafId={leafId}
						fileName={activeFileIdentifier}
						panelFocusState={panelFocusState}
						isSelected={selectedCardIds.has(card.id)}
						isExpanded={expandedCardIds.has(card.id)}
						hasChildren={card.child_ids.length > 0}
						isEditing={editingCardId === card.id}
						isDirty={dirtyCardIds.has(card.id)}
						displayMode={cardDisplayMode}
						onSelect={handleCardSelect}
						onKeyDown={handleCardKeyDown}
						onToggleExpand={() => {
							if (activeTabId) {
								useWorkspaceStore.getState().toggleCardExpanded(leafId, activeTabId, card.id);
							}
						}}
						onDoubleClick={handleCardDoubleClick}
						onUpdateCard={handleUpdateCard}
						onCancelEdit={handleCancelEdit}
						onDragStart={handleDragStart}
						onDragOver={handleDragOver}
						onDrop={handleDrop}
						onDragEnd={handleDragEnd}
						onContextMenu={handleCardContextMenu}
						panelScrollRef={panelScrollRef}
						currentDropTarget={visualDropTarget}
						draggedCardIds={draggedCardIds}
						highlightIds={highlightedIds}
						traceHighlightIds={combinedHighlightIds ?? undefined}
						leftTraceCount={activeFileName ? leftTraceCounts[card.id] ?? 0 : 0}
						rightTraceCount={activeFileName ? rightTraceCounts[card.id] ?? 0 : 0}
						connectorCount={activeFileName ? totalTraceCounts[card.id] ?? 0 : 0}
						leftConnectorVisible={getCardSideVisibility(card.id, 'left')}
						rightConnectorVisible={getCardSideVisibility(card.id, 'right')}
						markdownPreviewEnabled={card.markdownPreviewEnabled}
						isMarkdownPreviewGlobalEnabled={markdownPreviewGlobalEnabled}
						onToggleMarkdownPreview={() => handleCardMarkdownToggle(card.id)}
						onToggleLeftConnector={
							activeFileName && (leftTraceCounts[card.id] ?? 0) > 0
								? () => toggleCardTraceVisibility(activeFileName, card.id, 'left')
								: undefined
						}
						onToggleRightConnector={
							activeFileName && (rightTraceCounts[card.id] ?? 0) > 0
								? () => toggleCardTraceVisibility(activeFileName, card.id, 'right')
								: undefined
						}
					/>
				))}

				{/* センチネル要素（追加ロードのトリガー） */}
				{loadedCount < visibleCards.length && (
					<div
						ref={sentinelRef}
						className="load-more-sentinel"
						style={{ height: '1px', visibility: 'hidden' }}
						role="presentation"
					/>
				)}

				{/* ローディング表示 */}
				{isLoadingMore && (
					<div className="panel-cards__loading" role="status" aria-live="polite">
						読み込み中...
					</div>
				)}

				{renderedCards.length === 0 && cards.length > 0 && (
					<div className="panel-cards__empty" role="note">
						すべてのカードが折畳まれています。
					</div>
				)}
				{cards.length === 0 && (
					<div className="panel-cards__empty" role="note">
						表示するカードがありません。
					</div>
				)}
			</div>
			{contextMenu ? (
				<ContextMenu x={contextMenu.x} y={contextMenu.y} sections={contextMenuSections} onClose={handleCloseContextMenu} />
			) : null}

			{statsTargetCard ? (
				<CardStatsDialog
					card={statsTargetCard}
					leftTraceCount={leftTraceCounts[statsTargetCard.id] ?? 0}
					rightTraceCount={rightTraceCounts[statsTargetCard.id] ?? 0}
					onClose={() => setStatsTargetCardId(null)}
				/>
			) : null}

			{historyDialogCard && activeTab ? (
				<CardHistoryDialog
					card={historyDialogCard}
					fileName={activeTab.fileName ?? null}
					leafId={leafId}
					tabId={activeTab.id}
					cardIdentifier={historyDialogCard.cardId ?? historyDialogCard.id}
					isOpen={Boolean(historyDialogCard)}
					onClose={() => setHistoryDialogCardId(null)}
				/>
			) : null}

			{isMergeDialogOpen ? (
				<CardMergeDialog
					cards={mergeDialogCards}
					isOpen={isMergeDialogOpen}
					onCancel={handleMergeDialogCancel}
					onSubmit={handleMergeSubmit}
				/>
			) : null}

			<MatrixLaunchDialog
				isOpen={isMatrixDialogOpen}
				files={availableFiles}
				leftFile={matrixLeftFile}
				rightFile={matrixRightFile}
				error={matrixDialogError}
				onChangeLeft={setMatrixLeftFile}
				onChangeRight={setMatrixRightFile}
				onSwap={handleMatrixSwap}
				onSubmit={handleMatrixDialogSubmit}
				onClose={() => setMatrixDialogOpen(false)}
			/>

			{/* カードID接頭語一括編集ダイアログ */}
			{isBulkPrefixEditOpen ? (
				<div className="modal-overlay" onClick={handleBulkPrefixEditCancel}>
					<div className="modal-content" onClick={(e) => e.stopPropagation()}>
						<h2 className="modal-title">カードID接頭語一括編集</h2>
						<p className="modal-description">
							指定した接頭語を持つすべてのカードIDの接頭語を一括で変更します。
						</p>
						<div className="modal-form">
							<label className="modal-label">
								変更前の接頭語:
								<input
									type="text"
									className="modal-input"
									value={bulkPrefixOldValue}
									onChange={(e) => setBulkPrefixOldValue(e.target.value)}
									placeholder="例: REQ"
								/>
							</label>
							<label className="modal-label">
								変更後の接頭語:
								<input
									type="text"
									className="modal-input"
									value={bulkPrefixNewValue}
									onChange={(e) => setBulkPrefixNewValue(e.target.value)}
									placeholder="例: SPEC"
								/>
							</label>
						</div>
						<div className="modal-actions">
							<button
								type="button"
								className="modal-button modal-button--primary"
								onClick={handleBulkPrefixEditSave}
							>
								変更
							</button>
							<button
								type="button"
								className="modal-button modal-button--secondary"
								onClick={handleBulkPrefixEditCancel}
							>
								キャンセル
							</button>
						</div>
					</div>
				</div>
			) : null}
			{isExportDialogOpen && (
				<ExportDialog
					isOpen={isExportDialogOpen}
					onClose={() => setExportDialogOpen(false)}
					onExport={handleExport}
				/>
			)}
		</div>
	);
};

/**
 * @brief 編集可能なカードコンポーネントのプロパティ。
 */
interface EditableCardProps {
	card: Card;
	onSave: (cardId: string, patch: { title?: string; body?: string }) => void;
	onCancel: () => void;
}

/**
 * @brief 編集可能なカードコンポーネント。
 * @details
 * カードをインライン編集するためのUI。
 * タイトルと本文を編集可能で、Enter/Escapeキーによる確定/キャンセルに対応。
 */
const EditableCard = ({ card, onSave, onCancel }: EditableCardProps) => {
	const [title, setTitle] = useState(card.title);
	const [body, setBody] = useState(card.body);

	const handleTitleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
		setTitle(e.target.value);
	}, []);

	const handleBodyChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
		setBody(e.target.value);
	}, []);

	const handleSave = useCallback(() => {
		const patch: { title?: string; body?: string } = {};
		if (title !== card.title) {
			patch.title = title;
		}
		if (body !== card.body) {
			patch.body = body;
		}
		onSave(card.id, patch);
	}, [body, card.body, card.id, card.title, onSave, title]);

	const handleKeyDown = useCallback(
		(e: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				onCancel();
			} else if (e.key === 'Enter' && e.ctrlKey) {
				e.preventDefault();
				handleSave();
			}
		},
		[handleSave, onCancel],
	);

	//! 階層インデントのスタイル
	const indentStyle = { paddingLeft: `${12 + card.level * 24}px` };

	return (
		<article className="card card--editing" style={indentStyle} role="listitem">
			<header className="card__header">
				<span className="card__icon">{CARD_KIND_ICON[card.kind]}</span>
				<input
					type="text"
					className="card__title-input"
					value={title}
					onChange={handleTitleChange}
					onKeyDown={handleKeyDown}
					placeholder="カードタイトル"
					autoFocus
				/>
			</header>
			<textarea
				className="card__body-input"
				value={body}
				onChange={handleBodyChange}
				onKeyDown={handleKeyDown}
				placeholder="カード本文"
				rows={5}
			/>
			<p className="card__markdown-hint">Markdown記法に対応しています（例: **強調**, `コード`, - リスト）。</p>
			<footer className="card__footer card__footer--editing">
				<button type="button" className="card__button card__button--save" onClick={handleSave} title="保存 (Ctrl+Enter)">
					✓ 保存
				</button>
				<button type="button" className="card__button card__button--cancel" onClick={onCancel} title="キャンセル (Escape)">
					✕ キャンセル
				</button>
			</footer>
		</article>
	);
};

interface CardListItemProps {
	card: Card;
	isSelected: boolean; ///< 選択状態（複数選択対応）。
	isExpanded: boolean; ///< 展開状態（子を持つカードのみ有効）。
	hasChildren: boolean; ///< 子カードを持つかどうか。
	isEditing: boolean; ///< 編集モード中かどうか。
	isDirty: boolean;
	markdownPreviewEnabled: boolean;
	isMarkdownPreviewGlobalEnabled: boolean;
	leafId: string;
	fileName: string; ///< カードが属するファイル識別子（ファイル名またはタブID）。
	panelFocusState: PanelVisualState;
	displayMode: 'detailed' | 'compact'; ///< カード表示モード。
	panelScrollRef: React.RefObject<HTMLDivElement | null>;
	onSelect: (card: Card, event?: React.MouseEvent) => void; ///< 選択ハンドラ（イベント情報で複数選択判定）。
	onKeyDown: (event: ReactKeyboardEvent<HTMLElement>, card: Card) => void;
	onToggleExpand: () => void; ///< 展開/折畳トグルコールバック。
	onDoubleClick: (card: Card) => void; ///< ダブルクリックハンドラ（編集モード移行）。
	onUpdateCard: (cardId: string, patch: CardPatch) => void; ///< カード更新ハンドラ。
	onCancelEdit: () => void; ///< 編集キャンセルハンドラ。
	onDragStart?: (cardId: string) => void; ///< ドラッグ開始ハンドラ。
	onDragOver?: (cardId: string, position: 'before' | 'after' | 'child') => void; ///< ドラッグオーバーハンドラ。
	onDrop?: () => void; ///< ドロップハンドラ。
	onDragEnd?: () => void; ///< ドラッグ終了ハンドラ。
	onContextMenu?: (card: Card, event: React.MouseEvent) => void; ///< コンテキストメニューハンドラ。
	currentDropTarget?: { cardId: string | null; position: InsertPosition } | null;
	draggedCardIds?: string[];
	highlightIds?: Set<string>;
	traceHighlightIds?: Set<string> | null;
	leftTraceCount: number;
	rightTraceCount: number;
	connectorCount: number;
	leftConnectorVisible: boolean;
	rightConnectorVisible: boolean;
	onToggleLeftConnector?: () => void;
	onToggleRightConnector?: () => void;
	onToggleMarkdownPreview: () => void;
}

/**
 * @brief カードリストアイテムコンポーネント。
 * @details
 * React.memoで包んでおり、カスタム比較関数により不要な再レンダリングを防ぐ。
 * カードの状態変更、選択状態変更、表示モード変更などの重要な変更時のみ再レンダリングされる。
 */
const CardListItem = React.memo(({
	card,
	isSelected,
	isExpanded,
	hasChildren,
	isEditing,
	isDirty,
	markdownPreviewEnabled,
	isMarkdownPreviewGlobalEnabled,
	leafId,
	fileName,
	panelFocusState,
	displayMode,
	panelScrollRef,
	onSelect,
	onKeyDown,
	onToggleExpand,
	onDoubleClick,
	onUpdateCard,
	onCancelEdit,
	onDragStart,
	onDragOver,
	onDrop,
	onDragEnd,
	onContextMenu,
	currentDropTarget,
	draggedCardIds,
	highlightIds,
	traceHighlightIds,
	leftTraceCount,
	rightTraceCount,
	connectorCount,
	leftConnectorVisible,
	rightConnectorVisible,
	onToggleLeftConnector,
	onToggleRightConnector,
	onToggleMarkdownPreview,
}: CardListItemProps) => {
	const anchorRef = useCardConnectorAnchor({ cardId: card.id, leafId, fileName, scrollContainerRef: panelScrollRef });

	// 現在のタブのカード一覧を取得（重複チェック用）
	const allCardsInTab = useWorkspaceStore(
		useCallback((state) => {
			const leaf = state.leafs[leafId];
			if (!leaf || !leaf.activeTabId) {
				return [];
			}
			const tab = state.tabs[leaf.activeTabId];
			return tab?.cards ?? [];
		}, [leafId]),
	);

	// カードID編集用のローカルstate
	const [isEditingCardId, setIsEditingCardId] = useState(false);
	const [editingCardIdValue, setEditingCardIdValue] = useState('');
	const [cardIdError, setCardIdError] = useState<string | null>(null);
	const cardIdInputRef = useRef<HTMLInputElement>(null);

	// カードID編集開始
	const handleCardIdClick = (event: React.MouseEvent) => {
		event.stopPropagation();
		setIsEditingCardId(true);
		setEditingCardIdValue(card.cardId || '');
		setCardIdError(null);
	};

	// カードID編集のキーダウンハンドラ
	const handleCardIdKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			event.stopPropagation();
			handleCardIdSave();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			handleCardIdCancel();
		}
	};

	// カードID保存
	const handleCardIdSave = () => {
		const newCardId = editingCardIdValue.trim();

		// 空文字の場合は許可（ID削除）
		if (!newCardId) {
			onUpdateCard(card.id, { cardId: undefined });
			setIsEditingCardId(false);
			setCardIdError(null);
			return;
		}

		// 重複チェック（自分自身以外）
		const isDuplicate = allCardsInTab.some(
			(c) => c.id !== card.id && c.cardId === newCardId,
		);

		if (isDuplicate) {
			setCardIdError(`ID "${newCardId}" は既に使用されています`);
			return;
		}

		// 保存
		onUpdateCard(card.id, { cardId: newCardId });
		setIsEditingCardId(false);
		setCardIdError(null);
	};

	// カードID編集キャンセル
	const handleCardIdCancel = () => {
		setIsEditingCardId(false);
		setEditingCardIdValue('');
		setCardIdError(null);
	};

	// カードID編集中にフォーカスを外した時の処理
	const handleCardIdBlur = () => {
		// わずかに遅延させてクリックイベントが完了するのを待つ
		setTimeout(() => {
			// エラーがある場合はキャンセル
			if (cardIdError) {
				handleCardIdCancel();
			} else {
				handleCardIdSave();
			}
		}, 100);
	};

	// カードID編集モードに入ったときにinputにフォーカス
	useEffect(() => {
		if (isEditingCardId && cardIdInputRef.current) {
			cardIdInputRef.current.focus();
			cardIdInputRef.current.select();
		}
	}, [isEditingCardId]);

	const renderConnector = (
		side: TraceConnectorSide,
		hasTrace: boolean,
		count: number,
		isVisible: boolean,
		onToggle?: () => void,
	) => {
		const isActive = hasTrace && count > 0;
		const className = [
			'card__connector-button',
			isActive ? 'card__connector--active' : '',
			isVisible ? '' : 'card__connector--muted',
		]
			.filter(Boolean)
			.join(' ');
		const title = side === 'left' ? '左側トレース接合点' : '右側トレース接合点';

		return (
			<button
				type="button"
				className={className}
				onClick={(event) => {
					event.stopPropagation();
					onToggle?.();
				}}
				onFocus={(event) => event.stopPropagation()}
				disabled={!onToggle || count === 0}
				aria-disabled={!onToggle || count === 0}
				aria-pressed={isVisible}
				title={`${title}${count > 0 ? ` (${count})` : ''}`}
			>
				{connectorSymbol(isActive)}
				{count > 0 ? <span className="card__connector-count">{count}</span> : null}
			</button>
		);
	};

	const totalCount = connectorCount ?? 0;
	const leftConnectorNode = renderConnector('left', card.hasLeftTrace, totalCount, leftConnectorVisible, onToggleLeftConnector);
	const rightConnectorNode = renderConnector('right', card.hasRightTrace, totalCount, rightConnectorVisible, onToggleRightConnector);
	const shouldRenderMarkdown = markdownPreviewEnabled && isMarkdownPreviewGlobalEnabled;
	const markdownHtml = useMemo(() => (shouldRenderMarkdown ? renderMarkdownToHtml(card.body) : null), [card.body, shouldRenderMarkdown]);

	const markdownButton = (
		<button
			type="button"
			className={`card__markdown-button${markdownPreviewEnabled ? ' card__markdown-button--active' : ''}`}
			onClick={(event) => {
				event.stopPropagation();
				onToggleMarkdownPreview();
			}}
			aria-pressed={markdownPreviewEnabled}
			title="Markdownプレビュー切替"
		>
			MD
		</button>
	);

	//! 編集モードの場合はEditableCardを表示
	if (isEditing) {
		return <EditableCard card={card} onSave={onUpdateCard} onCancel={onCancelEdit} />;
	}

	//! 階層インデントのスタイル
	const indentStyle = { paddingLeft: `${12 + card.level * 24}px` };
	const dropBefore = currentDropTarget?.cardId === card.id && currentDropTarget.position === 'before';
	const dropAfter = currentDropTarget?.cardId === card.id && currentDropTarget.position === 'after';
	const dropChild = currentDropTarget?.cardId === card.id && currentDropTarget.position === 'child';
	const isDragging = draggedCardIds?.includes(card.id) ?? false;
	const isHighlighted = highlightIds?.has(card.id) ?? false;
	const isTraceHighlighted = traceHighlightIds?.has(card.id) ?? false;
	const baseClass = displayMode === 'compact' ? 'card card--compact' : 'card';
	const selectionClass = isSelected
		? panelFocusState === 'active'
			? 'card--selected-primary'
			: panelFocusState === 'semiActive'
				? 'card--selected-secondary'
				: 'card--selected-inactive'
		: '';
	const articleClassName = [
		baseClass,
		selectionClass,
		isDirty ? 'card--dirty' : '',
		isDragging ? 'card--dragging' : '',
		dropChild ? 'card--drop-child' : '',
		isHighlighted ? 'card--highlighted' : '',
		isTraceHighlighted ? 'card--trace-related' : '',
	]
		.filter(Boolean)
		.join(' ');

	const handleDragStartInternal = (event: React.DragEvent<HTMLElement>) => {
		if (!onDragStart) {
			return;
		}
		event.stopPropagation();
		event.dataTransfer.effectAllowed = 'move';
		onDragStart(card.id);
	};

	const handleDragOverInternal = (event: React.DragEvent<HTMLElement>) => {
		if (!onDragOver) {
			return;
		}
		event.preventDefault();
		const rect = event.currentTarget.getBoundingClientRect();
		const offsetY = event.clientY - rect.top;
		const threshold = rect.height * 0.25;
		let position: InsertPosition = 'child';
		if (offsetY < threshold) {
			position = 'before';
		} else if (offsetY > rect.height - threshold) {
			position = 'after';
		}
		onDragOver(card.id, position);
	};

	const handleDropInternal = (event: React.DragEvent<HTMLElement>) => {
		if (!onDrop) {
			return;
		}
		event.preventDefault();
		onDrop();
	};

	//! 展開/折畳ボタン
	const expandButton = hasChildren ? (
		<button
			type="button"
			className="card__expand-button"
			onClick={(e) => {
				e.stopPropagation();
				onToggleExpand();
			}}
			aria-label={isExpanded ? '折畳' : '展開'}
			title={isExpanded ? '折畳' : '展開'}
		>
			{isExpanded ? '▼' : '▶'}
		</button>
	) : (
		<span className="card__expand-placeholder" />
	);

	const isCompact = displayMode === 'compact';
	const compactTooltip = isCompact && card.body ? card.body : undefined;

	// カードID表示/編集コンポーネント
	const renderCardId = () => {
		if (isEditingCardId) {
			return (
				<span
					className="card__card-id-edit-container"
					onClick={(e) => e.stopPropagation()}
					onMouseDown={(e) => e.stopPropagation()}
					onDoubleClick={(e) => e.stopPropagation()}
				>
					<input
						ref={cardIdInputRef}
						type="text"
						className={`card__card-id-input${cardIdError ? ' card__card-id-input--error' : ''}`}
						value={editingCardIdValue}
						onChange={(e) => setEditingCardIdValue(e.target.value)}
						onKeyDown={handleCardIdKeyDown}
						onBlur={handleCardIdBlur}
						onMouseDown={(e) => e.stopPropagation()}
						onClick={(e) => e.stopPropagation()}
						placeholder="ID未設定"
						title={cardIdError || undefined}
					/>
					{cardIdError && (
						<span className="card__card-id-error" title={cardIdError}>
							⚠
						</span>
					)}
				</span>
			);
		}
		if (card.cardId) {
			return (
				<span
					className="card__card-id card__card-id--editable"
					onClick={handleCardIdClick}
					title="クリックして編集"
				>
					[{card.cardId}]
				</span>
			);
		}
		return (
			<span
				className="card__card-id card__card-id--empty card__card-id--editable"
				onClick={handleCardIdClick}
				title="クリックしてIDを設定"
			>
				[ID未設定]
			</span>
		);
	};

	const articleContent = isCompact
		? (
			<>
				{expandButton}
				{leftConnectorNode}
				<span className="card__icon">{CARD_KIND_ICON[card.kind]}</span>
				<span className={CARD_STATUS_CLASS[card.status]}>{CARD_STATUS_LABEL[card.status]}</span>
				{renderCardId()}
				<span className="card__title card__title--truncate">{card.title}</span>
				{markdownButton}
				{rightConnectorNode}
			</>
		)
		: (
			<>
				<header className="card__header">
					{expandButton}
					{leftConnectorNode}
					<span className="card__icon">{CARD_KIND_ICON[card.kind]}</span>
					<span className={CARD_STATUS_CLASS[card.status]}>{CARD_STATUS_LABEL[card.status]}</span>
					{renderCardId()}
					<span className="card__title">{card.title}</span>
					{markdownButton}
					{rightConnectorNode}
				</header>
				{shouldRenderMarkdown ? (
					<div className="card__body card__body--markdown" dangerouslySetInnerHTML={{ __html: markdownHtml ?? '' }} />
				) : (
					<p className="card__body">{card.body}</p>
				)}
				<footer className="card__footer">最終更新: {formatUpdatedAt(card.updatedAt)}</footer>
			</>
		);

	return (
		<div className="card-list-item" data-card-id={card.id}>
			{dropBefore ? (
				<div className="card__drop-indicator card__drop-indicator--before" role="presentation">
					<span className="card__drop-indicator-label">ここに挿入（前）</span>
				</div>
			) : null}
			<article
				className={articleClassName}
				style={indentStyle}
				aria-selected={isSelected}
				role="listitem"
				tabIndex={0}
				data-tooltip={compactTooltip}
				ref={anchorRef}
				draggable={Boolean(onDragStart)}
				onDragStart={handleDragStartInternal}
				onDragOver={handleDragOverInternal}
				onDrop={handleDropInternal}
				onDragEnd={() => {
					onDragEnd?.();
				}}
				onClick={(event) => onSelect(card, event)}
				onDoubleClick={() => onDoubleClick(card)}
				onKeyDown={(event) => onKeyDown(event, card)}
				onContextMenu={(event) => {
					if (onContextMenu) {
						event.preventDefault();
						onContextMenu(card, event);
					}
				}}
			>
				{articleContent}
				{dropChild ? (
					<div className="card__drop-child-overlay" role="presentation">
						<span className="card__drop-child-label">子として追加</span>
					</div>
				) : null}
			</article>
			{dropAfter ? (
				<div className="card__drop-indicator card__drop-indicator--after" role="presentation">
					<span className="card__drop-indicator-label">ここに挿入（後）</span>
				</div>
			) : null}
		</div>
	);
}, (prevProps, nextProps) => {
	// カスタム比較関数: 変更がない場合にtrueを返して再レンダリングをスキップ

	// カード本体の変更チェック
	if (prevProps.card.id !== nextProps.card.id) return false;
	if (prevProps.card.cardId !== nextProps.card.cardId) return false;
	if (prevProps.card.updatedAt !== nextProps.card.updatedAt) return false;
	if (prevProps.card.title !== nextProps.card.title) return false;
	if (prevProps.card.body !== nextProps.card.body) return false;
	if (prevProps.card.status !== nextProps.card.status) return false;
	if (prevProps.card.kind !== nextProps.card.kind) return false;
	if (prevProps.card.level !== nextProps.card.level) return false;
	if (prevProps.card.hasLeftTrace !== nextProps.card.hasLeftTrace) return false;
	if (prevProps.card.hasRightTrace !== nextProps.card.hasRightTrace) return false;

	// 状態フラグの変更チェック
	if (prevProps.isSelected !== nextProps.isSelected) return false;
	if (prevProps.isExpanded !== nextProps.isExpanded) return false;
	if (prevProps.hasChildren !== nextProps.hasChildren) return false;
	if (prevProps.isEditing !== nextProps.isEditing) return false;
	if (prevProps.isDirty !== nextProps.isDirty) return false;
	if (prevProps.markdownPreviewEnabled !== nextProps.markdownPreviewEnabled) return false;
	if (prevProps.isMarkdownPreviewGlobalEnabled !== nextProps.isMarkdownPreviewGlobalEnabled) return false;

	// 表示設定の変更チェック
	if (prevProps.displayMode !== nextProps.displayMode) return false;
	if (prevProps.panelFocusState !== nextProps.panelFocusState) return false;

	// トレース情報の変更チェック
	if (prevProps.leftTraceCount !== nextProps.leftTraceCount) return false;
	if (prevProps.rightTraceCount !== nextProps.rightTraceCount) return false;
	if (prevProps.leftConnectorVisible !== nextProps.leftConnectorVisible) return false;
	if (prevProps.rightConnectorVisible !== nextProps.rightConnectorVisible) return false;

	// ドラッグ&ドロップ状態の変更チェック
	const isDraggingPrev = prevProps.draggedCardIds?.includes(prevProps.card.id) ?? false;
	const isDraggingNext = nextProps.draggedCardIds?.includes(nextProps.card.id) ?? false;
	if (isDraggingPrev !== isDraggingNext) return false;

	const isDropTargetPrev = prevProps.currentDropTarget?.cardId === prevProps.card.id;
	const isDropTargetNext = nextProps.currentDropTarget?.cardId === nextProps.card.id;
	if (isDropTargetPrev !== isDropTargetNext) return false;
	if (isDropTargetPrev && isDropTargetNext) {
		if (prevProps.currentDropTarget?.position !== nextProps.currentDropTarget?.position) return false;
	}

	// ハイライト状態の変更チェック
	const isHighlightedPrev = prevProps.highlightIds?.has(prevProps.card.id) ?? false;
	const isHighlightedNext = nextProps.highlightIds?.has(nextProps.card.id) ?? false;
	if (isHighlightedPrev !== isHighlightedNext) return false;

	const isTraceHighlightedPrev = prevProps.traceHighlightIds?.has(prevProps.card.id) ?? false;
	const isTraceHighlightedNext = nextProps.traceHighlightIds?.has(nextProps.card.id) ?? false;
	if (isTraceHighlightedPrev !== isTraceHighlightedNext) return false;

	// 識別子の変更チェック
	if (prevProps.leafId !== nextProps.leafId) return false;
	if (prevProps.fileName !== nextProps.fileName) return false;

	// コールバック関数は参照が変わっても機能的には同じなので比較しない
	// （親コンポーネントでuseCallbackを使用することで安定化する）

	// すべてのチェックをパスした場合、再レンダリング不要
	return true;
});
