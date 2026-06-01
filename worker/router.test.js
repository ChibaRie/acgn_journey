import { describe, expect, it } from 'vitest';
import { corsHeaders, matchRoute, rewritePath } from './router.js';

describe('matchRoute', () => {
  it('matches the retained allowed source prefixes', () => {
    expect(matchRoute('/api/sources/bangumi/v0/search/subjects').target).toBe('https://api.bgm.tv');
    expect(matchRoute('/api/sources/age/search').target).toBe('https://www.agedm.io');
  });

  it('returns null for unknown prefixes and sibling prefix confusion', () => {
    expect(matchRoute('/api/evil/passthrough')).toBeNull();
    expect(matchRoute('/api/sources/ageextra/search')).toBeNull();
    expect(matchRoute('/api/sources/unknown/search')).toBeNull();
  });

  it('rejects discarded source prefixes', () => {
    expect(matchRoute('/api/sources/gugu/index.php/vod/search.html')).toBeNull();
    expect(matchRoute('/api/sources/girigiri/search/-------------/')).toBeNull();
    expect(matchRoute('/api/sources/douban/rexxar/api/v2/search')).toBeNull();
    expect(matchRoute('/api/sources/nyafun/search.html')).toBeNull();
  });
});

describe('rewritePath', () => {
  it('strips the source prefix and keeps the remainder', () => {
    expect(rewritePath('/api/sources/bangumi', '/api/sources/bangumi/v0/search/subjects')).toBe(
      '/v0/search/subjects',
    );
  });

  it('falls back to / when the stripped path is empty', () => {
    expect(rewritePath('/api/sources/age', '/api/sources/age')).toBe('/');
  });

  it('collapses a leading double slash so the remainder cannot be protocol-relative', () => {
    expect(rewritePath('/api/sources/age', '/api/sources/age//evil.com/x')).toBe('/evil.com/x');
  });
});

describe('corsHeaders', () => {
  it('uses the configured allowed origin', () => {
    const h = corsHeaders('https://chibarie.github.io');
    expect(h['Access-Control-Allow-Origin']).toBe('https://chibarie.github.io');
    expect(h['Access-Control-Allow-Methods']).toContain('POST');
    expect(h['Access-Control-Allow-Headers']).toContain('Content-Type');
  });
});
