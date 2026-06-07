export const LIBRARY_VIEW_KEY = 'acgn_journey:library-view:v1';
export const DEFAULT_LIBRARY_VIEW = 'list';

export function normalizeLibraryView(value) {
  return value === 'grid' || value === 'list' ? value : DEFAULT_LIBRARY_VIEW;
}

export function loadLibraryView(storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    return normalizeLibraryView(target?.getItem(LIBRARY_VIEW_KEY));
  } catch {
    return DEFAULT_LIBRARY_VIEW;
  }
}

export function saveLibraryView(value, storage) {
  const normalized = normalizeLibraryView(value);
  try {
    const target = storage ?? globalThis.localStorage;
    target?.setItem(LIBRARY_VIEW_KEY, normalized);
  } catch {
    // Keep the in-memory preference when browser storage is unavailable.
  }
  return normalized;
}
