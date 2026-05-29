import { describe, it, expect } from 'vitest';
import { stripBBCode } from './search.js';

describe('stripBBCode', () => {
  it('removes url bbcode but keeps the link text', () => {
    expect(stripBBCode('see [url=/v17]Ever17[/url] now')).toBe('see Ever17 now');
  });

  it('removes spoiler and formatting tags', () => {
    expect(stripBBCode('[spoiler]secret[/spoiler] [b]bold[/b]')).toBe('secret bold');
  });

  it('handles empty and plain input', () => {
    expect(stripBBCode('')).toBe('');
    expect(stripBBCode('plain text')).toBe('plain text');
  });
});

import { normalizeAniListItem } from './search.js';

const aniListAnime = {
  id: 21,
  title: { romaji: 'Sousou no Frieren', english: 'Frieren', native: '葬送のフリーレン' },
  coverImage: { large: 'https://img/large.jpg', medium: 'https://img/med.jpg' },
  description: 'A story <br>about an elf.',
  genres: ['Adventure', 'Drama'],
  tags: [{ name: 'Magic' }, { name: 'Adventure' }],
  averageScore: 89,
  format: 'TV',
  startDate: { year: 2023 },
  siteUrl: 'https://anilist.co/anime/21',
  isAdult: false,
};

describe('normalizeAniListItem', () => {
  it('prefers native (Japanese) title', () => {
    const work = normalizeAniListItem(aniListAnime, 'anilist_anime');
    expect(work.title).toBe('葬送のフリーレン');
    expect(work.originalTitle).toBe('Sousou no Frieren');
  });

  it('maps anime source to 动画 type and builds id/url', () => {
    const work = normalizeAniListItem(aniListAnime, 'anilist_anime');
    expect(work.id).toBe('anilist-21');
    expect(work.source).toBe('anilist_anime');
    expect(work.type).toBe('动画');
    expect(work.sourceUrl).toBe('https://anilist.co/anime/21');
    expect(work.releaseYear).toBe('2023');
  });

  it('converts averageScore to 10-point scale in meta', () => {
    const work = normalizeAniListItem(aniListAnime, 'anilist_anime');
    expect(work.meta).toContain('8.9 分');
  });

  it('dedupes genres and tags', () => {
    const work = normalizeAniListItem(aniListAnime, 'anilist_anime');
    expect(work.tags).toEqual(['Adventure', 'Drama', 'Magic']);
  });

  it('maps manga format NOVEL to 轻小说/书籍', () => {
    const novel = { ...aniListAnime, id: 99, format: 'NOVEL' };
    const work = normalizeAniListItem(novel, 'anilist_manga');
    expect(work.type).toBe('轻小说/书籍');
  });

  it('maps manga format MANGA to 漫画', () => {
    const manga = { ...aniListAnime, id: 98, format: 'MANGA' };
    const work = normalizeAniListItem(manga, 'anilist_manga');
    expect(work.type).toBe('漫画');
  });
});
