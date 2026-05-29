const SOURCE_LABELS = {
  bangumi: 'Bangumi',
  bilibili: 'Bilibili',
  moegirl: '萌娘百科',
  anilist_anime: 'AniList动画',
  anilist_manga: 'AniList漫画',
  vndb: 'VNDB',
};

const BANGUMI_TYPE_LABELS = {
  1: '轻小说/书籍',
  2: '动画',
  3: '音乐',
  4: 'Galgame/游戏',
  6: '三次元',
};

const ANILIST_MANGA_FORMAT_LABELS = {
  MANGA: '漫画',
  ONE_SHOT: '漫画',
  NOVEL: '轻小说/书籍',
};

function stripHtml(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripBBCode(value = '') {
  return String(value)
    .replace(/\[url=[^\]]*\]/gi, '')
    .replace(/\[\/?[a-z][^\]]*\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUrl(url) {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `https://zh.moegirl.org.cn${url}`;
  return url;
}

function uniqueTags(tags, limit = 10) {
  const seen = new Set();
  const output = [];

  for (const tag of tags.flat().filter(Boolean)) {
    const value = stripHtml(String(tag))
      .replace(/^Category:/i, '')
      .replace(/^分类:/, '')
      .trim();
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    output.push(value);
    if (output.length >= limit) break;
  }

  return output;
}

function getYear(value) {
  const match = String(value || '').match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : '';
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`.trim());
  }

  return response.json();
}

function normalizeBangumiItem(item) {
  const title = item.name_cn || item.name || '未命名条目';
  const summary = item.short_summary || item.summary || '';
  const releaseDate = item.date || '';
  const tags = uniqueTags((item.tags || []).map((tag) => tag.name));

  return {
    id: `bangumi-${item.id}`,
    source: 'bangumi',
    sourceLabel: SOURCE_LABELS.bangumi,
    sourceId: String(item.id),
    sourceUrl: `https://bgm.tv/subject/${item.id}`,
    title,
    originalTitle: item.name && item.name !== title ? item.name : '',
    cover: normalizeUrl(item.images?.large || item.images?.medium || item.images?.grid || ''),
    type: BANGUMI_TYPE_LABELS[item.type] || 'ACGN',
    summary: stripHtml(summary),
    releaseDate,
    releaseYear: getYear(releaseDate),
    tags,
    meta: [releaseDate, item.score ? `${item.score} 分` : '', item.rank ? `Rank ${item.rank}` : ''].filter(
      Boolean,
    ),
  };
}

async function searchBangumi(keyword, signal) {
  const payload = {
    keyword,
    sort: 'match',
    filter: {
      type: [1, 2, 4],
      nsfw: false,
    },
  };

  const json = await fetchJson('/api/bangumi/v0/search/subjects?limit=12&offset=0', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return (json.data || []).map(normalizeBangumiItem);
}

function normalizeBilibiliItem(item) {
  const title = stripHtml(item.title || item.org_title || '未命名番剧');
  const releaseDate = item.pubtime || item.pubtime_show || item.index_show || '';
  const tags = uniqueTags([
    item.season_type_name,
    item.areas,
    Array.isArray(item.styles) ? item.styles : String(item.styles || '').split(/[ ,/]+/),
  ]);

  return {
    id: `bilibili-${item.media_id || item.season_id || title}`,
    source: 'bilibili',
    sourceLabel: SOURCE_LABELS.bilibili,
    sourceId: String(item.media_id || item.season_id || title),
    sourceUrl: normalizeUrl(item.goto_url || item.url || ''),
    title,
    originalTitle: stripHtml(item.org_title || ''),
    cover: normalizeUrl(item.cover || ''),
    type: item.season_type_name || '动画',
    summary: stripHtml(item.desc || item.cv || item.staff || ''),
    releaseDate,
    releaseYear: getYear(releaseDate),
    tags,
    meta: uniqueTags([releaseDate, ...tags], 3),
  };
}

async function searchBilibili(keyword, signal) {
  const params = new URLSearchParams({
    search_type: 'media_bangumi',
    keyword,
    page: '1',
  });
  const json = await fetchJson(`/api/bilibili/x/web-interface/search/type?${params}`, {
    signal,
    headers: {
      Accept: 'application/json,text/plain,*/*',
    },
  });

  if (json.code !== 0) {
    throw new Error(json.message || `Bilibili 返回 code ${json.code}`);
  }

  return (json.data?.result || []).map(normalizeBilibiliItem);
}

function normalizeMoegirlItem(page) {
  const title = stripHtml(page.title || '未命名页面');
  const tags = uniqueTags((page.categories || []).map((category) => category.title), 10);
  const releaseYear = getYear(page.extract) || getYear(tags.join(' '));

  return {
    id: `moegirl-${page.pageid || title}`,
    source: 'moegirl',
    sourceLabel: SOURCE_LABELS.moegirl,
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

export function normalizeAniListItem(media, source) {
  const title = media.title?.native || media.title?.romaji || media.title?.english || '未命名条目';
  const romaji = media.title?.romaji || '';
  const year = media.startDate?.year ? String(media.startDate.year) : '';
  const type =
    source === 'anilist_manga'
      ? ANILIST_MANGA_FORMAT_LABELS[media.format] || '漫画'
      : '动画';
  const score = media.averageScore ? `${(media.averageScore / 10).toFixed(1)} 分` : '';

  return {
    id: `anilist-${media.id}`,
    source,
    sourceLabel: SOURCE_LABELS[source],
    sourceId: String(media.id),
    sourceUrl: media.siteUrl || `https://anilist.co/${source === 'anilist_manga' ? 'manga' : 'anime'}/${media.id}`,
    title,
    originalTitle: romaji && romaji !== title ? romaji : '',
    cover: normalizeUrl(media.coverImage?.large || media.coverImage?.medium || ''),
    type,
    summary: stripHtml(media.description || ''),
    releaseDate: year,
    releaseYear: year,
    tags: uniqueTags([...(media.genres || []), ...(media.tags || []).map((tag) => tag.name)]),
    meta: [year, score].filter(Boolean),
  };
}

export function normalizeVndbItem(vn) {
  const sortedTags = [...(vn.tags || [])].sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const rating = vn.rating ? `${(vn.rating / 10).toFixed(1)} 分` : '';

  return {
    id: `vndb-${vn.id}`,
    source: 'vndb',
    sourceLabel: SOURCE_LABELS.vndb,
    sourceId: vn.id,
    sourceUrl: `https://vndb.org/${vn.id}`,
    title: vn.title || '未命名作品',
    originalTitle: vn.alttitle && vn.alttitle !== vn.title ? vn.alttitle : '',
    cover: normalizeUrl(vn.image?.url || ''),
    type: 'Galgame/游戏',
    summary: stripHtml(stripBBCode(vn.description || '')),
    releaseDate: vn.released || '',
    releaseYear: getYear(vn.released),
    tags: uniqueTags(sortedTags.map((tag) => tag.name)),
    meta: [vn.released, rating].filter(Boolean),
  };
}

async function searchMoegirl(keyword, signal) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrnamespace: '0',
    gsrlimit: '12',
    gsrsearch: keyword,
    prop: 'extracts|pageimages|info|categories',
    exintro: '1',
    explaintext: '1',
    exchars: '160',
    piprop: 'thumbnail',
    pithumbsize: '360',
    cllimit: '20',
    inprop: 'url',
    utf8: '1',
  });

  const json = await fetchJson(`/api/moegirl/api.php?${params}`, { signal });
  return (json.query?.pages || []).map(normalizeMoegirlItem);
}

const ANILIST_QUERY = `query ($search: String, $type: MediaType) {
  Page(page: 1, perPage: 12) {
    media(search: $search, type: $type, sort: SEARCH_MATCH) {
      id
      title { romaji english native }
      coverImage { large medium }
      description(asHtml: false)
      genres
      tags { name }
      averageScore
      format
      startDate { year }
      siteUrl
      isAdult
    }
  }
}`;

async function searchAniListByType(keyword, source, mediaType, signal) {
  const json = await fetchJson('/api/anilist', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: ANILIST_QUERY, variables: { search: keyword, type: mediaType } }),
  });

  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message || 'AniList 查询失败');
  }

  return (json.data?.Page?.media || []).map((media) => normalizeAniListItem(media, source));
}

function searchAniListAnime(keyword, signal) {
  return searchAniListByType(keyword, 'anilist_anime', 'ANIME', signal);
}

function searchAniListManga(keyword, signal) {
  return searchAniListByType(keyword, 'anilist_manga', 'MANGA', signal);
}

async function searchVndb(keyword, signal) {
  const json = await fetchJson('/api/vndb/vn', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filters: ['search', '=', keyword],
      fields: 'title, alttitle, image{url, sexual}, released, description, rating, tags{name, rating}',
      results: 12,
      sort: 'searchrank',
    }),
  });

  return (json.results || []).map(normalizeVndbItem);
}

const PROVIDERS = {
  bangumi: searchBangumi,
  bilibili: searchBilibili,
  moegirl: searchMoegirl,
  anilist_anime: searchAniListAnime,
  anilist_manga: searchAniListManga,
  vndb: searchVndb,
};

export async function searchAllSources(keyword, { sources, signal } = {}) {
  const enabledSources = sources?.length ? sources : Object.keys(PROVIDERS);
  const settled = await Promise.allSettled(
    enabledSources.map(async (source) => ({
      source,
      items: await PROVIDERS[source](keyword, signal),
    })),
  );

  const errors = {};
  const items = [];

  settled.forEach((entry, index) => {
    const source = enabledSources[index];
    if (entry.status === 'fulfilled') {
      items.push(...entry.value.items);
    } else if (entry.reason?.name !== 'AbortError') {
      errors[source] = entry.reason?.message || '搜索失败';
    }
  });

  const unique = [];
  const seen = new Set();

  for (const item of items) {
    const key = `${item.source}:${item.sourceId || item.title}`.toLowerCase();
    if (!seen.has(key)) {
      unique.push(item);
      seen.add(key);
    }
  }

  return {
    items: unique,
    errors,
  };
}

export { SOURCE_LABELS };
