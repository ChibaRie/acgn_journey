import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, BarChart3, BookOpen, CalendarDays, Dices, Expand, Shrink, X } from 'lucide-react';
import ModalDialog from './ModalDialog.jsx';
import { WORK_CATEGORIES, getCategoryLabel, getStatusLabel, getWorkCategory } from '../utils/library.js';
import { getCalendarToday } from '../utils/dates.js';
import { drawWish, getAnnualReview, getDashboardData } from '../utils/dashboard.js';
import { filterRecords } from '../utils/stats.js';
import './Dashboard.css';

const MEDIA_COLORS = ['var(--primary)', 'var(--teal)', '#C8587B', 'var(--amber)', 'var(--muted)'];

function CoverButton({ record, onOpen, compact = false }) {
  const [failedCover, setFailedCover] = useState('');
  return (
    <button
      className={`dash-work${compact ? ' dash-work-compact' : ''}`}
      type="button"
      onClick={() => onOpen?.(record)}
      aria-label={`打开 ${record.title}`}
    >
      <span className="dash-cover">
        {record.cover && failedCover !== record.cover ? (
          <img
            src={record.cover}
            alt={`${record.title} 封面`}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailedCover(record.cover)}
          />
        ) : (
          <span className="dash-cover-placeholder" aria-hidden="true">
            <BookOpen size={24} />
            <span>{record.title.slice(0, 2)}</span>
          </span>
        )}
      </span>
      <span className="dash-work-copy">
        <strong>{record.title}</strong>
        <span>{getCategoryLabel(getWorkCategory(record))}</span>
        <span className="dash-work-state">{getStatusLabel(record.status, record.type)}</span>
      </span>
      <ArrowUpRight size={17} aria-hidden="true" />
    </button>
  );
}

function MediaChart({ items, total, onSelect }) {
  let position = 0;
  const stops = items.map((item, index) => {
    const start = position;
    position += total ? item.value / total * 100 : 0;
    return `${MEDIA_COLORS[index]} ${start}% ${position}%`;
  });
  return (
    <div className="dash-distribution">
      <div
        className="dash-ring"
        style={{ background: total ? `conic-gradient(${stops.join(',')})` : 'var(--border)' }}
        aria-hidden="true"
      >
        <div>
          <strong>{total}</strong>
          <span>部作品</span>
        </div>
      </div>
      <ul className="dash-media-list">
        {items.map((item, index) => (
          <li key={item.category}>
            <button type="button" onClick={() => onSelect?.(item.category)} aria-label={`${item.label} ${item.value} 部`}>
              <span className="dash-media-dot" style={{ backgroundColor: MEDIA_COLORS[index] }} aria-hidden="true" />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <span className="dash-percent">{total ? Math.round(item.value / total * 100) : 0}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TrendChart({ items, monthly, onSelect }) {
  const available = items.filter((item) => !item.future);
  const maximum = Math.max(...available.map((item) => item.value), 1);
  const width = 600;
  const pointX = (index) => items.length > 1 ? 8 + index / (items.length - 1) * (width - 16) : width / 2;
  const pointY = (value) => 110 - value / maximum * 96;
  const points = available.map((item) => `${pointX(items.indexOf(item))},${pointY(item.value)}`).join(' ');
  if (items.length === 0) return <p className="dash-empty-message">暂无有效完成记录</p>;
  return (
    <div className="dash-trend">
      <div className="dash-trend-scale">
        <span>{maximum} 部</span>
        <span>0 部</span>
      </div>
      <div className="dash-trend-main">
        <svg viewBox={`0 0 ${width} 120`} preserveAspectRatio="none" role="img" aria-label="完成数量趋势图">
          <path d="M0 110H600M0 62H600M0 14H600" className="dash-chart-grid" />
          <polyline points={points} className="dash-chart-line" vectorEffect="non-scaling-stroke" />
          {available.map((item) => (
            <circle key={item.label} cx={pointX(items.indexOf(item))} cy={pointY(item.value)} r="3.5" className="dash-chart-point" />
          ))}
        </svg>
        <div className="dash-trend-labels">
          {items.map((item) => {
            const label = monthly ? `${Number(item.label)}月` : `${item.label}年`;
            return (
              <button
                key={item.label}
                type="button"
                disabled={item.future}
                onClick={() => onSelect(item)}
                aria-label={item.future ? `${label}尚未到达` : `${label}完成 ${item.value} 部`}
              >
                <span>{label}</span>
                <strong>{item.future ? '待到达' : item.value}</strong>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CompletionCalendar({ calendar, onSelect }) {
  const [selectedDate, setSelectedDate] = useState(calendar.end);
  const [focusIndex, setFocusIndex] = useState(calendar.days.length - 1);
  const gridRef = useRef(null);
  const selected = calendar.days.find((day) => day.date === selectedDate);
  const handleKeyDown = (event, index) => {
    const moves = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 };
    if (!(event.key in moves) && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    let next = index + (moves[event.key] || 0);
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = calendar.days.length - 1;
    next = Math.max(0, Math.min(calendar.days.length - 1, next));
    setFocusIndex(next);
    gridRef.current.querySelectorAll('button')[next]?.focus();
  };
  if (calendar.future) return <p className="dash-empty-message">未来年份的完成日期待核对</p>;
  return (
    <>
      <p className="dash-calendar-range">{calendar.start} 至 {calendar.end} · {calendar.total} 部</p>
      <div ref={gridRef} className="dash-calendar" role="group" aria-label="26 周完成日历，方向键选择日期">
        {calendar.days.map((day, index) => (
          <button
            key={day.date}
            className={`dash-calendar-day dash-level-${Math.min(day.value, 4)}`}
            type="button"
            tabIndex={index === focusIndex ? 0 : -1}
            title={`${day.date} · ${day.value} 部`}
            aria-label={`${day.date} 完成 ${day.value} 部`}
            onFocus={() => { setFocusIndex(index); setSelectedDate(day.date); }}
            onKeyDown={(event) => handleKeyDown(event, index)}
            onClick={() => onSelect(day.date)}
          />
        ))}
      </div>
      <div className="dash-calendar-controls">
        <label>
          完成日期
          <input type="date" min={calendar.start} max={calendar.end} value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
        </label>
        <button className="dash-button" type="button" disabled={!selected} onClick={() => onSelect(selectedDate)}>查看 {selected?.value || 0} 部</button>
      </div>
      <p className="dash-caption">方向键选择日期，回车查看作品</p>
    </>
  );
}

export default function Dashboard({
  records,
  onEditRecord,
  onOpenLibrary,
  onOpenDiscover,
  onOpenImport,
  onOpenStats,
  onToast,
  motionEnabled = true,
}) {
  const [category, setCategory] = useState('all');
  const [year, setYear] = useState('all');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewYear, setReviewYear] = useState(() => getCalendarToday().slice(0, 4));
  const [wishId, setWishId] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const rootRef = useRef(null);
  const today = getCalendarToday();
  const data = useMemo(() => getDashboardData(records, { category, year, today }), [records, category, year, today]);
  const wishes = useMemo(() => filterRecords(records, { category, status: 'wish' }), [records, category]);
  const wish = wishes.find((record) => record.id === wishId);
  const review = useMemo(
    () => reviewOpen ? getAnnualReview(records, { category, year: reviewYear, today }) : null,
    [records, category, reviewYear, today, reviewOpen],
  );
  const filters = { category, year };
  const openLibrary = (extra = {}) => onOpenLibrary?.({ ...filters, ...extra });
  const reviewYears = Array.from(new Set([today.slice(0, 4), ...data.years])).sort().reverse();

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (rootRef.current.requestFullscreen) await rootRef.current.requestFullscreen();
      else onToast?.('当前环境暂不支持全屏展示');
    } catch {
      onToast?.('未能进入全屏，请重试');
    }
  };

  const changeCategory = (value) => {
    setCategory(value);
    setWishId('');
  };
  const draw = () => setWishId(drawWish(records, { category, previousId: wishId })?.id || '');
  const openReview = () => {
    setReviewYear(year === 'all' ? today.slice(0, 4) : year);
    setReviewOpen(true);
  };

  const openTrend = (item) => {
    const completion = { completionYear: year === 'all' ? item.label : year };
    if (year !== 'all') completion.completionMonth = item.label;
    openLibrary(completion);
  };

  const openReviewLibrary = (extra) => {
    setReviewOpen(false);
    onOpenLibrary?.({ category, completionYear: reviewYear, ...extra });
  };

  return (
    <section ref={rootRef} className="dash" data-motion={motionEnabled ? 'on' : 'off'} aria-labelledby="dashboard-title">
      <div className="dash-heading">
        <h1 id="dashboard-title">作品总览</h1>
        <div className="dash-heading-actions">
          <button className="dash-button" type="button" onClick={() => onOpenStats?.(filters)}>
            <BarChart3 size={18} />详细统计
          </button>
          <button className="dash-button" type="button" onClick={toggleFullscreen} aria-label={fullscreen ? '退出全屏' : '全屏展示'}>
            {fullscreen ? <Shrink size={18} /> : <Expand size={18} />}
            <span>{fullscreen ? '退出全屏' : '全屏展示'}</span>
          </button>
        </div>
      </div>

      <div className="dash-filters">
        <div className="dash-categories" role="group" aria-label="媒介筛选">
          {WORK_CATEGORIES.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={category === item.value}
              className={category === item.value ? 'active' : ''}
              onClick={() => changeCategory(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="dash-year">
          记录年份
          <select value={year} onChange={(event) => setYear(event.target.value)}>
            <option value="all">全部年份</option>
            {data.years.map((value) => <option key={value} value={value}>{value} 年</option>)}
          </select>
        </label>
      </div>

      <div className="dash-metrics">
        <button type="button" onClick={() => openLibrary()}>
          <span>作品数量</span><strong>{data.stats.total}</strong><span>部作品</span>
        </button>
        <button type="button" onClick={() => openLibrary({ status: 'done' })}>
          <span>已完成</span><strong>{data.stats.doneCount}</strong>
          <span>{data.stats.total ? Math.round(data.stats.doneCount / data.stats.total * 100) : 0}% 完成比例</span>
        </button>
        <button type="button" onClick={() => openLibrary({ status: 'active' })}>
          <span>进行中</span><strong>{data.activeCount}</strong><span>部作品</span>
        </button>
        <div>
          <span>个人均分</span>
          <strong className={data.stats.ratedCount ? '' : 'dash-no-rating'}>{data.stats.averageRating || '暂无评分'}</strong>
          <span>{data.stats.ratedCount} 部评分样本</span>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="dash-empty">
          <BookOpen size={40} aria-hidden="true" />
          <h2>作品库还是空的</h2>
          <div>
            <button className="dash-button dash-button-primary" type="button" onClick={onOpenDiscover}>发现作品</button>
            <button className="dash-button" type="button" onClick={onOpenImport}>导入备份</button>
          </div>
        </div>
      ) : (
        <div className="dash-grid">
          <section className="dash-panel dash-shelf-panel" aria-labelledby="dash-shelf-title">
            <div className="dash-panel-heading">
              <h2 id="dash-shelf-title">{data.coverTitle}</h2>
              <button className="dash-text-button" type="button" onClick={() => openLibrary()}>查看作品库<ArrowUpRight size={16} /></button>
            </div>
            <div className="dash-shelf">
              {data.covers.map((record) => <CoverButton key={record.id} record={record} onOpen={onEditRecord} />)}
            </div>
            {data.covers.length === 0 && <p className="dash-empty-message">当前筛选范围内暂无作品</p>}
          </section>

          <section className="dash-panel" aria-labelledby="dash-media-title">
            <h2 id="dash-media-title">媒介分布</h2>
            <MediaChart items={data.media} total={data.stats.total} onSelect={(value) => openLibrary({ category: value })} />
          </section>

          <section className="dash-panel dash-trend-panel" aria-labelledby="dash-trend-title">
            <div className="dash-panel-heading">
              <h2 id="dash-trend-title">完成趋势</h2>
              <span className="dash-caption">有效完成 {data.completedCount} 部</span>
            </div>
            <TrendChart items={data.trend} monthly={year !== 'all'} onSelect={openTrend} />
            <div className="dash-date-issues">
              <button type="button" onClick={() => openLibrary({ completionIssue: 'missing' })}>日期缺失或无效 {data.missingCount} 部</button>
              <button type="button" onClick={() => openLibrary({ completionIssue: 'future' })}>未来日期待核对 {data.futureCount} 部</button>
            </div>
          </section>

          <section className="dash-panel" aria-labelledby="dash-calendar-title">
            <div className="dash-panel-heading">
              <h2 id="dash-calendar-title">完成日历</h2>
              <span className="dash-caption">26 周</span>
            </div>
            <CompletionCalendar key={data.calendar.end} calendar={data.calendar} onSelect={(date) => openLibrary({ completionDate: date })} />
          </section>

          <section className="dash-panel" aria-labelledby="dash-tags-title">
            <div className="dash-panel-heading">
              <h2 id="dash-tags-title">标签偏好</h2>
              <span className="dash-caption">共 {data.stats.tagCount} 个标签</span>
            </div>
            <div className="dash-tags">
              {data.tags.map((tag) => (
                <button key={tag.label} type="button" onClick={() => openLibrary({ tag: tag.label })} aria-label={`${tag.label} ${tag.value} 部`}>
                  <span>{tag.label}</span><strong>{tag.value}</strong>
                </button>
              ))}
            </div>
            {data.tags.length === 0 && <p className="dash-empty-message">暂无标签</p>}
          </section>

          <div className="dash-extras">
            <section className="dash-panel dash-review-entry" aria-label="年度回顾入口">
              <CalendarDays size={24} aria-hidden="true" />
              <button type="button" className="dash-text-button" onClick={openReview}>年度回顾<ArrowUpRight size={18} /></button>
            </section>
            <section className="dash-panel dash-draw" aria-labelledby="dash-draw-title">
              <div className="dash-panel-heading">
                <h2 id="dash-draw-title">待补作品抽签</h2><Dices size={20} aria-hidden="true" />
              </div>
              <p className="dash-caption">{wishes.length} 部候选</p>
              {wish && <CoverButton key={wish.id} record={wish} onOpen={onEditRecord} compact />}
              {wishes.length ? (
                <button className="dash-button" type="button" onClick={draw}>{wish ? '再选一部' : '抽一部'}</button>
              ) : (
                <button className="dash-button" type="button" onClick={onOpenDiscover}>发现待补作品</button>
              )}
            </section>
          </div>
        </div>
      )}

      {reviewOpen && (
        <ModalDialog titleId="dash-review-title" onClose={() => setReviewOpen(false)} className="dash-review-dialog">
          <div className="dash-panel-heading">
            <h2 id="dash-review-title">年度回顾</h2>
            <button className="dash-button" type="button" onClick={() => setReviewOpen(false)} aria-label="关闭年度回顾"><X size={20} /></button>
          </div>
          <label className="dash-year">
            回顾年份
            <select data-autofocus value={reviewYear} onChange={(event) => setReviewYear(event.target.value)}>
              {reviewYears.map((value) => <option key={value} value={value}>{value} 年</option>)}
            </select>
          </label>
          <p>{review.total} 部有效完成</p>
          <p className="dash-caption">{category === 'all' ? '全部媒介' : getCategoryLabel(category)} · 截至 {today}</p>
          {review.total ? (
            <>
              <MediaChart items={review.media} total={review.total} onSelect={(value) => openReviewLibrary({ category: value })} />
              <h3>高评分作品</h3>
              <p className="dash-caption">{review.ratedCount} 部评分样本</p>
              <div className="dash-review-works">
                {review.top.map((record) => (
                  <div key={record.id}>
                    <CoverButton record={record} compact onOpen={(value) => { setReviewOpen(false); onEditRecord?.(value); }} />
                    <strong>{record.rating} / 10</strong>
                  </div>
                ))}
              </div>
              {review.top.length === 0 && <p>暂无评分</p>}
              <h3>高频标签</h3>
              <div className="dash-tags">
                {review.tags.map((tag) => (
                  <button key={tag.label} type="button" onClick={() => openReviewLibrary({ tag: tag.label })}>
                    {tag.label}<strong>{tag.value}</strong>
                  </button>
                ))}
              </div>
              {review.tags.length === 0 && <p>暂无标签</p>}
            </>
          ) : <p>该年暂无有效完成记录，可选择其他年份。</p>}
        </ModalDialog>
      )}
    </section>
  );
}
