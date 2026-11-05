// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import SearchPanel from './SearchPanel.jsx';
import TraceMoePanel from './TraceMoePanel.jsx';
import BulkImportPanel from './BulkImportPanel.jsx';
import WorkCard from './WorkCard.jsx';
import { searchSource, searchTraceMoe } from '../api/search.js';
import { parseImportFile } from '../utils/importers.js';

vi.mock('../api/search.js', () => {
  const sources = [
    { id: 'age', label: 'AGE动漫', accessLabel: '直连' },
    { id: 'bangumi', label: 'Bangumi', accessLabel: '需代理' },
  ];
  return {
    DEFAULT_SOURCE_ID: 'age',
    SOURCES: sources,
    getSourceById: (id) => sources.find((source) => source.id === id),
    searchSource: vi.fn(),
    searchTraceMoe: vi.fn(),
  };
});

vi.mock('../utils/importers.js', () => ({
  IMPORT_PROVIDERS: [{ value: 'auto', label: '自动识别' }],
  parseImportFile: vi.fn(),
}));

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function work(title) {
  return {
    id: title,
    title,
    type: '动画',
    status: 'done',
    tags: [],
    animeTags: [],
    rating: 0,
  };
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

test('ignores a source response that arrives after choosing another source', async () => {
  const request = deferred();
  vi.mocked(searchSource).mockReturnValue(request.promise);
  render(<SearchPanel hasWork={() => false} onAddWork={() => {}} />);
  fireEvent.change(screen.getByRole('textbox', { name: '搜索关键词' }), {
    target: { value: 'old' },
  });
  fireEvent.click(screen.getByRole('button', { name: '搜索', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: /Bangumi/ }));
  await act(async () => {
    request.resolve({ items: [work('旧来源作品')] });
  });
  expect(screen.queryByRole('heading', { name: '旧来源作品' })).toBeNull();
});

test('ignores screenshot results after selecting a different file', async () => {
  const request = deferred();
  vi.mocked(searchTraceMoe).mockReturnValue(request.promise);
  const view = render(
    <TraceMoePanel hasWork={() => false} onAddWork={() => {}} />
  );
  const input = view.container.querySelector('input[type=file]');
  fireEvent.change(input, {
    target: { files: [new File(['a'], 'a.png', { type: 'image/png' })] },
  });
  fireEvent.click(screen.getByRole('button', { name: '开始识别' }));
  fireEvent.change(input, {
    target: { files: [new File(['b'], 'b.png', { type: 'image/png' })] },
  });
  await act(async () => {
    request.resolve({ items: [work('旧截图作品')], frameCount: 1 });
  });
  expect(screen.queryByRole('heading', { name: '旧截图作品' })).toBeNull();
  expect(screen.getByRole('button', { name: '开始识别' }).disabled).toBe(false);
});

test('keeps the most recently selected import preview when parsing finishes out of order', async () => {
  const slow = deferred();
  const fast = deferred();
  vi.mocked(parseImportFile).mockImplementation((file) =>
    file.name === 'slow.json' ? slow.promise : fast.promise
  );
  const view = render(
    <BulkImportPanel onMergeRecords={() => {}} onReplaceRecords={() => {}} />
  );
  const input = view.container.querySelector('input[type=file]');
  fireEvent.change(input, {
    target: { files: [new File(['a'], 'slow.json')] },
  });
  fireEvent.change(input, {
    target: { files: [new File(['b'], 'fast.json')] },
  });
  await act(async () => {
    fast.resolve({ records: [work('新选择作品')], providerLabel: 'JSON' });
  });
  await act(async () => {
    slow.resolve({ records: [work('旧选择作品')], providerLabel: 'JSON' });
  });
  expect(screen.getByRole('heading', { name: '新选择作品' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: '旧选择作品' })).toBeNull();
});

test('disables adding a search result while library writes are unavailable', () => {
  render(
    <WorkCard
      work={work('只读作品')}
      isSaved={false}
      readOnly
      onAddWork={() => {}}
    />
  );
  expect(screen.getByRole('button', { name: '加入我的库' }).disabled).toBe(
    true
  );
});

test('shows a local cover placeholder after an image error', () => {
  render(
    <WorkCard
      work={{ ...work('封面作品'), cover: 'https://example.com/missing.jpg' }}
      onAddWork={() => {}}
    />
  );
  fireEvent.error(screen.getByRole('img', { name: '封面作品 封面' }));
  expect(screen.getByLabelText('无封面')).toBeTruthy();
});
