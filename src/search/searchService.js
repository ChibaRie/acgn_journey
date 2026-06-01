import { getSourceById } from './sources.js';
import { searchBangumi } from './adapters/bangumi.js';
import { searchAge } from './adapters/age.js';
import { searchMoegirl } from './adapters/moegirl.js';

const SEARCHERS = {
  bangumi: searchBangumi,
  moegirl: searchMoegirl,
  age: searchAge,
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
