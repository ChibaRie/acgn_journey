export const ROUTES = {
  '/api/bangumi': {
    target: 'https://api.bgm.tv',
    headers: { 'User-Agent': 'MyACGNJourney/0.3 (https://github.com/ChibaRie/My_ACGN_Journey)' },
  },
  '/api/bilibili': {
    target: 'https://api.bilibili.com',
    headers: { Referer: 'https://www.bilibili.com/', Origin: 'https://www.bilibili.com' },
  },
  '/api/moegirl': { target: 'https://zh.moegirl.org.cn', headers: {} },
  '/api/anilist': { target: 'https://graphql.anilist.co', headers: {} },
  '/api/vndb': { target: 'https://api.vndb.org/kana', headers: {} },
};

export function matchRoute(pathname) {
  const prefix = Object.keys(ROUTES)
    .filter((p) => pathname === p || pathname.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? { prefix, ...ROUTES[prefix] } : null;
}

export function rewritePath(prefix, pathname) {
  return pathname.slice(prefix.length) || '/';
}

export function corsHeaders(allowedOrigin) {
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
