import {
  getRecordYear,
  getStatusLabel,
  getWorkCategory,
  getWorkYear,
  normalizeTags,
} from './library.js';
import { getCalendarDate, getCalendarToday } from './dates.js';

function countBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item) || '未分类';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function toSeries(map) {
  return Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => {
      if (a.label === '未设置') return 1;
      if (b.label === '未设置') return -1;
      return String(a.label).localeCompare(String(b.label), 'zh-Hans-CN', { numeric: true });
    });
}

export function getTagSeries(records, limit = 60) {
  const counts = new Map();

  for (const record of records) {
    const tags = normalizeTags([...(record.tags || []), ...(record.animeTags || [])]);
    for (const tag of new Set(tags)) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  return Array.from(counts, ([label, value]) => ({ label, value }))
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return a.label.localeCompare(b.label, 'zh-Hans-CN', { numeric: true });
    })
    .slice(0, limit);
}

export function getStats(records) {
  const ratedRecords = records.filter((record) => isValidRating(record.rating));
  const doneCount = records.filter((record) => record.status === 'done').length;
  const totalRating = ratedRecords.reduce((sum, record) => sum + Number(record.rating), 0);
  const tags = getTagSeries(records, Infinity);

  return {
    total: records.length,
    doneCount,
    ratedCount: ratedRecords.length,
    tagCount: tags.length,
    averageRating: ratedRecords.length ? (totalRating / ratedRecords.length).toFixed(1) : '',
    typeSeries: toSeries(countBy(records, (record) => record.type)),
    statusSeries: toSeries(
      countBy(records, (record) => getStatusLabel(record.status, record.type)),
    ),
    yearSeries: toSeries(countBy(records, getRecordYear)),
    workYearSeries: toSeries(countBy(records, getWorkYear)),
    tagSeries: tags.slice(0, 60),
    ratingSeries: Array.from({ length: 10 }, (_, index) => {
      const score = index + 1;
      return {
        label: `${score}`,
        value: records.filter((record) => Number(record.rating) === score).length,
      };
    }).filter((item) => item.value > 0),
  };
}

export function isValidRating(rating) {
  const score = Number(rating);
  return Number.isFinite(score) && score >= 1 && score <= 10;
}

export function filterRecords(records, filters = {}) {
  const today = filters.today || getCalendarToday();
  return records.filter((record) => {
    const keyword = filters.keyword?.trim().toLowerCase();
    const titleMatch =
      !keyword ||
      record.title.toLowerCase().includes(keyword) ||
      record.comment.toLowerCase().includes(keyword) ||
      record.tags.some((tag) => tag.toLowerCase().includes(keyword)) ||
      (record.animeTags || []).some((tag) => tag.toLowerCase().includes(keyword));
    const categoryMatch =
      !filters.category ||
      filters.category === 'all' ||
      getWorkCategory(record) === filters.category;
    const workYearMatch =
      !filters.workYear ||
      filters.workYear === 'all' ||
      getWorkYear(record) === filters.workYear;
    const typeMatch = !filters.type || record.type === filters.type;
    const statusMatch = !filters.status || record.status === filters.status;
    const yearMatch = !filters.year || filters.year === 'all' || getRecordYear(record) === filters.year;
    const tagMatch = !filters.tag || [...(record.tags || []), ...(record.animeTags || [])].includes(filters.tag);
    if (!(titleMatch && categoryMatch && workYearMatch && typeMatch && statusMatch && yearMatch && tagMatch)) return false;

    const hasCompletionFilter = filters.completionYear || filters.completionMonth || filters.completionDate || filters.completionIssue;
    if (!hasCompletionFilter) return true;
    if (record.status !== 'done') return false;
    const date = getCalendarDate(record.finishedAt);
    const completionMatches =
      (!filters.completionYear || date.slice(0, 4) === String(filters.completionYear)) &&
      (!filters.completionMonth || Number(date.slice(5, 7)) === Number(filters.completionMonth)) &&
      (!filters.completionDate || date === filters.completionDate);
    if (!completionMatches) return false;
    if (filters.completionIssue === 'missing') return !date;
    if (filters.completionIssue === 'future') return Boolean(date && date > today);
    return Boolean(date && date <= today);
  });
}
