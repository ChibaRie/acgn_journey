import { useEffect, useMemo, useState } from 'react';
import {
  createRecordFromWork,
  getWorkKey,
  loadRecords,
  normalizeRecord,
  saveRecords,
} from '../utils/library.js';

export function useLibrary() {
  const [records, setRecords] = useState(() => loadRecords().map(normalizeRecord));

  useEffect(() => {
    saveRecords(records);
  }, [records]);

  const workKeys = useMemo(() => new Set(records.map((record) => record.workKey)), [records]);

  const hasWork = (work) => workKeys.has(getWorkKey(work));

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
      current.map((record) =>
        record.id === id
          ? normalizeRecord({
              ...record,
              ...patch,
              rating: Number(patch.rating ?? record.rating ?? 0),
              updatedAt: new Date().toISOString(),
            })
          : record,
      ),
    );
  };

  const deleteRecord = (id) => {
    setRecords((current) =>
      current
        .filter((record) => record.id !== id)
        .map((record) =>
          normalizeRecord({
            ...record,
            relations: (record.relations || []).filter((relation) => relation.targetId !== id),
          }),
        ),
    );
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
    replaceRecords,
    mergeRecords,
    hasWork,
  };
}
