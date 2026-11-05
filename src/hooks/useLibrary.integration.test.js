// @vitest-environment jsdom
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { useLibrary } from './useLibrary.js';
import { loadLocalRecords } from '../utils/localApi.js';

let child;
let dataDir;

afterEach(async () => {
  cleanup();
  if (child?.exitCode === null && child?.signalCode === null) {
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  }
  if (dataDir && path.dirname(dataDir) === path.resolve(os.tmpdir()) && path.basename(dataDir).startsWith('acgn-hook-test-')) {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  localStorage.clear();
  delete window.__ACGN_LOCAL_API__;
});

it('uses real temporary SQLite revisions to recover concurrent hook writers', async () => {
  const probe = http.createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acgn-hook-test-'));
  const root = path.resolve(import.meta.dirname, '../..');
  child = spawn(process.execPath, [path.join(root, 'server/local-data-server.mjs')], {
    cwd: root,
    env: {
      ...process.env, ACGN_DATA_DIR: dataDir, ACGN_DB_PATH: path.join(dataDir, 'hook.sqlite'),
      ACGN_LOCAL_API_TOKEN: '', DATA_HOST: '127.0.0.1', DATA_PORT: String(port),
    },
    stdio: 'ignore',
  });
  window.__ACGN_LOCAL_API__ = { baseUrl: `http://127.0.0.1:${port}` };
  await waitFor(async () => expect((await loadLocalRecords()).revision).toEqual(expect.any(String)), { timeout: 5000 });
  const one = renderHook(useLibrary);
  const two = renderHook(useLibrary);
  await waitFor(() => expect(one.result.current.canWrite && two.result.current.canWrite).toBe(true));
  act(() => {
    one.result.current.addWork({ source: 'synthetic', sourceId: 'one', title: 'Writer one' });
    two.result.current.addWork({ source: 'synthetic', sourceId: 'two', title: 'Writer two' });
  });
  await waitFor(() => {
    expect([one.result.current.storage.status, two.result.current.storage.status].sort()).toEqual(['conflict', 'saved']);
  });
  const conflicted = one.result.current.recovery ? one : two;
  const candidate = conflicted.result.current.recovery.candidates[0];
  await act(async () => conflicted.result.current.resolveRecovery('candidate', candidate.id));
  expect(conflicted.result.current.canWrite).toBe(true);
  expect(conflicted.result.current.storage.status).toBe('saved');
  const persisted = await loadLocalRecords();
  expect(persisted.records[0].title).toBe(candidate.records[0].title);
  expect(Object.keys(localStorage).filter((key) => key.includes(':writer:'))).toHaveLength(0);
}, 10000);
