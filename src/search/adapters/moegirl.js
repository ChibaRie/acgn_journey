import { buildDirectUrl } from '../sources.js';
import { getYear, normalizeUrl, stripHtml, uniqueTags } from '../html.js';
import { SEARCH_RESULT_LIMIT } from '../constants.js';

export function buildMoegirlParams(keyword) {
  return new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrnamespace: '0',
    gsrlimit: String(SEARCH_RESULT_LIMIT),
    gsrsearch: keyword,
    prop: 'extracts|pageimages|info|categories',
    exintro: '1',
    explaintext: '1',
    exchars: '160',
    piprop: 'thumbnail',
    pithumbsize: '360',
    cllimit: 'max',
    inprop: 'url',
    utf8: '1',
    origin: '*',
  });
}

export function isMoegirlWork(page) {
  const categories = (page.categories || []).map((category) =>
    String(category.title || '').replace(/^Category:/i, '').replace(/^分类:/, ''),
  );
  return categories.some((name) => /(作品|题材)$/.test(name));
}

export function normalizeMoegirlItem(page) {
  const title = stripHtml(page.title || '未命名页面');
  const tags = uniqueTags((page.categories || []).map((category) => category.title), 10);
  const releaseYear = getYear(page.extract) || getYear(tags.join(' '));

  return {
    id: `moegirl-${page.pageid || title}`,
    source: 'moegirl',
    sourceLabel: '萌娘百科',
    sourceId: String(page.pageid || title),
    sourceUrl: page.fullurl || `https://zh.moegirl.org.cn/${encodeURIComponent(title)}`,
    title,
    originalTitle: '',
    cover: normalizeUrl(page.thumbnail?.source || ''),
    type: '百科条目',
    summary: stripHtml(page.extract || ''),
    releaseDate: releaseYear,
    releaseYear,
    tags,
    meta: uniqueTags(['萌娘百科', releaseYear], 3),
  };
}

export async function searchMoegirl(keyword, { signal, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(buildDirectUrl('moegirl', `/api.php?${buildMoegirlParams(keyword)}`), {
    signal,
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`.trim());
  }

  const json = await response.json();
  return (json.query?.pages || []).filter(isMoegirlWork).map(normalizeMoegirlItem);
}
