import { describe, expect, it } from 'vitest';
import { normalizeAgeItem } from './age.js';

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
});
