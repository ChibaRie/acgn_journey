const ENTITY_MAP = {
  '&quot;': '"',
  '&#34;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
};

export function decodeHtmlEntities(value = '') {
  return String(value)
    .replace(/&(quot|#34|#39|apos|amp|lt|gt|nbsp);/g, (entity) => ENTITY_MAP[entity] || entity)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

export function stripHtml(value = '') {
  return decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripBBCode(value = '') {
  return String(value)
    .replace(/\[url=[^\]]*\]/gi, '')
    .replace(/\[\/?[a-z][^\]]*\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeUrl(url, base = '') {
  const value = String(url || '').trim();
  if (!value) return '';
  if (value.startsWith('//')) return `https:${value}`;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/') && base) return `${base.replace(/\/$/, '')}${value}`;
  return value;
}

export function getYear(value) {
  const match = String(value || '').match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : '';
}

export function uniqueTags(tags, limit = 10) {
  const seen = new Set();
  const output = [];

  for (const tag of tags.flat().filter(Boolean)) {
    const value = stripHtml(String(tag))
      .replace(/^Category:/i, '')
      .replace(/^分类:/, '')
      .trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    output.push(value);
    if (output.length >= limit) break;
  }

  return output;
}

export function parseDocument(html) {
  if (typeof DOMParser === 'undefined') return null;
  return new DOMParser().parseFromString(String(html || ''), 'text/html');
}

export function getText(node, selector = '') {
  const target = selector ? node?.querySelector?.(selector) : node;
  return stripHtml(target?.textContent || target?.innerHTML || '');
}

export function getAttr(node, selector, name) {
  const target = selector ? node?.querySelector?.(selector) : node;
  return target?.getAttribute?.(name) || '';
}

export function cleanImageUrl(url, base = '') {
  const value = String(url || '').replace(/^.*url=/, '');
  return normalizeUrl(value, base);
}
