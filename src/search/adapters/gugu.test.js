import { describe, expect, it } from 'vitest';
import { normalizeGuguItem } from './gugu.js';

describe('gugu adapter', () => {
  it('normalizes gugu search result', () => {
    const work = normalizeGuguItem({
      id: 'vod-1',
      title: '咕咕动画',
      cover: '/img.php?url=https://img.example/gugu.jpg',
      url: '/vod/1.html',
      releaseDate: '2023-10-01',
    });

    expect(work.source).toBe('gugu');
    expect(work.sourceLabel).toBe('咕咕番');
    expect(work.sourceUrl).toBe('https://www.gugu3.com/vod/1.html');
    expect(work.cover).toBe('https://img.example/gugu.jpg');
    expect(work.releaseYear).toBe('2023');
  });
});
