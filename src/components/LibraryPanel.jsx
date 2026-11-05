import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
  Edit3,
  Filter,
  LayoutGrid,
  List,
  Square,
  Star,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import EmptyState from './EmptyState.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import {
  STATUS_OPTIONS,
  WORK_CATEGORIES,
  getStatusLabel,
  getWorkCategory,
  getWorkYear,
} from '../utils/library.js';
import { filterRecords } from '../utils/stats.js';
import { loadLibraryView, saveLibraryView } from '../utils/libraryView.js';

const DEFAULT_FILTERS = {
  keyword: '',
  category: 'all',
  workYear: 'all',
  status: '',
};
const PAGE_SIZE = 48;
const LINKED_FILTERS = [
  'year',
  'tag',
  'completionYear',
  'completionMonth',
  'completionDate',
  'completionIssue',
  'today',
];

function getFilterLabel(key, value) {
  const labels = {
    keyword: '关键词',
    category: '分类',
    workYear: '作品年份',
    status: '状态',
    year: '记录年份',
    tag: '标签',
    completionYear: '完成年份',
    completionMonth: '完成月份',
    completionDate: '完成日期',
    completionIssue: '完成日期',
  };
  let display = value;
  if (key === 'category')
    display =
      WORK_CATEGORIES.find((item) => item.value === value)?.label || value;
  if (key === 'status') display = getStatusLabel(value);
  if (key === 'completionIssue')
    display = value === 'missing' ? '缺失或无效' : '未来日期待核对';
  return `${labels[key] || key} ${display}`;
}

export default function LibraryPanel({
  records,
  onEditRecord,
  onDeleteRecord,
  onBulkUpdateRecords,
  onDeleteRecords,
  externalFilters,
  readOnly = false,
}) {
  const [filters, setFilters] = useState(() => ({
    ...DEFAULT_FILTERS,
    ...externalFilters,
  }));
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [viewMode, setViewMode] = useState(loadLibraryView);
  const [page, setPage] = useState(1);
  const listRef = useRef(null);
  useEffect(() => {
    setPage(1);
  }, [filters]);
  useEffect(() => {
    if (!externalFilters) return;
    setFilters((current) => {
      const next = { ...current };
      LINKED_FILTERS.forEach((key) => delete next[key]);
      return { ...next, ...externalFilters };
    });
    setSelectedIds([]);
  }, [externalFilters]);
  const filteredRecords = useMemo(
    () => filterRecords(records, filters),
    [records, filters]
  );
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRecords = filteredRecords.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleRecordIds = useMemo(
    () => filteredRecords.map((record) => record.id),
    [filteredRecords]
  );
  const selectedVisibleCount = visibleRecordIds.filter((id) =>
    selectedIdSet.has(id)
  ).length;
  const allVisibleSelected =
    visibleRecordIds.length > 0 &&
    selectedVisibleCount === visibleRecordIds.length;
  const selectedCount = selectedIds.length;

  const categoryCounts = useMemo(
    () =>
      WORK_CATEGORIES.map((category) => ({
        ...category,
        count:
          category.value === 'all'
            ? records.length
            : records.filter(
                (record) => getWorkCategory(record) === category.value
              ).length,
      })),
    [records]
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

  const changeViewMode = (nextViewMode) => {
    setViewMode(saveLibraryView(nextViewMode));
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
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id]
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
    if (readOnly || !bulkStatus || selectedCount === 0) return;
    onBulkUpdateRecords(selectedIds, { status: bulkStatus });
    setSelectedIds([]);
    setBulkStatus('');
  };

  const handleBulkDelete = () => {
    if (readOnly || selectedCount === 0) return;
    setDeleteDialog({
      type: 'bulk',
      ids: [...selectedIds],
      count: selectedCount,
    });
  };

  const confirmDelete = (record) => {
    if (readOnly) return;
    setDeleteDialog({
      type: 'single',
      record,
    });
  };

  const closeDeleteDialog = () => {
    setDeleteDialog(null);
  };

  const handleConfirmDelete = () => {
    if (readOnly || !deleteDialog) return;

    if (deleteDialog.type === 'bulk') {
      onDeleteRecords(deleteDialog.ids);
      setSelectedIds([]);
      setBulkStatus('');
    } else {
      onDeleteRecord(deleteDialog.record.id);
    }

    setDeleteDialog(null);
  };

  return (
    <section className="panel" aria-labelledby="library-title">
      <div className="section-heading split">
        <div>
          <h2 id="library-title">作品库</h2>
        </div>
        <div className="library-heading-actions">
          <div className="result-count">
            {filteredRecords.length} / {records.length}
          </div>
          <div
            className="library-view-toggle"
            role="group"
            aria-label="作品库视图"
          >
            <button
              className={viewMode === 'list' ? 'active' : ''}
              type="button"
              onClick={() => changeViewMode('list')}
              aria-pressed={viewMode === 'list'}
              aria-label="切换为列表视图"
              title="列表视图"
            >
              <List size={17} />
              <span>列表</span>
            </button>
            <button
              className={viewMode === 'grid' ? 'active' : ''}
              type="button"
              onClick={() => changeViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              aria-label="切换为方块视图"
              title="方块视图"
            >
              <LayoutGrid size={17} />
              <span>方块</span>
            </button>
          </div>
        </div>
      </div>

      {records.length > 0 && (
        <div className="bulk-toolbar" aria-label="批量管理">
          <button
            className={
              bulkMode ? 'button secondary active' : 'button secondary'
            }
            type="button"
            onClick={toggleBulkMode}
            disabled={readOnly}
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
                disabled={readOnly || visibleRecordIds.length === 0}
              >
                {allVisibleSelected ? (
                  <CheckSquare size={16} />
                ) : (
                  <Square size={16} />
                )}
                <span>
                  {allVisibleSelected ? '取消当前筛选' : '选择当前筛选'}
                </span>
              </button>

              <div className="bulk-actions">
                <span className="bulk-count">{selectedCount} 项已选</span>
                <select
                  value={bulkStatus}
                  onChange={(event) => setBulkStatus(event.target.value)}
                  disabled={readOnly || selectedCount === 0}
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
                  disabled={readOnly || !bulkStatus || selectedCount === 0}
                >
                  <span>应用</span>
                </button>
                <button
                  className="button danger"
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={readOnly || selectedCount === 0}
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
            className={
              filters.category === category.value
                ? 'category-chip active'
                : 'category-chip'
            }
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
            className={
              filters.workYear === year.value
                ? 'category-chip active'
                : 'category-chip'
            }
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
          aria-label="作品状态"
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

      <div className="category-row" aria-label="已应用筛选">
        {Object.entries(filters)
          .filter(([key, value]) => key !== 'today' && value && value !== 'all')
          .map(([key, value]) => (
            <button
              key={key}
              className="category-chip active"
              type="button"
              aria-label={`清除${getFilterLabel(key, value)}`}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  [key]: DEFAULT_FILTERS[key] || '',
                }))
              }
            >
              <span>{getFilterLabel(key, value)}</span>
              <X size={16} aria-hidden="true" />
            </button>
          ))}
        {Object.entries(filters).some(
          ([key, value]) => key !== 'today' && value && value !== 'all'
        ) && (
          <button
            className="button secondary"
            type="button"
            onClick={() => setFilters({ ...DEFAULT_FILTERS })}
          >
            清除全部筛选
          </button>
        )}
      </div>

      {records.length === 0 && (
        <EmptyState
          title="作品库还是空的"
          description="先去搜索页加入几部作品，时间线和统计会自动生成。"
        />
      )}

      {records.length > 0 && filteredRecords.length === 0 && (
        <EmptyState
          title="当前分类下没有记录"
          description="换一个分类、状态或关键词看看。"
        />
      )}

      <div
        ref={listRef}
        className={`library-list ${viewMode === 'grid' ? 'grid-view' : 'list-view'}`}
        data-view={viewMode}
      >
        {pageRecords.map((record) => {
          const displayTags =
            record.tags.length > 0 ? record.tags : record.animeTags || [];
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
                  <span className="status-pill">
                    {getStatusLabel(record.status, record.type)}
                  </span>
                </div>

                <p className="summary compact">
                  {record.comment || record.summary || '暂无短评。'}
                </p>

                <div className="record-meta">
                  <span>
                    <Star size={15} />
                    {record.rating > 0 ? `${record.rating}/10` : '未评分'}
                  </span>
                  <span>{getWorkYear(record)} 年</span>
                  <span className="record-tags">
                    <Tag size={15} />
                    {displayTags.length > 0
                      ? displayTags.join(' / ')
                      : '无标签'}
                  </span>
                </div>
              </div>

              <div className="item-actions">
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => {
                    if (!readOnly) onEditRecord(record);
                  }}
                  disabled={readOnly}
                  aria-label={`编辑 ${record.title}`}
                  title="编辑"
                >
                  <Edit3 size={17} />
                </button>
                <button
                  className="icon-button danger"
                  type="button"
                  onClick={() => confirmDelete(record)}
                  disabled={readOnly}
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

      {pageCount > 1 && (
        <nav className="pagination" aria-label="作品库分页">
          <button
            className="button secondary"
            type="button"
            disabled={currentPage === 1}
            onClick={() => {
              setPage(currentPage - 1);
              listRef.current?.scrollIntoView?.({ block: 'start' });
            }}
          >
            上一页
          </button>
          <span>
            第 {currentPage} / {pageCount} 页 · {filteredRecords.length} 部作品
          </span>
          <button
            className="button secondary"
            type="button"
            disabled={currentPage === pageCount}
            onClick={() => {
              setPage(currentPage + 1);
              listRef.current?.scrollIntoView?.({ block: 'start' });
            }}
          >
            下一页
          </button>
        </nav>
      )}

      {deleteDialog && (
        <ConfirmModal
          eyebrow="删除确认"
          title={
            deleteDialog.type === 'bulk'
              ? '删除选中的记录？'
              : `删除《${deleteDialog.record.title}》？`
          }
          description={
            deleteDialog.type === 'bulk'
              ? `将删除选中的 ${deleteDialog.count} 条记录。此操作不会影响你的本地备份文件。`
              : '这条记录会从我的库中移除。此操作不会影响你的本地备份文件。'
          }
          icon={Trash2}
          tone="danger"
          confirmLabel="确认删除"
          onCancel={closeDeleteDialog}
          onConfirm={handleConfirmDelete}
        />
      )}
    </section>
  );
}
