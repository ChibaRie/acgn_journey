import { describe, expect, it } from 'vitest';
import { normalizeAgeItem, searchAge } from './age.js';

describe('age adapter', () => {
  it('normalizes age search result', () => {
    const work = normalizeAgeItem({
      id: 'detail-123',
      title: '某动画',
      cover: '//img.example/age.jpg',
      url: '/detail/123',
      year: '2024',
      summary: '<p>简介</p>',
    });

    expect(work.source).toBe('age');
    expect(work.sourceLabel).toBe('AGE动漫');
    expect(work.sourceUrl).toBe('https://www.agedm.io/detail/123');
    expect(work.cover).toBe('https://img.example/age.jpg');
    expect(work.type).toBe('动画');
    expect(work.releaseYear).toBe('2024');
  });

  it('queries AGE directly because it exposes readable CORS', async () => {
    const calls = [];
    await searchAge('孤独摇滚', {
      fetchImpl: async (url) => {
        calls.push(url);
        return { ok: true, text: async () => '' };
      },
    });

    expect(calls[0]).toBe('https://www.agedm.io/search?query=%E5%AD%A4%E7%8B%AC%E6%91%87%E6%BB%9A');
  });
});
