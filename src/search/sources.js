const API_BASE = import.meta.env.VITE_API_BASE || '';

export const DEFAULT_SOURCE_ID = 'bangumi';

export const SOURCES = [
  {
    id: 'bangumi',
    label: 'Bangumi',
    description: '官方 API 支持 CORS，可浏览器直连，适合作为基础元数据来源。',
    directBase: 'https://api.bgm.tv',
    proxyPrefix: '/api/sources/bangumi',
  },
  {
    id: 'moegirl',
    label: '萌娘百科',
    description: 'MediaWiki API 支持 origin=* 跨域参数，墙内直连可读。',
    directBase: 'https://zh.moegirl.org.cn',
  },
  {
    id: 'age',
    label: 'AGE动漫',
    description: '动画资源站，搜索页返回可读 CORS，按 anime_trace 的 /search?query= 入口检索。',
    directBase: 'https://www.agedm.io',
    proxyPrefix: '/api/sources/age',
  },
];

export const PROXY_CANDIDATE_SOURCES = [
  {
    id: 'gugu',
    label: '咕咕番',
    description: '动画资源站，页面无 CORS，需代理后启用。',
    proxyPrefix: '/api/sources/gugu',
  },
  {
    id: 'girigiri',
    label: 'girigiri愛',
    description: '动画资源站，页面无 CORS，需代理后启用。',
    proxyPrefix: '/api/sources/girigiri',
  },
  {
    id: 'douban',
    label: '豆瓣',
    description: '中文标题、年份、评分和简介的补充来源，需代理后启用。',
    proxyPrefix: '/api/sources/douban',
  },
  {
    id: 'nyafun',
    label: 'NyaFun',
    description: '动画资源站，当前存在跳转校验，需代理和解析适配后启用。',
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
  const source = [...SOURCES, ...PROXY_CANDIDATE_SOURCES].find((source) => source.id === sourceId) || null;
  if (!source) {
    throw new Error(`未知搜索源：${sourceId}`);
  }
  if (!source.proxyPrefix) {
    throw new Error(`搜索源不支持代理：${sourceId}`);
  }

  const path = upstreamPath.startsWith('/') ? upstreamPath : `/${upstreamPath}`;
  return buildApiUrl(`${source.proxyPrefix}${path}`, base);
}

export function buildDirectUrl(sourceId, upstreamPath) {
  const source = getSourceById(sourceId);
  if (!source?.directBase) {
    throw new Error(`搜索源不支持直连：${sourceId}`);
  }

  const path = upstreamPath.startsWith('/') ? upstreamPath : `/${upstreamPath}`;
  return `${source.directBase.replace(/\/$/, '')}${path}`;
}
