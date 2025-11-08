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
      const message = error instanceof Error ? error.message : '正規表現の構文が正しくありません。';
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
    return text.length > radius * 2 ? `${text.slice(0, radius * 2)}…` : text;
  }
  const start = Math.max(match.firstIndex - radius, 0);
  const end = Math.min(match.firstIndex + match.matchLength + radius, text.length);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end)}${suffix}`;
};
