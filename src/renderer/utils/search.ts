import type { Card } from '@/shared/workspace';
import type { TraceSeed } from '../store/traceStore';

export interface SearchMatchResult {
  count: number;
  firstIndex: number;
  matchLength: number;
}

export interface SearchMatcher {
  valid: boolean;
  error?: string;
  match: (text: string) => SearchMatchResult;
}

const EMPTY_MATCH: SearchMatchResult = { count: 0, firstIndex: -1, matchLength: 0 };

export const createSearchMatcher = (query: string, useRegex: boolean): SearchMatcher => {
  const trimmed = query ?? '';
  if (!trimmed) {
    return { valid: false, error: '検索キーワードを入力してください。', match: () => EMPTY_MATCH };
  }

  if (useRegex) {
    try {
      const regex = new RegExp(trimmed, 'gi');
      return {
        valid: true,
        match: (text: string): SearchMatchResult => {
          if (!text) {
            return EMPTY_MATCH;
          }
          let count = 0;
          let firstIndex = -1;
          let firstLength = 0;
          regex.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = regex.exec(text)) !== null) {
            if (match[0].length === 0) {
              regex.lastIndex += 1;
            }
            count += 1;
            if (firstIndex === -1) {
              firstIndex = match.index;
              firstLength = match[0].length || 1;
            }
          }
          return count > 0 ? { count, firstIndex, matchLength: firstLength } : EMPTY_MATCH;
        },
      } satisfies SearchMatcher;
    } catch (error) {
      const message = error instanceof Error ? (error as Error).message : '正規表現の構文が正しくありません。';
      return { valid: false, error: message, match: () => EMPTY_MATCH };
    }
  }

  const needle = trimmed.toLowerCase();
  return {
    valid: true,
    match: (text: string): SearchMatchResult => {
      if (!text) {
        return EMPTY_MATCH;
      }
      const haystack = text.toLowerCase();
      let index = haystack.indexOf(needle);
      if (index === -1) {
        return EMPTY_MATCH;
      }
      let count = 0;
      let firstIndex = -1;
      while (index !== -1) {
        count += 1;
        if (firstIndex === -1) {
          firstIndex = index;
        }
        const nextStart = index + (needle.length || 1);
        index = haystack.indexOf(needle, nextStart);
      }
      return { count, firstIndex, matchLength: needle.length || 1 };
    },
  } satisfies SearchMatcher;
};

export const buildSnippet = (text: string, match: SearchMatchResult, radius = 40): string => {
  if (!text) {
    return '';
  }
  if (match.firstIndex < 0) {
    return text;
  }
  const start = Math.max(match.firstIndex - radius, 0);
  const end = Math.min(match.firstIndex + match.matchLength + radius, text.length);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end)}${suffix}`;
};

export type SearchScope = 'current' | 'open' | 'input';
export type SearchMode = 'text' | 'regex' | 'id' | 'trace' | 'advanced';
export type SearchField = 'title' | 'body' | 'cardId' | 'status' | 'kind';
export type SearchOperator = 'contains' | 'equals' | 'regex';

export type SearchCondition = {
  field: SearchField;
  operator: SearchOperator;
  value: string;
};

export type TraceQuery = {
  seeds?: TraceSeed[];
  depth?: number;
};

export type AdvancedQuery = {
  combinator: 'AND' | 'OR';
  conditions: SearchCondition[];
  trace?: TraceQuery;
};

export type SearchRequest = {
  id: string;
  scope: SearchScope;
  mode: SearchMode;
  text?: string;
  useRegex?: boolean;
  advanced?: AdvancedQuery;
  trace?: TraceQuery;
};

export interface SearchResult {
  id: string;
  source: 'open' | 'input';
  fileName: string | null;
  tabId?: string;
  leafId?: string;
  cardId: string;
  cardTitle: string;
  snippet: string;
  matchCount: number;
}

export interface SearchDataset {
  source: 'open' | 'input';
  fileName: string | null;
  tabId?: string;
  leafId?: string;
  cards: Card[];
}

export interface SearchExecutionOptions {
  traceResolver?: (seeds: TraceSeed[], depth: number) => Promise<Record<string, Set<string>>>;
}

export interface SearchResponse {
  results: SearchResult[];
  seeds: TraceSeed[];
  error: string | null;
}

const normalize = (value: unknown): string => (value ?? '').toString();

const matchId = (card: Card, keyword: string): SearchMatchResult => {
  const haystack = `${card.cardId ?? ''}\n${card.id}`.toLowerCase();
  const needle = keyword.toLowerCase();
  const index = haystack.indexOf(needle);
  if (index === -1) {
    return EMPTY_MATCH;
  }
  return { count: 1, firstIndex: index, matchLength: needle.length || 1 };
};

const evaluateCondition = (card: Card, condition: SearchCondition): SearchMatchResult => {
  const raw = (() => {
    switch (condition.field) {
      case 'title':
        return normalize(card.title);
      case 'body':
        return normalize(card.body);
      case 'cardId':
        return normalize(card.cardId ?? card.id);
      case 'status':
        return normalize(card.status);
      case 'kind':
        return normalize(card.kind);
      default:
        return '';
    }
  })();

  if (!condition.value) {
    return EMPTY_MATCH;
  }

  if (condition.operator === 'equals') {
    const matched = raw.toLowerCase() === condition.value.toLowerCase();
    return matched ? { count: 1, firstIndex: 0, matchLength: raw.length || 1 } : EMPTY_MATCH;
  }

  if (condition.operator === 'regex') {
    try {
      const regex = new RegExp(condition.value, 'i');
      const hit = raw.match(regex);
      if (hit && typeof hit.index === 'number') {
        return { count: 1, firstIndex: hit.index, matchLength: hit[0]?.length ?? 1 };
      }
      return EMPTY_MATCH;
    } catch {
      return EMPTY_MATCH;
    }
  }

  // contains
  const index = raw.toLowerCase().indexOf(condition.value.toLowerCase());
  if (index === -1) {
    return EMPTY_MATCH;
  }
  return { count: 1, firstIndex: index, matchLength: condition.value.length || 1 };
};

const combineMatchResults = (results: SearchMatchResult[], combinator: 'AND' | 'OR'): SearchMatchResult => {
  if (results.length === 0) {
    return EMPTY_MATCH;
  }
  if (combinator === 'OR') {
    const firstHit = results.find((r) => r.count > 0);
    if (!firstHit) {
      return EMPTY_MATCH;
    }
    return { ...firstHit, count: results.filter((r) => r.count > 0).length };
  }
  // AND
  const everyHit = results.every((r) => r.count > 0);
  if (!everyHit) {
    return EMPTY_MATCH;
  }
  const first = results.find((r) => r.firstIndex >= 0) ?? results[0];
  return { ...first, count: results.length };
};

const countFromMatcher = (matcher: SearchMatcher, text: string): SearchMatchResult => matcher.match(text);

const dedupeKey = (dataset: SearchDataset, card: Card): string =>
  `${dataset.fileName ?? dataset.tabId ?? 'untitled'}::${card.id}`;

const seedsFromText = (text: string, datasets: SearchDataset[]): TraceSeed[] => {
  if (!text) {
    return [];
  }
  const lower = text.toLowerCase();
  const seeds: TraceSeed[] = [];
  datasets.forEach((dataset) => {
    dataset.cards.forEach((card) => {
      const idCandidate = card.cardId ?? card.id;
      const haystack = `${card.title ?? ''}\n${card.body ?? ''}\n${idCandidate}`.toLowerCase();
      if (haystack.includes(lower)) {
        seeds.push({ fileName: dataset.fileName ?? '', cardId: idCandidate });
      }
    });
  });
  return seeds;
};

export const runSearch = async (
  request: SearchRequest,
  datasets: SearchDataset[],
  options?: SearchExecutionOptions,
): Promise<SearchResponse> => {
  const results: SearchResult[] = [];
  const seeds: TraceSeed[] = [];
  const seedKeys = new Set<string>();
  const pushSeed = (seed: TraceSeed) => {
    if (!seed.fileName || !seed.cardId) {
      return;
    }
    const key = `${seed.fileName}::${seed.cardId}`;
    if (seedKeys.has(key)) {
      return;
    }
    seedKeys.add(key);
    seeds.push(seed);
  };
  request.trace?.seeds?.forEach(pushSeed);
  const useRegex = request.mode === 'regex' || request.useRegex === true;
  const trimmed = request.text?.trim() ?? '';

  if (request.mode !== 'advanced' && request.mode !== 'trace' && !trimmed) {
    return { results: [], seeds, error: '検索キーワードを入力してください。' };
  }

  let matcher: SearchMatcher | null = null;
  if (request.mode === 'text' || request.mode === 'regex') {
    matcher = createSearchMatcher(trimmed, useRegex);
    if (!matcher.valid) {
      return { results: [], seeds, error: matcher.error ?? '検索条件が無効です。' };
    }
  }

  const addResult = (dataset: SearchDataset, card: Card, match: SearchMatchResult, snippetSource: string) => {
    const key = dedupeKey(dataset, card);
    const exists = results.some((r) => `${r.fileName ?? r.tabId ?? ''}::${r.cardId}` === key);
    if (exists) {
      return;
    }
    results.push({
      id: `${key}#${results.length}`,
      source: dataset.source,
      fileName: dataset.fileName,
      tabId: dataset.tabId,
      leafId: dataset.leafId,
      cardId: card.id,
      cardTitle: card.title ?? '(無題)',
      snippet: buildSnippet(snippetSource, match),
      matchCount: match.count,
    });
  };

  const evaluateDatasets = () => {
    datasets.forEach((dataset) => {
      dataset.cards.forEach((card) => {
        const combinedText = `${card.title ?? ''}\n${card.body ?? ''}`;
        if (request.mode === 'text' || request.mode === 'regex') {
          if (!matcher) {
            return;
          }
          const match = countFromMatcher(matcher, combinedText);
          if (match.count > 0) {
            addResult(dataset, card, match, combinedText);
          }
          return;
        }

        if (request.mode === 'id') {
          const match = matchId(card, trimmed);
          if (match.count > 0) {
            addResult(dataset, card, match, card.cardId ?? card.id);
          }
          return;
        }

        if (request.mode === 'advanced') {
          if (!request.advanced || request.advanced.conditions.length === 0) {
            return;
          }
          const matches = request.advanced.conditions.map((condition) => evaluateCondition(card, condition));
          const combined = combineMatchResults(matches, request.advanced.combinator);
          if (combined.count > 0) {
            addResult(dataset, card, combined, combinedText);
            if (request.advanced.trace) {
              const seedId = card.cardId ?? card.id;
              pushSeed({ fileName: dataset.fileName ?? '', cardId: seedId });
            }
          }
          return;
        }

        if (request.mode === 'trace') {
          if (trimmed && seeds.length === 0) {
            seedsFromText(trimmed, datasets).forEach(pushSeed);
          }
          if (trimmed) {
            const baseMatch = matchId(card, trimmed);
            if (baseMatch.count > 0) {
              pushSeed({ fileName: dataset.fileName ?? '', cardId: card.cardId ?? card.id });
            }
          }
        }
      });
    });
  };

  evaluateDatasets();

  const traceQuery = request.mode === 'trace' ? request.trace : request.advanced?.trace;
  const depth = traceQuery?.depth ?? (request.mode === 'trace' ? 1 : undefined);

  if ((request.mode === 'trace' || request.advanced?.trace) && depth !== undefined) {
    if (seeds.length === 0) {
      return { results: [], seeds, error: 'トレース検索の種カードが見つかりません。' };
    }
    if (!options?.traceResolver) {
      return { results: [], seeds, error: 'トレース情報が利用できません。' };
    }
    const related = await options.traceResolver(seeds, depth);
    datasets.forEach((dataset) => {
      const allowedIds = related[dataset.fileName ?? ''] ?? new Set<string>();
      dataset.cards.forEach((card) => {
        const candidate = card.cardId ?? card.id;
        if (!allowedIds.has(candidate)) {
          return;
        }
        addResult(
          dataset,
          card,
          { count: 1, firstIndex: 0, matchLength: candidate.length || 1 },
          `トレースで関連: ${candidate}`,
        );
      });
    });
  }

  return { results, seeds, error: results.length === 0 ? null : null };
};
