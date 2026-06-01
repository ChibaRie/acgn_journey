import { getYear, normalizeUrl, uniqueTags } from '../html.js';

const TRACE_MOE_BASE = 'https://api.trace.moe';

function formatDate(date = {}) {
  if (!date.year) return '';
  const month = date.month ? String(date.month).padStart(2, '0') : '';
  const day = date.day ? String(date.day).padStart(2, '0') : '';
  return [date.year, month, day].filter(Boolean).join('-');
}

export function formatSeconds(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value)) return '';

  const totalSeconds = Math.max(0, Math.round(value));
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export function formatSimilarity(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return '';
  return `${Math.round(score * 1000) / 10}%`;
}

export function buildTraceMoeSearchUrl({ imageUrl = '', cutBorders = true } = {}) {
  const flags = ['anilistInfo'];
  if (cutBorders) flags.push('cutBorders');

  const params = new URLSearchParams();
  if (imageUrl) params.set('url', imageUrl);

  const query = [flags.join('&'), params.toString()].filter(Boolean).join('&');
  return `${TRACE_MOE_BASE}/search?${query}`;
}

function getAnimeTitle(anilist) {
  if (!anilist || typeof anilist === 'number') return `AniList ${anilist || ''}`.trim();
  return (
    anilist.title?.chinese ||
    anilist.title?.native ||
    anilist.title?.english ||
    anilist.title?.romaji ||
    `AniList ${anilist.id || ''}`.trim()
  );
}

function getOriginalTitle(anilist, title) {
  if (!anilist || typeof anilist === 'number') return '';
  const candidates = [anilist.title?.native, anilist.title?.romaji, anilist.title?.english].filter(Boolean);
  return candidates.find((candidate) => candidate !== title) || '';
}

function getStudios(anilist) {
  if (!anilist || typeof anilist === 'number') return [];
  const edges = anilist.studios?.edges || [];
  const main = edges.filter((edge) => edge.isMain).map((edge) => edge.node?.name);
  return uniqueTags(main.length ? main : edges.map((edge) => edge.node?.name), 4);
}

export function normalizeTraceMoeResult(item) {
  const anilist = item.anilist;
  const anilistId = typeof anilist === 'number' ? anilist : anilist?.id;
  const title = getAnimeTitle(anilist);
  const originalTitle = getOriginalTitle(anilist, title);
  const releaseDate = formatDate(anilist?.startDate) || String(anilist?.seasonYear || '');
  const studios = getStudios(anilist);
  const episode = item.episode ? `第 ${item.episode} 集` : '';
  const timestamp = formatSeconds(item.at);
  const similarity = formatSimilarity(item.similarity);
  const sourceId = anilistId || item.filename || title;

  return {
    id: `trace-moe-${sourceId}`,
    source: 'trace-moe',
    sourceLabel: 'trace.moe',
    sourceId: String(sourceId),
    sourceUrl: anilist?.siteUrl || (anilistId ? `https://anilist.co/anime/${anilistId}` : ''),
    title,
    originalTitle,
    cover: normalizeUrl(anilist?.coverImage?.large || anilist?.coverImage?.medium || ''),
    type: '动画',
    summary: uniqueTags(
      [
        episode || '集数未识别',
        timestamp ? `命中时间 ${timestamp}` : '',
        item.filename ? `文件 ${item.filename}` : '',
      ],
      3,
    ).join(' / '),
    releaseDate,
    releaseYear: String(anilist?.seasonYear || getYear(releaseDate) || ''),
    tags: uniqueTags([anilist?.genres || [], studios], 8),
    meta: uniqueTags([similarity ? `相似度 ${similarity}` : '', episode, timestamp ? `时间 ${timestamp}` : '', studios[0]], 4),
    trace: {
      episode: item.episode ?? '',
      at: item.at ?? '',
      from: item.from ?? '',
      to: item.to ?? '',
      similarity: item.similarity ?? '',
      image: item.image || '',
      video: item.video || '',
      filename: item.filename || '',
    },
  };
}

export async function searchTraceMoe({ file, imageUrl, cutBorders = true } = {}, { signal, fetchImpl = fetch } = {}) {
  const url = buildTraceMoeSearchUrl({ imageUrl, cutBorders });
  const init = { signal };

  if (file) {
    const formData = new FormData();
    formData.append('image', file);
    init.method = 'POST';
    init.body = formData;
  }

  const response = await fetchImpl(url, init);
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`.trim();
    try {
      const payload = await response.json();
      message = payload.error || message;
    } catch {
      // Keep the HTTP status message when the API does not return JSON.
    }
    throw new Error(message);
  }

  const json = await response.json();
  if (json.error) {
    throw new Error(json.error);
  }

  return {
    frameCount: json.frameCount || 0,
    items: (json.result || []).map(normalizeTraceMoeResult),
  };
}
