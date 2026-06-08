import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Clock3,
  Download,
  ExternalLink,
  Github,
  Image as ImageIcon,
  Library,
  Moon,
  PackageCheck,
  Search,
  Settings2,
  Sparkles,
  Sun,
  Upload,
  UploadCloud,
  X,
} from 'lucide-react';
import SearchPanel from './components/SearchPanel.jsx';
import TraceMoePanel from './components/TraceMoePanel.jsx';
import LibraryPanel from './components/LibraryPanel.jsx';
import TimelinePanel from './components/TimelinePanel.jsx';
import StatsPanel from './components/StatsPanel.jsx';
import AiProfilePanel from './components/AiProfilePanel.jsx';
import InventoryPanel from './components/InventoryPanel.jsx';
import BulkImportPanel from './components/BulkImportPanel.jsx';
import RecordEditor from './components/RecordEditor.jsx';
import ConfirmModal from './components/ConfirmModal.jsx';
import { useLibrary } from './hooks/useLibrary.js';
import { useBackground } from './hooks/useBackground.js';
import { getStats } from './utils/stats.js';
import {
  EXPORT_FORMATS,
  createExportText,
  getDoneLabel,
  getExportFileName,
  getExportMimeType,
  readBackup,
} from './utils/library.js';
import { readImageFile } from './utils/background.js';
import { loadLocalSetting, saveLocalSetting } from './utils/localApi.js';

const THEME_KEY = 'acgn_journey:theme';
const LEGACY_THEME_KEYS = [`${['my', 'acgn', 'journey'].join('-')}:theme`];

const TABS = [
  { id: 'search', label: '搜索', icon: Search },
  { id: 'trace', label: '截图识别', icon: ImageIcon },
  { id: 'library', label: '我的库', icon: Library },
  { id: 'inventory', label: '实体库存', icon: PackageCheck },
  { id: 'import', label: '批量导入', icon: UploadCloud },
  { id: 'timeline', label: '历程', icon: Clock3 },
  { id: 'stats', label: '统计', icon: BarChart3 },
  { id: 'ai-profile', label: 'AI画像', icon: Sparkles },
];

function getInitialTheme() {
  const savedTheme =
    localStorage.getItem(THEME_KEY) ||
    LEGACY_THEME_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
  if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const [activeTab, setActiveTab] = useState('search');
  const [editingRecord, setEditingRecord] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);
  const [themeStorageMode, setThemeStorageMode] = useState('checking');
  const [toast, setToast] = useState('');
  const [showCover, setShowCover] = useState(true);
  const [coverLeaving, setCoverLeaving] = useState(false);
  const [exportFormat, setExportFormat] = useState('json');
  const [pendingBackupImport, setPendingBackupImport] = useState(null);
  const fileInputRef = useRef(null);
  const bgInputRef = useRef(null);
  const {
    records,
    addWork,
    updateRecord,
    deleteRecord,
    bulkUpdateRecords,
    deleteRecords,
    replaceRecords,
    mergeRecords,
    hasWork,
    storage,
  } = useLibrary();
  const { background, setImage, setOpacity, setBlur, clearImage } = useBackground();
  const stats = useMemo(() => getStats(records), [records]);
  const isDark = theme === 'dark';

  useEffect(() => {
    let cancelled = false;
    loadLocalSetting('theme')
      .then((setting) => {
        if (cancelled) return;
        if (setting?.value === 'dark' || setting?.value === 'light') {
          setTheme(setting.value);
        }
        setThemeStorageMode('local');
      })
      .catch(() => {
        if (!cancelled) setThemeStorageMode('browser');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem(THEME_KEY, theme);
    if (themeStorageMode === 'local') {
      saveLocalSetting('theme', theme).catch(() => {
        setThemeStorageMode('browser');
      });
    }
  }, [theme, themeStorageMode]);

  const handleEnterApp = () => {
    if (coverLeaving) return;
    setCoverLeaving(true);
    window.setTimeout(() => setShowCover(false), 560);
  };

  const handleCoverKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleEnterApp();
    }
  };

  const showToast = (message) => {
    setToast(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(''), 2800);
  };

  const handleToggleTheme = () => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      showToast(next === 'dark' ? '已切换到暗夜主题' : '已切换到日间主题');
      return next;
    });
  };

  const handleAddWork = (work) => {
    const record = addWork(work);
    showToast(`已加入我的库，并标记为${getDoneLabel(record.type)}`);
    return record;
  };

  const handleSaveRecord = (draft) => {
    updateRecord(draft.id, draft);
    setEditingRecord(null);
    showToast('记录已更新');
  };

  const handleDeleteRecord = (id) => {
    deleteRecord(id);
    showToast('记录已删除');
  };

  const handleBulkUpdateRecords = (ids, patch) => {
    bulkUpdateRecords(ids, patch);
    showToast(`已更新 ${ids.length} 条记录`);
  };

  const handleDeleteRecords = (ids) => {
    deleteRecords(ids);
    showToast(`已删除 ${ids.length} 条记录`);
  };

  const handleMergeImport = (nextRecords) => {
    mergeRecords(nextRecords);
    showToast(`已合并导入 ${nextRecords.length} 条记录`);
  };

  const handleReplaceImport = (nextRecords) => {
    replaceRecords(nextRecords);
    showToast(`已覆盖导入 ${nextRecords.length} 条记录`);
  };

  const handleExportBackup = () => {
    const blob = new Blob([createExportText(records, exportFormat)], {
      type: getExportMimeType(exportFormat),
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = getExportFileName(exportFormat);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(`已导出 ${records.length} 条 ${exportFormat.toUpperCase()} 备份`);
  };

  const handleImportBackup = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const payload = JSON.parse(await file.text());
      const importedRecords = readBackup(payload);
      setPendingBackupImport({
        records: importedRecords,
        fileName: file.name,
      });
    } catch (error) {
      showToast(error.message || '备份导入失败');
    }
  };

  const handleConfirmBackupImport = () => {
    if (!pendingBackupImport) return;
    replaceRecords(pendingBackupImport.records);
    showToast(`已恢复 ${pendingBackupImport.records.length} 条备份记录`);
    setPendingBackupImport(null);
  };

  const handleImportBackground = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const dataUrl = await readImageFile(file);
      setImage(dataUrl);
      showToast('已应用自定义背景');
    } catch (error) {
      showToast(error.message || '背景图片导入失败');
    }
  };

  const handleClearBackground = () => {
    clearImage();
    showToast('已恢复默认背景');
  };

  return (
    <div className={showCover ? 'app-shell app-shell-with-cover' : 'app-shell'}>
      {showCover && (
        <section
          className={coverLeaving ? 'cover-screen leaving' : 'cover-screen'}
          aria-labelledby="cover-title"
          role="button"
          tabIndex={0}
          onClick={handleEnterApp}
          onKeyDown={handleCoverKeyDown}
        >
          <div className="cover-atmosphere" aria-hidden="true" />
          <div className="cover-mosaic" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="cover-content">
            <p className="cover-kicker">acgn_journey</p>
            <h1 id="cover-title">由此开启你的ACGN之旅</h1>
            <p className="cover-lead">
              让作品、进度、收藏和回忆落在自己的设备里。轻点任意一处，进入你的私人档案。
            </p>
          </div>
        </section>
      )}

      <div
        className={showCover && !coverLeaving ? 'main-stage behind-cover' : 'main-stage ready'}
        aria-hidden={showCover && !coverLeaving}
      >
      {background.image && (
        <div
          className="app-background"
          aria-hidden="true"
          style={{
            backgroundImage: `url(${background.image})`,
            opacity: background.opacity,
            filter: background.blur ? `blur(${background.blur}px)` : 'none',
          }}
        />
      )}
      <header className="topbar">
        <div className="brand">
          <div>
            <h1>acgn_journey</h1>
            <p>{records.length} 部作品已记录</p>
          </div>
        </div>

        <nav className="tabbar" aria-label="主导航">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={activeTab === tab.id ? 'tab active' : 'tab'}
                type="button"
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={17} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="topbar-meta" aria-label="快速概览">
          <span>{stats.doneCount} 已完成</span>
          <span>{stats.averageRating || '--'} 均分</span>
        </div>
      </header>

      <main className="workspace">
        <div key={activeTab} className="view-transition">
        {activeTab === 'search' && (
          <SearchPanel hasWork={hasWork} onAddWork={handleAddWork} />
        )}

        {activeTab === 'trace' && (
          <TraceMoePanel hasWork={hasWork} onAddWork={handleAddWork} />
        )}

        {activeTab === 'library' && (
          <LibraryPanel
            records={records}
            onEditRecord={setEditingRecord}
            onDeleteRecord={handleDeleteRecord}
            onBulkUpdateRecords={handleBulkUpdateRecords}
            onDeleteRecords={handleDeleteRecords}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryPanel
            records={records}
            onEditRecord={setEditingRecord}
            onUpdateRecord={updateRecord}
          />
        )}

        {activeTab === 'import' && (
          <BulkImportPanel
            onMergeRecords={handleMergeImport}
            onReplaceRecords={handleReplaceImport}
          />
        )}

        {activeTab === 'timeline' && (
          <TimelinePanel records={records} onEditRecord={setEditingRecord} />
        )}

        {activeTab === 'stats' && <StatsPanel records={records} stats={stats} />}

        {activeTab === 'ai-profile' && (
          <AiProfilePanel
            records={records}
            stats={stats}
            storage={storage}
            onToast={showToast}
          />
        )}
        </div>
      </main>

      <footer className="site-footer">
        <a
          className="repo-link"
          href="https://github.com/ChibaRie/acgn_journey"
          target="_blank"
          rel="noreferrer"
        >
          <Github size={18} aria-hidden="true" />
          <span>ChibaRie/acgn_journey</span>
          <ExternalLink size={15} aria-hidden="true" />
        </a>
      </footer>

      {settingsOpen && (
        <aside className="settings-popover" role="dialog" aria-labelledby="settings-title">
          <div className="settings-header">
            <div>
              <p className="eyebrow">设置说明</p>
              <h2 id="settings-title">数据与偏好</h2>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={() => setSettingsOpen(false)}
              aria-label="关闭设置说明"
              title="关闭"
            >
              <X size={17} />
            </button>
          </div>
          <dl className="settings-list">
            <div>
              <dt>记录数据</dt>
              <dd>
                {storage.mode === 'local'
                  ? `保存在本机 SQLite 数据库：${storage.path || '本地数据目录'}，不会随浏览器清理丢失。`
                  : '当前回退到浏览器 LocalStorage；若本机数据服务可用会优先写入 SQLite。'}
              </dd>
            </div>
            <div>
              <dt>主题偏好</dt>
              <dd>日间/暗夜选择会保存在本机浏览器，下次打开自动沿用。</dd>
            </div>
            <div>
              <dt>搜索来源</dt>
              <dd>当前为墙内优先的单来源检索：AGE动漫、萌娘百科为直连，Bangumi 标注为需代理。</dd>
            </div>
            <div>
              <dt>存储模式</dt>
              <dd>
                {storage.mode === 'local'
                  ? `本机持久化已启用（${storage.type}）`
                  : `本机持久化未连接，${storage.error || '使用浏览器回退存储'}`}
              </dd>
            </div>
          </dl>

          <div className="settings-section">
            <div className="settings-section-head">
              <p className="settings-section-title">自定义背景</p>
              <span className="settings-section-hint">图片仅保存在本机浏览器</span>
            </div>
            <div className="settings-actions">
              <button
                className="button primary"
                type="button"
                onClick={() => bgInputRef.current?.click()}
              >
                <ImageIcon size={16} />
                <span>导入图片</span>
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={handleClearBackground}
                disabled={!background.image}
              >
                <X size={16} />
                <span>恢复默认</span>
              </button>
              <input
                ref={bgInputRef}
                className="sr-only"
                type="file"
                accept="image/*"
                onChange={handleImportBackground}
              />
            </div>
            <label className="settings-slider">
              <span>
                不透明度<em>{Math.round(background.opacity * 100)}%</em>
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={background.opacity}
                disabled={!background.image}
                onChange={(event) => setOpacity(Number(event.target.value))}
              />
            </label>
            <label className="settings-slider">
              <span>
                模糊<em>{background.blur}px</em>
              </span>
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={background.blur}
                disabled={!background.image}
                onChange={(event) => setBlur(Number(event.target.value))}
              />
            </label>
          </div>

          <div className="settings-section">
            <div className="settings-section-head">
              <p className="settings-section-title">导出格式</p>
              <span className="settings-section-hint">JSON 可直接恢复</span>
            </div>
            <label className="settings-select">
              <span>备份文件格式</span>
              <select value={exportFormat} onChange={(event) => setExportFormat(event.target.value)}>
                {EXPORT_FORMATS.map((format) => (
                  <option key={format.value} value={format.value}>
                    {format.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="settings-actions">
            <button className="button primary" type="button" onClick={handleExportBackup}>
              <Download size={16} />
              <span>导出 {exportFormat.toUpperCase()}</span>
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} />
              <span>导入备份</span>
            </button>
            <input
              ref={fileInputRef}
              className="sr-only"
              type="file"
              accept="application/json,.json"
              onChange={handleImportBackup}
            />
          </div>
        </aside>
      )}

      <div className="floating-toolbar" aria-label="右下角功能栏">
        <button
          className="floating-tool-button"
          type="button"
          onClick={handleToggleTheme}
          aria-label={isDark ? '切换日间主题' : '切换暗夜主题'}
          title={isDark ? '切换日间主题' : '切换暗夜主题'}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          className={settingsOpen ? 'floating-tool-button active' : 'floating-tool-button'}
          type="button"
          onClick={() => setSettingsOpen((current) => !current)}
          aria-label="打开数据与偏好说明"
          title="数据与偏好说明"
        >
          <Settings2 size={18} />
        </button>
      </div>

      {editingRecord && (
        <RecordEditor
          record={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSave={handleSaveRecord}
        />
      )}

      {pendingBackupImport && (
        <ConfirmModal
          eyebrow="备份导入"
          title="覆盖当前作品库？"
          description={`将用 ${pendingBackupImport.fileName} 中的 ${pendingBackupImport.records.length} 条记录覆盖当前作品库。建议先导出当前备份再继续。`}
          icon={Upload}
          confirmLabel="确认覆盖"
          onCancel={() => setPendingBackupImport(null)}
          onConfirm={handleConfirmBackupImport}
        />
      )}

      <div className={toast ? 'toast show' : 'toast'} role="status" aria-live="polite">
        {toast}
      </div>
      </div>
    </div>
  );
}
