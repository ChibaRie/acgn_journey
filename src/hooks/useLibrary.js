import { useEffect, useMemo, useState } from 'react';
import { loadLocalRecords, saveLocalRecords } from '../utils/localApi.js';
import {
  createRecordFromWork,
  getWorkKey,
  loadRecords,
  normalizeRecord,
  saveRecords,
} from '../utils/library.js';

export function useLibrary() {
  const [storage, setStorage] = useState({
    mode: 'checking',
    type: 'browser',
    path: '',
    error: '',
  });
  const [records, setRecords] = useState(() => loadRecords().map(normalizeRecord));

  useEffect(() => {
    let cancelled = false;
    loadLocalRecords()
      .then((payload) => {
        if (cancelled) return;
        setRecords((current) => {
          const localRecords = (payload.records || []).map(normalizeRecord);
          if (localRecords.length === 0 && current.length > 0) {
            saveLocalRecords(current).catch(() => {});
            return current;
          }
          return localRecords;
        });
        setStorage({
          mode: 'local',
          type: payload.storage?.type || 'sqlite',
          path: payload.storage?.path || '',
          error: '',
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setStorage({
          mode: 'browser',
          type: 'localStorage',
          path: '',
          error: error.message || '本地数据服务不可用',
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (storage.mode === 'checking') return;
    saveRecords(records);
    if (storage.mode === 'local') {
      saveLocalRecords(records).catch((error) => {
        setStorage((current) => ({
          ...current,
          mode: 'browser',
          type: 'localStorage',
          path: '',
          error: error.message || '本地数据服务保存失败，已回退到浏览器存储',
        }));
      });
    }
  }, [records, storage.mode]);

  const workKeys = useMemo(() => new Set(records.map((record) => record.workKey)), [records]);

  const hasWork = (work) => workKeys.has(getWorkKey(work));

  const applyPatchToRecord = (record, patch) =>
    normalizeRecord({
      ...record,
      ...patch,
      rating: patch.rating === undefined ? record.rating ?? 0 : Number(patch.rating),
      updatedAt: new Date().toISOString(),
    });

  const addWork = (work) => {
    const key = getWorkKey(work);
    const existing = records.find((record) => record.workKey === key);
    if (existing) return existing;

    const record = createRecordFromWork(work);
    setRecords((current) => [record, ...current]);
    return record;
  };

  const updateRecord = (id, patch) => {
    setRecords((current) =>
      current.map((record) => (record.id === id ? applyPatchToRecord(record, patch) : record)),
    );
  };

  const deleteRecord = (id) => {
    setRecords((current) => current.filter((record) => record.id !== id));
  };

  const bulkUpdateRecords = (ids, patch) => {
    const idSet = new Set((ids || []).filter(Boolean));
    if (idSet.size === 0) return;

    setRecords((current) =>
      current.map((record) => (idSet.has(record.id) ? applyPatchToRecord(record, patch) : record)),
    );
  };

  const deleteRecords = (ids) => {
    const idSet = new Set((ids || []).filter(Boolean));
    if (idSet.size === 0) return;

    setRecords((current) => current.filter((record) => !idSet.has(record.id)));
  };

  const replaceRecords = (nextRecords) => {
    setRecords(nextRecords.map(normalizeRecord));
  };

  const mergeRecords = (nextRecords) => {
    setRecords((current) => {
      const merged = new Map(current.map((record) => [record.workKey || record.id, record]));
      nextRecords.map(normalizeRecord).forEach((record) => {
        merged.set(record.workKey || record.id, record);
      });
      return Array.from(merged.values());
    });
  };

  return {
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
  };
}
