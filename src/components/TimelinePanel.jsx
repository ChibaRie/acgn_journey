import { useMemo, useState } from 'react';
import { CalendarDays, Edit3, Filter } from 'lucide-react';
import EmptyState from './EmptyState.jsx';
import { STATUS_OPTIONS, getRecordYear, getStatusLabel } from '../utils/library.js';
import { filterRecords } from '../utils/stats.js';

function groupByYear(records) {
  return records.reduce((acc, record) => {
    const year = getRecordYear(record);
    acc[year] = acc[year] || [];
    acc[year].push(record);
    return acc;
  }, {});
}

export default function TimelinePanel({ records, onEditRecord }) {
  const [filters, setFilters] = useState({ year: '', type: '', status: '' });
  const years = useMemo(
    () => [...new Set(records.map(getRecordYear))].sort((a, b) => b.localeCompare(a)),
    [records],
  );
  const types = useMemo(() => [...new Set(records.map((record) => record.type))], [records]);
  const filtered = useMemo(() => filterRecords(records, filters), [records, filters]);
  const grouped = useMemo(() => groupByYear(filtered), [filtered]);

  const sortedYears = Object.keys(grouped).sort((a, b) => {
    if (a === '未设置') return 1;
    if (b === '未设置') return -1;
    return Number(b) - Number(a);
  });

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <section className="panel" aria-labelledby="timeline-title">
      <div className="section-heading split">
        <div>
          <p className="eyebrow">个人历程</p>
          <h2 id="timeline-title">按完成时间沉淀你的 ACGN 轨迹</h2>
        </div>
        <div className="result-count">{filtered.length} 条</div>
      </div>

      <div className="filter-row" aria-label="历程筛选">
        <span className="source-label">
          <Filter size={16} />
          筛选
        </span>
        <select value={filters.year} onChange={(event) => updateFilter('year', event.target.value)}>
          <option value="">全部年份</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <select value={filters.type} onChange={(event) => updateFilter('type', event.target.value)}>
          <option value="">全部类型</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
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
        <EmptyState title="时间线等待第一条记录" description="加入作品后，这里会自动按年份分组。" />
      )}

      {records.length > 0 && filtered.length === 0 && (
        <EmptyState title="筛选下没有历程" description="换一个年份、类型或状态看看。" />
      )}

      <div className="timeline">
        {sortedYears.map((year) => (
          <section className="timeline-year" key={year} aria-label={`${year} 年记录`}>
            <div className="year-sticky">
              <CalendarDays size={17} />
              <span>{year}</span>
            </div>

            <div className="timeline-items">
              {grouped[year]
                .slice()
                .sort(
                  (a, b) =>
                    new Date(b.finishedAt || b.addedAt).getTime() -
                    new Date(a.finishedAt || a.addedAt).getTime(),
                )
                .map((record) => (
                  <article className="timeline-entry" key={record.id}>
                    <time>{record.finishedAt || record.startedAt || record.addedAt.slice(0, 10)}</time>
                    <div className="timeline-dot" aria-hidden="true" />
                    <div className="timeline-entry-main">
                      <div className="timeline-title-line">
                        <h3>{record.title}</h3>
                        <button
                          className="icon-button"
                          type="button"
                          onClick={() => onEditRecord(record)}
                          aria-label={`编辑 ${record.title}`}
                          title="编辑"
                        >
                          <Edit3 size={16} />
                        </button>
                      </div>
                      <p>
                        {record.type} · {getStatusLabel(record.status, record.type)}
                        {record.rating > 0 ? ` · ${record.rating}/10` : ''}
                      </p>
                      {record.comment && <blockquote>{record.comment}</blockquote>}
                    </div>
                  </article>
                ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
