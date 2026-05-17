import { useMemo, useState } from 'react';
import { Edit3, Filter, Star, Tag, Trash2 } from 'lucide-react';
import EmptyState from './EmptyState.jsx';
import {
  STATUS_OPTIONS,
  WORK_CATEGORIES,
  getStatusLabel,
  getWorkCategory,
  getWorkYear,
} from '../utils/library.js';
import { filterRecords } from '../utils/stats.js';

export default function LibraryPanel({ records, onEditRecord, onDeleteRecord }) {
  const [filters, setFilters] = useState({
    keyword: '',
    category: 'all',
    workYear: 'all',
    status: '',
  });
  const filteredRecords = useMemo(() => filterRecords(records, filters), [records, filters]);

  const categoryCounts = useMemo(
    () =>
      WORK_CATEGORIES.map((category) => ({
        ...category,
        count:
          category.value === 'all'
            ? records.length
            : records.filter((record) => getWorkCategory(record) === category.value).length,
      })),
    [records],
  );

  const workYearCounts = useMemo(() => {
    const yearMap = new Map();
    records.forEach((record) => {
      const year = getWorkYear(record);
      yearMap.set(year, (yearMap.get(year) || 0) + 1);
    });

    const years = Array.from(yearMap.entries()).sort(([a], [b]) => {
      if (a === '未设置') return 1;
      if (b === '未设置') return -1;
      return Number(b) - Number(a);
    });

    return [
      { value: 'all', label: '全部年份', count: records.length },
      ...years.map(([year, count]) => ({ value: year, label: year, count })),
    ];
  }, [records]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const confirmDelete = (record) => {
    if (window.confirm(`删除《${record.title}》这条记录？`)) {
      onDeleteRecord(record.id);
    }
  };

  return (
    <section className="panel" aria-labelledby="library-title">
      <div className="section-heading split">
        <div>
          <p className="eyebrow">本地作品库</p>
          <h2 id="library-title">按分类查看、编辑状态、评分、短评和标签</h2>
        </div>
        <div className="result-count">
          {filteredRecords.length} / {records.length}
        </div>
      </div>

      <div className="category-row" aria-label="作品分类">
        {categoryCounts.map((category) => (
          <button
            key={category.value}
            className={filters.category === category.value ? 'category-chip active' : 'category-chip'}
            type="button"
            onClick={() => updateFilter('category', category.value)}
            aria-pressed={filters.category === category.value}
          >
            <span>{category.label}</span>
            <strong>{category.count}</strong>
          </button>
        ))}
      </div>

      <div className="category-row year-category-row" aria-label="作品年份">
        <span className="category-row-label">作品年份</span>
        {workYearCounts.map((year) => (
          <button
            key={year.value}
            className={filters.workYear === year.value ? 'category-chip active' : 'category-chip'}
            type="button"
            onClick={() => updateFilter('workYear', year.value)}
            aria-pressed={filters.workYear === year.value}
          >
            <span>{year.label}</span>
            <strong>{year.count}</strong>
          </button>
        ))}
      </div>

      <div className="filter-row" aria-label="库筛选">
        <label className="filter-input grow">
          <Filter size={16} />
          <span className="sr-only">筛选关键词</span>
          <input
            value={filters.keyword}
            onChange={(event) => updateFilter('keyword', event.target.value)}
            placeholder="按标题、短评、标签筛选"
          />
        </label>

        <select
          value={filters.status}
          onChange={(event) => updateFilter('status', event.target.value)}
        >
          <option value="">全部状态</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status.value} value={status.value}>
              {status.defaultLabel}
            </option>
          ))}
        </select>
      </div>

      {records.length === 0 && (
        <EmptyState title="作品库还是空的" description="先去搜索页加入几部作品，时间线和统计会自动生成。" />
      )}

      {records.length > 0 && filteredRecords.length === 0 && (
        <EmptyState title="当前分类下没有记录" description="换一个分类、状态或关键词看看。" />
      )}

      <div className="library-list">
        {filteredRecords.map((record) => (
          <article className="library-item" key={record.id}>
            <div className="mini-cover">
              {record.cover ? (
                <img
                  src={record.cover}
                  alt={`${record.title} 封面`}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{record.title.slice(0, 2)}</span>
              )}
            </div>

            <div className="library-content">
              <div className="library-title-row">
                <div>
                  <h3>{record.title}</h3>
                  <p>
                    {record.type} · {record.source}
                  </p>
                </div>
                <span className="status-pill">{getStatusLabel(record.status, record.type)}</span>
              </div>

              <p className="summary compact">{record.comment || record.summary || '暂无短评。'}</p>

              <div className="record-meta">
                <span>
                  <Star size={15} />
                  {record.rating > 0 ? `${record.rating}/10` : '未评分'}
                </span>
                <span>{getWorkYear(record)} 年</span>
                <span>
                  <Tag size={15} />
                  {record.tags.length > 0 ? record.tags.join(' / ') : '无标签'}
                </span>
              </div>
            </div>

            <div className="item-actions">
              <button
                className="icon-button"
                type="button"
                onClick={() => onEditRecord(record)}
                aria-label={`编辑 ${record.title}`}
                title="编辑"
              >
                <Edit3 size={17} />
              </button>
              <button
                className="icon-button danger"
                type="button"
                onClick={() => confirmDelete(record)}
                aria-label={`删除 ${record.title}`}
                title="删除"
              >
                <Trash2 size={17} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
