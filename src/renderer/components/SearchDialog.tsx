import { nanoid } from 'nanoid';
import type { FC, FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdvancedSearchBuilder, type ConditionRow } from './AdvancedSearchBuilder';
import {
  runSearch,
  type AdvancedQuery,
  type SearchDataset,
  type SearchMode,
  type SearchRequest,
  type SearchResult,
  type SearchScope,
} from '../utils/search';
import { useSearchStore } from '../store/searchStore';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useSplitStore } from '../store/splitStore';
import { useTraceStore } from '../store/traceStore';

export interface SearchDialogProps {
  isOpen?: boolean;
  onClose?: () => void;
  onNavigate: (result: SearchResult) => void;
  executeSearch?: (request: SearchRequest) => Promise<{ results: SearchResult[]; error: string | null }>;
}

const MODE_LABELS: Record<SearchMode, string> = {
  text: 'キーワード',
  regex: '正規表現',
  id: 'ID',
  trace: 'トレース',
  advanced: '高度',
};

const deriveLabel = (request: SearchRequest): string => {
  if (request.mode === 'advanced') {
    return '高度検索';
  }
  if (request.mode === 'trace') {
    return `トレース: ${request.text ?? ''}`.trim();
  }
  return `${MODE_LABELS[request.mode]}: ${request.text ?? ''}`.trim() || MODE_LABELS[request.mode];
};

export const SearchDialog: FC<SearchDialogProps> = ({
  isOpen: controlledOpen,
  onClose,
  onNavigate,
  executeSearch,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const {
    isOpen: storeOpen,
    open,
    close,
    sessions,
    activeSessionId,
    addSession,
    activateSession,
    removeSession,
    draftText,
    setDraftText,
  } = useSearchStore();

  const isOpen = controlledOpen ?? storeOpen;

  const [mode, setMode] = useState<SearchMode>('text');
  const [scope, setScope] = useState<SearchScope>('current');
  const [useRegex, setUseRegex] = useState(false);
  const [advancedRows, setAdvancedRows] = useState<ConditionRow[]>([]);
  const [advancedCombinator, setAdvancedCombinator] = useState<'AND' | 'OR'>('AND');
  const [traceDepth, setTraceDepth] = useState<number>(1);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (controlledOpen === undefined) {
      return;
    }
    if (controlledOpen) {
      open();
    } else {
      close();
    }
  }, [controlledOpen, open, close]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }, [isOpen]);

  const activeSession = useMemo(() => {
    if (activeSessionId) {
      return sessions.find((s) => s.id === activeSessionId) ?? null;
    }
    return sessions.length > 0 ? sessions[0] : null;
  }, [activeSessionId, sessions]);

  const displayedResults = activeSession?.results ?? [];

  const defaultExecutor = useCallback(
    async (request: SearchRequest) => {
      const datasets: SearchDataset[] = [];
      const state = useWorkspaceStore.getState();
      const splitState = useSplitStore.getState();

      if (request.scope === 'current') {
        const leafId = splitState.activeLeafId;
        if (!leafId) {
          return { results: [], error: '検索対象のカードパネルが選択されていません。' };
        }
        const leaf = state.leafs[leafId];
        const tabId = leaf?.activeTabId;
        if (!tabId) {
          return { results: [], error: 'アクティブなカードファイルがありません。' };
        }
        const tab = state.tabs[tabId];
        if (!tab) {
          return { results: [], error: 'アクティブタブが見つかりません。' };
        }
        datasets.push({ source: 'open', tabId, leafId, fileName: tab.fileName, cards: tab.cards });
      } else if (request.scope === 'open') {
        Object.values(state.tabs).forEach((tab) => {
          datasets.push({
            source: 'open',
            tabId: tab.id,
            leafId: tab.leafId,
            fileName: tab.fileName,
            cards: tab.cards,
          });
        });
        if (datasets.length === 0) {
          return { results: [], error: '開いているカードファイルがありません。' };
        }
      } else {
        if (!window.app?.workspace?.loadCardFile) {
          return { results: [], error: 'カードファイル読み込み機能が利用できません。' };
        }
        const listApi = window.app.workspace.listCardFiles?.bind(window.app.workspace);
        const fileList = listApi ? await listApi() : [];
        for (const fileName of fileList) {
          try {
            const snapshot = await window.app.workspace.loadCardFile(fileName);
            if (snapshot?.cards) {
              datasets.push({ source: 'input', fileName, cards: snapshot.cards });
            }
          } catch (loadError) {
            console.error('[SearchDialog] failed to load card file', fileName, loadError);
          }
        }
        if (datasets.length === 0) {
          return { results: [], error: '検索対象となるカードファイルがありません。' };
        }
      }

      const { results, seeds, error: searchError } = await runSearch(request, datasets, {
        traceResolver: async (seedList, depth) => {
          return useTraceStore.getState().getRelatedCardsWithDepth(seedList, depth);
        },
      });

      if (!searchError && seeds.length > 0) {
        // トレース探索用の種をキャッシュに残したい場合の拡張余地
      }
      return { results, error: searchError };
    },
    [],
  );

  const executor = executeSearch ?? defaultExecutor;

  const buildRequest = (): SearchRequest => {
    const base: SearchRequest = {
      id: nanoid(),
      scope,
      mode,
      text: mode === 'advanced' ? undefined : draftText,
      useRegex,
    };

    if (mode === 'advanced') {
      const advanced: AdvancedQuery = {
        combinator: advancedCombinator,
        conditions: advancedRows.map((row) => ({
          field: row.field,
          operator: row.operator,
          value: row.value,
        })),
        trace: traceDepth ? { depth: traceDepth } : undefined,
      };
      base.advanced = advanced;
    }

    if (mode === 'trace') {
      base.trace = { depth: traceDepth };
    }

    return base;
  };

  const handleSubmit = useCallback(
    async (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      setSubmitting(true);
      setError(null);
      try {
        const request = buildRequest();
        const { results, error: searchError } = await executor(request);
        const label = deriveLabel(request);
        addSession({
          id: request.id,
          label,
          request,
          results,
          error: searchError,
          createdAt: Date.now(),
        });
        setError(searchError ?? (results.length === 0 ? '該当するカードがありません。' : null));
      } catch (submitError) {
        console.error('[SearchDialog] search failed', submitError);
        setError('検索処理中にエラーが発生しました。');
      } finally {
        setSubmitting(false);
      }
    },
    [addSession, executor, buildRequest],
  );

  const handleClose = useCallback(() => {
    close();
    onClose?.();
  }, [close, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="search-dialog" role="dialog" aria-modal="false" aria-label="検索ダイアログ">
      <div className="search-dialog__header">
        <h2>検索</h2>
        <div className="search-dialog__modes" role="tablist" aria-label="検索モード">
          {(Object.keys(MODE_LABELS) as SearchMode[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              className={`search-dialog__mode${mode === key ? ' is-active' : ''}`}
              onClick={() => setMode(key)}
            >
              {MODE_LABELS[key]}
            </button>
          ))}
        </div>
        <button type="button" className="search-dialog__close" onClick={handleClose} aria-label="検索ダイアログを閉じる">
          ✕
        </button>
      </div>

      <form className="search-dialog__form" onSubmit={handleSubmit}>
        <label className="search-dialog__field">
          <span className="search-dialog__label">キーワード</span>
          <input
            ref={inputRef}
            aria-label="検索キーワード"
            type="search"
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            disabled={mode === 'advanced'}
          />
        </label>

        <div className="search-dialog__controls">
          <label className="search-dialog__control">
            <span className="search-dialog__label">範囲</span>
            <select value={scope} onChange={(event) => setScope(event.target.value as SearchScope)} aria-label="検索範囲">
              <option value="current">アクティブタブ</option>
              <option value="open">開いているタブ</option>
              <option value="input">_input ディレクトリ</option>
            </select>
          </label>

          <label className="search-dialog__control search-dialog__checkbox">
            <input
              type="checkbox"
              checked={useRegex}
              onChange={(event) => setUseRegex(event.target.checked)}
              disabled={mode === 'id' || mode === 'trace'}
            />
            <span>正規表現</span>
          </label>

          <label className="search-dialog__control search-dialog__number">
            <span className="search-dialog__label">深さ</span>
            <input
              type="number"
              min={1}
              max={5}
              value={traceDepth}
              onChange={(event) => setTraceDepth(Number(event.target.value) || 1)}
              disabled={mode !== 'trace' && mode !== 'advanced'}
            />
          </label>

          <button type="submit" className="search-dialog__submit" disabled={isSubmitting}>
            {isSubmitting ? '検索中…' : '検索'}
          </button>
        </div>

        {mode === 'advanced' ? (
          <AdvancedSearchBuilder
            conditions={advancedRows}
            combinator={advancedCombinator}
            traceDepth={traceDepth}
            onConditionsChange={setAdvancedRows}
            onCombinatorChange={setAdvancedCombinator}
            onTraceDepthChange={setTraceDepth}
          />
        ) : null}
      </form>

      <div className="search-dialog__body">
        <div className="search-dialog__history" role="tablist" aria-label="検索履歴">
          {sessions.map((session) => (
            <div
              key={session.id}
              role="tab"
              tabIndex={0}
              aria-selected={activeSession?.id === session.id}
              className={`search-dialog__history-tab${activeSession?.id === session.id ? ' is-active' : ''}`}
              onClick={() => activateSession(session.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  activateSession(session.id);
                }
              }}
            >
              <span className="search-dialog__history-label">{session.label}</span>
              <button
                type="button"
                className="search-dialog__history-close"
                aria-label="検索結果を閉じる"
                onClick={(event) => {
                  event.stopPropagation();
                  removeSession(session.id);
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="search-dialog__status">
          {error ? <span className="search-dialog__status--error">{error}</span> : null}
          {!error && isSubmitting ? <span>検索中...</span> : null}
          {!error && !isSubmitting && displayedResults.length === 0 ? <span>まだ検索結果はありません</span> : null}
          {!error && displayedResults.length > 0 ? <span>{displayedResults.length}件ヒット</span> : null}
        </div>

        <div className="search-dialog__results" aria-label="検索結果">
          {displayedResults.map((result) => (
            <button
              key={result.id}
              type="button"
              className="search-dialog__result"
              onClick={() => onNavigate(result)}
            >
              <div className="search-dialog__result-meta">
                <span className="search-dialog__badge">{result.source}</span>
                <span className="search-dialog__file">{result.fileName ?? '未保存ファイル'}</span>
                <span className="search-dialog__count">{result.matchCount}件</span>
              </div>
              <div className="search-dialog__result-title">{result.cardTitle || '(無題)'}</div>
              <div className="search-dialog__result-snippet">{result.snippet}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
