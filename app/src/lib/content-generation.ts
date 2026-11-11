import { BRAND_FACTS, SITE_SUMMARY } from '@/lib/brand-facts';
import {
  ARTICLE_DRAFT_JSON_SCHEMA,
  ARTICLE_LIMITS,
  dedupeSlug,
  validateArticleDraft,
  type ArticleDraft,
  type ContentAudience,
  type ContentTopic,
  type TopicStatus,
} from '@/lib/content-articles';

// The content agent. Takes queued topics, asks the model for a complete
// article in a fixed JSON shape, validates it, and stores it as a *draft* for
// an admin to read and publish. It never publishes.
//
// Two seams keep it testable without a database or an API key:
//   * `ArticleWriter` — "given this prompt and schema, return JSON text". The
//     real one (content-generation-claude.ts) calls Claude; tests pass a fake.
//   * `ContentRepo` — the handful of reads and writes the run needs. The real
//     one (content-generation-repo.ts) uses the service-role Supabase client.

export const CONTENT_PROMPT_VERSION = '2026-11-11.1';

export type WriterRequest = {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
};

export type WriterResult = {
  /** The model's text output — expected to be a single JSON object. */
  text: string;
  model: string;
  stopReason: string | null;
  usage?: Record<string, unknown>;
};

export type ArticleWriter = (req: WriterRequest) => Promise<WriterResult>;

export type DraftInsert = ArticleDraft & {
  audience: ContentAudience;
  target_query: string | null;
  topic_id: string;
  generated_by: string;
  generation_meta: Record<string, unknown>;
};

export interface ContentRepo {
  /** Queued topics (or one specific topic), oldest first, flipped to `generating`. */
  claimTopics(opts: { limit: number; topicId?: string }): Promise<ContentTopic[]>;
  /** Titles of existing articles so the model doesn't write a near-duplicate. */
  listExistingArticles(): Promise<{ title: string; slug: string }[]>;
  slugExists(slug: string): Promise<boolean>;
  insertDraft(row: DraftInsert): Promise<{ id: string; slug: string }>;
  markTopic(id: string, status: TopicStatus, lastError: string | null): Promise<void>;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const AUDIENCE_LABEL: Record<ContentAudience, string> = {
  student: 'college students in the United States looking for an internship',
  employer: 'people at U.S. companies who hire interns (recruiters, hiring managers, founders)',
  both: 'both U.S. college students looking for internships and the employers who hire them',
};

export function buildSystemPrompt(): string {
  return [
    `You write guides for InternFirst, published at intern-first.com/blog. Readers arrive from Google and from AI assistants (ChatGPT, Perplexity, Claude, Gemini) that quote pages when they answer questions about internships, so every guide must be the clearest, most directly useful page on its question.`,
    '',
    'About InternFirst:',
    SITE_SUMMARY,
    ...BRAND_FACTS.map((f) => `- ${f}`),
    '',
    'How to write:',
    '- Answer the question in the first paragraph. Do not open with a preamble about why the topic matters.',
    '- Be specific and practical: concrete steps, timelines, examples, and the reasoning behind them. Prefer "apply to ten roles a week starting in September" over "apply early and often".',
    '- Use ## headings that are themselves questions or complete statements a reader might search for. Keep paragraphs to three or four sentences. Use bulleted or numbered lists when the content is a list.',
    '- Write plainly. No hype, no filler sentences, no "in today\'s competitive landscape". Do not use em dashes.',
    '- Mention InternFirst only where it genuinely helps the reader, and only using the facts above. Never invent a feature, statistic, price, partner, or outcome. If a fact is not listed, do not claim it.',
    '- Do not cite statistics or studies unless you are certain of them; prefer reasoning and experience over numbers you cannot stand behind. Never fabricate a source.',
    '- Link to InternFirst pages with relative Markdown links only when relevant: /internships (browse listings), /register?role=student, /register?role=employer, /faq. No other links.',
    '- U.S. context: U.S. spelling, U.S. academic calendar, U.S. employment terms.',
    `- Length: ${ARTICLE_LIMITS.minWords} to ${ARTICLE_LIMITS.maxWords} words in the body.`,
    '- Do not include an H1 in the body; the title is rendered separately. Do not repeat the title as a heading.',
    '',
    'Return exactly one JSON object matching the schema you were given, and nothing else.',
  ].join('\n');
}

export function buildTopicPrompt(topic: ContentTopic, existing: { title: string }[], today: string): string {
  const lines = [
    `Write a complete guide on this topic.`,
    '',
    `Topic: ${topic.topic}`,
    topic.target_query ? `The question the reader typed: ${topic.target_query}` : null,
    `Audience: ${AUDIENCE_LABEL[topic.audience]}`,
    topic.notes ? `Editorial notes from the InternFirst team: ${topic.notes}` : null,
    `Today's date: ${today}`,
  ].filter(Boolean) as string[];

  if (existing.length > 0) {
    lines.push('', 'Guides that already exist (do not duplicate them; link is not needed):');
    for (const e of existing.slice(0, 40)) lines.push(`- ${e.title}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// One topic -> one draft
// ---------------------------------------------------------------------------

export type GenerateOutcome =
  | { ok: true; draft: ArticleDraft; warnings: string[]; meta: Record<string, unknown> }
  | { ok: false; error: string; meta?: Record<string, unknown> };

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Some outputs arrive fenced; take the outermost object.
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('response contained no JSON object');
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

export async function generateArticleDraft(
  topic: ContentTopic,
  writer: ArticleWriter,
  opts: { existing: { title: string; slug: string }[]; today: string },
): Promise<GenerateOutcome> {
  let result: WriterResult;
  try {
    result = await writer({
      system: buildSystemPrompt(),
      prompt: buildTopicPrompt(topic, opts.existing, opts.today),
      schema: ARTICLE_DRAFT_JSON_SCHEMA as unknown as Record<string, unknown>,
    });
  } catch (e) {
    return { ok: false, error: `model request failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  const meta: Record<string, unknown> = {
    model: result.model,
    stop_reason: result.stopReason,
    usage: result.usage ?? null,
    prompt_version: CONTENT_PROMPT_VERSION,
  };

  if (result.stopReason === 'refusal') return { ok: false, error: 'the model declined this topic', meta };
  if (result.stopReason === 'max_tokens') return { ok: false, error: 'the draft was cut off (max_tokens)', meta };

  let raw: unknown;
  try {
    raw = extractJsonObject(result.text);
  } catch (e) {
    return { ok: false, error: `could not parse the draft: ${e instanceof Error ? e.message : String(e)}`, meta };
  }

  const validation = validateArticleDraft(raw);
  if (!validation.ok) return { ok: false, error: `draft rejected: ${validation.errors.join('; ')}`, meta };
  return { ok: true, draft: validation.draft, warnings: validation.warnings, meta: { ...meta, warnings: validation.warnings } };
}

// ---------------------------------------------------------------------------
// A run: claim topics, generate, store
// ---------------------------------------------------------------------------

export type RunSummary = {
  claimed: number;
  drafted: { topicId: string; articleId: string; slug: string; warnings: string[] }[];
  failed: { topicId: string; error: string }[];
};

export async function runContentGeneration(
  repo: ContentRepo,
  writer: ArticleWriter,
  opts: { limit?: number; topicId?: string; now?: Date } = {},
): Promise<RunSummary> {
  const limit = Math.max(1, Math.min(opts.limit ?? 1, 10));
  const today = (opts.now ?? new Date()).toISOString().slice(0, 10);
  const topics = await repo.claimTopics({ limit, topicId: opts.topicId });
  const summary: RunSummary = { claimed: topics.length, drafted: [], failed: [] };
  if (topics.length === 0) return summary;

  const existing = await repo.listExistingArticles();

  // Sequential on purpose: each draft is a long generation, and a failure in
  // one should not leave the others stuck in `generating`.
  for (const topic of topics) {
    const outcome = await generateArticleDraft(topic, writer, { existing, today });
    if (!outcome.ok) {
      await repo.markTopic(topic.id, 'failed', outcome.error);
      summary.failed.push({ topicId: topic.id, error: outcome.error });
      continue;
    }
    try {
      const taken = new Set(existing.map((e) => e.slug));
      let slug = outcome.draft.slug;
      if (taken.has(slug) || (await repo.slugExists(slug))) {
        // Check the database for each candidate, not just the in-memory list.
        slug = dedupeSlug(slug, (s) => taken.has(s));
        while (await repo.slugExists(slug)) {
          taken.add(slug);
          slug = dedupeSlug(outcome.draft.slug, (s) => taken.has(s));
        }
      }
      const inserted = await repo.insertDraft({
        ...outcome.draft,
        slug,
        audience: topic.audience,
        target_query: topic.target_query,
        topic_id: topic.id,
        generated_by: String(outcome.meta.model ?? 'unknown'),
        generation_meta: outcome.meta,
      });
      existing.push({ title: outcome.draft.title, slug: inserted.slug });
      await repo.markTopic(topic.id, 'generated', null);
      summary.drafted.push({ topicId: topic.id, articleId: inserted.id, slug: inserted.slug, warnings: outcome.warnings });
    } catch (e) {
      const error = `could not save the draft: ${e instanceof Error ? e.message : String(e)}`;
      await repo.markTopic(topic.id, 'failed', error);
      summary.failed.push({ topicId: topic.id, error });
    }
  }
  return summary;
}
