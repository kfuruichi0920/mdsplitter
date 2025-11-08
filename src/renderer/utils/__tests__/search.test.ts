import { buildSnippet, createSearchMatcher } from '../search';

describe('search utils', () => {
  it('matches plain text multiple times', () => {
    const matcher = createSearchMatcher('card', false);
    expect(matcher.valid).toBe(true);
    const result = matcher.match('This card is a sample card.');
    expect(result.count).toBe(2);
    expect(result.firstIndex).toBe(5);
    expect(result.matchLength).toBe(4);
  });

  it('handles invalid regex', () => {
    const matcher = createSearchMatcher('(*)', true);
    expect(matcher.valid).toBe(false);
    expect(matcher.error).toBeDefined();
    expect(matcher.match('text').count).toBe(0);
  });

  it('matches regex and builds snippet', () => {
    const matcher = createSearchMatcher('trace', true);
    const text = 'traceability links keep trace records.';
    const result = matcher.match(text);
    expect(result.count).toBeGreaterThan(0);
    const snippet = buildSnippet(text, result, 5);
    expect(snippet).toContain('trace');
  });

  it('returns trimmed snippet when no match', () => {
    const matcher = createSearchMatcher('nothing', false);
    const text = 'short text';
    const result = matcher.match(text);
    const snippet = buildSnippet(text, result, 2);
    expect(snippet).toBe(text);
  });
});
