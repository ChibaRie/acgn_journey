import { buildSourceUrl } from '../sources.js';
import { getAttr, getText, getYear, normalizeUrl, parseDocument, stripHtml, uniqueTags } from '../html.js';

const GIRIGIRI_BASE = 'http://bgm.girigirilove.com';

export function normalizeGirigiriItem(item) {
  const releaseDate = item.releaseDate || item.year || '';

  return {
    id: `girigiri-${item.id || item.title}`,
    source: 'girigiri',
    sourceLabel: 'girigiri愛',
    sourceId: String(item.id || item.title || ''),
    sourceUrl: normalizeUrl(item.url || '', GIRIGIRI_BASE),
    title: stripHtml(item.title || '未命名条目'),
    originalTitle: item.originalTitle || '',
    cover: normalizeUrl(item.cover || '', GIRIGIRI_BASE),
    type: '动画',
    summary: stripHtml(item.summary || ''),
    releaseDate,
    releaseYear: item.year || getYear(releaseDate),
    tags: uniqueTags(item.tags || []),
    meta: uniqueTags([releaseDate, item.status], 3),
  };
}

export function parseGirigiriHtml(html) {
  const doc = parseDocument(html);
  if (!doc) return [];

  const covers = [...doc.querySelectorAll('.gen-movie-img')].map((node) => getAttr(node, '', 'data-src'));
  return [...doc.querySelectorAll('.detail-info')]
    .map((item, index) => {
      const link = getAttr(item, 'a', 'href');
      const title = getText(item, '.slide-info-title') || getText(item, 'a');
      const sourceId = link.match(/\/([^/?#]+)(?:\.html)?(?:[?#].*)?$/)?.[1] || `${title}-${index}`;

      return normalizeGirigiriItem({
        id: sourceId,
        title,
        cover: covers[index] || getAttr(item.parentElement, '.gen-movie-img', 'data-src'),
        url: link,
        summary: getText(item),
      });
    })
    .filter((work) => work.title && work.sourceUrl);
}

export async function searchGirigiri(keyword, { signal, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(
    buildSourceUrl('girigiri', `/search/-------------/?wd=${encodeURIComponent(keyword)}`),
    { signal },
  );
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`.trim());
  }
  return parseGirigiriHtml(await response.text());
}
