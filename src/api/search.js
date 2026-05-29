const SOURCE_LABELS = {
  bangumi: 'Bangumi',
  bilibili: 'Bilibili',
  moegirl: '萌娘百科',
};

const BANGUMI_TYPE_LABELS = {
  1: '轻小说/书籍',
  2: '动画',
  3: '音乐',
  4: 'Galgame/游戏',
  6: '三次元',
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

const PROVIDERS = {
  bangumi: searchBangumi,
  bilibili: searchBilibili,
  moegirl: searchMoegirl,
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
