import { describe, expect, it } from 'vitest';
import { normalizeBangumiItem, searchBangumi } from './bangumi.js';

describe('bangumi adapter', () => {
  it('normalizes bangumi subject fields into SearchWork', () => {
    const work = normalizeBangumiItem({
      id: 1,
      name_cn: '葬送的芙莉莲',
      name: 'Sousou no Frieren',
      images: { large: 'https://img.example/a.jpg' },
      short_summary: 'A story',
      date: '2023-09-29',
      type: 2,
      tags: [{ name: 'Adventure' }, { name: 'Drama' }],
      score: 9.1,
      rank: 12,
    });

    expect(work.source).toBe('bangumi');
    expect(work.sourceLabel).toBe('Bangumi');
    expect(work.title).toBe('葬送的芙莉莲');
    expect(work.originalTitle).toBe('Sousou no Frieren');
    expect(work.type).toBe('动画');
    expect(work.meta).toContain('2023-09-29');
  });

  it('posts to the bangumi source proxy', async () => {
    const calls = [];
    await searchBangumi('芙莉莲', {
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return { ok: true, json: async () => ({ data: [] }) };
      },
    });

    expect(calls[0].url).toBe('https://api.bgm.tv/v0/search/subjects?limit=12&offset=0');
    expect(calls[0].init.method).toBe('POST');
  });
});
