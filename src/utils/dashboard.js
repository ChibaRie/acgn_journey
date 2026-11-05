import { getCalendarDate, getCalendarToday, shiftCalendarDate } from './dates.js';
import { WORK_CATEGORIES, getRecordYear, getWorkCategory } from './library.js';
import { filterRecords, getStats, getTagSeries, isValidRating } from './stats.js';

function getMediaSeries(records) {
  const counts = new Map();
  for (const record of records) {
    const category = getWorkCategory(record);
    counts.set(category, (counts.get(category) || 0) + 1);
  }
  return WORK_CATEGORIES.filter(({ value }) => value !== 'all').map(({ value, label }) => ({
    category: value, label, value: counts.get(value) || 0,
  }));
}

function getCalendar(completed, year, today) {
  if (year !== 'all' && year > today.slice(0, 4)) {
    return { start: '', end: '', days: [], total: 0, future: true };
  }
  const end = year === 'all' || year === today.slice(0, 4) ? today : `${year}-12-31`;
  const start = shiftCalendarDate(end, -181);
  const counts = new Map();
  for (const { date } of completed) counts.set(date, (counts.get(date) || 0) + 1);
  const days = Array.from({ length: 182 }, (_, index) => {
    const date = shiftCalendarDate(start, index);
    return { date, value: counts.get(date) || 0 };
  });
  return { start, end, days, total: days.reduce((sum, day) => sum + day.value, 0), future: false };
}

export function getDashboardData(records, { category = 'all', year = 'all', today = getCalendarToday() } = {}) {
  const selected = filterRecords(records, { category, year });
  const stats = getStats(selected);
  const completed = [];
  let missingCount = 0;
  let futureCount = 0;
  for (const record of selected) {
    if (record.status !== 'done') continue;
    const date = getCalendarDate(record.finishedAt);
    if (!date) missingCount += 1;
    else if (date > today) futureCount += 1;
    else completed.push({ record, date });
  }
  const counts = new Map();
  for (const { date } of completed) {
    const key = year === 'all' ? date.slice(0, 4) : date.slice(5, 7);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let trend = [];
  if (year === 'all' && counts.size > 0) {
    const years = Array.from(counts.keys(), Number);
    const first = Math.min(...years);
    const last = Math.max(...years);
    trend = Array.from({ length: last - first + 1 }, (_, index) => {
      const label = String(first + index).padStart(4, '0');
      return { label, value: counts.get(label) || 0, future: false };
    });
  } else if (year !== 'all') {
    trend = Array.from({ length: 12 }, (_, index) => {
      const label = String(index + 1).padStart(2, '0');
      return { label, value: counts.get(label) || 0, future: `${year}-${label}` > today.slice(0, 7) };
    });
  }
  const active = selected.filter((record) => record.status === 'active');
  const covers = (active.length ? active : selected)
    .map((record) => ({ record, updated: Date.parse(record.updatedAt) || 0 }))
    .sort((a, b) => b.updated - a.updated || String(a.record.id).localeCompare(String(b.record.id)))
    .slice(0, 4)
    .map(({ record }) => record);
  return {
    records: selected, stats, activeCount: active.length,
    completedCount: completed.length, missingCount, futureCount, trend,
    calendar: getCalendar(completed, year, today), media: getMediaSeries(selected),
    covers, coverTitle: active.length ? '进行中的作品' : '最近更新的作品',
    tags: stats.tagSeries.slice(0, 12),
    years: Array.from(new Set(records.map(getRecordYear))).filter((value) => value !== '未设置').sort().reverse(),
  };
}

export function getAnnualReview(records, { category = 'all', year, today = getCalendarToday() } = {}) {
  const completed = filterRecords(records, { category, completionYear: year, today });
  const rated = completed.filter((record) => isValidRating(record.rating));
  const top = [...rated].sort((a, b) =>
    Number(b.rating) - Number(a.rating) || getCalendarDate(b.finishedAt).localeCompare(getCalendarDate(a.finishedAt)) || String(a.id).localeCompare(String(b.id)),
  ).slice(0, 3);
  return { total: completed.length, ratedCount: rated.length, top, media: getMediaSeries(completed), tags: getTagSeries(completed, 6) };
}

export function drawWish(records, { category = 'all', previousId, random = Math.random } = {}) {
  const candidates = filterRecords(records, { category, status: 'wish' });
  if (candidates.length === 0) return null;
  const pool = candidates.length > 1 ? candidates.filter((record) => record.id !== previousId) : candidates;
  return pool[Math.floor(random() * pool.length)];
}
