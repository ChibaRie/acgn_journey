import { describe, expect, it } from 'vitest';
import {
  buildAgeAnimeTags,
  formatAgeSeasonTag,
  normalizeAgeItem,
  parseAgeInfoFields,
  searchAge,
  splitAgeTags,
} from './age.js';

describe('age adapter', () => {
  it('normalizes age search result', () => {
    const work = normalizeAgeItem({
      id: 'detail-123',
      title: '某动画',
      cover: '//img.example/age.jpg',
      url: '/detail/123',
      year: '2024',
      studio: 'CloverWorks',
      status: '完结',
      tags: ['百合', '偶像'],
      summary: '<p>简介</p>',
    });

    expect(work.source).toBe('age');
    expect(work.sourceLabel).toBe('AGE动漫');
    expect(work.sourceUrl).toBe('https://www.agedm.io/detail/123');
    expect(work.cover).toBe('https://img.example/age.jpg');
    expect(work.type).toBe('动画');
    expect(work.releaseYear).toBe('2024');
    expect(work.meta).toContain('CloverWorks');
    expect(work.tags).toEqual([]);
    expect(work.animeTags).toEqual(['百合', '偶像', 'CloverWorks', '2024年']);
  });

  it('parses AGE detail info labels from search result rows', () => {
    const row = (label, value) => ({
      textContent: `${label}${value}`,
      querySelector: () => ({ textContent: label }),
    });
    const item = {
      querySelectorAll: () => [
        row('首播时间：', '2022-10-08'),
        row('剧情类型：', '百合 偶像'),
        row('制作公司：', 'CloverWorks'),
      ],
    };

    expect(parseAgeInfoFields(item)).toEqual({
      首播时间: '2022-10-08',
      剧情类型: '百合 偶像',
      制作公司: 'CloverWorks',
    });
    expect(splitAgeTags('百合 偶像,音乐')).toEqual(['百合', '偶像', '音乐']);
    expect(formatAgeSeasonTag('2022-10-08')).toBe('2022年10月');
    expect(buildAgeAnimeTags({ releaseDate: '2022-10-08', studio: 'CloverWorks', tags: ['百合'] })).toEqual([
      '百合',
      'CloverWorks',
      '2022年10月',
    ]);
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
