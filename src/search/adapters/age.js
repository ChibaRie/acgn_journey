import { buildDirectUrl } from '../sources.js';
import { getAttr, getText, getYear, normalizeUrl, parseDocument, stripHtml, uniqueTags } from '../html.js';

const AGE_BASE = 'https://www.agedm.io';

export function splitAgeTags(value) {
  return uniqueTags(String(value || '').split(/[\s,，/、|]+/));
}

export function formatAgeSeasonTag(value) {
  const match = String(value || '').match(/\b((?:19|20)\d{2})(?:[-/.年](\d{1,2}))?/);
  if (!match) return '';
  return match[2] ? `${match[1]}年${Number(match[2])}月` : `${match[1]}年`;
}

export function buildAgeAnimeTags({ releaseDate = '', studio = '', tags = [] } = {}) {
  return uniqueTags([tags, studio, formatAgeSeasonTag(releaseDate)], 8);
}

export function parseAgeInfoFields(item) {
  const fields = {};

  for (const row of item?.querySelectorAll?.('.video_detail_info') || []) {
    const labelNode = row.querySelector('span');
    const label = stripHtml(labelNode?.textContent || '').replace(/[：:]\s*$/, '');
    if (!label) continue;

    const value = stripHtml((row.textContent || '').replace(labelNode?.textContent || '', ''));
    if (value) fields[label] = value;
  }

  return fields;
}

export function normalizeAgeItem(item) {
  const releaseDate = item.releaseDate || item.year || '';
  const studio = stripHtml(item.studio || '');
  const status = stripHtml(item.status || '');
  const genreTags = splitAgeTags(item.tags || []);
  const animeTags = buildAgeAnimeTags({ releaseDate, studio, tags: genreTags });

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
    tags: [],
    animeTags,
    meta: uniqueTags([releaseDate, studio, status], 4),
  };
}

export function parseAgeHtml(html) {
  const doc = parseDocument(html);
  if (!doc) return [];

  return [...doc.querySelectorAll('.cata_video_item')]
    .map((item, index) => {
      const link = getAttr(item, 'a', 'href');
      const title = getAttr(item, 'img', 'alt') || getText(item, '.video_title') || getText(item, 'a');
      const fields = parseAgeInfoFields(item);
      const sourceId = link.match(/\/([^/?#]+)(?:\.html)?(?:[?#].*)?$/)?.[1] || `${title}-${index}`;

      return normalizeAgeItem({
        id: sourceId,
        title,
        cover: getAttr(item, 'img', 'data-original') || getAttr(item, 'img', 'src'),
        url: link,
        originalTitle: fields['原版名称'] || '',
        releaseDate: fields['首播时间'] || '',
        year: getYear(fields['首播时间']),
        status: fields['播放状态'] || getText(item, '.video_play_status'),
        studio: fields['制作公司'] || '',
        tags: splitAgeTags(fields['剧情类型'] || fields['标签']),
        summary: fields['简介'] || Object.entries(fields).map(([key, value]) => `${key}：${value}`).join(' / '),
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
