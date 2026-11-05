import { useEffect, useRef, useState } from 'react';
import { getLocalApiBase, loadLocalRecords, saveLocalRecords } from '../utils/localApi.js';
import { createRecordFromWork, getWorkKey, normalizeRecord } from '../utils/library.js';
import {
  createRecordPackage, createWriterId, readLibraryCache,
  removeRecordPackage, sameRecords, writeRecordPackage,
} from '../utils/libraryStorage.js';

export function useLibrary() {
  const controller = useRef(null);
  if (!controller.current) {
    const target = getLocalApiBase() || 'browser';
    const cache = readLibraryCache(target);
    controller.current = {
      target, writer: createWriterId(), revision: null, baseline: cache.records,
      queued: null, inFlight: null, mounted: false, recoveryPackages: [],
      view: {
        records: cache.records, canWrite: false, recovery: null,
        storage: { mode: 'checking', type: 'browser', path: '', error: '', status: 'checking', cacheError: cache.error },
      },
    };
  }
  const state = controller.current;
  const [view, setView] = useState(state.view);

  function publish(patch) {
    state.view = { ...state.view, ...patch };
    if (state.mounted) setView(state.view);
  }

  function setStorage(patch) {
    publish({ storage: { ...state.view.storage, ...patch } });
  }

  function requireProtocol(payload) {
    if (Array.isArray(payload?.records) && typeof payload.revision === 'string' && payload.revision.trim()) return payload;
    const error = new Error('本机服务协议需要更新，请更新后重新打开应用');
    error.code = 'LOCAL_PROTOCOL_REQUIRED';
    throw error;
  }

  function blockIncompatibleService(error) {
    state.revision = null;
    publish({ canWrite: false, recovery: null });
    setStorage({ mode: 'local', status: 'error', error: error.message });
  }

  async function readLocalRecords() {
    return requireProtocol(await loadLocalRecords());
  }

  function cacheOperation(operation) {
    try {
      operation();
      return true;
    } catch (error) {
      setStorage({ cacheError: error.message || '浏览器副本保存失败' });
      return false;
    }
  }

  function confirmCache(records) {
    return cacheOperation(() => writeRecordPackage(createRecordPackage(
      state.target, records, state.revision, 'saved',
    )));
  }

  function showRecovery(baseline, candidates, status = 'conflict') {
    state.baseline = baseline;
    state.recoveryPackages = candidates;
    publish({
      canWrite: false,
      recovery: {
        baselineRecords: baseline,
        baselineLabel: state.view.storage.mode === 'local' ? '本机作品库' : '浏览器最近保存',
        candidates: candidates.map(({ id, records, updatedAt }) => ({ id, records, updatedAt })),
      },
    });
    setStorage({ status });
  }

  function collectCandidates(baseline, includeConfirmed = false) {
    const cache = readLibraryCache(state.target);
    if (cache.error) setStorage({ cacheError: cache.error });
    const candidates = [...cache.candidates];
    if (includeConfirmed && cache.confirmed && !sameRecords(cache.confirmed.records, baseline)) {
      candidates.push({ ...cache.confirmed, id: 'confirmed' });
    }
    if (state.queued && !candidates.some((item) => sameRecords(item.records, state.queued.records))) {
      candidates.push({ ...state.queued, id: `${state.writer}:memory:${state.queued.contentVersion}` });
    }
    return state.view.storage.mode === 'local'
      ? candidates.filter((item) => !sameRecords(item.records, baseline))
      : candidates;
  }

  function finishRecovery(records) {
    const candidates = collectCandidates(records).filter((candidate) =>
      candidate.id !== state.writer || !sameRecords(candidate.records, records),
    );
    if (candidates.length) {
      showRecovery(records, candidates);
    } else {
      state.recoveryPackages = [];
      publish({ canWrite: true, recovery: null });
    }
  }

  function acknowledge(packet, payload) {
    requireProtocol(payload);
    state.revision = payload.revision;
    state.baseline = packet.records;
    confirmCache(packet.records);
    cacheOperation(() => removeRecordPackage(packet));
    for (const candidate of packet.cleanup || []) cacheOperation(() => removeRecordPackage(candidate));
    if (state.queued?.contentVersion === packet.contentVersion) state.queued = null;
    setStorage({ status: state.queued ? 'saving' : 'saved', error: '' });
    if (packet.cleanup) finishRecovery(packet.records);
  }

  async function handleSaveFailure(packet, error) {
    if (error.code === 'LOCAL_PROTOCOL_REQUIRED') {
      blockIncompatibleService(error);
      return false;
    }
    // A timeout can hide a committed transaction. Read back before allowing
    // either a retry or a replacement of another window's revision.
    let payload;
    try { payload = await readLocalRecords(); } catch (readError) {
      if (readError.code === 'LOCAL_PROTOCOL_REQUIRED') {
        blockIncompatibleService(readError);
        return false;
      }
    }
    if (payload && sameRecords(payload.records.map(normalizeRecord), packet.records)) {
      acknowledge(packet, payload);
      return true;
    }
    if (payload && (error.status === 409 || payload.revision !== state.revision)) {
      state.revision = payload.revision;
      const baseline = payload.records.map(normalizeRecord);
      showRecovery(baseline, collectCandidates(baseline));
      setStorage({ error: '其他窗口已更新作品库，请选择要保留的副本' });
    } else {
      setStorage({
        status: state.queued?.cached ? 'pending' : 'error',
        error: error.status === 428 ? '本机服务需要更新，请导出备份后刷新应用' : error.message || '本机保存失败',
      });
    }
    return false;
  }

  function pump() {
    if (state.inFlight) return state.inFlight;
    if (!state.queued || state.view.storage.mode !== 'local') return Promise.resolve();
    state.inFlight = (async () => {
      while (state.queued && state.mounted && !state.view.recovery) {
        const packet = state.queued;
        setStorage({ status: 'saving' });
        try {
          const payload = await saveLocalRecords(packet.records, state.revision);
          acknowledge(packet, payload);
        } catch (error) {
          const accepted = await handleSaveFailure(packet, error);
          if (!accepted) break;
        }
      }
    })().finally(() => { state.inFlight = null; });
    return state.inFlight;
  }

  function enqueue(records, cleanupPackages) {
    setStorage({ cacheError: '' });
    const status = state.view.storage.mode === 'browser' ? 'saved' : 'pending';
    const packet = createRecordPackage(state.target, records, state.revision, status, state.writer);
    packet.cached = cacheOperation(() => writeRecordPackage(packet));
    packet.cleanup = cleanupPackages;
    state.queued = packet;
    if (state.view.storage.mode === 'local') return pump();
    const confirmed = confirmCache(records);
    if (packet.cached && confirmed) {
      for (const candidate of cleanupPackages || []) cacheOperation(() => removeRecordPackage(candidate));
      state.queued = null;
      setStorage({ status: 'saved', error: '' });
      if (cleanupPackages) finishRecovery(records);
    } else {
      setStorage({ status: 'error', error: '浏览器保存失败，请导出当前作品库' });
    }
    return Promise.resolve();
  }

  useEffect(() => {
    state.mounted = true;
    let active = true;
    (async () => {
      let payload;
      try { payload = await readLocalRecords(); } catch (error) {
        if (!active) return;
        if (error.code === 'LOCAL_PROTOCOL_REQUIRED') {
          blockIncompatibleService(error);
          return;
        }
        setStorage({ mode: 'browser', type: 'localStorage', status: 'saved', error: error.message });
      }
      if (!active) return;
      if (payload) {
        state.revision = payload.revision;
        setStorage({ mode: 'local', type: payload.storage?.type || 'sqlite', path: payload.storage?.path || '', status: 'saved', error: '' });
      }
      const cache = readLibraryCache(state.target);
      const baseline = payload ? payload.records.map(normalizeRecord) : cache.records;
      state.baseline = baseline;
      const candidates = collectCandidates(baseline, Boolean(payload));
      publish({ records: baseline });
      if (candidates.length) showRecovery(baseline, candidates);
      else {
        if (payload) confirmCache(baseline);
        publish({ canWrite: true });
      }
    })();
    return () => { active = false; state.mounted = false; };
  }, []);

  function assertReady() {
    if (!state.view.canWrite) {
      const error = new Error('作品库正在连接或等待副本选择');
      error.code = 'LIBRARY_NOT_READY';
      throw error;
    }
  }

  function mutate(transform) {
    assertReady();
    const records = transform(state.view.records);
    publish({ records });
    enqueue(records);
  }

  const patchRecord = (record, patch) => normalizeRecord({
    ...record, ...patch,
    rating: patch.rating === undefined ? record.rating ?? 0 : Number(patch.rating),
    updatedAt: new Date().toISOString(),
  });

  const addWork = (work) => {
    assertReady();
    const existing = state.view.records.find((record) => record.workKey === getWorkKey(work));
    if (existing) return existing;
    const record = createRecordFromWork(work);
    mutate((current) => [record, ...current]);
    return record;
  };
  const updateRecord = (id, patch) => mutate((current) => current.map((record) => record.id === id ? patchRecord(record, patch) : record));
  const deleteRecord = (id) => mutate((current) => current.filter((record) => record.id !== id));
  const bulkUpdateRecords = (ids, patch) => {
    assertReady();
    const selected = new Set((ids || []).filter(Boolean));
    if (selected.size) mutate((current) => current.map((record) => selected.has(record.id) ? patchRecord(record, patch) : record));
  };
  const deleteRecords = (ids) => {
    assertReady();
    const selected = new Set((ids || []).filter(Boolean));
    if (selected.size) mutate((current) => current.filter((record) => !selected.has(record.id)));
  };
  const replaceRecords = (records) => mutate(() => records.map(normalizeRecord));
  const mergeRecords = (records) => mutate((current) => {
    const merged = new Map(current.map((record) => [record.workKey || record.id, record]));
    for (const record of records.map(normalizeRecord)) merged.set(record.workKey || record.id, record);
    return [...merged.values()];
  });

  async function resolveRecovery(source, candidateId) {
    if (!state.view.recovery || state.inFlight) return;
    if (state.view.storage.mode === 'local') {
      try {
        const payload = await readLocalRecords();
        if (payload.revision !== state.revision) {
          state.revision = payload.revision;
          const baseline = payload.records.map(normalizeRecord);
          showRecovery(baseline, collectCandidates(baseline, true));
          setStorage({ error: '本机作品库再次更新，请重新确认要使用的副本' });
          return;
        }
      } catch (error) {
        if (error.code === 'LOCAL_PROTOCOL_REQUIRED') blockIncompatibleService(error);
        else setStorage({ status: 'error', error: error.message });
        return;
      }
    }
    const displayed = [...state.recoveryPackages];
    if (source === 'baseline') {
      const records = state.baseline;
      publish({ records, recovery: null });
      state.queued = null;
      // First persist the chosen baseline, then retire only displayed versions.
      setStorage({ cacheError: '' });
      if (!confirmCache(records) && state.view.storage.mode !== 'local') {
        showRecovery(records, displayed, 'error');
        return;
      }
      for (const candidate of displayed) cacheOperation(() => removeRecordPackage(candidate));
      setStorage({ status: 'saved', error: '' });
      finishRecovery(records);
      return;
    }
    const candidate = displayed.find((item) => item.id === candidateId);
    if (source !== 'candidate' || !candidate) throw new Error('请选择有效的浏览器副本');
    publish({ records: candidate.records, recovery: null });
    await enqueue(candidate.records, displayed);
    if (!state.view.recovery && !state.queued) publish({ canWrite: true });
  }

  async function retrySave() {
    if (state.inFlight) return state.inFlight;
    if (state.view.storage.mode === 'checking') return;
    if (state.view.recovery) return;
    if (state.view.storage.mode === 'browser') {
      await enqueue(state.view.records, state.queued?.cleanup);
      return;
    }
    try {
      const payload = await readLocalRecords();
      const records = payload.records.map(normalizeRecord);
      if (state.queued && sameRecords(records, state.queued.records)) {
        acknowledge(state.queued, payload);
      } else if (payload.revision !== state.revision) {
        state.revision = payload.revision;
        showRecovery(records, collectCandidates(records));
      } else if (state.queued) {
        await enqueue(state.queued.records, state.queued.cleanup);
      }
    } catch (error) {
      if (error.code === 'LOCAL_PROTOCOL_REQUIRED') blockIncompatibleService(error);
      else setStorage({ status: state.queued?.cached ? 'pending' : 'error', error: error.message });
    }
  }

  return {
    ...view, addWork, updateRecord, deleteRecord, bulkUpdateRecords,
    deleteRecords, replaceRecords, mergeRecords,
    hasWork: (work) => view.records.some((record) => record.workKey === getWorkKey(work)),
    resolveRecovery, retrySave,
  };
}
