import { describe, expect, it, vi } from 'vitest';
import {
  isAdultMangabakaItem,
  normalizeMangabakaItem,
  searchMangabaka,
} from './mangabaka.js';

const series = {
  id: 84589,
  title: 'Mushoku Tensei: Jobless Reincarnation',
  native_title: '無職転生 ～異世界行ったら本気だす～',
  titles: [
    {
      language: 'en',
      traits: ['official'],
      title: 'Mushoku Tensei: Jobless Reincarnation',
      is_primary: true,
    },
    {
      language: 'ja',
      traits: ['native'],
      title: '無職転生 ～異世界行ったら本気だす～',
      is_primary: true,
    },
    { language: 'zh', traits: [], title: '无职转生', is_primary: true },
  ],
  cover: {
    x350: { x1: 'https://cdn.mangabaka.dev/cover.jpg' },
    raw: { url: 'https://images.mangabaka.dev/raw.jpg' },
  },
  description: '<p>一部异世界轻小说。</p>',
  authors: ['Rifujin na Magonote'],
  year: 2014,
  published: { start_date: '2014-01-23' },
  status: 'completed',
  rating: 87.36,
  genres: ['fantasy', 'adventure'],
  tags: ['Isekai', 'Light Novel'],
  content_rating: 'safe',
  links: ['https://mangabaka.org/84589'],
};

function response(data, overrides = {}) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ data }),
    ...overrides,
  };
}

describe('MangaBaka adapter', () => {
  it('normalizes titles and novel metadata', () => {
    const work = normalizeMangabakaItem(series);

    expect(work).toMatchObject({
      source: 'mangabaka',
      sourceLabel: 'MangaBaka',
      sourceId: '84589',
      sourceUrl: 'https://mangabaka.org/84589',
      title: '无职转生',
      originalTitle: '無職転生 ～異世界行ったら本気だす～',
      cover: 'https://cdn.mangabaka.dev/cover.jpg',
      type: '轻小说',
      summary: '一部异世界轻小说。',
      authors: ['Rifujin na Magonote'],
      releaseDate: '2014-01-23',
      releaseYear: '2014',
      status: 'completed',
      statusLabel: '已完结',
      rating: 8.7,
    });
    expect(work.meta).toEqual([
      '作者 Rifujin na Magonote',
      '2014',
      '已完结',
      '评分 8.7/10',
    ]);
    expect(work.tags).toEqual(['fantasy', 'adventure', 'Isekai', 'Light Novel']);
  });

  it('uses Japanese before English and tolerates missing fields', () => {
    const japanese = normalizeMangabakaItem({
      id: 2,
      title: 'English title',
      native_title: '日本語原題',
    });
    const english = normalizeMangabakaItem({ id: 3, title: 'English title' });
    const missing = normalizeMangabakaItem({
      rating: null,
      published: { start_date: '2020-05-01' },
      genres: null,
      tags: null,
      links: null,
    });

    expect(japanese.title).toBe('日本語原題');
    expect(japanese.originalTitle).toBe('日本語原題');
    expect(english.title).toBe('English title');
    expect(missing).toMatchObject({
      title: '未命名条目',
      originalTitle: '',
      cover: '',
      summary: '',
      authors: [],
      releaseDate: '2020-05-01',
      releaseYear: '2020',
      status: '',
      rating: null,
      tags: [],
    });
  });

  it('does not treat a traditional Chinese title as simplified Chinese', () => {
    const work = normalizeMangabakaItem({
      id: 4,
      title: 'Spice & Wolf',
      native_title: '狼と香辛料',
      titles: [
        { language: 'zh', title: '狼與辛香料', is_primary: true },
        { language: 'ja', traits: ['native'], title: '狼と香辛料', is_primary: true },
      ],
    });

    expect(work.title).toBe('狼と香辛料');
    expect(work.originalTitle).toBe('狼と香辛料');
  });

  it('filters clearly adult content without treating ecchi as adult', () => {
    expect(isAdultMangabakaItem({ content_rating: 'pornographic' })).toBe(true);
    expect(isAdultMangabakaItem({ content_rating: 'erotica' })).toBe(true);
    expect(isAdultMangabakaItem({ content_rating: 'safe', genres: ['hentai'] })).toBe(true);
    expect(isAdultMangabakaItem({ content_rating: 'safe', genres: ['ecchi'] })).toBe(false);
  });

  it('requests at most ten novels and passes AbortSignal through', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async () =>
      response([
        { id: 'adult', content_rating: 'pornographic' },
        ...Array.from({ length: 11 }, (_, index) => ({
          id: index + 1,
          title: `Novel ${index + 1}`,
          content_rating: 'safe',
        })),
      ]),
    );

    const works = await searchMangabaka('药屋少女的呢喃', {
      signal: controller.signal,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.mangabaka.org/v1/series/search?q=%E8%8D%AF%E5%B1%8B%E5%B0%91%E5%A5%B3%E7%9A%84%E5%91%A2%E5%96%83&type=novel&limit=10',
      { signal: controller.signal },
    );
    expect(works).toHaveLength(10);
    expect(works.every((work) => work.sourceId !== 'adult')).toBe(true);
  });

  it('returns an empty array for empty or missing API data', async () => {
    await expect(
      searchMangabaka('none', { fetchImpl: async () => response([]) }),
    ).resolves.toEqual([]);
    await expect(
      searchMangabaka('none', {
        fetchImpl: async () => response(undefined, { json: async () => ({}) }),
      }),
    ).resolves.toEqual([]);
  });

  it('throws HTTP errors', async () => {
    await expect(
      searchMangabaka('error', {
        fetchImpl: async () =>
          response([], { ok: false, status: 503, statusText: 'Service Unavailable' }),
      }),
    ).rejects.toThrow('503 Service Unavailable');
  });

  it('throws a clear rate-limit error without retrying 429 responses', async () => {
    const fetchImpl = vi.fn(async () =>
      response([], { ok: false, status: 429, statusText: 'Too Many Requests' }),
    );

    await expect(searchMangabaka('busy', { fetchImpl })).rejects.toThrow(
      /限流.*429/,
    );
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
