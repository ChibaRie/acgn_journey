import { describe, expect, it } from 'vitest';
import { createExportText, createRecordFromWork, normalizeRecord } from './library.js';

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

  it('exports backup records as json, xml, and csv', () => {
    const record = normalizeRecord({
      id: 'record-1',
      source: 'manual',
      sourceId: 'white-album-2',
      title: '白色相簿2',
      comment: '冬日, 音乐 "名作"',
      tags: ['Galgame', '音乐'],
    });

    const json = createExportText([record], 'json');
    const xml = createExportText([record], 'xml');
    const csv = createExportText([record], 'csv');

    expect(JSON.parse(json).records[0].title).toBe('白色相簿2');
    expect(xml).toContain('<title>白色相簿2</title>');
    expect(xml).toContain('<comment>冬日, 音乐 &quot;名作&quot;</comment>');
    expect(csv).toContain('title');
    expect(csv).toContain('"冬日, 音乐 ""名作"""');
  });
});
