import { createId, getYearFromDate, normalizeRecord, normalizeTags } from './library.js';

export const IMPORT_PROVIDERS = [
  { value: 'auto', label: '自动识别' },
  { value: 'bangumi', label: 'Bangumi CSV' },
  { value: 'mal', label: 'MyAnimeList XML/CSV' },
  { value: 'anilist', label: 'AniList CSV' },
  { value: 'vndb', label: 'VNDB CSV' },
  { value: 'generic', label: '通用 CSV' },
];

const PROVIDER_LABELS = {
  bangumi: 'Bangumi',
  mal: 'MyAnimeList',
  anilist: 'AniList',
  vndb: 'VNDB',
  generic: 'Imported',
};

const FIELD_ALIASES = {
  title: [
    'title',
    'name',
    'name_cn',
    'series_title',
    'series title',
    'romaji title',
    'english title',
    'native title',
    '作品名',
    '标题',
    '名称',
  ],
  originalTitle: ['original title', 'japanese title', 'native title', '原名', '原文名'],
  type: ['type', 'media_type', 'media type', 'format', 'series_type', 'series type', '类别', '类型'],
  sourceId: [
    'id',
    'sourceId',
    'source id',
    'subject_id',
    'series_animedb_id',
    'series mangadb id',
    'mal id',
    'anilist id',
    'vndb id',
    '条目id',
  ],
  status: ['status', 'my_status', 'my status', 'collection status', '状态', '收藏状态'],
  rating: ['score', 'rating', 'my_score', 'my score', 'rate', 'vote', '分数', '评分'],
  comment: ['comment', 'comments', 'notes', 'note', 'review', 'my_comments', '短评', '备注'],
  tags: ['tags', 'tag', 'labels', 'my_tags', '标签'],
  startedAt: ['start date', 'started at', 'my_start_date', 'my start date', '开始日期'],
  finishedAt: [
    'completed date',
    'finish date',
    'finished at',
    'my_finish_date',
    'my finish date',
    '完成日期',
  ],
  releaseDate: [
    'released',
    'release date',
    'series_start',
    'series start',
    'aired',
    'date',
    '播出日期',
    '发售日期',
  ],
  releaseYear: ['year', 'release year', 'start year', '年份', '作品年份'],
  cover: ['cover', 'image', 'image url', '封面'],
  sourceUrl: ['url', 'link', 'source url', '条目链接'],
};

function cleanText(value = '') {
  return String(value)
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .trim();
}

function normalizeHeader(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function decodeXml(value = '') {
  return cleanText(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function pick(row, aliases) {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]);
  const normalizedAliases = aliases.map(normalizeHeader);

  for (const alias of normalizedAliases) {
    const entry = normalizedEntries.find(([key]) => key === alias);
    if (entry) return cleanText(entry[1]);
  }

  return '';
}

function normalizeDate(value) {
  const text = cleanText(value);
  if (!text || text === '0000-00-00' || /^0{4}/.test(text)) return '';
  const iso = text.match(/\b(19|20)\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}/);
  if (!iso) return '';
  const [year, month, day] = iso[0].match(/\d+/g);
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function normalizeRating(value) {
  const score = Number(String(value || '').match(/\d+(\.\d+)?/)?.[0] || 0);
  if (!Number.isFinite(score) || score <= 0) return 0;
  if (score > 10 && score <= 100) return Math.round(score / 10);
  if (score > 100) return 0;
  return Math.min(10, Math.round(score));
}

function normalizeStatus(value) {
  const text = cleanText(value).toLowerCase().replace(/\s+/g, '');
  if (!text) return 'wish';
  if (/(complete|completed|finish|finished|done|watched|read|played|已看|已读|已玩|完成)/i.test(text)) {
    return 'done';
  }
  if (/(watching|reading|playing|current|active|在看|在读|在玩|进行中)/i.test(text)) {
    return 'active';
  }
  if (/(hold|paused|onhold|搁置|暂停)/i.test(text)) {
    return 'paused';
  }
  if (/(drop|dropped|抛弃|弃)/i.test(text)) {
    return 'dropped';
  }
  return 'wish';
}

function normalizeType(value, provider) {
  const text = cleanText(value);
  const lower = text.toLowerCase();
  if (/(lightnovel|novel|book|manga|manhua|manhwa|轻小说|小说|漫画)/i.test(lower)) {
    return /manga|漫画/i.test(lower) ? '漫画' : '轻小说/书籍';
  }
  if (/(game|visualnovel|vn|galgame|游戏|视觉小说)/i.test(lower)) {
    return 'Galgame/游戏';
  }
  if (/(tv|ova|ona|movie|anime|special|动画|番剧)/i.test(lower)) {
    return '动画';
  }
  if (provider === 'vndb') return 'Galgame/游戏';
  return text || '未分类';
}

function getProviderFromFile(fileName, requestedProvider) {
  if (requestedProvider && requestedProvider !== 'auto') return requestedProvider;
  const name = fileName.toLowerCase();
  if (name.includes('myanimelist') || name.includes('mal')) return 'mal';
  if (name.includes('anilist')) return 'anilist';
  if (name.includes('vndb')) return 'vndb';
  if (name.includes('bangumi') || name.includes('bgm')) return 'bangumi';
  return 'generic';
}

function getSourceUrl(provider, sourceId, type) {
  if (!sourceId) return '';
  if (provider === 'bangumi') return `https://bgm.tv/subject/${sourceId}`;
  if (provider === 'vndb') return `https://vndb.org/${sourceId}`;
  if (provider === 'anilist') return `https://anilist.co/${type?.includes('动画') ? 'anime' : 'manga'}/${sourceId}`;
  if (provider === 'mal') return `https://myanimelist.net/${type?.includes('动画') ? 'anime' : 'manga'}/${sourceId}`;
  return '';
}

function rowToRecord(row, provider) {
  const title = pick(row, FIELD_ALIASES.title);
  if (!title) return null;

  const type = normalizeType(pick(row, FIELD_ALIASES.type), provider);
  const sourceId = pick(row, FIELD_ALIASES.sourceId) || title;
  const releaseDate = normalizeDate(pick(row, FIELD_ALIASES.releaseDate));
  const releaseYear =
    cleanText(pick(row, FIELD_ALIASES.releaseYear)) ||
    getYearFromDate(releaseDate) ||
    getYearFromDate(pick(row, FIELD_ALIASES.releaseDate));

  return normalizeRecord({
    id: createId(),
    workKey: `${provider}:${sourceId || title}`.toLowerCase(),
    source: provider,
    sourceId,
    sourceUrl: pick(row, FIELD_ALIASES.sourceUrl) || getSourceUrl(provider, sourceId, type),
    title,
    originalTitle: pick(row, FIELD_ALIASES.originalTitle),
    cover: pick(row, FIELD_ALIASES.cover),
    type,
    summary: '',
    releaseDate,
    releaseYear,
    status: normalizeStatus(pick(row, FIELD_ALIASES.status)),
    rating: normalizeRating(pick(row, FIELD_ALIASES.rating)),
    comment: pick(row, FIELD_ALIASES.comment),
    tags: normalizeTags(pick(row, FIELD_ALIASES.tags)),
    startedAt: normalizeDate(pick(row, FIELD_ALIASES.startedAt)),
    finishedAt: normalizeDate(pick(row, FIELD_ALIASES.finishedAt)),
  });
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const source = cleanText(text);

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
    } else if (char === '\n' && !inQuotes) {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((value) => cleanText(value))) rows.push(row);

  const [headers = [], ...bodyRows] = rows.filter((item) => item.some((value) => cleanText(value)));
  return bodyRows.map((values) =>
    headers.reduce((acc, header, index) => {
      acc[cleanText(header)] = cleanText(values[index] || '');
      return acc;
    }, {}),
  );
}

function extractXmlBlocks(text, tag) {
  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  return Array.from(text.matchAll(pattern)).map((match) => match[1]);
}

function xmlValue(block, tag) {
  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  return decodeXml(block.match(pattern)?.[1] || '');
}

function malXmlBlockToRecord(block, kind) {
  const sourceId = xmlValue(block, kind === 'anime' ? 'series_animedb_id' : 'series_mangadb_id');
  const title = xmlValue(block, 'series_title');
  const type = kind === 'anime' ? '动画' : normalizeType(xmlValue(block, 'series_type') || 'manga', 'mal');

  return rowToRecord(
    {
      title,
      sourceId,
      type,
      status: xmlValue(block, 'my_status'),
      rating: xmlValue(block, 'my_score'),
      comment: xmlValue(block, 'my_comments'),
      tags: xmlValue(block, 'my_tags'),
      startedAt: xmlValue(block, 'my_start_date'),
      finishedAt: xmlValue(block, 'my_finish_date'),
      releaseDate: xmlValue(block, 'series_start'),
    },
    'mal',
  );
}

function parseMalXml(text) {
  return [
    ...extractXmlBlocks(text, 'anime').map((block) => malXmlBlockToRecord(block, 'anime')),
    ...extractXmlBlocks(text, 'manga').map((block) => malXmlBlockToRecord(block, 'manga')),
  ].filter(Boolean);
}

export function parseImportText(text, { provider = 'auto', fileName = 'import.csv' } = {}) {
  const resolvedProvider = getProviderFromFile(fileName, provider);
  const lowerName = fileName.toLowerCase();
  const looksLikeXml = lowerName.endsWith('.xml') || /^\s*</.test(text);
  const records =
    looksLikeXml && (resolvedProvider === 'mal' || resolvedProvider === 'generic')
      ? parseMalXml(text)
      : parseCsv(text)
          .map((row) => rowToRecord(row, resolvedProvider))
          .filter(Boolean);

  return {
    provider: resolvedProvider,
    providerLabel: PROVIDER_LABELS[resolvedProvider] || PROVIDER_LABELS.generic,
    records,
  };
}

export async function parseImportFile(file, provider = 'auto') {
  const text = await file.text();
  return parseImportText(text, { provider, fileName: file.name });
}
