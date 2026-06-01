import { useRef, useState } from 'react';
import { AlertCircle, FileText, UploadCloud } from 'lucide-react';
import EmptyState from './EmptyState.jsx';
import { IMPORT_PROVIDERS, parseImportFile } from '../utils/importers.js';
import { getStatusLabel } from '../utils/library.js';

export default function BulkImportPanel({ onMergeRecords, onReplaceRecords }) {
  const [provider, setProvider] = useState('auto');
  const [mode, setMode] = useState('merge');
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setError('');
    setImportResult(null);
    if (!file) return;

    try {
      const result = await parseImportFile(file, provider);
      if (result.records.length === 0) {
        throw new Error('没有识别到可导入的作品记录，请检查文件表头或 XML 导出格式。');
      }
      setImportResult({
        ...result,
        fileName: file.name,
      });
    } catch (parseError) {
      setError(parseError.message || '文件解析失败');
    }
  };

  const handleCommit = () => {
    if (!importResult?.records.length) return;

    if (mode === 'replace') {
      const confirmed = window.confirm(
        `将用 ${importResult.records.length} 条导入记录覆盖当前作品库。继续吗？`,
      );
      if (!confirmed) return;
      onReplaceRecords(importResult.records);
    } else {
      onMergeRecords(importResult.records);
    }

    setImportResult(null);
  };

  return (
    <section className="panel" aria-labelledby="import-title">
      <div className="section-heading split">
        <div>
          <p className="eyebrow">批量导入</p>
          <h2 id="import-title">从 Bangumi、MAL、AniList、VNDB 的 XML/CSV 导入作品库</h2>
        </div>
        <div className="result-count">{importResult?.records.length || 0} 条待导入</div>
      </div>

      <div className="import-grid">
        <section className="import-dropzone" aria-label="文件导入">
          <UploadCloud size={36} />
          <h3>选择导出文件</h3>
          <p>支持 CSV 与 MyAnimeList XML。系统会根据文件名和表头自动映射标题、类型、状态、评分、标签与日期。</p>
          <div className="import-controls">
            <label>
              <span>来源平台</span>
              <select value={provider} onChange={(event) => setProvider(event.target.value)}>
                {IMPORT_PROVIDERS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>导入策略</span>
              <select value={mode} onChange={(event) => setMode(event.target.value)}>
                <option value="merge">合并到现有库</option>
                <option value="replace">覆盖当前库</option>
              </select>
            </label>
          </div>
          <button className="button primary" type="button" onClick={() => fileInputRef.current?.click()}>
            <FileText size={16} />
            <span>选择 XML / CSV</span>
          </button>
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept=".csv,.xml,text/csv,text/xml,application/xml"
            onChange={handleFileChange}
          />
        </section>

        <section className="api-sync-card" aria-label="授权 API 同步">
          <p className="eyebrow">API 同步</p>
          <h3>预留授权同步入口</h3>
          <p>
            Bangumi、MyAnimeList、AniList、VNDB 的账号同步通常需要 OAuth 或访问令牌。
            当前前端版先完成离线文件导入；后续接 Express/Serverless 后，可以把授权回调和令牌安全保存放到后端。
          </p>
          <button className="button secondary" type="button" disabled>
            <UploadCloud size={16} />
            <span>等待后端授权模块</span>
          </button>
        </section>
      </div>

      {error && (
        <div className="warning-strip" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {!importResult && !error && (
        <EmptyState title="等待导入文件" description="导入前会先展示预览，你可以确认数量和关键字段后再合并或覆盖。" />
      )}

      {importResult && (
        <section className="import-preview" aria-label="导入预览">
          <div className="section-heading split compact-heading">
            <div>
              <p className="eyebrow">
                {importResult.providerLabel} · {importResult.fileName}
              </p>
              <h3>预览前 {Math.min(5, importResult.records.length)} 条记录</h3>
            </div>
            <button className="button primary" type="button" onClick={handleCommit}>
              <UploadCloud size={16} />
              <span>{mode === 'merge' ? '确认合并' : '确认覆盖'}</span>
            </button>
          </div>

          <div className="preview-list">
            {importResult.records.slice(0, 5).map((record) => (
              <article className="preview-item" key={record.id}>
                <div>
                  <h3>{record.title}</h3>
                  <p>
                    {record.type} · {getStatusLabel(record.status, record.type)}
                    {record.rating > 0 ? ` · ${record.rating}/10` : ''}
                  </p>
                </div>
                <div className="tag-row">
                  {record.releaseYear && <span>{record.releaseYear}</span>}
                  {(record.tags.length > 0 ? record.tags : record.animeTags || []).slice(0, 4).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
