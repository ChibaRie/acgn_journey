import { BarChart3, CheckCircle2, Library, Star } from 'lucide-react';
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

export default function StatsPanel({ records, stats }) {
  if (records.length === 0) {
    return (
      <section className="panel" aria-labelledby="stats-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">统计面板</p>
            <h2 id="stats-title">作品、类型、年份和评分分布</h2>
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
          <p className="eyebrow">统计面板</p>
          <h2 id="stats-title">总览与分布</h2>
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
        </article>
        <article className="stat-card accent-indigo">
          <BarChart3 size={20} />
          <span>类型数量</span>
          <strong>{stats.typeSeries.length}</strong>
        </article>
      </div>

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
