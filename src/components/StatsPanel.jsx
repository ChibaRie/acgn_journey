import { useMemo, useState } from 'react';
import { CheckCircle2, Library, Star, Tags } from 'lucide-react';
import EmptyState from './EmptyState.jsx';

function BarList({ title, items }) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <section className="stat-section" aria-label={title}>
      <h3>{title}</h3>
      <div className="bar-list">
        {items.length === 0 && <p className="muted-text">暂无数据</p>}
        {items.map((item) => (
          <div className="bar-item" key={item.label}>
            <div className="bar-label">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
            <div className="bar-track" aria-hidden="true">
              <span style={{ width: `${(item.value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function collectRecordTags(record) {
  return Array.from(
    new Set(
      [...(record.tags || []), ...(record.animeTags || [])]
        .map((tag) => String(tag).trim())
        .filter(Boolean),
    ),
  );
}

function TagCloud({ items, records, tagCount }) {
  const [selectedTag, setSelectedTag] = useState('');
  const max = Math.max(...items.map((item) => item.value), 1);
  const min = Math.min(...items.map((item) => item.value), max);
  const span = Math.max(max - min, 1);

  const selectedRecords = useMemo(() => {
    if (!selectedTag) return [];
    return records.filter((record) => collectRecordTags(record).includes(selectedTag));
  }, [records, selectedTag]);

  return (
    <section className="stat-section tag-cloud-section" aria-label="标签词云">
      <div className="tag-cloud-heading">
        <div>
          <h3>标签词云</h3>
        </div>
        <span>{tagCount} 个标签</span>
      </div>

      {items.length === 0 ? (
        <p className="muted-text">暂无标签数据</p>
      ) : (
        <>
          <div className="tag-cloud" role="list" aria-label="作品标签词云">
            {items.map((item, index) => {
              const weight = (item.value - min) / span;
              const size = 0.92 + weight * 0.9 + Math.min(item.value, 8) * 0.03;
              const active = selectedTag === item.label;
              return (
                <button
                  key={item.label}
                  className={`cloud-word tone-${index % 5}${active ? ' active' : ''}`}
                  type="button"
                  style={{ '--tag-size': `${size.toFixed(2)}rem`, '--tag-weight': weight }}
                  title={`${item.label}：${item.value} 部作品`}
                  aria-pressed={active}
                  aria-label={`${item.label} ${item.value}`}
                  onClick={() => setSelectedTag(active ? '' : item.label)}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </button>
              );
            })}
          </div>

          <div className="tag-cloud-detail" aria-live="polite">
            {selectedTag ? (
              <>
                <p>
                  <strong>{selectedTag}</strong> 关联 {selectedRecords.length} 部作品
                </p>
                <div className="tag-cloud-records">
                  {selectedRecords.slice(0, 8).map((record) => (
                    <span key={record.id}>{record.title}</span>
                  ))}
                </div>
                {selectedRecords.length > 8 && <p className="muted-text">预览前 8 部作品</p>}
              </>
            ) : (
              <p>选择一个标签，看看它对应了哪些收藏。</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export default function StatsPanel({ records, stats }) {
  if (records.length === 0) {
    return (
      <section className="panel" aria-labelledby="stats-title">
        <div className="section-heading">
          <div>
            <h2 id="stats-title">作品分布</h2>
          </div>
        </div>
        <EmptyState title="暂无统计" description="添加作品并补充评分后，统计面板会自动更新。" />
      </section>
    );
  }

  return (
    <section className="panel" aria-labelledby="stats-title">
      <div className="section-heading">
        <div>
          <h2 id="stats-title">作品分布</h2>
        </div>
      </div>

      <div className="stat-cards">
        <article className="stat-card accent-red">
          <Library size={20} />
          <span>总作品数</span>
          <strong>{stats.total}</strong>
        </article>
        <article className="stat-card accent-teal">
          <CheckCircle2 size={20} />
          <span>已完成</span>
          <strong>{stats.doneCount}</strong>
        </article>
        <article className="stat-card accent-amber">
          <Star size={20} />
          <span>平均评分</span>
          <strong>{stats.averageRating || '--'}</strong>
          <span>{stats.ratedCount} 部评分样本</span>
        </article>
        <article className="stat-card accent-indigo">
          <Tags size={20} />
          <span>标签数量</span>
          <strong>{stats.tagCount || 0}</strong>
        </article>
      </div>

      <TagCloud items={stats.tagSeries || []} records={records} tagCount={stats.tagCount || 0} />

      <div className="stats-grid">
        <BarList title="类型分布" items={stats.typeSeries} />
        <BarList title="作品年份分布" items={stats.workYearSeries || []} />
        <BarList title="记录年份分布" items={stats.yearSeries} />
        <BarList title="状态分布" items={stats.statusSeries} />
        <BarList title="评分分布" items={stats.ratingSeries} />
      </div>
    </section>
  );
}
