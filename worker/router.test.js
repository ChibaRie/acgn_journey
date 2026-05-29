import { describe, it, expect } from 'vitest';
import { matchRoute, rewritePath, corsHeaders, shouldRefreshToken } from './router.js';

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

  it('rejects a sibling path with a suffix (prefix-confusion guard)', () => {
    expect(matchRoute('/api/bangumiXYZ')).toBeNull();
    expect(matchRoute('/api/vndbextra/x')).toBeNull();
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

  it('collapses a leading double slash so the remainder cannot be protocol-relative', () => {
    expect(rewritePath('/api/bangumi', '/api/bangumi//evil.com/x')).toBe('/evil.com/x');
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

describe('matchRoute ymgal', () => {
  it('matches /api/ymgal to ymgal target with auth flag', () => {
    const r = matchRoute('/api/ymgal/open/archive/search-game');
    expect(r.target).toBe('https://www.ymgal.games');
    expect(r.needsYmgalAuth).toBe(true);
  });
});

describe('shouldRefreshToken', () => {
  it('refreshes when no cache', () => {
    expect(shouldRefreshToken(null, 1000)).toBe(true);
  });
  it('refreshes when expired', () => {
    expect(shouldRefreshToken({ token: 'x', expiresAt: 500 }, 1000)).toBe(true);
  });
  it('reuses a valid cached token', () => {
    expect(shouldRefreshToken({ token: 'x', expiresAt: 5000 }, 1000)).toBe(false);
  });
});
