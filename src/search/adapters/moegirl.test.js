import { describe, expect, it } from 'vitest';
import { buildMoegirlParams, isMoegirlWork, normalizeMoegirlItem, searchMoegirl } from './moegirl.js';

const page = {
  pageid: 324442,
  title: '孤独摇滚！',
  extract: '《孤独摇滚！》是日本漫画家创作的漫画作品，并有动画等衍生作品。',
  fullurl: 'https://zh.moegirl.org.cn/孤独摇滚！',
  thumbnail: { source: 'https://img.example/bocchi.png' },
  categories: [
    { title: 'Category:乐队题材' },
    { title: 'Category:日本漫画作品' },
  ],
};

describe('moegirl adapter', () => {
  it('builds MediaWiki CORS search params', () => {
    const params = buildMoegirlParams('孤独摇滚');
    expect(params.get('origin')).toBe('*');
    expect(params.get('gsrsearch')).toBe('孤独摇滚');
    expect(params.get('gsrlimit')).toBe('24');
    expect(params.get('cllimit')).toBe('max');
  });

  it('keeps work pages and drops non-work pages', () => {
    expect(isMoegirlWork(page)).toBe(true);
    expect(isMoegirlWork({ categories: [{ title: 'Category:角色' }] })).toBe(false);
  });

  it('normalizes moegirl page fields into SearchWork', () => {
    const work = normalizeMoegirlItem(page);
    expect(work.source).toBe('moegirl');
    expect(work.sourceLabel).toBe('萌娘百科');
    expect(work.title).toBe('孤独摇滚！');
    expect(work.type).toBe('百科条目');
    expect(work.tags).toContain('日本漫画作品');
  });

  it('queries the direct MediaWiki API', async () => {
    const calls = [];
    await searchMoegirl('孤独摇滚', {
      fetchImpl: async (url) => {
        calls.push(url);
        return { ok: true, json: async () => ({ query: { pages: [] } }) };
      },
    });

    expect(calls[0]).toContain('https://zh.moegirl.org.cn/api.php?');
    expect(calls[0]).toContain('origin=*');
  });
});
