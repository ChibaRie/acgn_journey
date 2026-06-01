const API_BASE = import.meta.env.VITE_API_BASE || '';

export const DEFAULT_SOURCE_ID = 'bangumi';

export const SOURCES = [
  {
    id: 'bangumi',
    label: 'Bangumi',
    description: '条目信息与分类较完整，适合作为基础元数据来源。',
    proxyPrefix: '/api/sources/bangumi',
  },
  {
    id: 'age',
    label: 'AGE动漫',
    description: '动画资源站，按 anime_trace 的 /search?query= 入口检索。',
    proxyPrefix: '/api/sources/age',
  },
  {
    id: 'gugu',
    label: '咕咕番',
    description: '动画资源站，按 anime_trace 的 /index.php/vod/search.html 入口检索。',
    proxyPrefix: '/api/sources/gugu',
  },
  {
    id: 'girigiri',
    label: 'girigiri愛',
    description: '动画资源站，按 anime_trace 的 /search/-------------/ 入口检索。',
    proxyPrefix: '/api/sources/girigiri',
  },
  {
    id: 'douban',
    label: '豆瓣',
    description: '中文标题、年份、评分和简介的补充来源。',
    proxyPrefix: '/api/sources/douban',
  },
  {
    id: 'nyafun',
    label: 'NyaFun',
    description: '动画资源站，按 anime_trace 的 /search.html 入口检索。',
    proxyPrefix: '/api/sources/nyafun',
  },
];

export const SOURCE_LABELS = Object.fromEntries(SOURCES.map((source) => [source.id, source.label]));

export function getSourceById(sourceId) {
  return SOURCES.find((source) => source.id === sourceId) || null;
}

export function buildApiUrl(path, base = API_BASE) {
  return base ? `${base.replace(/\/$/, '')}${path}` : path;
}

export function buildSourceUrl(sourceId, upstreamPath, base = API_BASE) {
  const source = getSourceById(sourceId);
  if (!source) {
    throw new Error(`未知搜索源：${sourceId}`);
  }

  const path = upstreamPath.startsWith('/') ? upstreamPath : `/${upstreamPath}`;
  return buildApiUrl(`${source.proxyPrefix}${path}`, base);
}
