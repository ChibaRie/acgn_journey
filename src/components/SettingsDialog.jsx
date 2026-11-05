import { useRef, useState } from 'react';
import { Download, ImagePlus, RotateCcw, Upload, X } from 'lucide-react';
import ModalDialog from './ModalDialog.jsx';
import BulkImportPanel from './BulkImportPanel.jsx';
import { EXPORT_FORMATS } from '../utils/library.js';
import { readImageFile } from '../utils/background.js';

export default function SettingsDialog({
  records,
  storage,
  backgroundState,
  preferenceError,
  canWrite,
  initialView = 'preferences',
  motionEnabled,
  onMotionChange,
  onClose,
  onToast,
  onExport,
  onImportBackup,
  onMergeRecords,
  onReplaceRecords,
}) {
  const [view, setView] = useState(initialView);
  const [exportFormat, setExportFormat] = useState('json');
  const backupInput = useRef(null);
  const backgroundInput = useRef(null);
  const {
    background,
    ready,
    setImage,
    setOpacity,
    setBlur,
    clearImage,
    storage: backgroundStorage,
  } = backgroundState;

  const importBackground = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setImage(await readImageFile(file));
      onToast('背景已应用');
    } catch (error) {
      onToast(error.message || '背景读取失败');
    }
  };

  return (
    <ModalDialog
      titleId="settings-title"
      onClose={onClose}
      className="settings-dialog"
    >
      <div className="dialog-heading">
        <h2 id="settings-title">数据与设置</h2>
        <button
          className="icon-button"
          type="button"
          aria-label="关闭数据与设置"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <div
        className="segmented-control settings-tabs"
        role="group"
        aria-label="设置分类"
      >
        <button
          type="button"
          aria-pressed={view === 'preferences'}
          onClick={() => setView('preferences')}
        >
          偏好与备份
        </button>
        <button
          type="button"
          aria-pressed={view === 'import'}
          onClick={() => setView('import')}
        >
          批量导入
        </button>
      </div>
      {view === 'import' ? (
        <BulkImportPanel
          onMergeRecords={onMergeRecords}
          onReplaceRecords={onReplaceRecords}
          readOnly={!canWrite}
        />
      ) : (
        <div className="settings-sections">
          <section className="settings-section">
            <h3>保存位置</h3>
            <p>
              {storage.mode === 'local'
                ? '本机 SQLite 数据库'
                : storage.mode === 'checking'
                  ? '正在连接本机数据库'
                  : '浏览器本地存储'}{' '}
              · {records.length} 部作品
            </p>
            {storage.path && <p className="storage-path">{storage.path}</p>}
            {storage.error && <p className="warning-strip">{storage.error}</p>}
            {storage.cacheError && (
              <p className="warning-strip">
                浏览器缓存保存失败，本机保存结果以页面状态为准。
              </p>
            )}
            {preferenceError && (
              <p className="warning-strip">{preferenceError}</p>
            )}
          </section>
          <section className="settings-section">
            <h3>备份与恢复</h3>
            <div className="backup-controls">
              <label>
                <span>导出格式</span>
                <select
                  value={exportFormat}
                  onChange={(event) => setExportFormat(event.target.value)}
                >
                  {EXPORT_FORMATS.map((format) => (
                    <option key={format.value} value={format.value}>
                      {format.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button primary"
                type="button"
                onClick={() => onExport(exportFormat)}
              >
                <Download size={17} />
                导出 {exportFormat.toUpperCase()}
              </button>
              <button
                className="button secondary"
                type="button"
                disabled={!canWrite}
                onClick={() => backupInput.current?.click()}
              >
                <Upload size={17} />
                恢复 JSON 备份
              </button>
            </div>
            <input
              className="sr-only"
              ref={backupInput}
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) onImportBackup(file);
              }}
            />
            <p className="field-hint">
              JSON 用于完整恢复，XML 和 CSV 用于阅读与迁移。
            </p>
          </section>
          <section className="settings-section">
            <h3>自定义背景</h3>
            <div className="button-row">
              <button
                className="button secondary"
                type="button"
                disabled={!ready}
                onClick={() => backgroundInput.current?.click()}
              >
                <ImagePlus size={17} />
                选择背景图片
              </button>
              <button
                className="button secondary"
                type="button"
                disabled={!ready || !background.image}
                onClick={clearImage}
              >
                <RotateCcw size={17} />
                恢复默认
              </button>
            </div>
            <input
              className="sr-only"
              ref={backgroundInput}
              type="file"
              accept="image/*"
              onChange={importBackground}
            />
            <label className="settings-slider">
              <span>
                不透明度{' '}
                <strong>{Math.round(background.opacity * 100)}%</strong>
              </span>
              <input
                aria-label="背景不透明度"
                type="range"
                min="0"
                max="1"
                step=".05"
                value={background.opacity}
                disabled={!ready || !background.image}
                onChange={(event) => setOpacity(Number(event.target.value))}
              />
            </label>
            <label className="settings-slider">
              <span>
                模糊 <strong>{background.blur}px</strong>
              </span>
              <input
                aria-label="背景模糊"
                type="range"
                min="0"
                max="30"
                step="1"
                value={background.blur}
                disabled={!ready || !background.image}
                onChange={(event) => setBlur(Number(event.target.value))}
              />
            </label>
            {backgroundStorage?.error && (
              <p className="warning-strip">{backgroundStorage.error}</p>
            )}
          </section>
          <section className="settings-section">
            <h3>界面动效</h3>
            <label className="check-row">
              <input
                type="checkbox"
                checked={motionEnabled}
                onChange={(event) => onMotionChange(event.target.checked)}
              />
              <span>开启动效</span>
            </label>
            <p className="field-hint">同时遵循系统的低动态效果偏好。</p>
          </section>
          <a
            className="project-link"
            href="https://github.com/ChibaRie/acgn_journey"
            target="_blank"
            rel="noreferrer"
          >
            项目源码
          </a>
        </div>
      )}
    </ModalDialog>
  );
}
