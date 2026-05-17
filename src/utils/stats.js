import { getRecordYear, getStatusLabel, getWorkCategory, getWorkYear } from './library.js';

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

export function getStats(records) {
  const ratedRecords = records.filter((record) => Number(record.rating) > 0);
  const doneCount = records.filter((record) => record.status === 'done').length;
  const totalRating = ratedRecords.reduce((sum, record) => sum + Number(record.rating), 0);

  return {
    total: records.length,
    doneCount,
    averageRating: ratedRecords.length ? (totalRating / ratedRecords.length).toFixed(1) : '',
    typeSeries: toSeries(countBy(records, (record) => record.type)),
    statusSeries: toSeries(
      countBy(records, (record) => getStatusLabel(record.status, record.type)),
    ),
    yearSeries: toSeries(countBy(records, getRecordYear)),
    workYearSeries: toSeries(countBy(records, getWorkYear)),
    ratingSeries: Array.from({ length: 10 }, (_, index) => {
      const score = index + 1;
      return {
        label: `${score}`,
        value: records.filter((record) => Number(record.rating) === score).length,
      };
    }).filter((item) => item.value > 0),
  };
}

export function filterRecords(records, filters) {
  return records.filter((record) => {
    const keyword = filters.keyword?.trim().toLowerCase();
    const titleMatch =
      !keyword ||
      record.title.toLowerCase().includes(keyword) ||
      record.comment.toLowerCase().includes(keyword) ||
      record.tags.some((tag) => tag.toLowerCase().includes(keyword));
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
    const yearMatch = !filters.year || getRecordYear(record) === filters.year;
    return titleMatch && categoryMatch && workYearMatch && typeMatch && statusMatch && yearMatch;
  });
}
