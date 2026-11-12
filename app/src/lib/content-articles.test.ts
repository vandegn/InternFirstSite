import { describe, expect, it } from 'vitest';
import {
  ARTICLE_LIMITS,
  articleJsonLd,
  dedupeSlug,
  faqPageJsonLd,
  readingMinutes,
  renderLlmsTxt,
  slugify,
  validateArticleDraft,
  type ContentArticle,
} from './content-articles';

const body = Array.from({ length: 120 }, (_, i) => `Sentence number ${i} about finding an internship early.`).join(' ');

function goodRaw() {
  return {
    title: 'How to Find a Summer Internship as a Sophomore',
    slug: 'summer internship sophomore',
    description: 'Start in the fall, use your school\'s career center, and apply in batches of ten.',
    key_takeaways: ['Start early', 'Apply in batches', 'Follow up once'],
    body_markdown: `## Start in the fall\n\n${body}\n\n## Apply in batches\n\n${body}`,
    faq: [
      { question: 'When should I start', answer: 'September of sophomore year.' },
      { question: 'How many should I apply to?', answer: 'Ten at a time.' },
      { question: 'Do I need experience?', answer: 'No. Coursework and clubs count.' },
    ],
    tags: ['Sophomore', 'Summer', 'sophomore'],
  };
}

describe('slugify', () => {
  it('lowercases, strips punctuation and accents, and joins with hyphens', () => {
    expect(slugify('How to Find a Summer Internship — Fast!')).toBe('how-to-find-a-summer-internship-fast');
    expect(slugify('Résumé & cover letters')).toBe('resume-and-cover-letters');
    expect(slugify('  --weird--  ')).toBe('weird');
  });

  it('caps the length without leaving a trailing hyphen', () => {
    const slug = slugify('word '.repeat(40));
    expect(slug.length).toBeLessThanOrEqual(ARTICLE_LIMITS.slugMax);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('validateArticleDraft', () => {
  it('normalises a good draft', () => {
    const result = validateArticleDraft(goodRaw());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.slug).toBe('summer-internship-sophomore');
    expect(result.draft.faq[0].question).toBe('When should I start?');
    expect(result.draft.tags).toEqual(['sophomore', 'summer']);
    expect(result.warnings).toEqual([]);
  });

  it('fails hard when the body or title is missing', () => {
    const result = validateArticleDraft({ ...goodRaw(), body_markdown: '', title: '' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain('title is missing');
    expect(result.errors).toContain('body_markdown is missing');
  });

  it('derives the slug and description from the title and body when absent', () => {
    const result = validateArticleDraft({ ...goodRaw(), slug: '', description: '' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.slug).toBe('how-to-find-a-summer-internship-as-a-sophomore');
    expect(result.draft.description.length).toBeGreaterThan(20);
    expect(result.draft.description.length).toBeLessThanOrEqual(ARTICLE_LIMITS.descriptionMax);
  });

  it('warns instead of failing on soft limits', () => {
    const result = validateArticleDraft({ ...goodRaw(), body_markdown: '# Title\n\nShort body.', key_takeaways: ['one'], faq: [] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.join('\n')).toMatch(/minimum/);
    expect(result.warnings.join('\n')).toMatch(/H1/);
    expect(result.warnings.join('\n')).toMatch(/key takeaways/);
    expect(result.warnings.join('\n')).toMatch(/FAQ/);
  });

  it('trims an over-long description on a word boundary', () => {
    const result = validateArticleDraft({ ...goodRaw(), description: 'word '.repeat(100) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.description.length).toBeLessThanOrEqual(ARTICLE_LIMITS.descriptionMax);
    expect(result.draft.description.endsWith('…')).toBe(true);
  });
});

describe('dedupeSlug', () => {
  it('returns the slug untouched when free and suffixes otherwise', () => {
    const taken = new Set(['guide', 'guide-2']);
    expect(dedupeSlug('fresh', (s) => taken.has(s))).toBe('fresh');
    expect(dedupeSlug('guide', (s) => taken.has(s))).toBe('guide-3');
  });
});

describe('structured data', () => {
  const article: ContentArticle = {
    id: 'a1',
    slug: 'summer-internship-sophomore',
    title: 'How to Find a Summer Internship as a Sophomore',
    description: 'Start early.',
    body_markdown: body,
    key_takeaways: ['Start early'],
    faq: [{ question: 'When?', answer: 'Fall.' }],
    tags: ['sophomore'],
    audience: 'student',
    target_query: null,
    status: 'published',
    topic_id: null,
    generated_by: 'claude-opus-5-5',
    generation_meta: null,
    published_at: '2026-11-11T00:00:00.000Z',
    created_at: '2026-11-10T00:00:00.000Z',
    updated_at: '2026-11-12T00:00:00.000Z',
  };

  it('builds an Article node tied to the site Organization', () => {
    const json = articleJsonLd(article);
    expect(json['@type']).toBe('Article');
    expect(json.url).toBe('https://www.intern-first.com/blog/summer-internship-sophomore');
    expect(json.datePublished).toBe('2026-11-11T00:00:00.000Z');
    expect(json.dateModified).toBe('2026-11-12T00:00:00.000Z');
    expect((json.author as { '@id': string })['@id']).toBe('https://www.intern-first.com/#organization');
    expect(json.keywords).toBe('sophomore');
  });

  it('builds a FAQPage node, or nothing when there are no questions', () => {
    const json = faqPageJsonLd(article.faq, 'https://www.intern-first.com/blog/x');
    expect(json?.['@type']).toBe('FAQPage');
    expect((json?.mainEntity as unknown[]).length).toBe(1);
    expect(faqPageJsonLd([], 'https://x')).toBeNull();
  });

  it('estimates reading time from the body', () => {
    expect(readingMinutes('one two three')).toBe(1);
    expect(readingMinutes(body)).toBeGreaterThanOrEqual(4);
  });
});

describe('renderLlmsTxt', () => {
  it('renders the llms.txt sections with absolute links', () => {
    const text = renderLlmsTxt({
      siteName: 'InternFirst',
      siteUrl: 'https://www.intern-first.com',
      summary: 'An internship platform.',
      facts: ['Free for students.'],
      keyPages: [{ title: 'Browse internships', path: '/internships', note: 'Every open listing.' }],
      guides: [{ slug: 'a-guide', title: 'A guide', description: 'Read this.' }],
      faq: [{ question: 'Is it free?', answer: 'Yes.' }],
      generatedAt: new Date('2026-11-11T10:00:00Z'),
    });
    expect(text.startsWith('# InternFirst\n\n> An internship platform.')).toBe(true);
    expect(text).toContain('- [Browse internships](https://www.intern-first.com/internships): Every open listing.');
    expect(text).toContain('- [A guide](https://www.intern-first.com/blog/a-guide): Read this.');
    expect(text).toContain('- **Is it free?** Yes.');
    expect(text).toContain('_Updated 2026-11-11._');
  });
});
