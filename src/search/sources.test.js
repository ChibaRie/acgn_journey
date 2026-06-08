import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SOURCE_ID,
  SOURCE_LABELS,
  SOURCES,
  buildPreferredUrl,
  buildSourceUrl,
  getSourceById,
} from './sources.js';

describe('sources registry', () => {
  it('exports sources in mainland-priority order with access labels', () => {
    expect(SOURCES.map((source) => source.id)).toEqual([
      'age',
      'moegirl',
      'mangabaka',
      'bangumi',
    ]);
    expect(SOURCES.map((source) => source.accessLabel)).toEqual(['直连', '直连', '直连', '需代理']);
  });

  it('defaults to the mainland-priority source and returns null for unknown source ids', () => {
    expect(DEFAULT_SOURCE_ID).toBe('age');
    expect(getSourceById('evil')).toBeNull();
  });

  it('exports labels from the registry', () => {
    expect(SOURCE_LABELS.moegirl).toBe('萌娘百科');
    expect(SOURCE_LABELS.mangabaka).toBe('MangaBaka');
    expect(SOURCE_LABELS.age).toBe('AGE动漫');
  });

  it('builds source proxy urls and rejects unknown source ids', () => {
    expect(buildSourceUrl('age', '/search?query=芙莉莲')).toBe('/api/sources/age/search?query=芙莉莲');
    expect(() => buildSourceUrl('moegirl', '/api.php')).toThrow('搜索源不支持代理');
    expect(() => buildSourceUrl('mangabaka', '/v1/series/search')).toThrow('搜索源不支持代理');
    expect(() => buildSourceUrl('gugu', '/x')).toThrow('未知搜索源');
    expect(() => buildSourceUrl('evil', '/x')).toThrow('未知搜索源');
  });

  it('marks retained sources as direct-readable fallbacks', () => {
    expect(SOURCES.every((source) => source.directBase)).toBe(true);
  });

  it('prefers proxy urls for proxy-marked sources when a proxy base exists', () => {
    expect(buildPreferredUrl('bangumi', '/v0/search/subjects', 'https://w.example.dev')).toBe(
      'https://w.example.dev/api/bangumi/v0/search/subjects',
    );
    expect(buildPreferredUrl('bangumi', '/v0/search/subjects')).toBe(
      'https://api.bgm.tv/v0/search/subjects',
    );
  });
});
