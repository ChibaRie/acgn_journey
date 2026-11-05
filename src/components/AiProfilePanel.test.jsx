// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import AiProfilePanel from './AiProfilePanel.jsx';
import { normalizeRecord } from '../utils/library.js';
import { loadLocalSetting } from '../utils/localApi.js';

vi.mock('../utils/localApi.js', () => ({
  loadLocalSetting: vi.fn(),
  saveLocalSetting: vi.fn(),
  deleteLocalSetting: vi.fn(),
  requestAiProfile: vi.fn(),
  requestAiModels: vi.fn(),
  testAiProfileConnection: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

test('blocks saving and clearing settings until existing configuration finishes loading', async () => {
  let resolve;
  vi.mocked(loadLocalSetting).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    })
  );
  render(
    <AiProfilePanel
      records={[normalizeRecord({ id: 'one', title: '作品' })]}
      storage={{ mode: 'local' }}
    />
  );
  expect(screen.getByRole('button', { name: '保存配置' }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: '清除配置' }).disabled).toBe(true);
  await act(async () =>
    resolve({
      value: {
        baseUrl: 'https://example.test/v1',
        apiKey: 'test-key',
        model: 'test-model',
      },
    })
  );
  expect(screen.getByRole('button', { name: '保存配置' }).disabled).toBe(false);
  expect(screen.getByRole('textbox', { name: '接口地址' }).value).toBe(
    'https://example.test/v1'
  );
});
