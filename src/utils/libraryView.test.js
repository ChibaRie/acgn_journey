import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LIBRARY_VIEW,
  LIBRARY_VIEW_KEY,
  loadLibraryView,
  normalizeLibraryView,
  saveLibraryView,
} from './libraryView.js';

describe('library view preference', () => {
  it('defaults invalid or missing values to list view', () => {
    expect(normalizeLibraryView()).toBe(DEFAULT_LIBRARY_VIEW);
    expect(normalizeLibraryView('cards')).toBe(DEFAULT_LIBRARY_VIEW);
    expect(loadLibraryView({ getItem: () => null })).toBe('list');
  });

  it('restores supported list and grid preferences', () => {
    expect(loadLibraryView({ getItem: () => 'list' })).toBe('list');
    expect(loadLibraryView({ getItem: () => 'grid' })).toBe('grid');
  });

  it('persists a normalized preference', () => {
    const setItem = vi.fn();
    expect(saveLibraryView('grid', { setItem })).toBe('grid');
    expect(setItem).toHaveBeenCalledWith(LIBRARY_VIEW_KEY, 'grid');

    expect(saveLibraryView('unknown', { setItem })).toBe('list');
    expect(setItem).toHaveBeenLastCalledWith(LIBRARY_VIEW_KEY, 'list');
  });

  it('falls back safely when storage access fails', () => {
    expect(
      loadLibraryView({
        getItem() {
          throw new Error('blocked');
        },
      }),
    ).toBe('list');

    expect(
      saveLibraryView('grid', {
        setItem() {
          throw new Error('blocked');
        },
      }),
    ).toBe('grid');
  });
});
