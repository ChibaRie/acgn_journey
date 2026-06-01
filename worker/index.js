import { matchRoute, rewritePath, corsHeaders } from './router.js';

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
    headers.delete('origin');
    headers.delete('referer');
    headers.set(
      'User-Agent',
      'Mozilla/5.0 (compatible; acgn_journey/0.7.0; +https://github.com/ChibaRie/acgn_journey)',
    );
    for (const [k, v] of Object.entries(route.headers)) headers.set(k, v);

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
