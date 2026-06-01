import { buildSourceUrl } from '../sources.js';
import { getAttr, getText, getYear, normalizeUrl, parseDocument, stripHtml, uniqueTags } from '../html.js';

const NYAFUN_BASE = 'https://www.nyadm.org';

export function normalizeNyafunItem(item) {
  const releaseDate = item.releaseDate || item.year || '';

  return {
    id: `nyafun-${item.id || item.title}`,
    source: 'nyafun',
    sourceLabel: 'NyaFun',
    sourceId: String(item.id || item.title || ''),
    sourceUrl: normalizeUrl(item.url || '', NYAFUN_BASE),
    title: stripHtml(item.title || '未命名条目'),
    originalTitle: item.originalTitle || '',
    cover: normalizeUrl(item.cover || '', NYAFUN_BASE),
    type: '动画',
    summary: stripHtml(item.summary || ''),
    releaseDate,
    releaseYear: item.year || getYear(releaseDate),
    tags: uniqueTags(item.tags || []),
    meta: uniqueTags([releaseDate, item.status], 3),
  };
}

export function parseNyafunHtml(html) {
  const doc = parseDocument(html);
  if (!doc) return [];

  const covers = [...doc.querySelectorAll('.lazy')].map((node) => getAttr(node, '', 'data-src'));
  const remarks = [...doc.querySelectorAll('.slide-info-remarks')].map((node) => getText(node.nextElementSibling) || getText(node));

  return [...doc.querySelectorAll('.slide-info-title')]
    .map((item, index) => {
      const link = item.closest?.('a')?.getAttribute('href') || getAttr(item, 'a', 'href') || item.parentElement?.getAttribute?.('href') || '';
      const title = getText(item, 'a') || getText(item);
      const sourceId = link.match(/\/([^/?#]+)(?:\.html)?(?:[?#].*)?$/)?.[1] || `${title}-${index}`;

      return normalizeNyafunItem({
        id: sourceId,
        title,
        cover: covers[index] || getAttr(item.parentElement, 'img', 'data-src'),
        url: link,
        releaseDate: remarks[index] || '',
      });
    })
    .filter((work) => work.title && work.sourceUrl);
}

export async function searchNyafun(keyword, { signal, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(buildSourceUrl('nyafun', `/search.html?wd=${encodeURIComponent(keyword)}`), {
    signal,
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`.trim());
  }
  return parseNyafunHtml(await response.text());
}
