import { describe, expect, it } from 'vitest';
import { normalizeGirigiriItem } from './girigiri.js';

describe('girigiri adapter', () => {
  it('normalizes girigiri search result', () => {
    const work = normalizeGirigiriItem({
      id: '1',
      title: 'Giri 动画',
      cover: '/upload/a.jpg',
      url: '/vod/1.html',
      status: '更新至 3 集',
    });

    expect(work.source).toBe('girigiri');
    expect(work.sourceLabel).toBe('girigiri愛');
    expect(work.sourceUrl).toBe('http://bgm.girigirilove.com/vod/1.html');
    expect(work.cover).toBe('http://bgm.girigirilove.com/upload/a.jpg');
    expect(work.meta).toContain('更新至 3 集');
  });
});
