import { describe, expect, it } from 'vitest';
import { normalizeListingMarkdown } from './listing-sections';

describe('normalizeListingMarkdown', () => {
  it('turns "-Item" (no space) lines into bullets', () => {
    expect(normalizeListingMarkdown('Required:\n\n-Junior standing.\n-Strong writing.')).toBe(
      'Required:\n\n- Junior standing.\n- Strong writing.',
    );
  });

  it('accepts •, – and single * as bullet markers but leaves **bold** alone', () => {
    expect(normalizeListingMarkdown('• One\n– Two\n*Three\n**Bold** line')).toBe(
      '- One\n- Two\n- Three\n\n**Bold** line',
    );
  });

  it('keeps single line breaks as line breaks', () => {
    expect(normalizeListingMarkdown('Process Development:\nAssist in mapping.\nHelp document.')).toBe(
      'Process Development:  \nAssist in mapping.  \nHelp document.',
    );
  });

  it('closes a list before an unindented line that follows it', () => {
    expect(normalizeListingMarkdown('-Do A\n-Do B\nSystems Optimization:\n-Do C')).toBe(
      '- Do A\n- Do B\n\nSystems Optimization:\n- Do C',
    );
  });

  it('leaves well-formed Markdown, horizontal rules and code fences alone', () => {
    const md = '## Heading\n\n- One\n- Two\n\n---\n\n```\nline1\nline2\n```';
    expect(normalizeListingMarkdown(md)).toBe(md);
  });

  it('handles Windows line endings', () => {
    expect(normalizeListingMarkdown('-A\r\n-B')).toBe('- A\n- B');
  });
});
