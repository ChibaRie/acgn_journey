import { buildSourceUrl } from '../sources.js';
import { cleanImageUrl, getAttr, getText, getYear, normalizeUrl, parseDocument, stripHtml, uniqueTags } from '../html.js';

const GUGU_BASE = 'https://www.gugu3.com';

export function normalizeGuguItem(item) {
  const releaseDate = item.releaseDate || item.year || '';

  return {
    id: `gugu-${item.id || item.title}`,
    source: 'gugu',
    sourceLabel: '咕咕番',
    sourceId: String(item.id || item.title || ''),
    sourceUrl: normalizeUrl(item.url || '', GUGU_BASE),
    title: stripHtml(item.title || '未命名条目'),
    originalTitle: item.originalTitle || '',
    cover: cleanImageUrl(item.cover || '', GUGU_BASE),
    type: '动画',
    summary: stripHtml(item.summary || ''),
    releaseDate,
    releaseYear: item.year || getYear(releaseDate),
    tags: uniqueTags(item.tags || []),
    meta: uniqueTags([releaseDate, item.status], 3),
  };
}

export function parseGuguHtml(html) {
  const doc = parseDocument(html);
  if (!doc) return [];

  return [...doc.querySelectorAll('.search-list')]
    .map((item, index) => {
      const link = getAttr(item, '.detail-info a', 'href') || getAttr(item, 'a', 'href');
      const title = getText(item, '.slide-info-title') || getText(item, 'a');
      const sourceId = link.match(/\/([^/?#]+)(?:\.html)?(?:[?#].*)?$/)?.[1] || `${title}-${index}`;

      return normalizeGuguItem({
        id: sourceId,
        title,
        cover: getAttr(item, 'img', 'data-src') || getAttr(item, 'img', 'src'),
        url: link,
        summary: getText(item, '.slide-info') || getText(item, '.detail-info'),
      });
    })
    .filter((work) => work.title && work.sourceUrl);
}

export async function searchGugu(keyword, { signal, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(
    buildSourceUrl('gugu', `/index.php/vod/search.html?wd=${encodeURIComponent(keyword)}`),
    { signal },
  );
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`.trim());
  }
  return parseGuguHtml(await response.text());
}
