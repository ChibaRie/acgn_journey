import { describe, expect, it } from 'vitest';
import { createExportText, normalizeRecord } from './library.js';
import { parseImportText } from './importers.js';

describe('import file parsing', () => {
  it('imports acgn_journey json backups', () => {
    const backupText = createExportText(
      [
        normalizeRecord({
          id: 'record-json-1',
          source: 'manual',
          sourceId: 'steins-gate',
          title: '命运石之门',
          type: '动画',
          status: 'done',
          rating: 10,
          tags: ['科幻'],
        }),
      ],
      'json',
    );

    const result = parseImportText(backupText, {
      provider: 'auto',
      fileName: 'acgn_journey-backup-2026-06-02.json',
    });

    expect(result.provider).toBe('acgn');
    expect(result.providerLabel).toBe('acgn_journey');
    expect(result.records).toHaveLength(1);
    expect(result.records[0].title).toBe('命运石之门');
    expect(result.records[0].tags).toEqual(['科幻']);
  });

  it('imports direct json record arrays', () => {
    const result = parseImportText(
      JSON.stringify([
        {
          id: 'record-json-2',
          title: '某作品',
          source: 'manual',
          sourceId: 'work-2',
        },
      ]),
      { provider: 'acgn', fileName: 'records.json' },
    );

    expect(result.records).toHaveLength(1);
    expect(result.records[0].title).toBe('某作品');
  });
});
