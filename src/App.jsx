import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  LayoutDashboard,
  Library,
  Loader2,
  Moon,
  PackageCheck,
  Search,
  Settings2,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useLibrary } from './hooks/useLibrary.js';
import { useBackground } from './hooks/useBackground.js';
import { getStats, filterRecords } from './utils/stats.js';
import {
  createExportText,
  getExportFileName,
  getExportMimeType,
  getDoneLabel,
  readBackup,
} from './utils/library.js';
import { loadLocalSetting, saveLocalSetting } from './utils/localApi.js';

const Dashboard = lazy(() => import('./components/Dashboard.jsx'));
const LibraryPanel = lazy(() => import('./components/LibraryPanel.jsx'));
const SearchPanel = lazy(() => import('./components/SearchPanel.jsx'));
const TraceMoePanel = lazy(() => import('./components/TraceMoePanel.jsx'));
const TimelinePanel = lazy(() => import('./components/TimelinePanel.jsx'));
const StatsPanel = lazy(() => import('./components/StatsPanel.jsx'));
const InventoryPanel = lazy(() => import('./components/InventoryPanel.jsx'));
const AiProfilePanel = lazy(() => import('./components/AiProfilePanel.jsx'));
const SettingsDialog = lazy(() => import('./components/SettingsDialog.jsx'));
const RecordEditor = lazy(() => import('./components/RecordEditor.jsx'));
const ConfirmModal = lazy(() => import('./components/ConfirmModal.jsx'));
const RecoveryDialog = lazy(() => import('./components/RecoveryDialog.jsx'));

const THEME_KEY = 'acgn_journey:theme';
const MOTION_KEY = 'acgn_journey:motion';
const TABS = [
  { id: 'overview', label: '总览', icon: LayoutDashboard },
  { id: 'library', label: '作品库', icon: Library },
  { id: 'discover', label: '发现', icon: Search },
  { id: 'timeline', label: '历程', icon: Clock3 },
  { id: 'inventory', label: '实体收藏', icon: PackageCheck },
  { id: 'ai-profile', label: 'AI画像', icon: Sparkles },
];

function getInitialTheme() {
  try {
    const theme =
      localStorage.getItem(THEME_KEY) ||
      localStorage.getItem('my-acgn-journey:theme');
    return theme === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function getInitialMotion() {
  try {
    const preference = localStorage.getItem(MOTION_KEY);
    if (preference !== null) return preference !== 'off';
  } catch {
    /* The current session can still apply the preference. */
  }
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function downloadBackup(records, format = 'json') {
  const blob = new Blob([createExportText(records, format)], {
    type: getExportMimeType(format),
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = getExportFileName(format);
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function App() {
  const library = useLibrary();
  const { records, storage, canWrite, recovery, resolveRecovery, retrySave } =
    library;
  const backgroundState = useBackground();
  const { background } = backgroundState;
  const [activeTab, setActiveTab] = useState('overview');
  const [discoverMode, setDiscoverMode] = useState('text');
  const [libraryFilters, setLibraryFilters] = useState(null);
  const [statsFilters, setStatsFilters] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState('preferences');
  const [theme, setTheme] = useState(getInitialTheme);
  const [themeMode, setThemeMode] = useState('checking');
  const [themeCacheError, setThemeCacheError] = useState('');
  const [themeSaveError, setThemeSaveError] = useState('');
  const [motionEnabled, setMotionEnabled] = useState(getInitialMotion);
  const [toast, setToast] = useState('');
  const [pendingBackup, setPendingBackup] = useState(null);
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [pendingRecovery, setPendingRecovery] = useState(null);
  const toastTimer = useRef(null);
  const themeSaveQueue = useRef(Promise.resolve());
  const currentTheme = useRef(theme);
  currentTheme.current = theme;
  const stats = useMemo(() => getStats(records), [records]);
  const detailedRecords = useMemo(
    () => filterRecords(records, statsFilters || {}),
    [records, statsFilters]
  );
  const detailedStats = useMemo(
    () => getStats(detailedRecords),
    [detailedRecords]
  );

  const notify = useCallback((message) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 3200);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  useEffect(() => {
    setRecoveryDismissed(false);
  }, [recovery]);

  useEffect(() => {
    let cancelled = false;
    loadLocalSetting('theme')
      .then((setting) => {
        if (cancelled) return;
        if (setting?.value === 'light' || setting?.value === 'dark')
          setTheme(setting.value);
        setThemeMode('local');
      })
      .catch(() => {
        if (!cancelled) setThemeMode('browser');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    if (themeMode === 'checking') return;
    try {
      localStorage.setItem(THEME_KEY, theme);
      setThemeCacheError('');
    } catch {
      setThemeCacheError('主题已应用，浏览器偏好暂时无法保存。');
    }
    if (themeMode === 'local') {
      themeSaveQueue.current = themeSaveQueue.current
        .catch(() => {})
        .then(() => saveLocalSetting('theme', theme))
        .then(() => {
          if (currentTheme.current === theme) setThemeSaveError('');
        })
        .catch(() => {
          if (currentTheme.current === theme)
            setThemeSaveError('主题已应用，本机偏好保存失败。');
        });
    }
  }, [theme, themeMode]);

  useEffect(() => {
    document.documentElement.dataset.motion = motionEnabled ? 'on' : 'off';
    try {
      localStorage.setItem(MOTION_KEY, motionEnabled ? 'on' : 'off');
    } catch {
      /* Motion remains available for this session. */
    }
  }, [motionEnabled]);

  const runMutation = (operation) => {
    try {
      return operation();
    } catch (error) {
      notify(
        error.code === 'LIBRARY_NOT_READY'
          ? '作品库正在连接或等待恢复选择，请稍后再试。'
          : error.message || '操作未完成'
      );
      return false;
    }
  };

  const openLibrary = (filters = {}) => {
    setLibraryFilters({ ...filters });
    setActiveTab('library');
    setShowStats(false);
  };
  const openImport = () => {
    setSettingsView('import');
    setSettingsOpen(true);
  };
  const editRecord = (record) => {
    if (!canWrite) {
      notify('请先完成作品库连接或副本恢复。');
      return;
    }
    setEditingRecord(record);
  };
  const addWork = (work) => {
    const record = runMutation(() => library.addWork(work));
    if (record) notify(`已加入作品库，标记为${getDoneLabel(record.type)}`);
    return record;
  };
  const mergeRecords = (nextRecords) => {
    const result = runMutation(() => library.mergeRecords(nextRecords));
    if (result === false) return false;
    notify(`已合并 ${nextRecords.length} 条记录`);
    return true;
  };
  const replaceRecords = (nextRecords) => {
    const result = runMutation(() => library.replaceRecords(nextRecords));
    if (result === false) return false;
    notify(`已恢复 ${nextRecords.length} 条记录`);
    return true;
  };
  const importBackup = async (file) => {
    try {
      setPendingBackup({
        records: readBackup(JSON.parse(await file.text())),
        name: file.name,
      });
    } catch (error) {
      notify(error.message || '备份读取失败');
    }
  };
  const handleRecovery = async (source, id) => {
    setRecoveryBusy(true);
    try {
      await resolveRecovery(source, id);
      setPendingRecovery(null);
    } catch (error) {
      notify(error.message || '副本恢复失败，请重试或先导出副本。');
    } finally {
      setRecoveryBusy(false);
    }
  };

  const saveStatus =
    storage.status || (storage.mode === 'checking' ? 'checking' : 'saved');
  const statusText =
    {
      checking: '正在连接',
      saving: '正在保存',
      saved: storage.mode === 'local' ? '本机已保存' : '浏览器已保存',
      pending: '等待同步',
      conflict: '版本冲突',
      error: '保存失败',
    }[saveStatus] || '检查保存状态';
  const hasStorageNotice = storage.error || storage.cacheError || recovery;

  return (
    <div className="app-shell">
      {background.image && (
        <div
          className="app-background"
          aria-hidden="true"
          style={{
            backgroundImage: `url(${background.image})`,
            opacity: background.opacity,
            filter: `blur(${background.blur}px)`,
          }}
        />
      )}
      <header className="app-header">
        <div className="header-inner">
          <nav className="main-nav" aria-label="主导航">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={
                    activeTab === tab.id ? 'nav-button active' : 'nav-button'
                  }
                  aria-label={tab.label}
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id === 'overview') setShowStats(false);
                  }}
                >
                  <Icon size={19} aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="header-actions">
            <button
              className="icon-button"
              type="button"
              aria-label={theme === 'dark' ? '切换日间主题' : '切换暗夜主题'}
              title={theme === 'dark' ? '切换日间主题' : '切换暗夜主题'}
              disabled={themeMode === 'checking'}
              onClick={() =>
                setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
              }
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label="数据与设置"
              title="数据与设置"
              onClick={() => {
                setSettingsView('preferences');
                setSettingsOpen(true);
              }}
            >
              <Settings2 size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="workspace" tabIndex={-1} data-focus-fallback>
        <div
          className={`storage-strip status-${saveStatus}`}
          role="status"
          aria-live="polite"
        >
          <span>
            {saveStatus === 'checking' || saveStatus === 'saving' ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <CheckCircle2 size={16} />
            )}{' '}
            {statusText}
          </span>
          {hasStorageNotice && (
            <button
              className="text-button"
              type="button"
              onClick={() => {
                if (recovery) setRecoveryDismissed(false);
                else {
                  setSettingsView('preferences');
                  setSettingsOpen(true);
                }
              }}
            >
              查看详情
            </button>
          )}
          {['pending', 'error'].includes(saveStatus) && (
            <button
              className="text-button"
              type="button"
              onClick={() =>
                Promise.resolve(retrySave()).catch((error) =>
                  notify(error.message || '重试保存失败')
                )
              }
            >
              重试保存
            </button>
          )}
        </div>
        <Suspense
          fallback={
            <div className="loading-state" role="status">
              <Loader2 className="spin" size={22} />
              正在加载页面…
            </div>
          }
        >
          <div key={activeTab} className="view-transition">
            {activeTab === 'overview' && !showStats && (
              <Dashboard
                records={records}
                onEditRecord={editRecord}
                onOpenLibrary={openLibrary}
                onOpenDiscover={() => setActiveTab('discover')}
                onOpenImport={openImport}
                onOpenStats={(filters) => {
                  setStatsFilters(filters);
                  setShowStats(true);
                }}
                onToast={notify}
                motionEnabled={motionEnabled}
              />
            )}
            {activeTab === 'overview' && showStats && (
              <>
                <div className="page-heading">
                  <h1>详细统计</h1>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => setShowStats(false)}
                  >
                    <ArrowLeft size={18} />
                    返回总览
                  </button>
                </div>
                <StatsPanel records={detailedRecords} stats={detailedStats} />
              </>
            )}
            {activeTab === 'library' && (
              <LibraryPanel
                records={records}
                externalFilters={libraryFilters}
                readOnly={!canWrite}
                onEditRecord={editRecord}
                onDeleteRecord={(id) => {
                  if (runMutation(() => library.deleteRecord(id)) !== false)
                    notify('记录已删除');
                }}
                onBulkUpdateRecords={(ids, patch) => {
                  if (
                    runMutation(() => library.bulkUpdateRecords(ids, patch)) !==
                    false
                  )
                    notify(`已更新 ${ids.length} 条记录`);
                }}
                onDeleteRecords={(ids) => {
                  if (runMutation(() => library.deleteRecords(ids)) !== false)
                    notify(`已删除 ${ids.length} 条记录`);
                }}
              />
            )}
            {activeTab === 'discover' && (
              <div className="discover-page">
                <div className="page-heading">
                  <h1>发现作品</h1>
                  <div
                    className="segmented-control"
                    role="group"
                    aria-label="发现方式"
                  >
                    <button
                      type="button"
                      aria-pressed={discoverMode === 'text'}
                      onClick={() => setDiscoverMode('text')}
                    >
                      文字搜索
                    </button>
                    <button
                      type="button"
                      aria-pressed={discoverMode === 'image'}
                      onClick={() => setDiscoverMode('image')}
                    >
                      截图识别
                    </button>
                  </div>
                </div>
                {discoverMode === 'text' ? (
                  <SearchPanel
                    hasWork={library.hasWork}
                    onAddWork={addWork}
                    readOnly={!canWrite}
                  />
                ) : (
                  <TraceMoePanel
                    hasWork={library.hasWork}
                    onAddWork={addWork}
                    readOnly={!canWrite}
                  />
                )}
              </div>
            )}
            {activeTab === 'timeline' && (
              <TimelinePanel
                records={records}
                onEditRecord={editRecord}
                readOnly={!canWrite}
              />
            )}
            {activeTab === 'inventory' && (
              <InventoryPanel
                records={records}
                onEditRecord={editRecord}
                readOnly={!canWrite}
                onUpdateRecord={(id, patch) =>
                  runMutation(() => library.updateRecord(id, patch))
                }
              />
            )}
            {activeTab === 'ai-profile' && (
              <AiProfilePanel
                records={records}
                stats={stats}
                storage={storage}
                onToast={notify}
              />
            )}
          </div>
          {settingsOpen && (
            <SettingsDialog
              records={records}
              storage={storage}
              backgroundState={backgroundState}
              preferenceError={themeCacheError || themeSaveError}
              canWrite={canWrite}
              initialView={settingsView}
              motionEnabled={motionEnabled}
              onMotionChange={setMotionEnabled}
              onClose={() => setSettingsOpen(false)}
              onToast={notify}
              onExport={(format) => downloadBackup(records, format)}
              onImportBackup={importBackup}
              onMergeRecords={mergeRecords}
              onReplaceRecords={replaceRecords}
            />
          )}
          {editingRecord && (
            <RecordEditor
              record={editingRecord}
              onClose={() => setEditingRecord(null)}
              onSave={(draft) => {
                if (
                  runMutation(() => library.updateRecord(draft.id, draft)) !==
                  false
                ) {
                  setEditingRecord(null);
                  notify('记录已更新');
                }
              }}
            />
          )}
        </Suspense>
      </main>

      <Suspense fallback={null}>
        {recovery && !recoveryDismissed && (
          <RecoveryDialog
            recovery={recovery}
            busy={recoveryBusy}
            onClose={() => setRecoveryDismissed(true)}
            onUseBaseline={() => handleRecovery('baseline')}
            onUseCandidate={setPendingRecovery}
            onExport={downloadBackup}
          />
        )}
        {pendingRecovery && (
          <ConfirmModal
            title="使用浏览器副本替换当前库？"
            description={`将采用此副本中的 ${pendingRecovery.records.length} 条记录。请确认需要保留的其他副本已经导出。`}
            confirmLabel="确认使用此副本"
            onCancel={() => setPendingRecovery(null)}
            onConfirm={() => {
              if (!recoveryBusy)
                handleRecovery('candidate', pendingRecovery.id);
            }}
          />
        )}
        {pendingBackup && (
          <ConfirmModal
            title="覆盖当前作品库？"
            description={`将使用 ${pendingBackup.name} 中的 ${pendingBackup.records.length} 条记录。建议先导出当前备份。`}
            confirmLabel="确认覆盖"
            onCancel={() => setPendingBackup(null)}
            onConfirm={() => {
              if (replaceRecords(pendingBackup.records)) setPendingBackup(null);
            }}
          />
        )}
      </Suspense>
      <div
        className={toast ? 'toast show' : 'toast'}
        role="status"
        aria-live="polite"
      >
        {toast}
      </div>
    </div>
  );
}
