export const ROUTES = {
  '/api/sources/bangumi': {
    target: 'https://api.bgm.tv',
    headers: { 'User-Agent': 'MyACGNJourney/0.3 (https://github.com/ChibaRie/My_ACGN_Journey)' },
  },
  '/api/sources/age': { target: 'https://www.agedm.io', headers: {} },
  '/api/sources/gugu': { target: 'https://www.gugu3.com', headers: {} },
  '/api/sources/girigiri': { target: 'http://bgm.girigirilove.com', headers: {} },
  '/api/sources/douban': {
    target: 'https://m.douban.com',
    headers: { Referer: 'https://www.douban.com/search', Accept: 'application/json,text/plain,*/*' },
  },
  '/api/sources/nyafun': { target: 'https://www.nyadm.org', headers: {} },
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
