import { loadRecords, normalizeRecord } from './library.js';

const PREFIX = 'acgn_journey:records:v2:';

export function createWriterId() {
  return crypto.randomUUID();
}

export function sameRecords(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function cacheKey(target, writer = '', contentVersion = '') {
  const base = `${PREFIX}${encodeURIComponent(target)}:${writer ? `writer:${writer}` : 'confirmed'}`;
  return writer && contentVersion ? `${base}:version:${contentVersion}` : base;
}

export function createRecordPackage(
  target,
  records,
  revision,
  status,
  writer = ''
) {
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
  const key = cacheKey(packet.target, packet.writer, packet.contentVersion);
  localStorage.setItem(key, JSON.stringify(packet));
  if (!packet.writer) return;
  const prefix = `${cacheKey(packet.target, packet.writer)}:version:`;
  const previous = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const candidateKey = localStorage.key(index);
    if (candidateKey?.startsWith(prefix) && candidateKey !== key)
      previous.push(candidateKey);
  }
  for (const previousKey of previous) localStorage.removeItem(previousKey);
}

// Writer versions use immutable keys, so deleting an acknowledged version
// cannot delete a new version published by another window in the meantime.
export function removeRecordPackage(packet) {
  if (!packet.writer) return;
  const key =
    packet.key || cacheKey(packet.target, packet.writer, packet.contentVersion);
  if (key === cacheKey(packet.target, packet.writer)) {
    localStorage.setItem(
      `${key}:resolved`,
      JSON.stringify({
        version: 2,
        target: packet.target,
        contentVersion: packet.contentVersion,
      })
    );
  } else {
    localStorage.removeItem(key);
  }
}

export function readLibraryCache(target) {
  let confirmed = null;
  const candidates = [];
  const writers = new Map();
  let error = '';
  try {
    const prefix = `${PREFIX}${encodeURIComponent(target)}:`;
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      try {
        const packet = JSON.parse(localStorage.getItem(key));
        if (
          packet?.version !== 2 ||
          packet.target !== target ||
          !Array.isArray(packet.records)
        )
          continue;
        const normalized = {
          ...packet,
          key,
          records: packet.records.map(normalizeRecord),
        };
        if (key === cacheKey(target)) confirmed = normalized;
        else if (packet.writer) {
          const legacyKey = cacheKey(target, packet.writer);
          const resolved =
            key === legacyKey
              ? JSON.parse(
                  localStorage.getItem(`${legacyKey}:resolved`) || 'null'
                )
              : null;
          if (resolved?.contentVersion === packet.contentVersion) continue;
          const previous = writers.get(packet.writer);
          if (
            !previous ||
            String(packet.updatedAt) >= String(previous.updatedAt)
          ) {
            writers.set(packet.writer, { ...normalized, id: packet.writer });
          }
        }
      } catch (cause) {
        error = cause.message;
      }
    }
    candidates.push(...writers.values());
    // Once a v2 confirmed package exists, old arrays are historical migration
    // inputs. Reading them again would resurrect a deliberately emptied library.
    if (!confirmed) {
      for (const key of [
        'acgn_journey:records:v1',
        'my-acgn-journey:records:v1',
      ]) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const records = JSON.parse(raw);
          if (Array.isArray(records) && records.length)
            candidates.push({
              id: key,
              key,
              raw,
              records: records.map(normalizeRecord),
              updatedAt: '',
            });
        } catch (cause) {
          error = cause.message;
        }
      }
    }
  } catch (cause) {
    error = cause.message;
  }
  return {
    confirmed,
    candidates,
    records: confirmed?.records || loadRecords().map(normalizeRecord),
    error,
  };
}
