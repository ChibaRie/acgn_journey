export const ROUTES = {
  '/api/bangumi': {
    target: 'https://api.bgm.tv',
    headers: { 'User-Agent': 'MyACGNJourney/0.3 (https://github.com/ChibaRie/My_ACGN_Journey)' },
  },
  '/api/moegirl': { target: 'https://zh.moegirl.org.cn', headers: {} },
  '/api/anilist': { target: 'https://graphql.anilist.co', headers: {} },
  '/api/vndb': { target: 'https://api.vndb.org/kana', headers: {} },
  '/api/ymgal': { target: 'https://www.ymgal.games', headers: {}, needsYmgalAuth: true },
};

export function matchRoute(pathname) {
  const prefix = Object.keys(ROUTES)
    .filter((p) => pathname === p || pathname.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? { prefix, ...ROUTES[prefix] } : null;
}

export function rewritePath(prefix, pathname) {
  const remainder = pathname.slice(prefix.length).replace(/^\/+/, '/');
  return remainder || '/';
}

export function corsHeaders(allowedOrigin) {
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export function shouldRefreshToken(cache, now) {
  return !cache || !cache.token || now >= cache.expiresAt;
}
