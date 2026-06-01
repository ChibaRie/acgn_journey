import { describe, expect, it } from 'vitest';
import { createRecordFromWork, normalizeRecord } from './library.js';

describe('library record normalization', () => {
  it('keeps source anime tags separate from user tags', () => {
    const record = createRecordFromWork({
      source: 'age',
      sourceId: '20220121',
      title: '孤独摇滚！',
      type: '动画',
      tags: ['用户标签'],
      animeTags: ['百合', 'CloverWorks', '2022年10月'],
    });

    expect(record.tags).toEqual(['用户标签']);
    expect(record.animeTags).toEqual(['百合', 'CloverWorks', '2022年10月']);
  });

  it('normalizes missing anime tags to an empty array', () => {
    const record = normalizeRecord({ title: '某动画', tags: '科幻 恋爱' });

    expect(record.tags).toEqual(['科幻', '恋爱']);
    expect(record.animeTags).toEqual([]);
  });
});
