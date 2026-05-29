import { describe, it, expect } from 'vitest';
import { normalizeBackground, DEFAULT_BACKGROUND } from './background.js';

describe('normalizeBackground', () => {
  it('returns defaults for empty or invalid input', () => {
    expect(normalizeBackground(null)).toEqual(DEFAULT_BACKGROUND);
    expect(normalizeBackground(undefined)).toEqual(DEFAULT_BACKGROUND);
    expect(normalizeBackground('nope')).toEqual(DEFAULT_BACKGROUND);
  });

  it('keeps a valid data:image url', () => {
    const img = 'data:image/png;base64,AAAA';
    expect(normalizeBackground({ image: img }).image).toBe(img);
  });

  it('drops a non-data image url to prevent remote/script injection', () => {
    expect(normalizeBackground({ image: 'https://evil.example/x.png' }).image).toBe('');
    expect(normalizeBackground({ image: 'javascript:alert(1)' }).image).toBe('');
  });

  it('clamps opacity into 0..1', () => {
    expect(normalizeBackground({ opacity: 5 }).opacity).toBe(1);
    expect(normalizeBackground({ opacity: -2 }).opacity).toBe(0);
    expect(normalizeBackground({ opacity: 0.5 }).opacity).toBe(0.5);
  });

  it('clamps blur into 0..30 and falls back when not a number', () => {
    expect(normalizeBackground({ blur: 99 }).blur).toBe(30);
    expect(normalizeBackground({ blur: -4 }).blur).toBe(0);
    expect(normalizeBackground({ blur: 'x' }).blur).toBe(DEFAULT_BACKGROUND.blur);
  });
});
