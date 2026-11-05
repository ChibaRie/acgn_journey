// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  cacheKey,
  createRecordPackage,
  readLibraryCache,
  removeRecordPackage,
  writeRecordPackage,
} from './libraryStorage.js';

const target = 'http://127.0.0.1:49189';
const packet = (title) =>
  createRecordPackage(
    target,
    [{ id: 'one', title }],
    'r1',
    'pending',
    'foreign'
  );
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

test('uses a distinct storage key for each writer content version', () => {
  const first = packet('First');
  const second = packet('Second');
  writeRecordPackage(first);
  const firstKey = readLibraryCache(target).candidates[0].key;
  writeRecordPackage(second);
  const candidate = readLibraryCache(target).candidates[0];
  expect(candidate.key).not.toBe(firstKey);
  expect(candidate.records[0].title).toBe('Second');
  expect(readLibraryCache(target).candidates).toHaveLength(1);
});

test('keeps a newer writer version published during cleanup of the displayed version', () => {
  const older = packet('Older');
  const newer = packet('Newer');
  writeRecordPackage(older);
  const displayed = readLibraryCache(target).candidates[0];
  const originalRead = Storage.prototype.getItem;
  let interleaved = false;
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
    const value = originalRead.call(this, key);
    if (key === displayed.key && !interleaved) {
      interleaved = true;
      writeRecordPackage(newer);
    }
    return value;
  });
  removeRecordPackage(displayed);
  if (!interleaved) writeRecordPackage(newer);
  const candidates = readLibraryCache(target).candidates;
  expect(candidates).toHaveLength(1);
  expect(candidates[0].records[0].title).toBe('Newer');
});

test('acknowledges a legacy mutable package without deleting a concurrent newer value', () => {
  const older = packet('Older legacy');
  const newer = packet('Newer legacy');
  const key = cacheKey(target, 'foreign');
  localStorage.setItem(key, JSON.stringify(older));
  const displayed = readLibraryCache(target).candidates[0];
  const originalRead = Storage.prototype.getItem;
  let interleaved = false;
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
    function (storageKey) {
      const value = originalRead.call(this, storageKey);
      if (storageKey === key) {
        interleaved = true;
        localStorage.setItem(key, JSON.stringify(newer));
      }
      return value;
    }
  );
  removeRecordPackage(displayed);
  if (!interleaved) localStorage.setItem(key, JSON.stringify(newer));
  expect(JSON.parse(originalRead.call(localStorage, key)).contentVersion).toBe(
    newer.contentVersion
  );
});

test('resolves only the displayed legacy content version', () => {
  const older = packet('Resolved legacy');
  const key = cacheKey(target, 'foreign');
  localStorage.setItem(key, JSON.stringify(older));
  removeRecordPackage(readLibraryCache(target).candidates[0]);
  expect(readLibraryCache(target).candidates).toHaveLength(0);
  localStorage.setItem(key, JSON.stringify(packet('Later legacy edit')));
  expect(readLibraryCache(target).candidates[0].records[0].title).toBe(
    'Later legacy edit'
  );
});
