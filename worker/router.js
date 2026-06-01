export const ROUTES = {
  '/api/bangumi': {
    target: 'https://api.bgm.tv',
    headers: { 'User-Agent': 'acgn_journey/0.7.0 (https://github.com/ChibaRie/acgn_journey)' },
  },
  '/api/sources/bangumi': {
    target: 'https://api.bgm.tv',
    headers: { 'User-Agent': 'acgn_journey/0.7.0 (https://github.com/ChibaRie/acgn_journey)' },
  },
  '/api/age': { target: 'https://www.agedm.io', headers: {} },
  '/api/sources/age': { target: 'https://www.agedm.io', headers: {} },
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
