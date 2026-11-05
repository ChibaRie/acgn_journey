import { describe, expect, it } from 'vitest';
import { getRecordYear, getWorkCategory, normalizeRecord } from './library.js';
import { filterRecords, getStats } from './stats.js';
import { getCalendarDate } from './dates.js';
import { getDashboardData, getAnnualReview, drawWish } from './dashboard.js';

const record = (id, patch = {}) => normalizeRecord({
  id, title: id, type: '动画', status: 'done', finishedAt: '2026-01-03',
  addedAt: '2026-01-01T00:00:00Z', ...patch,
});

describe('classification and complete statistics', () => {
  it.each([
    [{ type: '动画', title: 'NEW GAME!', tags: ['游戏改'] }, 'anime'],
    [{ type: '漫画', title: '游戏人生', tags: ['轻小说'] }, 'comic'],
    [{ type: 'book', title: 'NEW GAME!' }, 'novel'],
    [{ type: '其他', title: '游戏人生', tags: ['轻小说'] }, 'other'],
    [{ type: ' OTHER ', title: 'NEW GAME!' }, 'other'],
    [{ type: '未分类', title: '视觉小说' }, 'galgame'],
    [{ type: '奇怪媒介', title: '普通作品' }, 'other'],
  ])('gives explicit type precedence over misleading title and tags', (input, category) => {
    expect(getWorkCategory(input)).toBe(category);
  });

  it('keeps complete tag counts and only rates finite scores within 1–10', () => {
    const records = Array.from({ length: 61 }, (_, index) => record(String(index), {
      tags: [`标签${index}`, '共有', '共有'], animeTags: ['共有'],
      rating: [0, 5, 10, 11, -1, Infinity, NaN][index % 7],
    }));
    const stats = getStats(records);
    expect(stats.tagSeries).toHaveLength(60);
    expect(stats.tagCount).toBe(62);
    expect(stats.ratedCount).toBe(18);
    expect(stats.averageRating).toBe('7.5');
    expect(stats.tagSeries[0]).toEqual({ label: '共有', value: 61 });
  });
});

describe('calendar date interpretation', () => {
  it('validates leap days and skips invalid dates when choosing record year', () => {
    expect(getCalendarDate('2024-02-29')).toBe('2024-02-29');
    expect(getCalendarDate('2025-02-29')).toBe('');
    expect(getCalendarDate('2026-13-01')).toBe('');
    expect(getRecordYear({ finishedAt: 'broken', startedAt: '2025-07-01', addedAt: '2026-01-01' })).toBe('2025');
    expect(getRecordYear({ finishedAt: 'broken' })).toBe('未设置');
  });

  it('keeps pure dates and converts zoned timestamps to device calendar dates', () => {
    expect(getCalendarDate('2025-12-31')).toBe('2025-12-31');
    const timestamp = '2025-12-31T23:30:00-05:00';
    const deviceDate = new Date(timestamp);
    const expected = `${deviceDate.getFullYear()}-${String(deviceDate.getMonth() + 1).padStart(2, '0')}-${String(deviceDate.getDate()).padStart(2, '0')}`;
    expect(getCalendarDate(timestamp)).toBe(expected);
    expect(getCalendarDate('2025-02-29T10:00:00Z')).toBe('');
  });
});

describe('dashboard aggregation', () => {
  const records = [
    record('jan', { rating: 8, tags: ['日常', '日常'] }),
    record('oct', { finishedAt: '2026-10-04', rating: 9, tags: ['日常'] }),
    record('missing', { finishedAt: '' }),
    record('invalid', { finishedAt: 'invalid' }),
    record('future', { finishedAt: '2026-12-01' }),
    record('active', { status: 'active', finishedAt: '', updatedAt: '2026-11-01T08:00:00Z' }),
    record('comic', { type: '漫画', finishedAt: '2025-02-02' }),
  ];

  it('reconciles completed totals with valid, missing and future dates', () => {
    const data = getDashboardData(records, { today: '2026-11-05' });
    expect(data.stats.total).toBe(7);
    expect(data.stats.doneCount).toBe(6);
    expect(data.completedCount).toBe(3);
    expect(data.missingCount).toBe(2);
    expect(data.futureCount).toBe(1);
    expect(data.trend.map(({ label, value }) => [label, value])).toEqual([['2025', 1], ['2026', 2]]);
    expect(data.covers.map(({ id }) => id)).toEqual(['active']);
    expect(data.tags[0]).toEqual({ label: '日常', value: 2 });
  });

  it('uses record-year and medium filters consistently but calendar only covers its visible range', () => {
    const data = getDashboardData(records, { category: 'anime', year: '2026', today: '2026-11-05' });
    expect(data.stats.total).toBe(6);
    expect(data.media.reduce((sum, item) => sum + item.value, 0)).toBe(6);
    expect(data.trend).toHaveLength(12);
    expect(data.trend[0].value).toBe(1);
    expect(data.trend[11]).toMatchObject({ value: 0, future: true });
    expect(data.calendar.days).toHaveLength(182);
    expect(data.calendar.end).toBe('2026-11-05');
    expect(data.calendar.total).toBe(1);
    expect(data.completedCount).toBe(2);
  });

  it('includes first-half completions in annual review with stable rated ranking', () => {
    const review = getAnnualReview(records, { category: 'anime', year: '2026', today: '2026-11-05' });
    expect(review.total).toBe(2);
    expect(review.top.map(({ id }) => id)).toEqual(['oct', 'jan']);
    expect(review.ratedCount).toBe(2);
    expect(review.tags).toEqual([{ label: '日常', value: 2 }]);
    const historical = getDashboardData(records, { year: '2025', today: '2026-11-05' });
    expect(historical.calendar.end).toBe('2025-12-31');
    expect(historical.calendar.total).toBe(0);
    expect(historical.completedCount).toBe(1);
  });

  it('falls back to the four most recently updated covers and counts the full tag set', () => {
    const collection = Array.from({ length: 15 }, (_, index) => record(String(index), {
      tags: [`tag${index}`], updatedAt: `2026-10-${String(index + 1).padStart(2, '0')}T00:00:00Z`,
    }));
    const data = getDashboardData(collection, { today: '2026-11-05' });
    expect(data.covers.map(({ id }) => id)).toEqual(['14', '13', '12', '11']);
    expect(data.coverTitle).toBe('最近更新的作品');
    expect(data.tags).toHaveLength(12);
    expect(data.stats.tagCount).toBe(15);
  });

  it('keeps empty years in the yearly trend instead of skipping time intervals', () => {
    const data = getDashboardData([
      record('old', { finishedAt: '2023-04-01' }),
      record('recent', { finishedAt: '2026-02-01' }),
    ], { today: '2026-11-05' });
    expect(data.trend.map(({ label, value }) => [label, value])).toEqual([
      ['2023', 1], ['2024', 0], ['2025', 0], ['2026', 1],
    ]);
  });

  it('draws only wishes in the chosen medium, avoids repeat and never mutates records', () => {
    const choices = [record('a', { status: 'wish' }), record('b', { status: 'wish' }), record('c', { status: 'active' })];
    const before = JSON.stringify(choices);
    expect(drawWish([], { random: () => 0 })).toBeNull();
    expect(drawWish([choices[0]], { previousId: 'a', random: () => 0 })?.id).toBe('a');
    expect(drawWish(choices, { previousId: 'a', random: () => 0 })?.id).toBe('b');
    expect(drawWish(choices, { category: 'comic', random: () => 0 })).toBeNull();
    expect(JSON.stringify(choices)).toBe(before);
  });
});

describe('completion-linked library filters', () => {
  const records = [
    record('match', { tags: ['日常'], rating: 8, finishedAt: '2026-10-04' }),
    record('other-month', { tags: ['日常'], finishedAt: '2026-09-04' }),
    record('missing', { finishedAt: '' }), record('future', { finishedAt: '2026-12-01' }),
    record('active', { status: 'active', finishedAt: '' }),
  ];

  it('combines exact tag, medium, status and completion conditions', () => {
    const filters = { category: 'anime', status: 'done', tag: '日常', completionYear: '2026', completionMonth: '10', completionDate: '2026-10-04' };
    expect(filterRecords(records, filters).map(({ id }) => id)).toEqual(['match']);
    expect(filterRecords(records, { tag: '日' })).toHaveLength(0);
    expect(filterRecords(records, { year: 'all' })).toHaveLength(5);
  });

  it('limits completion issues to done records', () => {
    expect(filterRecords(records, { completionIssue: 'missing', today: '2026-11-05' }).map(({ id }) => id)).toEqual(['missing']);
    expect(filterRecords(records, { completionIssue: 'future', today: '2026-11-05' }).map(({ id }) => id)).toEqual(['future']);
  });

  it('keeps completion conditions conjunctive when a date issue is also selected', () => {
    expect(filterRecords(records, { completionIssue: 'future', completionYear: '2025', today: '2026-11-05' })).toEqual([]);
    expect(filterRecords(records, { completionIssue: 'missing', completionDate: '2026-10-04', today: '2026-11-05' })).toEqual([]);
    expect(filterRecords(records, { completionIssue: 'future', completionMonth: '12', today: '2026-11-05' }).map(({ id }) => id)).toEqual(['future']);
  });
});
