// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import App from './App.jsx';

const { library } = vi.hoisted(() => ({
  library: {
    records: [],
    storage: {
      mode: 'browser',
      type: 'localStorage',
      status: 'saved',
      error: '',
    },
    canWrite: true,
    recovery: null,
    addWork: vi.fn(),
    updateRecord: vi.fn(),
    deleteRecord: vi.fn(),
    bulkUpdateRecords: vi.fn(),
    deleteRecords: vi.fn(),
    replaceRecords: vi.fn(),
    mergeRecords: vi.fn(),
    hasWork: () => false,
    resolveRecovery: vi.fn().mockResolvedValue(undefined),
    retrySave: vi.fn(),
  },
}));

vi.mock('./hooks/useLibrary.js', () => ({ useLibrary: () => library }));
vi.mock('./hooks/useBackground.js', () => ({
  useBackground: () => ({
    background: { image: '', opacity: 0.35, blur: 4 },
    ready: true,
    storage: { mode: 'browser' },
    setImage: vi.fn(),
    setOpacity: vi.fn(),
    setBlur: vi.fn(),
    clearImage: vi.fn(),
  }),
}));
vi.mock('./utils/localApi.js', () => ({
  loadLocalSetting: vi.fn().mockResolvedValue(null),
  saveLocalSetting: vi.fn().mockResolvedValue({}),
  deleteLocalSetting: vi.fn(),
  requestAiProfile: vi.fn(),
  requestAiModels: vi.fn(),
  testAiProfileConnection: vi.fn(),
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
beforeEach(() => {
  localStorage.clear();
  library.records = [];
  library.canWrite = true;
  library.recovery = null;
  vi.clearAllMocks();
});
afterEach(cleanup);

test('starts on the overview with six named navigation entries and no logo', async () => {
  const view = render(<App />);
  expect(
    await screen.findByRole('heading', { name: '作品总览', level: 1 })
  ).toBeTruthy();
  const navigation = screen.getByRole('navigation', { name: '主导航' });
  const labels = [...navigation.querySelectorAll('button')].map((button) =>
    button.textContent.trim()
  );
  expect(labels).toEqual([
    '总览',
    '作品库',
    '发现',
    '历程',
    '实体收藏',
    'AI画像',
  ]);
  expect(view.container.querySelector('.brand')).toBeNull();
  expect(document.documentElement.dataset.theme).toBe('light');
});

test('opens data settings as a named native dialog', async () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '数据与设置' }));
  expect((await screen.findByRole('dialog', { name: '数据与设置' })).open).toBe(
    true
  );
});

test('offers the baseline and each recoverable browser copy explicitly', async () => {
  library.canWrite = false;
  library.recovery = {
    baselineRecords: [],
    baselineLabel: '本机库',
    candidates: [
      {
        id: 'copy-1',
        records: [{ id: 'one', title: '待恢复作品' }],
        updatedAt: '2026-11-05T00:00:00Z',
      },
    ],
  };
  render(<App />);
  expect(
    await screen.findByRole('heading', { name: '选择要恢复的作品库' })
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '使用本机库' }));
  await waitFor(() =>
    expect(library.resolveRecovery).toHaveBeenCalledWith('baseline', undefined)
  );
});

test('JSON recovery confirmation always follows the latest selected backup', async () => {
  let resolveOld;
  let resolveLatest;
  const older = {
    name: 'older.json',
    text: () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  };
  const latest = {
    name: 'latest.json',
    text: () =>
      new Promise((resolve) => {
        resolveLatest = resolve;
      }),
  };
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '数据与设置' }));
  const dialog = await screen.findByRole('dialog', { name: '数据与设置' });
  const input = dialog.querySelector('input[accept=".json,application/json"]');
  fireEvent.change(input, { target: { files: [older] } });
  fireEvent.change(input, { target: { files: [latest] } });
  await act(async () =>
    resolveLatest(
      JSON.stringify({ records: [{ id: 'latest', title: '最新备份' }] })
    )
  );
  await screen.findByText(/latest.json/);
  await act(async () =>
    resolveOld(JSON.stringify({ records: [{ id: 'old', title: '过期备份' }] }))
  );
  expect(screen.queryByText(/older.json/)).toBeNull();
  expect(screen.getByText(/latest.json/)).toBeTruthy();
  fireEvent.change(input, {
    target: {
      files: [{ name: 'broken.json', text: async () => 'invalid json' }],
    },
  });
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: '覆盖当前作品库？' })
    ).toBeNull()
  );
});
