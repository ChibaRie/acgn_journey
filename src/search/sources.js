const API_BASE = import.meta.env.VITE_API_BASE || '';

export const DEFAULT_SOURCE_ID = 'moegirl';

export const SOURCES = [
  {
    id: 'moegirl',
    label: '萌娘百科',
    description: 'MediaWiki API 支持 origin=* 跨域参数，墙内直连优先。',
    directBase: 'https://zh.moegirl.org.cn',
  },
  {
    id: 'age',
    label: 'AGE动漫',
    description: '动画资源站，搜索页返回可读 CORS，按 anime_trace 的 /search?query= 入口检索。',
    directBase: 'https://www.agedm.io',
    proxyPrefix: '/api/sources/age',
  },
  {
    id: 'bangumi',
    label: 'Bangumi',
    description: '官方 API 支持 CORS，可浏览器直连，适合作为基础元数据来源。',
    directBase: 'https://api.bgm.tv',
    proxyPrefix: '/api/sources/bangumi',
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
