import { buildDirectUrl } from '../sources.js';
import { getAttr, getText, getYear, normalizeUrl, parseDocument, stripHtml, uniqueTags } from '../html.js';

const AGE_BASE = 'https://www.agedm.io';

export function normalizeAgeItem(item) {
  const releaseDate = item.releaseDate || item.year || '';

  return {
    id: `age-${item.id || item.title}`,
    source: 'age',
    sourceLabel: 'AGE动漫',
    sourceId: String(item.id || item.title || ''),
    sourceUrl: normalizeUrl(item.url || '', AGE_BASE),
    title: stripHtml(item.title || '未命名条目'),
    originalTitle: item.originalTitle || '',
    cover: normalizeUrl(item.cover || '', AGE_BASE),
    type: '动画',
    summary: stripHtml(item.summary || ''),
    releaseDate,
    releaseYear: item.year || getYear(releaseDate),
    tags: uniqueTags(item.tags || []),
    meta: uniqueTags([releaseDate, item.status], 3),
  };
}

export function parseAgeHtml(html) {
  const doc = parseDocument(html);
  if (!doc) return [];

  return [...doc.querySelectorAll('.cata_video_item')]
    .map((item, index) => {
      const link = getAttr(item, 'a', 'href');
      const title = getAttr(item, 'img', 'alt') || getText(item, '.video_title') || getText(item, 'a');
      const info = [...item.querySelectorAll('.video_detail_info')].map((node) => getText(node));
      const sourceId = link.match(/\/([^/?#]+)(?:\.html)?(?:[?#].*)?$/)?.[1] || `${title}-${index}`;

      return normalizeAgeItem({
        id: sourceId,
        title,
        cover: getAttr(item, 'img', 'data-original') || getAttr(item, 'img', 'src'),
        url: link,
        releaseDate: info[3] || '',
        status: getText(item, '.video_play_status'),
        summary: info.join(' / '),
      });
    })
    .filter((work) => work.title && work.sourceUrl);
}

export async function searchAge(keyword, { signal, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(buildDirectUrl('age', `/search?query=${encodeURIComponent(keyword)}`), { signal });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`.trim());
  }
  return parseAgeHtml(await response.text());
}
