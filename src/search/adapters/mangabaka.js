import { getYear, stripHtml, uniqueTags } from '../html.js';
import { SEARCH_RESULT_LIMIT } from '../constants.js';

const MANGABAKA_API = 'https://api.mangabaka.org/v1/series/search';
const MANGABAKA_SITE = 'https://mangabaka.org';
const ADULT_RATINGS = new Set(['adult', 'erotica', 'explicit', 'hentai', 'pornographic']);
const ADULT_GENRES = new Set(['adult', 'erotica', 'hentai', 'pornographic', 'smut']);
const TRADITIONAL_CHINESE_CHARS =
  /[體國學轉關於為與聲時會後裡這個們來說點畫書無職異專業從東長門見風開還發現實應該]/;

const STATUS_LABELS = {
  cancelled: '已取消',
  completed: '已完结',
  hiatus: '暂停',
  releasing: '连载中',
};

function titleEntries(item) {
  return Array.isArray(item?.titles) ? item.titles.filter((entry) => entry?.title) : [];
}

function pickBest(entries) {
  return [...entries]
    .sort((left, right) => Number(right.is_primary) - Number(left.is_primary))
    .map((entry) => String(entry.title).trim())
    .find(Boolean);
}

function getSimplifiedChineseTitle(item) {
  const entries = titleEntries(item);
  const explicitSimplified = entries.filter((entry) =>
    /^(zh-hans|zh-cn|zh-sg)$/i.test(entry.language || ''),
  );
  if (explicitSimplified.length) return pickBest(explicitSimplified) || '';

  const genericChinese = entries.filter((entry) => /^zh$/i.test(entry.language || ''));
  const likelySimplified = genericChinese.filter(
    (entry) => !TRADITIONAL_CHINESE_CHARS.test(entry.title),
  );
  return pickBest(likelySimplified) || '';
}

function getJapaneseTitle(item) {
  const entries = titleEntries(item).filter((entry) => /^ja$/i.test(entry.language || ''));
  const nativeEntries = entries.filter((entry) => entry.traits?.includes('native'));
  return String(item?.native_title || pickBest(nativeEntries) || pickBest(entries) || '').trim();
}

function getEnglishTitle(item) {
  const entries = titleEntries(item).filter((entry) => /^en$/i.test(entry.language || ''));
  const officialEntries = entries.filter((entry) => entry.traits?.includes('official'));
  return String(pickBest(officialEntries) || item?.title || pickBest(entries) || '').trim();
}

function getCover(item) {
  return String(
    item?.cover?.x350?.x1 ||
      item?.cover?.x250?.x1 ||
      item?.cover?.x150?.x1 ||
      item?.cover?.raw?.url ||
      '',
  ).trim();
}

function getAuthors(item) {
  return uniqueTags(
    (Array.isArray(item?.authors) ? item.authors : []).map((author) =>
      typeof author === 'string' ? author : author?.name,
    ),
  );
}

function formatRating(value) {
  const rating = Number(value);
  if (!Number.isFinite(rating)) return '';
  return `${rating}/10`;
}

export function isAdultMangabakaItem(item) {
  const rating = String(item?.content_rating || '').trim().toLowerCase();
  if (ADULT_RATINGS.has(rating)) return true;

  return (Array.isArray(item?.genres) ? item.genres : []).some((genre) =>
    ADULT_GENRES.has(String(genre || '').toLowerCase()),
  );
}

export function normalizeMangabakaItem(item = {}) {
  const sourceId = String(item.id ?? '');
  const originalTitle = getJapaneseTitle(item);
  const title =
    getSimplifiedChineseTitle(item) ||
    originalTitle ||
    getEnglishTitle(item) ||
    '未命名条目';
  const authors = getAuthors(item);
  const releaseDate = String(item.published?.start_date || item.year || '').trim();
  const releaseYear = String(item.year || getYear(releaseDate) || '');
  const status = String(item.status || '').trim();
  const statusLabel = STATUS_LABELS[status.toLowerCase()] || status;
  const hasRating = item.rating !== null && item.rating !== undefined && item.rating !== '';
  const numericRating = hasRating ? Number(item.rating) : Number.NaN;
  const rating = Number.isFinite(numericRating)
    ? Math.round((numericRating / 10) * 10) / 10
    : null;
  const genres = uniqueTags(Array.isArray(item.genres) ? item.genres : []);
  const tags = uniqueTags(Array.isArray(item.tags) ? item.tags : []);
  const links = Array.isArray(item.links) ? item.links : [];
  const sourceUrl =
    links.find((link) => /^https?:\/\/(?:www\.)?mangabaka\.org\//i.test(link)) ||
    (sourceId ? `${MANGABAKA_SITE}/${sourceId}` : '');

  return {
    id: `mangabaka-${sourceId || title}`,
    source: 'mangabaka',
    sourceLabel: 'MangaBaka',
    sourceId,
    sourceUrl,
    title,
    originalTitle,
    cover: getCover(item),
    type: '轻小说',
    summary: stripHtml(item.description || ''),
    authors,
    author: authors.join('、'),
    releaseDate,
    releaseYear,
    status,
    statusLabel,
    rating,
    genres,
    tags: uniqueTags([genres, tags], 10),
    meta: uniqueTags(
      [
        authors.length ? `作者 ${authors.join('、')}` : '',
        releaseYear,
        statusLabel,
        rating === null ? '' : `评分 ${formatRating(rating)}`,
      ],
      4,
    ),
  };
}

export async function searchMangabaka(keyword, { signal, fetchImpl = fetch } = {}) {
  const params = new URLSearchParams({
    q: keyword,
    type: 'novel',
    limit: String(SEARCH_RESULT_LIMIT),
  });
  const response = await fetchImpl(`${MANGABAKA_API}?${params}`, { signal });

  if (response.status === 429) {
    throw new Error('MangaBaka API 限流（HTTP 429），请稍后再试');
  }
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`.trim());
  }

  const json = await response.json();
  return (Array.isArray(json?.data) ? json.data : [])
    .filter((item) => !isAdultMangabakaItem(item))
    .slice(0, SEARCH_RESULT_LIMIT)
    .map(normalizeMangabakaItem);
}
