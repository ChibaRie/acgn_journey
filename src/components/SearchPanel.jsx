import { useRef, useState } from 'react';
import { AlertTriangle, Database, Loader2, Search, SlidersHorizontal } from 'lucide-react';
import { DEFAULT_SOURCE_ID, SOURCES, getSourceById, searchSource } from '../api/search.js';
import WorkCard from './WorkCard.jsx';
import EmptyState from './EmptyState.jsx';

export default function SearchPanel({ hasWork, onAddWork }) {
  const [keyword, setKeyword] = useState('');
  const [sourceId, setSourceId] = useState(DEFAULT_SOURCE_ID);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const abortRef = useRef(null);
  const selectedSource = getSourceById(sourceId) || SOURCES[0];

  const handleSourceChange = (nextSourceId) => {
    abortRef.current?.abort();
    setSourceId(nextSourceId);
    setResults([]);
    setError('');
    setSearched(false);
    setLoading(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const query = keyword.trim();
    if (loading) return;
    if (!query) {
      setError('请输入搜索关键词。');
      setResults([]);
      setSearched(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setSearched(true);
    setError('');

    try {
      const response = await searchSource(sourceId, query, { signal: controller.signal });
      setResults(response.items);
      setError(response.error || '');
    } catch (error) {
      if (error.name !== 'AbortError') {
        setResults([]);
        setError(`${selectedSource.label} 搜索失败：${error.message || '来源暂时不可用'}`);
      }
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  };

  return (
    <section className="panel search-panel" aria-labelledby="search-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">单来源作品搜索</p>
          <h2 id="search-title">选择一个来源，再检索作品</h2>
        </div>
      </div>

      <div className="source-selector" aria-label="搜索来源">
        <div className="source-selector-head">
          <span className="source-label">
            <SlidersHorizontal size={16} />
            当前来源
          </span>
          <span className="source-current">
            <Database size={15} />
            {selectedSource.label}
          </span>
        </div>

        <div className="source-options">
          {SOURCES.map((source) => (
            <button
              key={source.id}
              type="button"
              className={sourceId === source.id ? 'source-chip active' : 'source-chip'}
              onClick={() => handleSourceChange(source.id)}
              aria-pressed={sourceId === source.id}
            >
              {source.label}
            </button>
          ))}
        </div>

        <p className="source-description">{selectedSource.description}</p>
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

      {error && (
        <div className="warning-strip" role="status">
          <AlertTriangle size={17} />
          <span>{error}</span>
        </div>
      )}

      {!searched && (
        <EmptyState title="输入关键词开始记录" description="每次只查询当前选择的来源，结果仍可直接加入我的库。" />
      )}

      {searched && !loading && results.length === 0 && (
        <EmptyState title="没有找到结果" description={`可以换一个更短的关键词，或切换到其他来源再搜索。当前来源：${selectedSource.label}。`} />
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
