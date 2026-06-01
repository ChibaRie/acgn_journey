import { describe, expect, it } from 'vitest';
import { normalizeDoubanItem, searchDouban } from './douban.js';

describe('douban adapter', () => {
  it('normalizes douban search result', () => {
    const work = normalizeDoubanItem({
      target: {
        id: '123',
        title: '孤独摇滚！',
        cover_url: 'https://img.example/h/120/public/a.jpg',
        year: '2022',
        type_name: '动画',
        rating: { value: '9.2' },
      },
    });

    expect(work.source).toBe('douban');
    expect(work.sourceLabel).toBe('豆瓣');
    expect(work.sourceUrl).toBe('https://www.douban.com/subject/123');
    expect(work.cover).toBe('https://img.example/h/600/public/a.jpg');
    expect(work.releaseYear).toBe('2022');
    expect(work.meta).toContain('9.2 分');
  });

  it('queries the rexxar search endpoint through the source proxy', async () => {
    const calls = [];
    await searchDouban('孤独摇滚', {
      fetchImpl: async (url) => {
        calls.push(url);
        return { ok: true, json: async () => ({ subjects: { items: [] }, smart_box: [] }) };
      },
    });

    expect(calls[0]).toContain('/api/sources/douban/rexxar/api/v2/search?');
    expect(calls[0]).toContain('q=%E5%AD%A4%E7%8B%AC%E6%91%87%E6%BB%9A');
  });
});
