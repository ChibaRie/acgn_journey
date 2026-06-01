import { describe, expect, it } from 'vitest';
import { DEFAULT_SOURCE_ID, SOURCE_LABELS, SOURCES, buildSourceUrl, getSourceById } from './sources.js';

describe('sources registry', () => {
  it('exports exactly six anime_trace style sources in the first release', () => {
    expect(SOURCES.map((source) => source.id)).toEqual([
      'bangumi',
      'age',
      'gugu',
      'girigiri',
      'douban',
      'nyafun',
    ]);
  });

  it('defaults to bangumi and returns null for unknown source ids', () => {
    expect(DEFAULT_SOURCE_ID).toBe('bangumi');
    expect(getSourceById('evil')).toBeNull();
  });

  it('exports labels from the registry', () => {
    expect(SOURCE_LABELS.age).toBe('AGE动漫');
    expect(SOURCE_LABELS.nyafun).toBe('NyaFun');
  });

  it('builds source proxy urls and rejects unknown source ids', () => {
    expect(buildSourceUrl('age', '/search?query=芙莉莲')).toBe('/api/sources/age/search?query=芙莉莲');
    expect(() => buildSourceUrl('evil', '/x')).toThrow('未知搜索源');
  });
});
