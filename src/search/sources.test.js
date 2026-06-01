import { describe, expect, it } from 'vitest';
import { DEFAULT_SOURCE_ID, SOURCE_LABELS, SOURCES, buildSourceUrl, getSourceById } from './sources.js';

describe('sources registry', () => {
  it('exports the browser-readable direct sources first', () => {
    expect(SOURCES.map((source) => source.id)).toEqual([
      'bangumi',
      'moegirl',
      'age',
    ]);
  });

  it('defaults to bangumi and returns null for unknown source ids', () => {
    expect(DEFAULT_SOURCE_ID).toBe('bangumi');
    expect(getSourceById('evil')).toBeNull();
  });

  it('exports labels from the registry', () => {
    expect(SOURCE_LABELS.moegirl).toBe('萌娘百科');
    expect(SOURCE_LABELS.age).toBe('AGE动漫');
  });

  it('builds source proxy urls and rejects unknown source ids', () => {
    expect(buildSourceUrl('age', '/search?query=芙莉莲')).toBe('/api/sources/age/search?query=芙莉莲');
    expect(() => buildSourceUrl('moegirl', '/api.php')).toThrow('搜索源不支持代理');
    expect(() => buildSourceUrl('evil', '/x')).toThrow('未知搜索源');
  });

  it('marks default sources as direct-readable', () => {
    expect(SOURCES.every((source) => source.directBase)).toBe(true);
  });
});
