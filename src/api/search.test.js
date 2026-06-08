import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SOURCE_ID,
  SOURCES,
  buildApiUrl,
  buildPreferredUrl,
  buildSourceUrl,
  getSourceById,
  searchSource,
} from './search.js';

describe('search api compatibility exports', () => {
  it('re-exports the single-source registry', () => {
    expect(DEFAULT_SOURCE_ID).toBe('age');
    expect(SOURCES.map((source) => source.id)).toEqual([
      'age',
      'moegirl',
      'mangabaka',
      'bangumi',
    ]);
    expect(getSourceById('nyafun')).toBeNull();
  });

  it('keeps buildApiUrl for the production worker base', () => {
    expect(buildApiUrl('/api/sources/age/search')).toBe('/api/sources/age/search');
    expect(buildApiUrl('/api/sources/age/search', 'https://w.example.dev/')).toBe(
      'https://w.example.dev/api/sources/age/search',
    );
  });

  it('builds source proxy urls only for retained proxy routes', () => {
    expect(buildSourceUrl('age', '/search?query=x')).toBe('/api/sources/age/search?query=x');
    expect(buildPreferredUrl('bangumi', '/v0/search/subjects', 'https://w.example.dev')).toBe(
      'https://w.example.dev/api/bangumi/v0/search/subjects',
    );
    expect(() => buildSourceUrl('gugu', '/index.php/vod/search.html?wd=x')).toThrow('未知搜索源');
  });

  it('re-exports the single-source search function', async () => {
    await expect(searchSource('age', '')).resolves.toEqual({ items: [], error: null });
  });
});
