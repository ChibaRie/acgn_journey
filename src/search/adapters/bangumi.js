import { buildPreferredUrl } from '../sources.js';
import { getYear, normalizeUrl, stripHtml, uniqueTags } from '../html.js';

const BANGUMI_TYPE_LABELS = {
  1: '轻小说/书籍',
  2: '动画',
  3: '音乐',
  4: 'Galgame/游戏',
  6: '三次元',
};

export function normalizeBangumiItem(item) {
  const title = item.name_cn || item.name || '未命名条目';
  const summary = item.short_summary || item.summary || '';
  const releaseDate = item.date || '';
  const score = item.score ? `${item.score} 分` : '';

  return {
    id: `bangumi-${item.id}`,
    source: 'bangumi',
    sourceLabel: 'Bangumi',
    sourceId: String(item.id),
    sourceUrl: `https://bgm.tv/subject/${item.id}`,
    title,
    originalTitle: item.name && item.name !== title ? item.name : '',
    cover: normalizeUrl(item.images?.large || item.images?.medium || item.images?.grid || ''),
    type: BANGUMI_TYPE_LABELS[item.type] || 'ACGN',
    summary: stripHtml(summary),
    releaseDate,
    releaseYear: getYear(releaseDate),
    tags: uniqueTags((item.tags || []).map((tag) => tag.name)),
    meta: [releaseDate, score, item.rank ? `Rank ${item.rank}` : ''].filter(Boolean),
  };
}

export async function searchBangumi(keyword, { signal, fetchImpl = fetch } = {}) {
  const payload = {
    keyword,
    sort: 'match',
    filter: { type: [1, 2, 4, 6], nsfw: false },
  };

  const response = await fetchImpl(buildPreferredUrl('bangumi', '/v0/search/subjects?limit=12&offset=0'), {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`.trim());
  }

  const json = await response.json();
  return (json.data || []).map(normalizeBangumiItem);
}
