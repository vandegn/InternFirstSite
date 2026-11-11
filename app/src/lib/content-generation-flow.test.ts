import { describe, expect, it } from 'vitest';
import {
  buildSystemPrompt,
  buildTopicPrompt,
  runContentGeneration,
  type ArticleWriter,
  type ContentRepo,
  type DraftInsert,
} from './content-generation';
import { BRAND_FACTS } from './brand-facts';
import type { ContentTopic } from './content-articles';

const longBody = Array.from({ length: 140 }, (_, i) => `Paragraph sentence ${i} with practical advice.`).join(' ');

function topic(over: Partial<ContentTopic> = {}): ContentTopic {
  return {
    id: 't1',
    topic: 'How to find a summer internship as a sophomore',
    target_query: 'can a sophomore get an internship',
    audience: 'student',
    notes: null,
    status: 'queued',
    last_error: null,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    ...over,
  };
}

function goodJson(title = 'Can a Sophomore Get an Internship? Yes, Here Is How') {
  return JSON.stringify({
    title,
    slug: 'sophomore-internship',
    description: 'Yes. Start in September, lean on coursework and clubs, and apply in batches.',
    key_takeaways: ['Start in September', 'Coursework counts as experience', 'Apply in batches of ten'],
    body_markdown: `## Start in September\n\n${longBody}\n\n## Apply in batches\n\n${longBody}`,
    faq: [
      { question: 'Is sophomore year too early?', answer: 'No.' },
      { question: 'Do I need a resume?', answer: 'Yes, one page.' },
      { question: 'What if I have no experience?', answer: 'Use coursework and clubs.' },
    ],
    tags: ['sophomore', 'summer'],
  });
}

function memoryRepo(topics: ContentTopic[], existing: { title: string; slug: string }[] = []) {
  const state = { topics, articles: [...existing] as (DraftInsert & { id: string })[] | { title: string; slug: string }[], marks: [] as { id: string; status: string; error: string | null }[] };
  const articles: ({ id: string; title: string; slug: string } & Partial<DraftInsert>)[] = existing.map((e, i) => ({ id: `seed${i}`, ...e }));
  let seq = 0;
  const repo: ContentRepo = {
    async claimTopics({ limit, topicId }) {
      const picked = topicId ? state.topics.filter((t) => t.id === topicId) : state.topics.filter((t) => t.status === 'queued').slice(0, limit);
      for (const t of picked) t.status = 'generating';
      return picked;
    },
    async listExistingArticles() { return articles.map(({ title, slug }) => ({ title, slug })); },
    async slugExists(slug) { return articles.some((a) => a.slug === slug); },
    async insertDraft(row) {
      if (articles.some((a) => a.slug === row.slug)) throw new Error('duplicate key value violates unique constraint');
      const id = `a${++seq}`;
      articles.push({ id, ...row });
      return { id, slug: row.slug };
    },
    async markTopic(id, status, error) {
      const t = state.topics.find((x) => x.id === id)!;
      t.status = status; t.last_error = error;
      state.marks.push({ id, status, error });
    },
  };
  return { repo, articles, state };
}

const okWriter: ArticleWriter = async () => ({ text: goodJson(), model: 'claude-opus-5-5', stopReason: 'end_turn', usage: { output_tokens: 1200 } });

describe('prompt', () => {
  it('grounds the model in the brand facts and the topic', () => {
    const system = buildSystemPrompt();
    for (const fact of BRAND_FACTS) expect(system).toContain(fact);
    expect(system).toMatch(/Never invent a feature/);
    const prompt = buildTopicPrompt(topic({ notes: 'Mention the .edu rule.' }), [{ title: 'Existing guide' }], '2026-11-11');
    expect(prompt).toContain('can a sophomore get an internship');
    expect(prompt).toContain('college students in the United States');
    expect(prompt).toContain('Mention the .edu rule.');
    expect(prompt).toContain('- Existing guide');
    expect(prompt).toContain("Today's date: 2026-11-11");
  });
});

describe('runContentGeneration', () => {
  it('turns a queued topic into a draft and marks the topic generated', async () => {
    const { repo, articles, state } = memoryRepo([topic()]);
    const summary = await runContentGeneration(repo, okWriter, { now: new Date('2026-11-11T00:00:00Z') });
    expect(summary.claimed).toBe(1);
    expect(summary.failed).toEqual([]);
    expect(summary.drafted).toHaveLength(1);
    expect(summary.drafted[0].slug).toBe('sophomore-internship');
    const draft = articles[0];
    expect(draft.generated_by).toBe('claude-opus-5-5');
    expect(draft.topic_id).toBe('t1');
    expect(draft.audience).toBe('student');
    expect((draft.generation_meta as Record<string, unknown>).prompt_version).toBeTruthy();
    expect(state.topics[0].status).toBe('generated');
    expect(state.topics[0].last_error).toBeNull();
  });

  it('does nothing when the queue is empty', async () => {
    const { repo } = memoryRepo([topic({ status: 'generated' })]);
    const summary = await runContentGeneration(repo, okWriter);
    expect(summary).toEqual({ claimed: 0, drafted: [], failed: [] });
  });

  it('suffixes the slug when an article already owns it', async () => {
    const { repo } = memoryRepo([topic()], [{ title: 'Older guide', slug: 'sophomore-internship' }]);
    const summary = await runContentGeneration(repo, okWriter);
    expect(summary.drafted[0].slug).toBe('sophomore-internship-2');
  });

  it('records a failure on the topic when the model declines', async () => {
    const { repo, state } = memoryRepo([topic()]);
    const writer: ArticleWriter = async () => ({ text: '', model: 'm', stopReason: 'refusal' });
    const summary = await runContentGeneration(repo, writer);
    expect(summary.drafted).toEqual([]);
    expect(summary.failed[0].error).toMatch(/declined/);
    expect(state.topics[0].status).toBe('failed');
    expect(state.topics[0].last_error).toMatch(/declined/);
  });

  it('records a failure when the output is not a usable draft', async () => {
    const { repo, state } = memoryRepo([topic()]);
    const writer: ArticleWriter = async () => ({ text: '{"title": "x"}', model: 'm', stopReason: 'end_turn' });
    const summary = await runContentGeneration(repo, writer);
    expect(summary.failed[0].error).toMatch(/body_markdown is missing/);
    expect(state.topics[0].status).toBe('failed');
  });

  it('survives a thrown model error and keeps going with the next topic', async () => {
    const { repo, state } = memoryRepo([topic({ id: 't1' }), topic({ id: 't2', topic: 'Second topic' })]);
    let calls = 0;
    const writer: ArticleWriter = async () => {
      calls++;
      if (calls === 1) throw new Error('rate limited');
      return { text: goodJson('Second Guide'), model: 'm', stopReason: 'end_turn' };
    };
    const summary = await runContentGeneration(repo, writer, { limit: 2 });
    expect(summary.failed).toHaveLength(1);
    expect(summary.failed[0].error).toMatch(/rate limited/);
    expect(summary.drafted).toHaveLength(1);
    expect(state.topics.map((t) => t.status)).toEqual(['failed', 'generated']);
  });

  it('can re-run one specific topic regardless of its status', async () => {
    const { repo, state } = memoryRepo([topic({ status: 'failed', last_error: 'old' })]);
    const summary = await runContentGeneration(repo, okWriter, { topicId: 't1' });
    expect(summary.drafted).toHaveLength(1);
    expect(state.topics[0].status).toBe('generated');
  });

  it('accepts a fenced JSON response', async () => {
    const { repo } = memoryRepo([topic()]);
    const writer: ArticleWriter = async () => ({ text: '```json\n' + goodJson() + '\n```', model: 'm', stopReason: 'end_turn' });
    const summary = await runContentGeneration(repo, writer);
    expect(summary.drafted).toHaveLength(1);
  });
});
