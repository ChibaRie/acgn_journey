import { describe, expect, it } from 'vitest';
import { searchSource } from './searchService.js';

describe('searchSource', () => {
  it('returns no results for empty keyword without fetching', async () => {
    const response = await searchSource('age', '', {
      fetchImpl: () => {
        throw new Error('should not fetch');
      },
    });

    expect(response).toEqual({ items: [], error: null });
  });

  it('rejects unknown source ids', async () => {
    await expect(searchSource('evil', 'test')).rejects.toThrow('未知搜索源');
  });

  it('dispatches to the selected adapter only', async () => {
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(url);
      return {
        ok: true,
        json: async () => ({ data: [] }),
      };
    };

    const response = await searchSource('bangumi', '芙莉莲', { fetchImpl });
    expect(response).toEqual({ items: [], error: null });
    expect(calls).toEqual(['https://api.bgm.tv/v0/search/subjects?limit=12&offset=0']);
  });
});
