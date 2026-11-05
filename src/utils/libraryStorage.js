import { loadRecords, normalizeRecord } from './library.js';

const PREFIX = 'acgn_journey:records:v2:';

export function createWriterId() {
  return crypto.randomUUID();
}

export function sameRecords(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function cacheKey(target, writer = '') {
  return `${PREFIX}${encodeURIComponent(target)}:${writer ? `writer:${writer}` : 'confirmed'}`;
}

export function createRecordPackage(target, records, revision, status, writer = '') {
  return {
    version: 2,
    target,
    writer,
    contentVersion: createWriterId(),
    records,
    revision,
    status,
    updatedAt: new Date().toISOString(),
  };
}

export function writeRecordPackage(packet) {
  localStorage.setItem(cacheKey(packet.target, packet.writer), JSON.stringify(packet));
}

// Compare the exact displayed package before removing it. A writer may have
// replaced its package while a recovery dialog or network request was open.
export function removeRecordPackage(packet) {
  const key = packet.key || cacheKey(packet.target, packet.writer);
  const raw = localStorage.getItem(key);
  if (!raw) return;
  if (packet.raw !== undefined) {
    if (raw === packet.raw) localStorage.removeItem(key);
    return;
  }
  if (JSON.parse(raw).contentVersion === packet.contentVersion) localStorage.removeItem(key);
}

export function readLibraryCache(target) {
  let confirmed = null;
  const candidates = [];
  let error = '';
  try {
    const prefix = `${PREFIX}${encodeURIComponent(target)}:`;
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      try {
        const packet = JSON.parse(localStorage.getItem(key));
        if (packet?.version !== 2 || packet.target !== target || !Array.isArray(packet.records)) continue;
        const normalized = { ...packet, key, records: packet.records.map(normalizeRecord) };
        if (key === cacheKey(target)) confirmed = normalized;
        else if (packet.writer) candidates.push({ ...normalized, id: packet.writer });
      } catch (cause) {
        error = cause.message;
      }
    }
    // Once a v2 confirmed package exists, old arrays are historical migration
    // inputs. Reading them again would resurrect a deliberately emptied library.
    if (!confirmed) {
      for (const key of ['acgn_journey:records:v1', 'my-acgn-journey:records:v1']) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const records = JSON.parse(raw);
          if (Array.isArray(records) && records.length) candidates.push({
            id: key, key, raw, records: records.map(normalizeRecord), updatedAt: '',
          });
        } catch (cause) { error = cause.message; }
      }
    }
  } catch (cause) {
    error = cause.message;
  }
  return { confirmed, candidates, records: confirmed?.records || loadRecords().map(normalizeRecord), error };
}
