// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useBackground } from './useBackground.js';

beforeEach(() => { localStorage.clear(); window.__ACGN_LOCAL_API__ = { baseUrl: 'http://127.0.0.1:49189' }; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('gates background changes until initialization and saves SQLite despite cache quota', async () => {
  let complete;
  const gate = new Promise((resolve) => { complete = resolve; });
  const saved = [];
  vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
    if (options.method === 'PUT') {
      saved.push(JSON.parse(options.body).value);
      return { ok: true, text: async () => JSON.stringify({ value: saved.at(-1) }) };
    }
    await gate;
    return { ok: true, text: async () => JSON.stringify({ value: { image: '', opacity: 0.3, blur: 4 } }) };
  }));
  const { result } = renderHook(useBackground);
  expect(result.current.ready).toBe(false);
  expect(() => result.current.setOpacity(0.5)).toThrow();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  await act(async () => complete());
  await waitFor(() => expect(result.current.ready).toBe(true));
  act(() => result.current.setOpacity(0.8));
  await waitFor(() => expect(saved.at(-1)?.opacity).toBe(0.8));
  expect(result.current.storage.cacheError).toBeTruthy();
  expect(result.current.storage.mode).toBe('local');
});

it('migrates an existing browser background when the local setting has no value', async () => {
  localStorage.setItem('acgn_journey:background:v1', JSON.stringify({ image: '', opacity: 0.65, blur: 7 }));
  const saved = [];
  vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
    if (options.method === 'PUT') saved.push(JSON.parse(options.body).value);
    return { ok: true, text: async () => JSON.stringify({ value: null }) };
  }));
  const { result } = renderHook(useBackground);
  await waitFor(() => expect(result.current.ready).toBe(true));
  await waitFor(() => expect(saved).toEqual([{ image: '', opacity: 0.65, blur: 7 }]));
});
