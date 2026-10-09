import { describe, expect, it } from 'vitest';
import { stageColor } from './stage-colors';

describe('stageColor', () => {
  it('maps the database-seeded stage hex to the matching theme token', () => {
    expect(stageColor('#e0e7ff')).toBe('var(--chip-indigo-bg)');
    expect(stageColor('#3730A3')).toBe('var(--chip-indigo-ink)');
    expect(stageColor('#ede9fe')).toBe('var(--chip-purple-bg)');
    expect(stageColor('#d1fae5')).toBe('var(--chip-green-bg)');
    expect(stageColor('#065f46')).toBe('var(--chip-green-ink)');
  });

  it('passes tokens and unknown values through untouched', () => {
    expect(stageColor('var(--danger-fg)')).toBe('var(--danger-fg)');
    expect(stageColor('#123456')).toBe('#123456');
    expect(stageColor(null)).toBeUndefined();
    expect(stageColor(undefined)).toBeUndefined();
  });
});
