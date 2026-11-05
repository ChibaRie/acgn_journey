import { useEffect, useRef, useState } from 'react';
import { AlertCircle, FileText, UploadCloud } from 'lucide-react';
import EmptyState from './EmptyState.jsx';
import ConfirmModal from './ConfirmModal.jsx';
import { IMPORT_PROVIDERS, parseImportFile } from '../utils/importers.js';
import { getStatusLabel } from '../utils/library.js';

export default function BulkImportPanel({ onMergeRecords, onReplaceRecords, readOnly = false }) {
  const [provider, setProvider] = useState('auto');
  const [mode, setMode] = useState('merge');
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState('');
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef(null);
  const parseVersion = useRef(0);

  useEffect(() => () => { parseVersion.current += 1; }, []);

  const handleFileChange = async (event) => {
    const version = ++parseVersion.current;
    const file = event.target.files?.[0];
    event.target.value = '';
    setError('');
    setImportResult(null);
    setConfirmReplaceOpen(false);
    setParsing(Boolean(file));
    if (!file) return;

    try {
      const result = await parseImportFile(file, provider);
      if (version !== parseVersion.current) return;
      if (result.records.length === 0) {
        throw new Error('没有识别到可导入的作品记录，请检查 JSON 备份、文件表头或 XML 导出格式。');
      }
      setImportResult({
        ...result,
        fileName: file.name,
      });
    } catch (parseError) {
      if (version === parseVersion.current) setError(parseError.message || '文件解析失败');
    } finally {
      if (version === parseVersion.current) setParsing(false);
    }
  };

  const handleCommit = () => {
    if (!importResult?.records.length || readOnly || parsing) return;

    if (mode === 'replace') {
      setConfirmReplaceOpen(true);
    } else {
      if (onMergeRecords(importResult.records) === false) return;
      setImportResult(null);
    }
  };

  const handleConfirmReplace = () => {
    if (!importResult?.records.length || readOnly || parsing) return;
    if (onReplaceRecords(importResult.records) === false) return;
    setConfirmReplaceOpen(false);
    setImportResult(null);
  };

  return (
    <section className="panel" aria-labelledby="import-title">
      <div className="section-heading split">
        <div>
          <h2 id="import-title">批量导入</h2>
        </div>
        <div className="result-count">{importResult?.records.length || 0} 条待导入</div>
      </div>

      <div className="import-grid">
        <section className="import-dropzone" aria-label="文件导入">
          <UploadCloud size={36} />
          <h3>选择导出文件</h3>
          <p>支持本项目 JSON 备份、MyAnimeList XML 和常见 CSV。系统会根据文件名和表头自动映射标题、类型、状态、评分、标签与日期。</p>
          <div className="import-controls">
            <label>
              <span>来源平台</span>
              <select value={provider} onChange={(event) => {
                parseVersion.current += 1;
                setProvider(event.target.value);
                setImportResult(null);
                setConfirmReplaceOpen(false);
                setParsing(false);
                setError('');
              }}>
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
            <span>选择 JSON / XML / CSV</span>
          </button>
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept=".json,.csv,.xml,application/json,text/csv,text/xml,application/xml"
            onChange={handleFileChange}
          />
        </section>

      </div>

      {error && (
        <div className="warning-strip" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {parsing && <p className="loading-state" role="status">正在解析文件…</p>}

      {!importResult && !error && !parsing && (
        <EmptyState title="等待导入文件" description="导入前会先展示预览，你可以确认数量和关键字段后再合并或覆盖。" />
      )}

      {importResult && (
        <section className="import-preview" aria-label="导入预览">
          <div className="section-heading split compact-heading">
            <div>
              <p className="import-file-info">
                {importResult.providerLabel} · {importResult.fileName}
              </p>
              <h3>预览前 {Math.min(5, importResult.records.length)} 条记录</h3>
            </div>
            <button className="button primary" type="button" onClick={handleCommit} disabled={readOnly || parsing}>
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

      {confirmReplaceOpen && importResult && (
        <ConfirmModal
          eyebrow="覆盖导入"
          title="覆盖当前作品库？"
          description={`将用 ${importResult.fileName} 中的 ${importResult.records.length} 条导入记录覆盖当前作品库。建议先在设置中导出当前备份再继续。`}
          icon={UploadCloud}
          confirmLabel="确认覆盖"
          onCancel={() => setConfirmReplaceOpen(false)}
          onConfirm={handleConfirmReplace}
        />
      )}
    </section>
  );
}
