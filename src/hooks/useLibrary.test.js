// @vitest-environment jsdom
import { StrictMode, createElement } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLibrary } from './useLibrary.js';
import { normalizeRecord } from '../utils/library.js';
import {
  cacheKey,
  createRecordPackage,
  readLibraryCache,
  writeRecordPackage,
} from '../utils/libraryStorage.js';

const record = (title = 'Original') =>
  normalizeRecord({
    id: 'one',
    workKey: 'test:one',
    title,
    source: 'test',
    addedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const response = (records, revision = 'r1') => ({
  records,
  revision,
  storage: { type: 'sqlite', path: 'temporary.db' },
});
const json = (payload, status = 200) => ({
  ok: status < 400,
  status,
  text: async () => JSON.stringify(payload),
});
let read;
let write;
let puts;

beforeEach(() => {
  localStorage.clear();
  window.__ACGN_LOCAL_API__ = { baseUrl: 'http://127.0.0.1:49189' };
  puts = [];
  read = async () => response([record()]);
  write = async (body) => response(body.records, 'r2');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url, options = {}) => {
      if (options.method === 'PUT') {
        const body = JSON.parse(options.body);
        puts.push(body);
        return json(await write(body));
      }
      return json(await read());
    })
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('library persistence lifecycle', () => {
  it('keeps an old service read-only after retry and baseline recovery actions', async () => {
    read = async () => ({ records: [record()] });
    const { result } = renderHook(useLibrary);
    await waitFor(() => expect(result.current.storage.status).toBe('error'));
    await act(async () => result.current.retrySave());
    await act(async () => result.current.resolveRecovery('baseline'));
    expect(result.current.canWrite).toBe(false);
    expect(result.current.recovery).toBeNull();
    expect(() => result.current.replaceRecords([])).toThrow(
      expect.objectContaining({ code: 'LIBRARY_NOT_READY' })
    );
    expect(puts).toHaveLength(0);
  });

  it('rejects protocol loss during timeout readback and preserves pending edits', async () => {
    const { result } = renderHook(useLibrary);
    await waitFor(() => expect(result.current.canWrite).toBe(true));
    write = async () => {
      read = async () => ({ records: puts.at(-1).records });
      throw new DOMException('timeout', 'AbortError');
    };
    act(() =>
      result.current.updateRecord('one', { title: 'Pending protocol update' })
    );
    await waitFor(() => expect(result.current.storage.status).toBe('error'));
    expect(result.current.canWrite).toBe(false);
    expect(result.current.records[0].title).toBe('Pending protocol update');
    expect(
      Object.keys(localStorage).filter((key) => key.includes(':writer:'))
    ).toHaveLength(1);
    await act(async () => result.current.retrySave());
    expect(result.current.canWrite).toBe(false);
    expect(puts).toHaveLength(1);
  });

  it('does not acknowledge a successful PUT response without a revision', async () => {
    const { result } = renderHook(useLibrary);
    await waitFor(() => expect(result.current.canWrite).toBe(true));
    write = async (body) => ({ records: body.records });
    act(() =>
      result.current.updateRecord('one', { title: 'Unconfirmed update' })
    );
    await waitFor(() => expect(result.current.storage.status).toBe('error'));
    expect(result.current.canWrite).toBe(false);
    expect(result.current.records[0].title).toBe('Unconfirmed update');
    expect(
      Object.keys(localStorage).filter((key) => key.includes(':writer:'))
    ).toHaveLength(1);
  });

  it('checks protocol again before resolving an existing recovery choice', async () => {
    writeRecordPackage(
      createRecordPackage(
        'http://127.0.0.1:49189',
        [record('Candidate')],
        'r0',
        'pending',
        'foreign'
      )
    );
    const { result } = renderHook(useLibrary);
    await waitFor(() => expect(result.current.recovery).toBeTruthy());
    read = async () => ({ records: [record()] });
    await act(async () =>
      result.current.resolveRecovery('candidate', 'foreign')
    );
    expect(result.current.canWrite).toBe(false);
    expect(result.current.storage.status).toBe('error');
    expect(puts).toHaveLength(0);
    expect(
      readLibraryCache('http://127.0.0.1:49189').candidates.some(
        (item) => item.id === 'foreign'
      )
    ).toBe(true);
  });

  it('blocks every mutation while initialization is pending, including StrictMode', async () => {
    const gate = deferred();
    read = () => gate.promise;
    const { result } = renderHook(useLibrary, {
      wrapper: ({ children }) => createElement(StrictMode, null, children),
    });
    expect(result.current.canWrite).toBe(false);
    expect(() => result.current.replaceRecords([])).toThrow(
      expect.objectContaining({ code: 'LIBRARY_NOT_READY' })
    );
    expect(puts).toHaveLength(0);
    await act(async () => gate.resolve(response([record()])));
    await waitFor(() => expect(result.current.canWrite).toBe(true));
    expect(puts).toHaveLength(0);
  });

  it('continues SQLite writes when all browser writes exceed quota', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const { result } = renderHook(useLibrary);
    await waitFor(() => expect(result.current.canWrite).toBe(true));
    act(() => result.current.updateRecord('one', { title: 'Saved in SQLite' }));
    await waitFor(() => expect(result.current.storage.status).toBe('saved'));
    expect(puts.at(-1)).toMatchObject({
      revision: 'r1',
      records: [{ title: 'Saved in SQLite' }],
    });
    expect(result.current.storage.cacheError).toBeTruthy();
    expect(result.current.storage.mode).toBe('local');
  });

  it('can adopt the durable SQLite baseline when browser cache writes fail', async () => {
    writeRecordPackage(
      createRecordPackage(
        'http://127.0.0.1:49189',
        [record('Browser copy')],
        'r0',
        'pending',
        'foreign'
      )
    );
    const { result } = renderHook(useLibrary);
    await waitFor(() => expect(result.current.recovery).toBeTruthy());
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    await act(async () => result.current.resolveRecovery('baseline'));
    expect(result.current.canWrite).toBe(true);
    expect(result.current.recovery).toBeNull();
    expect(result.current.storage.cacheError).toBeTruthy();
    act(() =>
      result.current.updateRecord('one', { title: 'Still saved locally' })
    );
    await waitFor(() => expect(result.current.storage.status).toBe('saved'));
    expect(puts.at(-1).records[0].title).toBe('Still saved locally');
  });

  it('serializes PUTs and coalesces edits into the latest snapshot', async () => {
    const first = deferred();
    const second = deferred();
    write = () => (puts.length === 1 ? first.promise : second.promise);
    const { result } = renderHook(useLibrary);
    await waitFor(() => expect(result.current.canWrite).toBe(true));
    act(() => result.current.updateRecord('one', { title: 'First' }));
    act(() => result.current.updateRecord('one', { title: 'Second' }));
    act(() => result.current.updateRecord('one', { title: 'Latest' }));
    expect(puts).toHaveLength(1);
    await act(async () => first.resolve(response(puts[0].records, 'r2')));
    await waitFor(() => expect(puts).toHaveLength(2));
    expect(puts[1]).toMatchObject({
      revision: 'r2',
      records: [{ title: 'Latest' }],
    });
    const pending = Object.keys(localStorage)
      .filter((key) => key.includes(':writer:'))
      .map((key) => JSON.parse(localStorage.getItem(key)));
    expect(pending).toHaveLength(1);
    expect(pending[0].records[0].title).toBe('Latest');
    await act(async () => second.resolve(response(puts[1].records, 'r3')));
    await waitFor(() => expect(result.current.storage.status).toBe('saved'));
    expect(result.current.records[0].title).toBe('Latest');
  });

  it('requires confirmation before migrating an old browser array into empty SQLite', async () => {
    localStorage.setItem(
      'my-acgn-journey:records:v1',
      JSON.stringify([record('Legacy')])
    );
    read = async () => response([], 'empty');
    const { result } = renderHook(useLibrary);
    await waitFor(() => expect(result.current.recovery).toBeTruthy());
    expect(result.current.canWrite).toBe(false);
    expect(puts).toHaveLength(0);
    const candidate = result.current.recovery.candidates[0];
    await act(async () =>
      result.current.resolveRecovery('candidate', candidate.id)
    );
    expect(puts[0]).toMatchObject({
      revision: 'empty',
      records: [{ title: 'Legacy' }],
    });
    expect(result.current.canWrite).toBe(true);
  });

  it('loads newer SQLite data without treating a previously acknowledged cache as pending', async () => {
    writeRecordPackage(
      createRecordPackage(
        'http://127.0.0.1:49189',
        [record('Old acknowledged snapshot')],
        'older-revision',
        'saved'
      )
    );
    read = async () =>
      response([record('New SQLite snapshot')], 'newer-revision');
    const { result } = renderHook(useLibrary);
    await waitFor(() => expect(result.current.canWrite).toBe(true));
    expect(result.current.recovery).toBeNull();
    expect(result.current.records[0].title).toBe('New SQLite snapshot');
    expect(puts).toHaveLength(0);
  });

  it('requires confirmation before replacing the last confirmed nonempty copy with empty SQLite', async () => {
    writeRecordPackage(
      createRecordPackage(
        'http://127.0.0.1:49189',
        [record('Last acknowledged copy')],
        'older-revision',
        'saved'
      )
    );
    read = async () => response([], 'new-empty-revision');
    const { result } = renderHook(useLibrary);
    await waitFor(() => expect(result.current.recovery).toBeTruthy());
    expect(result.current.canWrite).toBe(false);
    expect(result.current.recovery.baselineRecords).toHaveLength(0);
    expect(result.current.recovery.candidates[0].records[0].title).toBe(
      'Last acknowledged copy'
    );
    expect(puts).toHaveLength(0);
  });

  it('offers browser-only cached data once when a local service becomes available', async () => {
    const offline = [record('Offline browser edits')];
    writeRecordPackage(
      createRecordPackage(
        'http://127.0.0.1:49189',
        offline,
        null,
        'saved',
        'browser-writer'
      )
    );
    writeRecordPackage(
      createRecordPackage('http://127.0.0.1:49189', offline, null, 'saved')
    );
    read = async () => response([], 'empty');
    const { result } = renderHook(useLibrary);
    await waitFor(() => expect(result.current.recovery).toBeTruthy());
    expect(result.current.recovery.candidates).toHaveLength(1);
    expect(result.current.recovery.candidates[0].records[0].title).toBe(
      'Offline browser edits'
    );
    expect(puts).toHaveLength(0);
  });

  it('retains independent successful browser copies and offers both on reopen', async () => {
    read = async () => {
      throw new Error('offline');
    };
    const one = renderHook(useLibrary);
    const two = renderHook(useLibrary);
    await waitFor(() =>
      expect(one.result.current.canWrite && two.result.current.canWrite).toBe(
        true
      )
    );
    act(() => one.result.current.replaceRecords([record('Window one')]));
    act(() => two.result.current.replaceRecords([record('Window two')]));
    one.unmount();
    two.unmount();
    const reopened = renderHook(useLibrary);
    await waitFor(() => expect(reopened.result.current.recovery).toBeTruthy());
    const titles = reopened.result.current.recovery.candidates.map(
      (item) => item.records[0].title
    );
    expect(titles).toContain('Window one');
    expect(titles).toContain('Window two');
  });

  it('reads back an accepted write after a lost response without duplicating the PUT', async () => {
    let server = response([record()]);
    read = async () => server;
    write = async (body) => {
      server = response(body.records, 'r2');
      throw new DOMException('timeout', 'AbortError');
    };
    const { result } = renderHook(useLibrary);
    await waitFor(() => expect(result.current.canWrite).toBe(true));
    act(() => result.current.updateRecord('one', { title: 'Accepted' }));
    await waitFor(() => expect(result.current.storage.status).toBe('saved'));
    expect(puts).toHaveLength(1);
    expect(result.current.records[0].title).toBe('Accepted');
  });

  it('pauses conflicting writes and replaces only after an explicit recovery choice', async () => {
    let server = response([record()]);
    read = async () => server;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, options = {}) => {
        if (options.method !== 'PUT') return json(server);
        const body = JSON.parse(options.body);
        puts.push(body);
        if (puts.length === 1) {
          server = response([record('Other window')], 'r-other');
          return json(
            {
              error: 'conflict',
              code: 'REVISION_CONFLICT',
              currentRevision: 'r-other',
            },
            409
          );
        }
        server = response(body.records, 'r-final');
        return json(server);
      })
    );
    const { result } = renderHook(useLibrary);
    await waitFor(() => expect(result.current.canWrite).toBe(true));
    act(() => result.current.updateRecord('one', { title: 'My pending edit' }));
    await waitFor(() => expect(result.current.storage.status).toBe('conflict'));
    expect(result.current.canWrite).toBe(false);
    expect(result.current.recovery.baselineRecords[0].title).toBe(
      'Other window'
    );
    const candidate = result.current.recovery.candidates.find(
      (item) => item.records[0].title === 'My pending edit'
    );
    expect(candidate).toBeTruthy();
    await act(async () =>
      result.current.resolveRecovery('candidate', candidate.id)
    );
    expect(puts.at(-1).revision).toBe('r-other');
    expect(result.current.canWrite).toBe(true);
  });

  it('preserves a newer foreign writer version while recovering the displayed version', async () => {
    const original = createRecordPackage(
      'http://127.0.0.1:49189',
      [record('Displayed')],
      'r0',
      'pending',
      'foreign'
    );
    writeRecordPackage(original);
    const { result } = renderHook(useLibrary);
    await waitFor(() => expect(result.current.recovery).toBeTruthy());
    const newer = createRecordPackage(
      original.target,
      [record('Newer foreign edit')],
      'r0',
      'pending',
      'foreign'
    );
    writeRecordPackage(newer);
    await act(async () =>
      result.current.resolveRecovery('candidate', 'foreign')
    );
    expect(puts[0].records[0].title).toBe('Displayed');
    expect(
      JSON.parse(
        localStorage.getItem(
          cacheKey(original.target, 'foreign', newer.contentVersion)
        )
      ).records[0].title
    ).toBe('Newer foreign edit');
    expect(
      result.current.recovery.candidates.some(
        (item) => item.records[0].title === 'Newer foreign edit'
      )
    ).toBe(true);
  });

  it('retains memory and exposes failure when both stores fail, then retries after reading revision', async () => {
    const { result } = renderHook(useLibrary);
    await waitFor(() => expect(result.current.canWrite).toBe(true));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    write = async () => {
      throw new Error('offline');
    };
    act(() => result.current.updateRecord('one', { title: 'Only in memory' }));
    await waitFor(() => expect(result.current.storage.status).toBe('error'));
    expect(result.current.records[0].title).toBe('Only in memory');
    vi.restoreAllMocks();
    write = async (body) => response(body.records, 'recovered');
    await act(async () => result.current.retrySave());
    expect(result.current.storage.status).toBe('saved');
    expect(puts.at(-1).records[0].title).toBe('Only in memory');
  });

  it('completes browser recovery while keeping the chosen new writer copy recoverable', async () => {
    read = async () => {
      throw new Error('offline');
    };
    const initial = renderHook(useLibrary);
    await waitFor(() => expect(initial.result.current.canWrite).toBe(true));
    act(() =>
      initial.result.current.replaceRecords([record('Browser version')])
    );
    initial.unmount();
    const reopened = renderHook(useLibrary);
    await waitFor(() => expect(reopened.result.current.recovery).toBeTruthy());
    const id = reopened.result.current.recovery.candidates[0].id;
    await act(async () =>
      reopened.result.current.resolveRecovery('candidate', id)
    );
    expect(reopened.result.current.canWrite).toBe(true);
    expect(reopened.result.current.recovery).toBeNull();
    expect(
      Object.keys(localStorage).filter((key) => key.includes(':writer:'))
    ).toHaveLength(1);
  });

  it('reopens a failed SQL save as a recoverable package without issuing a PUT', async () => {
    const initial = renderHook(useLibrary);
    await waitFor(() => expect(initial.result.current.canWrite).toBe(true));
    write = async () => {
      throw new Error('offline');
    };
    act(() => initial.result.current.updateRecord('one', { title: 'Unsent' }));
    await waitFor(() =>
      expect(initial.result.current.storage.status).toBe('pending')
    );
    initial.unmount();
    puts = [];
    const reopened = renderHook(useLibrary);
    await waitFor(() => expect(reopened.result.current.recovery).toBeTruthy());
    expect(
      reopened.result.current.recovery.candidates[0].records[0].title
    ).toBe('Unsent');
    expect(puts).toHaveLength(0);
  });

  it('keeps a deliberately emptied confirmed library empty despite an old v1 key', async () => {
    localStorage.setItem(
      'acgn_journey:records:v1',
      JSON.stringify([record('Historical')])
    );
    const initial = renderHook(useLibrary);
    await waitFor(() => expect(initial.result.current.recovery).toBeTruthy());
    await act(async () => initial.result.current.resolveRecovery('baseline'));
    act(() => initial.result.current.replaceRecords([]));
    await waitFor(() =>
      expect(initial.result.current.storage.status).toBe('saved')
    );
    initial.unmount();
    read = async () => response([], 'empty');
    const reopened = renderHook(useLibrary);
    await waitFor(() => expect(reopened.result.current.canWrite).toBe(true));
    expect(reopened.result.current.records).toEqual([]);
    expect(reopened.result.current.recovery).toBeNull();
  });

  it('keeps recovery gated when adopting a browser baseline cannot be cached', async () => {
    read = async () => {
      throw new Error('offline');
    };
    const packet = createRecordPackage(
      'http://127.0.0.1:49189',
      [record('Pending')],
      null,
      'saved',
      'foreign'
    );
    writeRecordPackage(packet);
    const { result } = renderHook(useLibrary);
    await waitFor(() => expect(result.current.recovery).toBeTruthy());
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    await act(async () => result.current.resolveRecovery('baseline'));
    expect(result.current.storage.status).toBe('error');
    expect(result.current.canWrite).toBe(false);
    expect(
      localStorage.getItem(
        cacheKey(packet.target, 'foreign', packet.contentVersion)
      )
    ).toBeTruthy();
  });

  it('recovers a browser choice after quota failure through retrySave', async () => {
    read = async () => {
      throw new Error('offline');
    };
    writeRecordPackage(
      createRecordPackage(
        'http://127.0.0.1:49189',
        [record('Pending')],
        null,
        'saved',
        'foreign'
      )
    );
    const { result } = renderHook(useLibrary);
    await waitFor(() => expect(result.current.recovery).toBeTruthy());
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    await act(async () =>
      result.current.resolveRecovery('candidate', 'foreign')
    );
    expect(result.current.storage.status).toBe('error');
    expect(result.current.canWrite).toBe(false);
    vi.restoreAllMocks();
    await act(async () => result.current.retrySave());
    expect(result.current.canWrite).toBe(true);
    expect(result.current.records[0].title).toBe('Pending');
  });

  it('offers the newest memory version with a unique id when an older writer cache survives', async () => {
    const { result } = renderHook(useLibrary);
    await waitFor(() => expect(result.current.canWrite).toBe(true));
    write = async () => {
      throw new Error('offline');
    };
    act(() => result.current.updateRecord('one', { title: 'Older cached' }));
    await waitFor(() => expect(result.current.storage.status).toBe('pending'));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    read = async () => response([record('Other window')], 'r-other');
    act(() => result.current.updateRecord('one', { title: 'Newest memory' }));
    await waitFor(() => expect(result.current.recovery).toBeTruthy());
    const candidates = result.current.recovery.candidates;
    expect(candidates.map((item) => item.records[0].title)).toContain(
      'Newest memory'
    );
    expect(new Set(candidates.map((item) => item.id)).size).toBe(
      candidates.length
    );
  });
});
