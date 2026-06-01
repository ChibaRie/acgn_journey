import { describe, expect, it } from 'vitest';
import { getStats, getTagSeries } from './stats.js';

describe('tag statistics', () => {
  it('counts user tags and source anime tags once per record', () => {
    const records = [
      { tags: ['百合', '百合'], animeTags: ['原创', '动画工房'] },
      { tags: ['科幻'], animeTags: ['原创', '动画工房'] },
      { tags: [], animeTags: ['恋爱'] },
    ];

    expect(getTagSeries(records)).toEqual([
      { label: '动画工房', value: 2 },
      { label: '原创', value: 2 },
      { label: '百合', value: 1 },
      { label: '科幻', value: 1 },
      { label: '恋爱', value: 1 },
    ]);
  });

  it('exposes tag series in the stats payload', () => {
    const stats = getStats([{ tags: ['治愈'], animeTags: ['日常'] }]);

    expect(stats.tagSeries).toEqual([
      { label: '日常', value: 1 },
      { label: '治愈', value: 1 },
    ]);
  });
});
