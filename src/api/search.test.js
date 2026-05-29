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
