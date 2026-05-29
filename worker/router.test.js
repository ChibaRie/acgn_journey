import { describe, it, expect } from 'vitest';
import { matchRoute, rewritePath, corsHeaders } from './router.js';

describe('matchRoute', () => {
  it('matches a known prefix to its target + headers', () => {
    const r = matchRoute('/api/bilibili/x/web-interface/search/type');
    expect(r.target).toBe('https://api.bilibili.com');
    expect(r.headers.Referer).toBe('https://www.bilibili.com/');
  });

  it('matches vndb prefix', () => {
    expect(matchRoute('/api/vndb/vn').target).toBe('https://api.vndb.org/kana');
  });

  it('returns null for unknown prefix (whitelist closed)', () => {
    expect(matchRoute('/api/evil/passthrough')).toBeNull();
    expect(matchRoute('/')).toBeNull();
  });
});

describe('rewritePath', () => {
  it('strips the prefix and keeps the remainder', () => {
    expect(rewritePath('/api/bangumi', '/api/bangumi/v0/search/subjects')).toBe('/v0/search/subjects');
  });

  it('falls back to / when the stripped path is empty (anilist fix)', () => {
    expect(rewritePath('/api/anilist', '/api/anilist')).toBe('/');
  });

  it('keeps vndb subpath', () => {
    expect(rewritePath('/api/vndb', '/api/vndb/vn')).toBe('/vn');
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
