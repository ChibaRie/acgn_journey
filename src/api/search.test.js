import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SOURCE_ID,
  SOURCES,
  buildApiUrl,
  buildSourceUrl,
  getSourceById,
  searchSource,
} from './search.js';

describe('search api compatibility exports', () => {
  it('re-exports the single-source registry', () => {
    expect(DEFAULT_SOURCE_ID).toBe('bangumi');
    expect(SOURCES.map((source) => source.id)).toEqual([
      'bangumi',
      'age',
      'gugu',
      'girigiri',
      'douban',
      'nyafun',
    ]);
    expect(getSourceById('moegirl')).toBeNull();
  });

  it('keeps buildApiUrl for the production worker base', () => {
    expect(buildApiUrl('/api/sources/age/search')).toBe('/api/sources/age/search');
    expect(buildApiUrl('/api/sources/age/search', 'https://w.example.dev/')).toBe(
      'https://w.example.dev/api/sources/age/search',
    );
  });

  it('builds source proxy urls from source ids', () => {
    expect(buildSourceUrl('gugu', '/index.php/vod/search.html?wd=x')).toBe(
      '/api/sources/gugu/index.php/vod/search.html?wd=x',
    );
  });

  it('re-exports the single-source search function', async () => {
    await expect(searchSource('bangumi', '')).resolves.toEqual({ items: [], error: null });
  });
});
