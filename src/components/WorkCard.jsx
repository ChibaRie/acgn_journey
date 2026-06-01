import { Check, ExternalLink, Plus } from 'lucide-react';

export default function WorkCard({ work, isSaved, onAddWork }) {
  const displayTags = work.animeTags?.length > 0 ? work.animeTags : work.tags || [];

  return (
    <article className="work-card">
      <div className="cover-frame">
        {work.cover ? (
          <img
            src={work.cover}
            alt={`${work.title} 封面`}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="cover-placeholder" aria-label="无封面">
            {work.title.slice(0, 2)}
          </div>
        )}
      </div>

      <div className="work-card-body">
        <div className="work-card-kicker">
          <span>{work.sourceLabel}</span>
          <span>{work.type}</span>
        </div>
        <h3>{work.title}</h3>
        {work.originalTitle && <p className="original-title">{work.originalTitle}</p>}
        <p className="summary">{work.summary || '暂无简介。'}</p>

        {work.meta?.length > 0 && (
          <div className="meta-row">
            {work.meta.slice(0, 3).map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        )}

        {displayTags.length > 0 && (
          <div className="tag-row" aria-label={`${work.title} 动漫标签`}>
            {displayTags.slice(0, 8).map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        )}

        <div className="card-actions">
          <button
            className={isSaved ? 'button saved' : 'button primary'}
            type="button"
            disabled={isSaved}
            onClick={() => onAddWork(work)}
          >
            {isSaved ? <Check size={16} /> : <Plus size={16} />}
            <span>{isSaved ? '已在库中' : '加入我的库'}</span>
          </button>

          {work.sourceUrl && (
            <a
              className="icon-link"
              href={work.sourceUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`打开 ${work.title} 的来源页面`}
              title="打开来源页面"
            >
              <ExternalLink size={16} />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
