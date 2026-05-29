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
    expect(work.sourceLabel).toBe('AniList动画');
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

import { normalizeVndbItem } from './search.js';

const vndbVn = {
  id: 'v17',
  title: 'Ever17 -The Out of Infinity-',
  alttitle: 'Ever17 -the out of infinity-',
  image: { url: 'https://t.vndb.org/cv/17.jpg', sexual: 0 },
  released: '2002-08-29',
  description: 'A [b]sci-fi[/b] mystery. [url=/v18]sequel[/url]',
  rating: 87,
  length: 4,
  tags: [
    { name: 'Science Fiction', rating: 2.8 },
    { name: 'Amnesia', rating: 2.1 },
  ],
};

describe('normalizeVndbItem', () => {
  it('builds id, source, url and fixed Galgame type', () => {
    const work = normalizeVndbItem(vndbVn);
    expect(work.id).toBe('vndb-v17');
    expect(work.source).toBe('vndb');
    expect(work.sourceId).toBe('v17');
    expect(work.sourceUrl).toBe('https://vndb.org/v17');
    expect(work.type).toBe('Galgame/游戏');
    expect(work.sourceLabel).toBe('VNDB');
  });

  it('uses default title and strips bbcode from description', () => {
    const work = normalizeVndbItem(vndbVn);
    expect(work.title).toBe('Ever17 -The Out of Infinity-');
    expect(work.summary).toBe('A sci-fi mystery. sequel');
  });

  it('converts 0-100 rating to 10-point scale', () => {
    const work = normalizeVndbItem(vndbVn);
    expect(work.meta).toContain('8.7 分');
  });

  it('orders tags by rating descending', () => {
    const work = normalizeVndbItem(vndbVn);
    expect(work.tags).toEqual(['Science Fiction', 'Amnesia']);
  });

  it('extracts release year', () => {
    const work = normalizeVndbItem(vndbVn);
    expect(work.releaseYear).toBe('2002');
  });
});

import { buildApiUrl } from './search.js';

describe('buildApiUrl', () => {
  it('keeps bare /api path when API_BASE is empty (dev)', () => {
    expect(buildApiUrl('/api/bangumi/v0/search')).toBe('/api/bangumi/v0/search');
  });

  it('prefixes API_BASE when set (prod simulated)', () => {
    expect(buildApiUrl('/api/vndb/vn', 'https://w.example.dev')).toBe('https://w.example.dev/api/vndb/vn');
  });

  it('strips a trailing slash on the base to avoid double slashes', () => {
    expect(buildApiUrl('/api/anilist', 'https://w.example.dev/')).toBe('https://w.example.dev/api/anilist');
  });
});

import { directApiUrl, DIRECT_BASES } from './search.js';

describe('directApiUrl', () => {
  it('routes a direct-connect source to its official domain', () => {
    expect(directApiUrl('bangumi', '/v0/search/subjects')).toBe('https://api.bgm.tv/v0/search/subjects');
  });

  it('routes moegirl to its official domain', () => {
    expect(directApiUrl('moegirl', '/api.php?x=1')).toBe('https://zh.moegirl.org.cn/api.php?x=1');
  });

  it('exposes only bangumi and moegirl as direct sources', () => {
    expect(Object.keys(DIRECT_BASES).sort()).toEqual(['bangumi', 'moegirl']);
  });
});

import { buildMoegirlParams } from './search.js';

describe('buildMoegirlParams', () => {
  it('includes origin=* to enable MediaWiki CORS', () => {
    const params = buildMoegirlParams('芙莉莲');
    expect(params.get('origin')).toBe('*');
    expect(params.get('gsrsearch')).toBe('芙莉莲');
  });

  it('requests the full category list to avoid batch-wide truncation', () => {
    expect(buildMoegirlParams('x').get('cllimit')).toBe('max');
  });
});

import { isMoegirlWork } from './search.js';

const cats = (...names) => ({ categories: names.map((title) => ({ title: `Category:${title}` })) });

describe('isMoegirlWork', () => {
  it('keeps pages with a 作品 category (anime/game/novel/music)', () => {
    expect(isMoegirlWork(cats('日本动画作品', '校园题材'))).toBe(true);
    expect(isMoegirlWork(cats('日本游戏作品'))).toBe(true);
    expect(isMoegirlWork(cats('日本音乐作品', '片尾曲'))).toBe(true);
  });

  it('keeps pages whose only signal is a 题材 category', () => {
    expect(isMoegirlWork(cats('凉宫春日系列', '恋爱题材'))).toBe(true);
  });

  it('drops character pages (配音角色 / 萌属性, no 作品/题材)', () => {
    expect(isMoegirlWork(cats('凉宫春日系列', '平野绫配音角色', '傲娇', '马尾'))).toBe(false);
  });

  it('drops element/setting pages', () => {
    expect(isMoegirlWork(cats('命运石之门系列', '特殊能力'))).toBe(false);
    expect(isMoegirlWork(cats('命运石之门系列', '虚构事物'))).toBe(false);
  });

  it('drops pages that only carry the franchise series category', () => {
    expect(isMoegirlWork(cats('命运石之门系列'))).toBe(false);
  });

  it('drops pages with missing or empty categories', () => {
    expect(isMoegirlWork({})).toBe(false);
    expect(isMoegirlWork({ categories: [] })).toBe(false);
  });

  it('handles the 分类: prefix variant', () => {
    expect(isMoegirlWork({ categories: [{ title: '分类:日本动画作品' }] })).toBe(true);
  });
});

import { normalizeYmgalItem } from './search.js';

const ymgalItem = {
  id: 10886,
  name: 'White Album',
  chineseName: '白色相簿',
  mainImg: 'https://cdn.ymgal.games/archive/main/75/abc.webp',
  releaseDate: '1998-05-01',
  orgName: 'Leaf',
  haveChinese: true,
};

describe('normalizeYmgalItem', () => {
  it('prefers chineseName and builds id/url/type', () => {
    const w = normalizeYmgalItem(ymgalItem);
    expect(w.id).toBe('ymgal-10886');
    expect(w.source).toBe('ymgal');
    expect(w.sourceLabel).toBe('月幕Galgame');
    expect(w.sourceId).toBe('10886');
    expect(w.sourceUrl).toBe('https://www.ymgal.games/ga10886');
    expect(w.title).toBe('白色相簿');
    expect(w.originalTitle).toBe('White Album');
    expect(w.type).toBe('Galgame/游戏');
    expect(w.cover).toBe('https://cdn.ymgal.games/archive/main/75/abc.webp');
    expect(w.releaseYear).toBe('1998');
  });

  it('falls back to name when no chineseName', () => {
    const w = normalizeYmgalItem({ ...ymgalItem, id: 1, chineseName: '' });
    expect(w.title).toBe('White Album');
    expect(w.originalTitle).toBe('');
  });

  it('builds tags from org and chinese flag', () => {
    const w = normalizeYmgalItem(ymgalItem);
    expect(w.tags).toEqual(['Leaf', '有中文']);
  });

  it('omits 有中文 tag when haveChinese is false', () => {
    const w = normalizeYmgalItem({ ...ymgalItem, haveChinese: false });
    expect(w.tags).toEqual(['Leaf']);
  });
});
