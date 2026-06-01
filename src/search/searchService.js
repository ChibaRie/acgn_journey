import { getSourceById } from './sources.js';
import { searchBangumi } from './adapters/bangumi.js';
import { searchAge } from './adapters/age.js';
import { searchGugu } from './adapters/gugu.js';
import { searchGirigiri } from './adapters/girigiri.js';
import { searchDouban } from './adapters/douban.js';
import { searchNyafun } from './adapters/nyafun.js';

const SEARCHERS = {
  bangumi: searchBangumi,
  age: searchAge,
  gugu: searchGugu,
  girigiri: searchGirigiri,
  douban: searchDouban,
  nyafun: searchNyafun,
};

export async function searchSource(sourceId, keyword, options = {}) {
  const source = getSourceById(sourceId);
  if (!source) {
    throw new Error(`未知搜索源：${sourceId}`);
  }

  const query = String(keyword || '').trim();
  if (!query) {
    return { items: [], error: null };
  }

  const searcher = SEARCHERS[sourceId];
  if (!searcher) {
    throw new Error(`搜索源未实现：${source.label}`);
  }

  const items = await searcher(query, options);
  return { items, error: null };
}
