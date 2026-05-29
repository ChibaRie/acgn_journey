import { matchRoute, rewritePath, corsHeaders, shouldRefreshToken } from './router.js';

let ymgalTokenCache = null;

async function getYmgalToken(now = Date.now()) {
  if (!shouldRefreshToken(ymgalTokenCache, now)) return ymgalTokenCache.token;
  const url =
    'https://www.ymgal.games/oauth/token?grant_type=client_credentials&client_id=ymgal&client_secret=luna0327&scope=public';
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  const data = await resp.json();
  ymgalTokenCache = { token: data.access_token, expiresAt: now + 55 * 60 * 1000 };
  return ymgalTokenCache.token;
}

export default {
  async fetch(request, env) {
    const allowed = env.ALLOWED_ORIGIN || 'https://chibarie.github.io';
    const cors = corsHeaders(allowed);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const route = matchRoute(url.pathname);
    if (!route) {
      return new Response('Not found', { status: 404, headers: cors });
    }

    const upstreamPath = rewritePath(route.prefix, url.pathname);
    const upstreamUrl = `${route.target}${upstreamPath}${url.search}`;

    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.set(
      'User-Agent',
      'Mozilla/5.0 (compatible; MyACGNJourney/0.3; +https://github.com/ChibaRie/My_ACGN_Journey)',
    );
    for (const [k, v] of Object.entries(route.headers)) headers.set(k, v);

    if (route.needsYmgalAuth) {
      const token = await getYmgalToken();
      headers.set('Authorization', `Bearer ${token}`);
      headers.set('version', '1');
      headers.set('Accept', 'application/json;charset=utf-8');
    }

    const init = {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    };

    const upstream = await fetch(upstreamUrl, init);
    const respHeaders = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(cors)) respHeaders.set(k, v);
    return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
  },
};
