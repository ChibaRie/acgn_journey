// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import Dashboard from './Dashboard.jsx';
import LibraryPanel from './LibraryPanel.jsx';
import StatsPanel from './StatsPanel.jsx';
import { normalizeRecord } from '../utils/library.js';
import { getStats } from '../utils/stats.js';

const record = (id, patch = {}) =>
  normalizeRecord({
    id,
    title: id,
    type: '动画',
    status: 'done',
    finishedAt: '2026-10-04',
    addedAt: '2026-01-01T00:00:00Z',
    ...patch,
  });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-05T12:00:00'));
  localStorage.clear();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('dashboard normal entry points', () => {
  it('opens library with medium, year, exact tag and completion filters', () => {
    const onOpenLibrary = vi.fn();
    render(
      <Dashboard
        records={[
          record('动画', { tags: ['日常'] }),
          record('漫画', { type: '漫画' }),
        ]}
        onOpenLibrary={onOpenLibrary}
      />
    );
    expect(screen.getByLabelText('记录年份').value).toBe('all');
    fireEvent.change(screen.getByLabelText('记录年份'), {
      target: { value: '2026' },
    });
    fireEvent.click(screen.getByRole('button', { name: '日常 1 部' }));
    expect(onOpenLibrary).toHaveBeenLastCalledWith({
      category: 'all',
      year: '2026',
      tag: '日常',
    });
    fireEvent.click(screen.getByRole('button', { name: '10月完成 2 部' }));
    expect(onOpenLibrary).toHaveBeenLastCalledWith(
      expect.objectContaining({
        year: '2026',
        completionYear: '2026',
        completionMonth: '10',
      })
    );
    fireEvent.click(screen.getByRole('button', { name: '漫画 1 部' }));
    expect(onOpenLibrary).toHaveBeenLastCalledWith({
      category: 'comic',
      year: '2026',
    });
  });

  it('supports empty-library discovery and import actions', () => {
    const onOpenDiscover = vi.fn();
    const onOpenImport = vi.fn();
    render(
      <Dashboard
        records={[]}
        onOpenDiscover={onOpenDiscover}
        onOpenImport={onOpenImport}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '发现作品' }));
    fireEvent.click(screen.getByRole('button', { name: '导入备份' }));
    expect(onOpenDiscover).toHaveBeenCalledOnce();
    expect(onOpenImport).toHaveBeenCalledOnce();
  });

  it('shows complete counts, cover fallback and opens current records', () => {
    const onEditRecord = vi.fn();
    render(
      <Dashboard
        records={[
          record('在看作品', {
            status: 'active',
            cover: 'https://example.test/cover.jpg',
          }),
        ]}
        onEditRecord={onEditRecord}
      />
    );
    fireEvent.error(screen.getByAltText('在看作品 封面'));
    fireEvent.click(screen.getByRole('button', { name: '打开 在看作品' }));
    expect(onEditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ id: '在看作品' })
    );
    expect(screen.queryByAltText('在看作品 封面')).toBeNull();
    expect(screen.getByRole('heading', { name: '进行中的作品' })).toBeTruthy();
  });

  it('draws wishes, avoids repeat and leaves statuses unchanged', () => {
    const records = [
      record('候选甲', { status: 'wish' }),
      record('候选乙', { status: 'wish' }),
    ];
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<Dashboard records={records} />);
    const drawPanel = screen.getByRole('region', { name: '待补作品抽签' });
    expect(within(drawPanel).getByText('2 部候选')).toBeTruthy();
    fireEvent.click(within(drawPanel).getByRole('button', { name: '抽一部' }));
    expect(
      within(drawPanel).getByRole('button', { name: '打开 候选甲' })
    ).toBeTruthy();
    fireEvent.click(
      within(drawPanel).getByRole('button', { name: '再选一部' })
    );
    expect(
      within(drawPanel).getByRole('button', { name: '打开 候选乙' })
    ).toBeTruthy();
    expect(records.map(({ status }) => status)).toEqual(['wish', 'wish']);
  });

  it('opens annual review and excludes future and missing completions', () => {
    render(
      <Dashboard
        records={[
          record('好作品', { rating: 9 }),
          record('未来', { finishedAt: '2026-12-01' }),
          record('无日期', { finishedAt: '' }),
        ]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '年度回顾' }));
    const review = screen.getByRole('dialog', { name: '年度回顾' });
    expect(within(review).getByText('1 部有效完成')).toBeTruthy();
    expect(
      within(review).getByRole('button', { name: '打开 好作品' })
    ).toBeTruthy();
    expect(within(review).queryByText('未来')).toBeNull();
    fireEvent.click(
      within(review).getByRole('button', { name: '关闭年度回顾' })
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('provides one calendar tab stop, arrow navigation and an accessible date input', () => {
    const onOpenLibrary = vi.fn();
    render(
      <Dashboard records={[record('作品')]} onOpenLibrary={onOpenLibrary} />
    );
    const calendar = screen.getByRole('group', {
      name: '26 周完成日历，方向键选择日期',
    });
    expect(
      within(calendar)
        .getAllByRole('button')
        .filter((button) => button.tabIndex === 0)
    ).toHaveLength(1);
    const lastDay = screen.getByRole('button', {
      name: '2026-11-05 完成 0 部',
    });
    fireEvent.keyDown(lastDay, { key: 'ArrowUp' });
    expect(document.activeElement.getAttribute('aria-label')).toBe(
      '2026-11-04 完成 0 部'
    );
    fireEvent.change(screen.getByLabelText('完成日期'), {
      target: { value: '2026-10-04' },
    });
    fireEvent.click(screen.getByRole('button', { name: '查看 1 部' }));
    expect(onOpenLibrary).toHaveBeenLastCalledWith({
      category: 'all',
      year: 'all',
      completionDate: '2026-10-04',
    });
  });

  it('reflects full-screen entry and exit in the control state', async () => {
    let fullscreenElement = null;
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });
    Element.prototype.requestFullscreen = function () {
      fullscreenElement = this;
      document.dispatchEvent(new Event('fullscreenchange'));
      return Promise.resolve();
    };
    document.exitFullscreen = () => {
      fullscreenElement = null;
      document.dispatchEvent(new Event('fullscreenchange'));
      return Promise.resolve();
    };
    render(<Dashboard records={[]} motionEnabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: '全屏展示' }));
    expect(screen.getByRole('button', { name: '退出全屏' })).toBeTruthy();
    expect(fullscreenElement.dataset.motion).toBe('off');
    fireEvent.click(screen.getByRole('button', { name: '退出全屏' }));
    expect(screen.getByRole('button', { name: '全屏展示' })).toBeTruthy();
    delete Element.prototype.requestFullscreen;
    delete document.exitFullscreen;
    delete document.fullscreenElement;
  });
});

describe('linked library and detailed statistics', () => {
  it('renders a bounded page of a large library while bulk selection covers the full filter', () => {
    const onBulkUpdateRecords = vi.fn();
    const records = Array.from({ length: 53 }, (_, index) =>
      record(`分页作品${index}`)
    );
    render(
      <LibraryPanel
        records={records}
        onBulkUpdateRecords={onBulkUpdateRecords}
      />
    );
    expect(screen.getAllByRole('heading', { name: /^分页作品/ })).toHaveLength(
      48
    );
    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    expect(screen.getByRole('heading', { name: '分页作品52' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '批量管理' }));
    fireEvent.click(screen.getByRole('button', { name: '选择当前筛选' }));
    fireEvent.change(screen.getByRole('combobox', { name: '批量修改状态' }), {
      target: { value: 'active' },
    });
    fireEvent.click(screen.getByRole('button', { name: '应用' }));
    expect(onBulkUpdateRecords.mock.calls[0][0]).toHaveLength(53);
    fireEvent.change(screen.getByLabelText('筛选关键词'), {
      target: { value: '分页作品0' },
    });
    expect(screen.getAllByRole('heading', { name: /^分页作品/ })).toHaveLength(
      1
    );
    expect(screen.getByRole('heading', { name: '分页作品0' })).toBeTruthy();
  });

  it('combines external filters with local controls and clears linked filters individually', () => {
    const records = [
      record('匹配', { tags: ['日常'] }),
      record('其他', { tags: ['科幻'] }),
    ];
    render(
      <LibraryPanel
        records={records}
        externalFilters={{ tag: '日常', completionYear: '2026' }}
      />
    );
    expect(screen.getByRole('heading', { name: '匹配' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '其他' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '清除标签 日常' }));
    expect(screen.getByRole('heading', { name: '其他' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('筛选关键词'), {
      target: { value: '匹配' },
    });
    expect(screen.queryByRole('heading', { name: '其他' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '清除全部筛选' }));
    expect(screen.getByRole('heading', { name: '其他' })).toBeTruthy();
  });

  it('disables editing, deletion and bulk writes in readOnly mode', () => {
    const onEditRecord = vi.fn();
    render(
      <LibraryPanel
        records={[record('只读')]}
        readOnly
        onEditRecord={onEditRecord}
      />
    );
    expect(screen.getByRole('button', { name: '编辑 只读' }).disabled).toBe(
      true
    );
    expect(screen.getByRole('button', { name: '删除 只读' }).disabled).toBe(
      true
    );
    expect(screen.getByRole('button', { name: '批量管理' }).disabled).toBe(
      true
    );
    fireEvent.click(screen.getByRole('button', { name: '编辑 只读' }));
    expect(onEditRecord).not.toHaveBeenCalled();
  });

  it('replaces previous linked completion filters when opening a new link', () => {
    const records = [
      record('十月', { tags: ['日常'] }),
      record('九月', { tags: ['日常'], finishedAt: '2026-09-01' }),
    ];
    const { rerender } = render(
      <LibraryPanel
        records={records}
        externalFilters={{ completionDate: '2026-10-04' }}
      />
    );
    expect(screen.queryByRole('heading', { name: '九月' })).toBeNull();
    rerender(
      <LibraryPanel records={records} externalFilters={{ tag: '日常' }} />
    );
    expect(screen.getByRole('heading', { name: '九月' })).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: '清除完成日期 2026-10-04' })
    ).toBeNull();
  });

  it('preserves all distributions and counts nine linked works before the eight-work preview', () => {
    const records = Array.from({ length: 61 }, (_, index) =>
      record(`作品${index}`, {
        tags: [`标签${index}`, ...(index < 9 ? ['共享'] : [])],
        rating: index < 9 ? 8 : 0,
      })
    );
    render(<StatsPanel records={records} stats={getStats(records)} />);
    fireEvent.click(screen.getByRole('button', { name: '共享 9' }));
    expect(screen.getByText('关联 9 部作品', { exact: false })).toBeTruthy();
    expect(screen.getByText('62 个标签')).toBeTruthy();
    expect(screen.getByText('9 部评分样本')).toBeTruthy();
    for (const name of [
      '类型分布',
      '作品年份分布',
      '记录年份分布',
      '状态分布',
      '评分分布',
    ]) {
      expect(screen.getByRole('region', { name })).toBeTruthy();
    }
  });
});
