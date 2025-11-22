import { nanoid } from 'nanoid';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { SearchMode, SearchRequest, SearchResult, SearchScope } from '@/shared/search';
import { applyThemeColors, applyTypography, applySplitterWidth } from '../utils/themeUtils';
import { defaultSettings } from '@/shared/settings';
import type { ThemeSettings } from '@/shared/settings';
import { AdvancedSearchBuilder, type ConditionRow } from '../components/AdvancedSearchBuilder';

type Status = 'idle' | 'loading' | 'error' | 'ready';

const MODE_LABELS: Record<SearchMode, string> = {
  text: 'キーワード',
  regex: '正規表現',
  id: 'ID',
  trace: 'トレース',
  advanced: '高度',
};

const SCOPE_LABELS: Record<SearchScope, string> = {
  current: 'アクティブタブ',
  open: '開いているタブ',
  input: 'すべて',
};

const API_ORIGIN = (port: number | null) => `http://127.0.0.1:${port ?? 0}`;

export const SearchApp = () => {
  const [mode, setMode] = useState<SearchMode>('text');
  const [scope, setScope] = useState<SearchScope>('current');
  const [keyword, setKeyword] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [traceDepth, setTraceDepth] = useState(1);
  const [conditions, setConditions] = useState<ConditionRow[]>([]);
  const [combinator, setCombinator] = useState<'AND' | 'OR'>('AND');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [port, setPort] = useState<number | null>(null);
  const [history, setHistory] = useState<
    { id: string; label: string; request: SearchRequest; results: SearchResult[] }[]
  >([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeResultId, setActiveResultId] = useState<string | null>(null);
  const resolveThemeMode = (mode: 'light' | 'dark' | 'system'): 'light' | 'dark' => {
    if (mode === 'system') {
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return mode === 'dark' ? 'dark' : 'light';
  };

  useEffect(() => {
    void (async () => {
      const info = await window.app.search.getServerInfo();
      setPort(info.port);
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const settings = await window.app.settings.load();
        const themeMode = resolveThemeMode(settings.theme.mode ?? defaultSettings.theme.mode);
        const colors = themeMode === 'dark' ? settings.theme.dark : settings.theme.light;
        applyThemeColors(colors);
        applyTypography(settings.theme.fontSize, settings.theme.fontFamily);
        applySplitterWidth(settings.theme.splitterWidth);
        if (themeMode === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (err) {
        console.error('[SearchApp] failed to apply theme', err);
      }
    })();
    const unsubscribe = window.app.theme.onChanged((theme: ThemeSettings['theme']) => {
      const mode = resolveThemeMode(theme.mode ?? defaultSettings.theme.mode);
      const colors = mode === 'dark' ? theme.dark : theme.light;
      applyThemeColors(colors);
      applyTypography(theme.fontSize, theme.fontFamily);
      applySplitterWidth(theme.splitterWidth);
      if (mode === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    });
    return () => {
      unsubscribe?.();
    };
  }, []);

  const requestBody = useMemo<SearchRequest>(() => {
    const base: SearchRequest = {
      id: nanoid(),
      scope,
      mode,
      text: mode === 'advanced' ? undefined : keyword,
      useRegex,
    };
    if (mode === 'advanced') {
      base.advanced = {
        combinator,
        conditions: conditions.map((c) => ({ field: c.field, operator: c.operator, value: c.value })),
        trace: { depth: traceDepth },
      };
    }
    if (mode === 'trace') {
      base.trace = { depth: traceDepth };
    }
    return base;
  }, [combinator, conditions, keyword, mode, scope, traceDepth, useRegex]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!port) {
      setError('検索サーバが起動していません。');
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch(`${API_ORIGIN(port)}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? '検索に失敗しました。');
        setStatus('error');
        return;
      }
      const nextResults: SearchResult[] = json.results ?? [];
      setResults(nextResults);
      const sessionId = requestBody.id ?? nanoid();
      const label = `${MODE_LABELS[mode]}: ${requestBody.text ?? '(条件指定)'}`;
      setHistory((prev) => [{ id: sessionId, label, request: requestBody, results: nextResults }, ...prev].slice(0, 10));
      setActiveSessionId(sessionId);
      setActiveResultId(null);
      setStatus('ready');
    } catch (err) {
      console.error('[SearchApp] search failed', err);
      setError('検索処理中にエラーが発生しました。');
      setStatus('error');
    }
  };

  const handleFocus = async (item: SearchResult) => {
    if (!port) {
      return;
    }
    setActiveResultId(item.id);
    try {
      await fetch(`${API_ORIGIN(port)}/api/focus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: item.fileName, cardId: item.cardId, tabId: item.tabId }),
      });
    } catch (err) {
      console.error('[SearchApp] focus failed', err);
    }
  };

  return (
    <div className="search-window">
      <header className="search-window__header">
        <h1>検索</h1>
        <div className="search-window__port">API Port: {port ?? '---'}</div>
      </header>

      <form className="search-window__form" onSubmit={handleSubmit}>
        <div className="search-window__row">
          <label className="search-window__field search-window__field--narrow">
            <span>範囲</span>
            <select value={scope} onChange={(e) => setScope(e.target.value as SearchScope)}>
              {(Object.keys(SCOPE_LABELS) as SearchScope[]).map((s) => (
                <option key={s} value={s}>
                  {SCOPE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="search-window__field search-window__field--wide">
            <span>キーワード</span>
            <div className="search-window__keyword">
              <input
                type="search"
                placeholder="キーワードを入力"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                disabled={mode === 'advanced'}
              />
              <label className="search-window__checkbox-inline">
                <input
                  type="checkbox"
                  checked={useRegex}
                  onChange={(e) => setUseRegex(e.target.checked)}
                  disabled={mode !== 'regex' && mode !== 'text'}
                />
                <span>正規表現</span>
              </label>
            </div>
          </label>

          <label className="search-window__field search-window__field--narrow">
            <span>検索モード</span>
            <select value={mode} onChange={(e) => setMode(e.target.value as SearchMode)}>
              {(Object.keys(MODE_LABELS) as SearchMode[]).map((m) => (
                <option key={m} value={m}>
                  {MODE_LABELS[m]}
                </option>
              ))}
            </select>
          </label>

          <label className="search-window__field search-window__field--narrow">
            <span>深さ</span>
            <input
              type="number"
              min={1}
              max={5}
              value={traceDepth}
              onChange={(e) => setTraceDepth(Number(e.target.value) || 1)}
              disabled={mode !== 'trace' && mode !== 'advanced'}
            />
          </label>

          <button className="search-window__submit" type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? '検索中…' : '検索'}
          </button>
        </div>

        {mode === 'advanced' ? (
          <AdvancedSearchBuilder
            conditions={conditions}
            combinator={combinator}
            traceDepth={traceDepth}
            onConditionsChange={setConditions}
            onCombinatorChange={setCombinator}
            onTraceDepthChange={setTraceDepth}
          />
        ) : null}
      </form>

      <div className="search-window__status">
        {error ? <span className="search-window__error">{error}</span> : null}
        {!error && status === 'loading' ? <span>検索中...</span> : null}
        {!error && status === 'ready' ? <span>{results.length}件ヒット</span> : null}
      </div>

      <div className="search-window__history" role="tablist" aria-label="検索履歴">
        {history.map((h) => (
          <button
            key={h.id}
            type="button"
            role="tab"
            aria-selected={activeSessionId === h.id}
            className={`search-window__history-tab${activeSessionId === h.id ? ' is-active' : ''}`}
            onClick={() => {
              setActiveSessionId(h.id);
              setResults(h.results);
              setActiveResultId(null);
            }}
          >
            <span className="search-window__history-label">{h.label}</span>
            <span className="search-window__history-count">{h.results.length}</span>
            <span
              role="button"
              tabIndex={0}
              className="search-window__history-close"
              aria-label="履歴を削除"
              onClick={(e) => {
                e.stopPropagation();
                setHistory((prev) => prev.filter((item) => item.id !== h.id));
                if (activeSessionId === h.id) {
                  const next = history.filter((item) => item.id !== h.id);
                  setActiveSessionId(next[0]?.id ?? null);
                  setResults(next[0]?.results ?? []);
                  setActiveResultId(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  setHistory((prev) => prev.filter((item) => item.id !== h.id));
                  if (activeSessionId === h.id) {
                    const next = history.filter((item) => item.id !== h.id);
                    setActiveSessionId(next[0]?.id ?? null);
                    setResults(next[0]?.results ?? []);
                    setActiveResultId(null);
                  }
                }
              }}
            >
              ✕
            </span>
          </button>
        ))}
      </div>

      <div className="search-window__results" aria-label="検索結果">
        {results.map((item) => (
          <button
            key={item.id}
            className={`search-window__result${activeResultId === item.id ? ' is-active' : ''}`}
            type="button"
            onClick={() => handleFocus(item)}
          >
            <div className="search-window__result-meta">
              <span className="search-window__badge">{item.source}</span>
              <span className="search-window__file">{item.fileName ?? '未保存'}</span>
            </div>
            <div className="search-window__result-title">{item.cardTitle || '(無題)'}</div>
            <div className="search-window__result-snippet">{item.snippet}</div>
          </button>
        ))}
      </div>
    </div>
  );
};
