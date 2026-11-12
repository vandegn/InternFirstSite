import { SITE_NAME, SITE_URL, absoluteUrl } from '@/lib/site';
import { toMetaDescription } from '@/lib/listing-seo';

// Pure rules for the GEO content engine: the shape of an article, how a
// generated draft is validated and normalised before it touches the database,
// and the structured data / llms.txt text built from published articles.
// No Next, no Supabase, no SDK — content-articles.test.ts covers it directly,
// and the generator, the API routes and the pages all import from here so the
// rules can't drift.

export type ContentAudience = 'student' | 'employer' | 'both';
export type ArticleStatus = 'draft' | 'published' | 'archived';
export type TopicStatus = 'queued' | 'generating' | 'generated' | 'failed' | 'skipped';

export type FaqItem = { question: string; answer: string };

export type ContentTopic = {
  id: string;
  topic: string;
  target_query: string | null;
  audience: ContentAudience;
  notes: string | null;
  status: TopicStatus;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type ContentArticle = {
  id: string;
  slug: string;
  title: string;
  description: string;
  body_markdown: string;
  key_takeaways: string[];
  faq: FaqItem[];
  tags: string[];
  audience: ContentAudience;
  target_query: string | null;
  status: ArticleStatus;
  topic_id: string | null;
  generated_by: string | null;
  generation_meta: Record<string, unknown> | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Every column of content_articles, for selects that need the whole row. */
export const ARTICLE_COLUMNS =
  'id, slug, title, description, body_markdown, key_takeaways, faq, tags, audience, target_query, status, topic_id, generated_by, generation_meta, published_at, created_at, updated_at';

/** The fields the generator produces; everything else is bookkeeping. */
export type ArticleDraft = Pick<
  ContentArticle,
  'slug' | 'title' | 'description' | 'body_markdown' | 'key_takeaways' | 'faq' | 'tags'
>;

// ---------------------------------------------------------------------------
// Limits. These are the editorial contract the generator is prompted with and
// the validator enforces, so a prompt change can't silently ship 3,000-word
// drafts or a 400-character meta description.
// ---------------------------------------------------------------------------
export const ARTICLE_LIMITS = {
  titleMax: 90,
  descriptionMax: 300,
  slugMax: 80,
  minWords: 600,
  maxWords: 2200,
  takeawaysMin: 3,
  takeawaysMax: 6,
  faqMin: 3,
  faqMax: 8,
  tagsMax: 8,
} as const;

// JSON schema handed to the model as the structured-output format. Kept next
// to the validator so the two describe the same object.
export const ARTICLE_DRAFT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'slug', 'description', 'key_takeaways', 'body_markdown', 'faq', 'tags'],
  properties: {
    title: { type: 'string', description: `Page title, under ${ARTICLE_LIMITS.titleMax} characters, no brand suffix.` },
    slug: { type: 'string', description: 'URL slug: lowercase words joined by hyphens, 3-8 words, no stop words.' },
    description: {
      type: 'string',
      description: `A direct, self-contained answer to the target question in one or two sentences, under ${ARTICLE_LIMITS.descriptionMax} characters. Used as the meta description.`,
    },
    key_takeaways: {
      type: 'array',
      items: { type: 'string' },
      description: `${ARTICLE_LIMITS.takeawaysMin}-${ARTICLE_LIMITS.takeawaysMax} one-sentence takeaways a reader could act on without reading further.`,
    },
    body_markdown: {
      type: 'string',
      description: `The article body in Markdown. H2 (##) sections with descriptive headings, short paragraphs, lists where they help. ${ARTICLE_LIMITS.minWords}-${ARTICLE_LIMITS.maxWords} words. No H1 — the title is rendered separately.`,
    },
    faq: {
      type: 'array',
      description: `${ARTICLE_LIMITS.faqMin}-${ARTICLE_LIMITS.faqMax} questions people ask about this topic, each with a complete answer of 1-3 sentences.`,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'answer'],
        properties: { question: { type: 'string' }, answer: { type: 'string' } },
      },
    },
    tags: { type: 'array', items: { type: 'string' }, description: `Up to ${ARTICLE_LIMITS.tagsMax} short topic tags.` },
  },
} as const;

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, ARTICLE_LIMITS.slugMax)
    .replace(/-+$/g, '');
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length <= ARTICLE_LIMITS.slugMax;
}

export function wordCount(markdown: string): number {
  const text = markdown.replace(/```[\s\S]*?```/g, ' ').replace(/[#*_`>\-|]/g, ' ');
  return text.split(/\s+/).filter(Boolean).length;
}

/** Minutes, rounded up, at a reading pace of ~230 words per minute. */
export function readingMinutes(markdown: string): number {
  return Math.max(1, Math.ceil(wordCount(markdown) / 230));
}

function cleanLines(values: unknown, max: number): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  for (const v of values) {
    if (typeof v !== 'string') continue;
    const t = v.replace(/\s+/g, ' ').trim();
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function cleanFaq(values: unknown): FaqItem[] {
  if (!Array.isArray(values)) return [];
  const out: FaqItem[] = [];
  for (const v of values) {
    if (!v || typeof v !== 'object') continue;
    const q = typeof (v as FaqItem).question === 'string' ? (v as FaqItem).question.trim() : '';
    const a = typeof (v as FaqItem).answer === 'string' ? (v as FaqItem).answer.trim() : '';
    if (q && a) out.push({ question: q.endsWith('?') ? q : `${q}?`, answer: a });
    if (out.length >= ARTICLE_LIMITS.faqMax) break;
  }
  return out;
}

export type DraftValidation =
  | { ok: true; draft: ArticleDraft; warnings: string[] }
  | { ok: false; errors: string[] };

// Takes whatever the model returned (already JSON-parsed) and either produces
// a clean draft or says exactly why it can't. Soft limits (word count a little
// off) become warnings stored on the row; hard failures (no body, no title)
// fail the topic so an admin sees `last_error` instead of an empty draft.
export function validateArticleDraft(raw: unknown): DraftValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const title = typeof obj.title === 'string' ? obj.title.replace(/\s+/g, ' ').trim() : '';
  if (!title) errors.push('title is missing');
  else if (title.length > ARTICLE_LIMITS.titleMax) warnings.push(`title is ${title.length} characters (limit ${ARTICLE_LIMITS.titleMax})`);

  const body = typeof obj.body_markdown === 'string' ? obj.body_markdown.trim() : '';
  if (!body) errors.push('body_markdown is missing');
  const words = wordCount(body);
  if (body && words < ARTICLE_LIMITS.minWords) warnings.push(`body is ${words} words (minimum ${ARTICLE_LIMITS.minWords})`);
  if (body && words > ARTICLE_LIMITS.maxWords) warnings.push(`body is ${words} words (maximum ${ARTICLE_LIMITS.maxWords})`);
  if (/^#\s/m.test(body)) warnings.push('body contains an H1; the title is rendered separately');

  let description = typeof obj.description === 'string' ? obj.description.replace(/\s+/g, ' ').trim() : '';
  if (!description) description = toMetaDescription(body, title);
  if (description.length > ARTICLE_LIMITS.descriptionMax) {
    warnings.push(`description trimmed from ${description.length} characters`);
    description = `${description.slice(0, ARTICLE_LIMITS.descriptionMax - 1).replace(/\s+\S*$/, '')}…`;
  }

  const slugSource = typeof obj.slug === 'string' && obj.slug.trim() ? obj.slug : title;
  const slug = slugify(slugSource);
  if (!slug || !isValidSlug(slug)) errors.push('slug could not be derived');

  const key_takeaways = cleanLines(obj.key_takeaways, ARTICLE_LIMITS.takeawaysMax);
  if (key_takeaways.length < ARTICLE_LIMITS.takeawaysMin) warnings.push(`only ${key_takeaways.length} key takeaways`);

  const faq = cleanFaq(obj.faq);
  if (faq.length < ARTICLE_LIMITS.faqMin) warnings.push(`only ${faq.length} FAQ entries`);

  const tags = cleanLines(
    Array.isArray(obj.tags) ? obj.tags.map((t) => (typeof t === 'string' ? t.toLowerCase() : t)) : [],
    ARTICLE_LIMITS.tagsMax,
  );

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, draft: { slug, title, description, body_markdown: body, key_takeaways, faq, tags }, warnings };
}

// When a slug is already taken, suffix it rather than fail: two topics can
// legitimately produce "how-to-ask-for-a-reference". Admins can rename before
// publishing.
export function dedupeSlug(slug: string, taken: (candidate: string) => boolean): string {
  if (!taken(slug)) return slug;
  for (let n = 2; n < 100; n++) {
    const candidate = `${slug.slice(0, ARTICLE_LIMITS.slugMax - 3)}-${n}`;
    if (!taken(candidate)) return candidate;
  }
  return `${slug.slice(0, ARTICLE_LIMITS.slugMax - 14)}-${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// URLs, metadata and structured data
// ---------------------------------------------------------------------------

export function articleUrl(slug: string) {
  return absoluteUrl(`/blog/${slug}`);
}

export function isPublished(article: Pick<ContentArticle, 'status' | 'published_at'>): boolean {
  return article.status === 'published' && Boolean(article.published_at);
}

// schema.org Article. `author` and `publisher` are the Organization node the
// homepage declares (same @id), so the answer engines reconcile the guide with
// the brand entity rather than treating "InternFirst" as an unknown byline.
export function articleJsonLd(article: ContentArticle): Record<string, unknown> {
  const url = articleUrl(article.slug);
  const org = { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: SITE_NAME, url: SITE_URL };
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: article.title,
    description: article.description,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    datePublished: article.published_at ?? article.created_at,
    dateModified: article.updated_at,
    author: org,
    publisher: org,
    inLanguage: 'en-US',
    isAccessibleForFree: true,
    wordCount: wordCount(article.body_markdown),
    ...(article.tags.length > 0 ? { keywords: article.tags.join(', ') } : {}),
    ...(article.audience === 'student'
      ? { audience: { '@type': 'EducationalAudience', educationalRole: 'student' } }
      : article.audience === 'employer'
        ? { audience: { '@type': 'BusinessAudience' } }
        : {}),
  };
}

// schema.org FAQPage. Google has pulled the FAQ rich result for most sites,
// but the markup is still how answer engines find the Q&A pairs quickly, and
// it costs nothing when the questions are already on the page.
export function faqPageJsonLd(faq: FaqItem[], pageUrl: string): Record<string, unknown> | null {
  if (faq.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${pageUrl}#faq`,
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

// ---------------------------------------------------------------------------
// /llms.txt
// ---------------------------------------------------------------------------

// llms.txt (https://llmstxt.org) is a plain-Markdown map of the site for
// language models: who we are, the facts we want quoted correctly, and the
// pages worth reading. Rendered from the same data the pages use so it can't
// go stale on its own.
export type LlmsTxtInput = {
  siteName: string;
  siteUrl: string;
  summary: string;
  facts: string[];
  keyPages: { title: string; path: string; note: string }[];
  guides: Pick<ContentArticle, 'slug' | 'title' | 'description'>[];
  faq: FaqItem[];
  generatedAt: Date;
};

export function renderLlmsTxt(input: LlmsTxtInput): string {
  const abs = (path: string) => `${input.siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const lines: string[] = [];
  lines.push(`# ${input.siteName}`, '', `> ${input.summary}`, '');
  if (input.facts.length > 0) {
    lines.push('## Key facts', '');
    for (const fact of input.facts) lines.push(`- ${fact}`);
    lines.push('');
  }
  lines.push('## Key pages', '');
  for (const page of input.keyPages) lines.push(`- [${page.title}](${abs(page.path)}): ${page.note}`);
  lines.push('');
  if (input.guides.length > 0) {
    lines.push('## Guides', '');
    for (const g of input.guides) lines.push(`- [${g.title}](${abs(`/blog/${g.slug}`)}): ${g.description}`);
    lines.push('');
  }
  if (input.faq.length > 0) {
    lines.push('## Frequently asked questions', '');
    for (const item of input.faq) lines.push(`- **${item.question}** ${item.answer}`);
    lines.push('');
  }
  lines.push('## Optional', '', `- [Sitemap](${abs('/sitemap.xml')}): every public URL, including each open internship listing.`, `- [Crawler policy](${abs('/robots.txt')}): AI crawlers are welcome; dashboards and the API are off limits.`, '');
  lines.push(`_Updated ${input.generatedAt.toISOString().slice(0, 10)}._`, '');
  return lines.join('\n');
}
