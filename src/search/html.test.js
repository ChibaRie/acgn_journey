import { describe, expect, it } from 'vitest';
import { cleanImageUrl, getYear, normalizeUrl, stripBBCode, stripHtml, uniqueTags } from './html.js';

describe('html helpers', () => {
  it('strips html tags and entities', () => {
    expect(stripHtml('<p>A &amp; B<br>C</p>')).toBe('A & B C');
  });

  it('strips bbcode but keeps visible text', () => {
    expect(stripBBCode('see [url=/v17]Ever17[/url] now')).toBe('see Ever17 now');
  });

  it('normalizes protocol-relative and path-relative urls', () => {
    expect(normalizeUrl('//cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
    expect(normalizeUrl('/img/a.jpg', 'https://www.gugu3.com')).toBe('https://www.gugu3.com/img/a.jpg');
  });

  it('extracts year from date text', () => {
    expect(getYear('2002-08-29')).toBe('2002');
  });

  it('deduplicates tags in order and strips category prefixes', () => {
    expect(uniqueTags(['Category:Drama', 'drama', '分类:Adventure'])).toEqual(['Drama', 'Adventure']);
  });

  it('cleans proxied image wrappers used by some source pages', () => {
    expect(cleanImageUrl('/image.php?url=https://img.example/a.jpg')).toBe('https://img.example/a.jpg');
  });
});
