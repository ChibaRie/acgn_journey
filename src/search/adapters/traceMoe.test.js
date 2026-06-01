import { describe, expect, it } from 'vitest';
import {
  buildTraceMoeSearchUrl,
  formatSeconds,
  formatSimilarity,
  normalizeTraceMoeResult,
  searchTraceMoe,
} from './traceMoe.js';

const result = {
  anilist: {
    id: 21034,
    title: {
      native: 'ご注文はうさぎですか？？',
      romaji: 'Gochuumon wa Usagi desu ka??',
      chinese: '请问您今天要来点兔子吗？？',
    },
    siteUrl: 'https://anilist.co/anime/21034',
    genres: ['Slice of Life'],
    startDate: { year: 2015, month: 10, day: 10 },
    seasonYear: 2015,
    studios: {
      edges: [
        { isMain: true, node: { name: 'WHITE FOX' } },
        { isMain: true, node: { name: 'Kinema Citrus' } },
      ],
    },
    coverImage: { large: 'https://img.example/cover.jpg' },
  },
  filename: 'Gochiusa S2 01.mkv',
  episode: 1,
  at: 98.2231,
  similarity: 0.944,
  image: 'https://api.trace.moe/image/token',
  video: 'https://api.trace.moe/video/token',
};

describe('trace.moe adapter', () => {
  it('builds URL search requests with anilist info and border crop', () => {
    const url = buildTraceMoeSearchUrl({
      imageUrl: 'https://example.com/a b.jpg',
      cutBorders: true,
    });

    expect(url).toContain('https://api.trace.moe/search?');
    expect(url).toContain('anilistInfo');
    expect(url).toContain('cutBorders');
    expect(url).toContain('url=https%3A%2F%2Fexample.com%2Fa+b.jpg');
  });

  it('formats scene time and similarity', () => {
    expect(formatSeconds(98.2231)).toBe('1:38');
    expect(formatSimilarity(0.944)).toBe('94.4%');
  });

  it('normalizes trace results into SearchWork', () => {
    const work = normalizeTraceMoeResult(result);

    expect(work.source).toBe('trace-moe');
    expect(work.sourceLabel).toBe('trace.moe');
    expect(work.title).toBe('请问您今天要来点兔子吗？？');
    expect(work.originalTitle).toBe('ご注文はうさぎですか？？');
    expect(work.cover).toBe('https://img.example/cover.jpg');
    expect(work.releaseYear).toBe('2015');
    expect(work.tags).toContain('WHITE FOX');
    expect(work.meta).toContain('相似度 94.4%');
  });

  it('searches by public image URL', async () => {
    const calls = [];
    const response = await searchTraceMoe(
      { imageUrl: 'https://example.com/shot.jpg' },
      {
        fetchImpl: async (url, init) => {
          calls.push({ url, init });
          return {
            ok: true,
            json: async () => ({ frameCount: 10, error: '', result: [result] }),
          };
        },
      },
    );

    expect(calls[0].url).toContain('url=https%3A%2F%2Fexample.com%2Fshot.jpg');
    expect(calls[0].init.method).toBeUndefined();
    expect(response.items).toHaveLength(1);
  });
});
