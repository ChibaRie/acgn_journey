import { describe, expect, it } from 'vitest';
import { normalizeNyafunItem } from './nyafun.js';

describe('nyafun adapter', () => {
  it('normalizes nyafun search result', () => {
    const work = normalizeNyafunItem({
      id: '2',
      title: 'Nya 动画',
      cover: '//img.example/nya.jpg',
      url: '/bangumi/2.html',
      releaseDate: '2021',
    });

    expect(work.source).toBe('nyafun');
    expect(work.sourceLabel).toBe('NyaFun');
    expect(work.sourceUrl).toBe('https://www.nyadm.org/bangumi/2.html');
    expect(work.cover).toBe('https://img.example/nya.jpg');
    expect(work.type).toBe('动画');
    expect(work.releaseYear).toBe('2021');
  });
});
