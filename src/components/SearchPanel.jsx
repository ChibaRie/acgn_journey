import { useRef, useState } from 'react';
import { AlertTriangle, Loader2, Search, SlidersHorizontal } from 'lucide-react';
import { SOURCE_LABELS, searchAllSources } from '../api/search.js';
import WorkCard from './WorkCard.jsx';
import EmptyState from './EmptyState.jsx';

const DEFAULT_SOURCES = ['bangumi', 'moegirl', 'anilist_anime', 'anilist_manga', 'vndb', 'ymgal'];
const DIRECT_SOURCES = new Set(['moegirl']);

export default function SearchPanel({ hasWork, onAddWork }) {
  const [keyword, setKeyword] = useState('');
  const [sources, setSources] = useState(DEFAULT_SOURCES);
  const [results, setResults] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const abortRef = useRef(null);

  const toggleSource = (source) => {
    setSources((current) =>
      current.includes(source)
        ? current.filter((item) => item !== source)
        : [...current, source],
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const query = keyword.trim();
    if (!query || loading || sources.length === 0) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setSearched(true);
    setErrors({});

    try {
      const response = await searchAllSources(query, {
        sources,
        signal: controller.signal,
      });
      setResults(response.items);
      setErrors(response.errors);
    } catch (error) {
      if (error.name !== 'AbortError') {
        setResults([]);
        setErrors({ all: error.message || '搜索失败' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel search-panel" aria-labelledby="search-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">多源作品搜索</p>
          <h2 id="search-title">搜索动画、轻小说、Galgame 与百科条目</h2>
        </div>
      </div>

      <form className="search-form" onSubmit={handleSubmit}>
        <label className="search-input">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">搜索关键词</span>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="例如：葬送的芙莉莲、命运石之门、白色相簿2"
          />
        </label>
        <button className="button primary search-button" type="submit" disabled={loading}>
          {loading ? <Loader2 className="spin" size={17} /> : <Search size={17} />}
          <span>{loading ? '搜索中' : '搜索'}</span>
        </button>
      </form>

      <div className="source-bar" aria-label="搜索来源">
        <span className="source-label">
          <SlidersHorizontal size={16} />
          来源
        </span>
        {DEFAULT_SOURCES.map((source) => (
          <button
            key={source}
            type="button"
            className={sources.includes(source) ? 'source-chip active' : 'source-chip'}
            onClick={() => toggleSource(source)}
            aria-pressed={sources.includes(source)}
          >
            {SOURCE_LABELS[source]}
            {DIRECT_SOURCES.has(source) && <span className="source-direct"> · 直连</span>}
          </button>
        ))}
      </div>

      {Object.keys(errors).length > 0 && (
        <div className="warning-strip" role="status">
          <AlertTriangle size={17} />
          <span>
            {Object.entries(errors)
              .map(([source, message]) => `${SOURCE_LABELS[source] || source}: ${message}`)
              .join('；')}
          </span>
        </div>
      )}

      {!searched && (
        <EmptyState title="输入关键词开始记录" description="搜索结果会显示标题、封面、类型、简介和来源站点。" />
      )}

      {searched && !loading && results.length === 0 && (
        <EmptyState title="没有找到结果" description="可以换一个更短的关键词，或只保留 Bangumi 再试一次。" />
      )}

      {results.length > 0 && (
        <div className="result-grid">
          {results.map((work) => (
            <WorkCard
              key={work.id}
              work={work}
              isSaved={hasWork(work)}
              onAddWork={onAddWork}
            />
          ))}
        </div>
      )}
    </section>
  );
}
