import { describe, expect, it } from 'vitest';
import {
  buildAiProfileInput,
  buildAiProfilePrompt,
  parseAiProfileResponse,
} from './aiProfile.js';

function record(index, overrides = {}) {
  return {
    title: `Work ${index}`,
    originalTitle: `Original ${index}`,
    type: 'anime',
    source: 'manual',
    sourceUrl: `https://example.test/${index}`,
    cover: `cover-${index}.jpg`,
    status: 'done',
    rating: index,
    releaseYear: `20${String(index).padStart(2, '0')}`,
    tags: [`tag-${index}`],
    animeTags: [`anime-tag-${index}`],
    comment: `private-comment-${index}`,
    summary: `private-summary-${index}`,
    finishedAt: `2026-01-${String(index).padStart(2, '0')}`,
    addedAt: `2025-01-${String(index).padStart(2, '0')}`,
    updatedAt: `2026-02-${String(index).padStart(2, '0')}`,
    ...overrides,
  };
}

describe('AI profile input builder', () => {
  it('builds an empty schemaVersion 1 profile input', () => {
    const input = buildAiProfileInput([], { total: 0 });

    expect(input).toMatchObject({
      schemaVersion: 1,
      recordCount: 0,
      stats: { total: 0 },
      representativeWorks: {
        highRated: [],
        recentDone: [],
        active: [],
        paused: [],
        dropped: [],
      },
      privacy: {
        fullLibraryIncluded: false,
        representativeSampleLimit: 5,
      },
    });
  });

  it('creates representative samples for a small library without private fields', () => {
    const input = buildAiProfileInput(
      [
        record(1, { status: 'done', rating: 8 }),
        record(2, { status: 'active', rating: 0 }),
        record(3, { status: 'paused', rating: 6 }),
        record(4, { status: 'dropped', rating: 3 }),
      ],
      {
        total: 4,
        comment: 'private-stat-comment',
        nested: { summary: 'private-stat-summary', value: 1 },
      },
    );

    expect(input.recordCount).toBe(4);
    expect(input.representativeWorks.highRated).toHaveLength(3);
    expect(input.representativeWorks.active).toHaveLength(1);
    expect(input.representativeWorks.paused).toHaveLength(1);
    expect(input.representativeWorks.dropped).toHaveLength(1);
    expect(input.representativeWorks.highRated[0]).toEqual({
      title: 'Work 1',
      originalTitle: 'Original 1',
      type: 'anime',
      source: 'manual',
      status: 'done',
      rating: 8,
      releaseYear: '2001',
      tags: ['tag-1'],
      animeTags: ['anime-tag-1'],
    });

    const serialized = JSON.stringify(input);
    expect(serialized).not.toContain('private-comment');
    expect(serialized).not.toContain('private-summary');
    expect(serialized).not.toContain('private-stat-comment');
    expect(serialized).not.toContain('private-stat-summary');
    expect(Object.keys(input.representativeWorks.highRated[0])).not.toContain('sourceUrl');
    expect(Object.keys(input.representativeWorks.highRated[0])).not.toContain('cover');
    expect(Object.keys(input.representativeWorks.highRated[0])).not.toContain('comment');
    expect(Object.keys(input.representativeWorks.highRated[0])).not.toContain('summary');
    expect(serialized).not.toContain('cover-');
  });

  it('limits large-library representative groups to five samples', () => {
    const records = Array.from({ length: 9 }, (_, index) =>
      record(index + 1, {
        status: index % 2 === 0 ? 'done' : 'active',
        rating: index + 1,
      }),
    );

    const input = buildAiProfileInput(records, { total: records.length });

    expect(input.representativeWorks.highRated).toHaveLength(5);
    expect(input.representativeWorks.recentDone).toHaveLength(5);
    expect(input.representativeWorks.active).toHaveLength(4);
    expect(input.representativeWorks.highRated.map((item) => item.title)).toEqual([
      'Work 9',
      'Work 8',
      'Work 7',
      'Work 6',
      'Work 5',
    ]);
  });
});

describe('AI profile prompt builder', () => {
  it('builds OpenAI-compatible Chinese chat messages with required JSON fields', () => {
    const messages = buildAiProfilePrompt(buildAiProfileInput([record(1)], { total: 1 }));

    expect(messages).toHaveLength(2);
    expect(messages.map((message) => message.role)).toEqual(['system', 'user']);
    expect(messages[0].content).toContain('合法 JSON');

    const userContent = messages[1].content;
    for (const field of [
      'summary',
      'tasteProfile',
      'favoriteThemes',
      'mediaPreference',
      'ratingStyle',
      'completionHabits',
      'personaTags',
      'caveats',
      'reflectionQuestions',
    ]) {
      expect(userContent).toContain(field);
    }
    expect(userContent).toContain('"schemaVersion": 1');
  });
});

describe('AI profile response parser', () => {
  it('parses legal JSON and fills missing fields', () => {
    const result = parseAiProfileResponse('{"summary":"偏爱日常","personaTags":["温柔"]}');

    expect(result.error).toBeNull();
    expect(result.parsed).toMatchObject({
      summary: '偏爱日常',
      tasteProfile: '',
      favoriteThemes: [],
      mediaPreference: '',
      ratingStyle: '',
      completionHabits: '',
      personaTags: ['温柔'],
      caveats: [],
      reflectionQuestions: [],
    });
  });

  it('parses fenced JSON responses', () => {
    const result = parseAiProfileResponse('```json\n{"summary":"完成度高"}\n```');

    expect(result.error).toBeNull();
    expect(result.parsed.summary).toBe('完成度高');
  });

  it('returns raw text and an error for non-JSON responses', () => {
    const result = parseAiProfileResponse('这不是 JSON');

    expect(result.parsed).toBeNull();
    expect(result.rawText).toBe('这不是 JSON');
    expect(result.error).toBeTruthy();
  });
});
