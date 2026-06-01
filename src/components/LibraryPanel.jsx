import { useMemo, useState } from 'react';
import { CheckSquare, Edit3, Filter, Square, Star, Tag, Trash2, X } from 'lucide-react';
import EmptyState from './EmptyState.jsx';
import {
  STATUS_OPTIONS,
  WORK_CATEGORIES,
  getStatusLabel,
  getWorkCategory,
  getWorkYear,
} from '../utils/library.js';
import { filterRecords } from '../utils/stats.js';

export default function LibraryPanel({
  records,
  onEditRecord,
  onDeleteRecord,
  onBulkUpdateRecords,
  onDeleteRecords,
}) {
  const [filters, setFilters] = useState({
    keyword: '',
    category: 'all',
    workYear: 'all',
    status: '',
  });
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const filteredRecords = useMemo(() => filterRecords(records, filters), [records, filters]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleRecordIds = useMemo(() => filteredRecords.map((record) => record.id), [filteredRecords]);
  const selectedVisibleCount = visibleRecordIds.filter((id) => selectedIdSet.has(id)).length;
  const allVisibleSelected = visibleRecordIds.length > 0 && selectedVisibleCount === visibleRecordIds.length;
  const selectedCount = selectedIds.length;

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

  const toggleBulkMode = () => {
    setBulkMode((current) => {
      if (current) {
        setSelectedIds([]);
        setBulkStatus('');
      }
      return !current;
    });
  };

  const toggleRecordSelection = (id) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id],
    );
  };

  const toggleVisibleSelection = () => {
    setSelectedIds((current) => {
      const currentSet = new Set(current);
      if (allVisibleSelected) {
        return current.filter((id) => !visibleRecordIds.includes(id));
      }
      visibleRecordIds.forEach((id) => currentSet.add(id));
      return Array.from(currentSet);
    });
  };

  const handleApplyStatus = () => {
    if (!bulkStatus || selectedCount === 0) return;
    onBulkUpdateRecords(selectedIds, { status: bulkStatus });
    setSelectedIds([]);
    setBulkStatus('');
  };

  const handleBulkDelete = () => {
    if (selectedCount === 0) return;
    const confirmed = window.confirm(`删除选中的 ${selectedCount} 条记录？`);
    if (!confirmed) return;
    onDeleteRecords(selectedIds);
    setSelectedIds([]);
    setBulkStatus('');
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

      {records.length > 0 && (
        <div className="bulk-toolbar" aria-label="批量管理">
          <button
            className={bulkMode ? 'button secondary active' : 'button secondary'}
            type="button"
            onClick={toggleBulkMode}
            aria-pressed={bulkMode}
          >
            {bulkMode ? <X size={16} /> : <CheckSquare size={16} />}
            <span>{bulkMode ? '退出批量管理' : '批量管理'}</span>
          </button>

          {bulkMode && (
            <>
              <button
                className="button secondary"
                type="button"
                onClick={toggleVisibleSelection}
                disabled={visibleRecordIds.length === 0}
              >
                {allVisibleSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                <span>{allVisibleSelected ? '取消当前筛选' : '选择当前筛选'}</span>
              </button>

              <div className="bulk-actions">
                <span className="bulk-count">{selectedCount} 项已选</span>
                <select
                  value={bulkStatus}
                  onChange={(event) => setBulkStatus(event.target.value)}
                  disabled={selectedCount === 0}
                  aria-label="批量修改状态"
                >
                  <option value="">修改状态</option>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.defaultLabel}
                    </option>
                  ))}
                </select>
                <button
                  className="button primary"
                  type="button"
                  onClick={handleApplyStatus}
                  disabled={!bulkStatus || selectedCount === 0}
                >
                  <span>应用</span>
                </button>
                <button
                  className="button danger"
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={selectedCount === 0}
                >
                  <Trash2 size={16} />
                  <span>删除</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

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
        {filteredRecords.map((record) => {
          const displayTags = record.tags.length > 0 ? record.tags : record.animeTags || [];
          const isSelected = selectedIdSet.has(record.id);
          return (
            <article
              className={
                bulkMode
                  ? isSelected
                    ? 'library-item bulk-select selected'
                    : 'library-item bulk-select'
                  : isSelected
                    ? 'library-item selected'
                    : 'library-item'
              }
              key={record.id}
            >
              {bulkMode && (
                <label className="library-select">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleRecordSelection(record.id)}
                  />
                  <span className="sr-only">选择 {record.title}</span>
                </label>
              )}
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
                    {displayTags.length > 0 ? displayTags.join(' / ') : '无标签'}
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
          );
        })}
      </div>
    </section>
  );
}
