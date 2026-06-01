import { useRef, useState } from 'react';
import { AlertTriangle, ImageUp, Link2, Loader2, Search, X } from 'lucide-react';
import { searchTraceMoe } from '../api/search.js';
import EmptyState from './EmptyState.jsx';
import WorkCard from './WorkCard.jsx';

export default function TraceMoePanel({ hasWork, onAddWork }) {
  const [imageUrl, setImageUrl] = useState('');
  const [file, setFile] = useState(null);
  const [cutBorders, setCutBorders] = useState(true);
  const [results, setResults] = useState([]);
  const [frameCount, setFrameCount] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    if (!nextFile) return;
    setFile(nextFile);
    setImageUrl('');
    setResults([]);
    setError('');
    setSearched(false);
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedUrl = imageUrl.trim();
    if (!file && !trimmedUrl) {
      setError('请上传截图，或粘贴一张可公开访问的图片 URL。');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setSearched(true);
    setError('');

    try {
      const response = await searchTraceMoe(
        { file, imageUrl: file ? '' : trimmedUrl, cutBorders },
        { signal: controller.signal },
      );
      setResults(response.items);
      setFrameCount(response.frameCount);
    } catch (error) {
      if (error.name !== 'AbortError') {
        setResults([]);
        setFrameCount(0);
        setError(`trace.moe 识别失败：${error.message || '服务暂时不可用'}`);
      }
    } finally {
      if (abortRef.current === controller) {
        setLoading(false);
      }
    }
  };

  return (
    <section className="panel trace-panel" aria-labelledby="trace-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">截图识别</p>
          <h2 id="trace-title">用 trace.moe 反查动画场景</h2>
        </div>
        {searched && frameCount > 0 && <span className="result-count">检索 {frameCount.toLocaleString()} 帧</span>}
      </div>

      <form className="trace-form" onSubmit={handleSubmit}>
        <div className="trace-upload">
          <button className="button secondary" type="button" onClick={() => fileInputRef.current?.click()}>
            <ImageUp size={17} />
            <span>上传截图</span>
          </button>
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept="image/*,video/*"
            onChange={handleFileChange}
          />
          {file && (
            <span className="trace-file">
              {file.name}
              <button type="button" onClick={clearFile} aria-label="移除已选择文件">
                <X size={14} />
              </button>
            </span>
          )}
        </div>

        <label className="search-input trace-url-input">
          <Link2 size={18} aria-hidden="true" />
          <span className="sr-only">图片 URL</span>
          <input
            value={imageUrl}
            onChange={(event) => {
              setImageUrl(event.target.value);
              if (event.target.value.trim()) clearFile();
            }}
            placeholder="或粘贴图片 URL，例如 https://example.com/screenshot.jpg"
          />
        </label>

        <label className="check-row trace-option">
          <input
            type="checkbox"
            checked={cutBorders}
            onChange={(event) => setCutBorders(event.target.checked)}
          />
          <span>自动裁掉黑边</span>
        </label>

        <button className="button primary search-button" type="submit" disabled={loading}>
          {loading ? <Loader2 className="spin" size={17} /> : <Search size={17} />}
          <span>{loading ? '识别中' : '开始识别'}</span>
        </button>
      </form>

      {error && (
        <div className="warning-strip" role="status">
          <AlertTriangle size={17} />
          <span>{error}</span>
        </div>
      )}

      {!searched && (
        <EmptyState title="上传一张动画截图" description="trace.moe 会返回可能的番名、集数、时间点和相似度，识别结果也可以加入我的库。" />
      )}

      {searched && !loading && results.length === 0 && (
        <EmptyState title="没有找到足够相似的场景" description="可以尝试原始 16:9 截图、减少滤镜/裁剪，或关闭黑边裁剪再试一次。" />
      )}

      {results.length > 0 && (
        <div className="result-grid">
          {results.map((work) => (
            <WorkCard
              key={`${work.id}-${work.trace?.at || ''}`}
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
