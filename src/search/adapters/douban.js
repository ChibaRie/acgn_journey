import { buildSourceUrl } from '../sources.js';
import { getYear, normalizeUrl, stripHtml, uniqueTags } from '../html.js';

export function normalizeDoubanItem(item) {
  const target = item.target || item;
  const title = target.title || target.name || '未命名条目';
  const id = target.id || target.uri?.match(/subject\/(\d+)/)?.[1] || title;
  const releaseDate = target.year || target.pubdate?.[0] || '';
  const rating = target.rating?.value || target.rating?.star_count || target.rating;
  const cover = target.cover_url || target.pic?.large || target.pic?.normal || '';

  return {
    id: `douban-${id}`,
    source: 'douban',
    sourceLabel: '豆瓣',
    sourceId: String(id),
    sourceUrl: `https://www.douban.com/subject/${id}`,
    title: stripHtml(title),
    originalTitle: target.original_title || '',
    cover: normalizeUrl(String(cover).replace(/h\/[0-9]+/i, 'h/600')),
    type: target.type_name || target.type || '影视/动画',
    summary: stripHtml(target.intro || target.description || target.card_subtitle || ''),
    releaseDate,
    releaseYear: getYear(releaseDate),
    tags: uniqueTags([target.type_name, ...(target.genres || []), ...(target.countries || [])]),
    meta: [releaseDate, rating ? `${rating} 分` : ''].filter(Boolean),
  };
}

export async function searchDouban(keyword, { signal, fetchImpl = fetch } = {}) {
  const params = new URLSearchParams({
    q: keyword,
    type: '',
    loc_id: '',
    start: '0',
    count: '10',
    sort: 'relevance',
  });

  const response = await fetchImpl(buildSourceUrl('douban', `/rexxar/api/v2/search?${params}`), {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`.trim());
  }

  const json = await response.json();
  const items = [...(json.subjects?.items || []), ...(json.smart_box || [])];
  return items
    .filter((item) => item.layout === 'subject' && item.target)
    .map(normalizeDoubanItem);
}
