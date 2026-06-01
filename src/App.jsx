import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Clock3,
  Download,
  Image as ImageIcon,
  Library,
  Moon,
  Network,
  PackageCheck,
  Search,
  Settings2,
  Sun,
  Upload,
  UploadCloud,
  X,
} from 'lucide-react';
import SearchPanel from './components/SearchPanel.jsx';
import LibraryPanel from './components/LibraryPanel.jsx';
import TimelinePanel from './components/TimelinePanel.jsx';
import StatsPanel from './components/StatsPanel.jsx';
import InventoryPanel from './components/InventoryPanel.jsx';
import RelationGraphPanel from './components/RelationGraphPanel.jsx';
import BulkImportPanel from './components/BulkImportPanel.jsx';
import RecordEditor from './components/RecordEditor.jsx';
import { useLibrary } from './hooks/useLibrary.js';
import { useBackground } from './hooks/useBackground.js';
import { getStats } from './utils/stats.js';
import { createBackup, getDoneLabel, readBackup } from './utils/library.js';
import { readImageFile } from './utils/background.js';

const THEME_KEY = 'my-acgn-journey:theme';

const TABS = [
  { id: 'search', label: '搜索', icon: Search },
  { id: 'library', label: '我的库', icon: Library },
  { id: 'inventory', label: '实体库存', icon: PackageCheck },
  { id: 'graph', label: '关系图谱', icon: Network },
  { id: 'import', label: '批量导入', icon: UploadCloud },
  { id: 'timeline', label: '历程', icon: Clock3 },
  { id: 'stats', label: '统计', icon: BarChart3 },
];

function getInitialTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const [activeTab, setActiveTab] = useState('search');
  const [editingRecord, setEditingRecord] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);
  const [toast, setToast] = useState('');
  const fileInputRef = useRef(null);
  const bgInputRef = useRef(null);
  const { records, addWork, updateRecord, deleteRecord, replaceRecords, mergeRecords, hasWork } =
    useLibrary();
  const { background, setImage, setOpacity, setBlur, clearImage } = useBackground();
  const stats = useMemo(() => getStats(records), [records]);
  const isDark = theme === 'dark';

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

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

  const handleMergeImport = (nextRecords) => {
    mergeRecords(nextRecords);
    showToast(`已合并导入 ${nextRecords.length} 条记录`);
  };

  const handleReplaceImport = (nextRecords) => {
    replaceRecords(nextRecords);
    showToast(`已覆盖导入 ${nextRecords.length} 条记录`);
  };

  const handleExportBackup = () => {
    const backup = createBackup(records);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `my-acgn-journey-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(`已导出 ${records.length} 条记录`);
  };

  const handleImportBackup = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const payload = JSON.parse(await file.text());
      const importedRecords = readBackup(payload);
      const confirmed = window.confirm(
        `将导入 ${importedRecords.length} 条记录并覆盖当前作品库。继续吗？`,
      );
      if (!confirmed) return;
      replaceRecords(importedRecords);
      showToast(`已恢复 ${importedRecords.length} 条备份记录`);
    } catch (error) {
      showToast(error.message || '备份导入失败');
    }
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
    <div className="app-shell">
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
          <img className="brand-mark" src="/img.ico" alt="" aria-hidden="true" />
          <div>
            <h1>My ACGN Journey</h1>
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
        {activeTab === 'search' && (
          <SearchPanel hasWork={hasWork} onAddWork={handleAddWork} />
        )}

        {activeTab === 'library' && (
          <LibraryPanel
            records={records}
            onEditRecord={setEditingRecord}
            onDeleteRecord={handleDeleteRecord}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryPanel
            records={records}
            onEditRecord={setEditingRecord}
            onUpdateRecord={updateRecord}
          />
        )}

        {activeTab === 'graph' && (
          <RelationGraphPanel records={records} onUpdateRecord={updateRecord} />
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
      </main>

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
              <dd>保存在当前浏览器的 LocalStorage，不会自动同步到云端。</dd>
            </div>
            <div>
              <dt>主题偏好</dt>
              <dd>日间/暗夜选择会保存在本机浏览器，下次打开自动沿用。</dd>
            </div>
            <div>
              <dt>搜索来源</dt>
              <dd>当前为单来源检索：Bangumi、AGE动漫、咕咕番、girigiri愛、豆瓣、NyaFun。</dd>
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

          <div className="settings-actions">
            <button className="button primary" type="button" onClick={handleExportBackup}>
              <Download size={16} />
              <span>导出备份</span>
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

      <div className={toast ? 'toast show' : 'toast'} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}
