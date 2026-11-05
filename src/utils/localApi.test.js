// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { saveLocalRecords } from './localApi.js';

afterEach(() => vi.unstubAllGlobals());

it('carries revision preconditions and exposes conflict metadata to recovery callers', async () => {
  window.__ACGN_LOCAL_API__ = { baseUrl: 'http://127.0.0.1:49189' };
  let body;
  vi.stubGlobal('fetch', async (_url, options) => {
    body = JSON.parse(options.body);
    return {
      ok: false, status: 409,
      text: async () => JSON.stringify({ error: 'Revision conflict', code: 'REVISION_CONFLICT', currentRevision: 'r2' }),
    };
  });
  await expect(saveLocalRecords([], 'r1')).rejects.toMatchObject({
    status: 409, code: 'REVISION_CONFLICT', currentRevision: 'r2',
  });
  expect(body).toEqual({ records: [], revision: 'r1' });
});
