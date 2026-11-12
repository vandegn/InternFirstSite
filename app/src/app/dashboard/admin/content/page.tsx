'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  addContentTopic,
  deleteContentTopic,
  getContentArticles,
  getContentTopics,
  setContentTopicStatus,
  type ContentArticle,
  type ContentTopic,
} from '@/lib/supabase';
import type { ArticleStatus, ContentAudience, FaqItem } from '@/lib/content-articles';

// The editorial desk for the GEO content engine (docs/geo-seo.md):
//   1. queue topics  →  2. the agent drafts them  →  3. an admin reads, edits
//   and publishes. Nothing generated goes live without step 3.

const AUDIENCES: { value: ContentAudience; label: string }[] = [
  { value: 'student', label: 'Students' },
  { value: 'employer', label: 'Employers' },
  { value: 'both', label: 'Both' },
];

const TOPIC_PILL: Record<ContentTopic['status'], { bg: string; color: string; label: string }> = {
  queued: { bg: 'var(--chip-amber-bg)', color: 'var(--chip-amber-ink)', label: 'Queued' },
  generating: { bg: 'var(--chip-blue-bg)', color: 'var(--chip-blue-ink)', label: 'Generating' },
  generated: { bg: 'var(--chip-green-bg)', color: 'var(--chip-green-ink)', label: 'Drafted' },
  failed: { bg: 'var(--danger-bg)', color: 'var(--danger-fg)', label: 'Failed' },
  skipped: { bg: 'var(--chip-neutral-bg)', color: 'var(--chip-neutral-ink)', label: 'Skipped' },
};

const ARTICLE_PILL: Record<ArticleStatus, { bg: string; color: string; label: string }> = {
  draft: { bg: 'var(--chip-amber-bg)', color: 'var(--chip-amber-ink)', label: 'Draft' },
  published: { bg: 'var(--chip-green-bg)', color: 'var(--chip-green-ink)', label: 'Published' },
  archived: { bg: 'var(--chip-neutral-bg)', color: 'var(--chip-neutral-ink)', label: 'Archived' },
};

function Pill({ bg, color, label }: { bg: string; color: string; label: string }) {
  return (
    <span style={{ background: bg, color, padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

async function patchArticle(id: string, patch: Record<string, unknown>): Promise<ContentArticle> {
  const res = await fetch(`/api/content/articles/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const json = (await res.json().catch(() => ({}))) as { article?: ContentArticle; error?: string };
  if (!res.ok || !json.article) throw new Error(json.error ?? `Save failed (${res.status})`);
  return json.article;
}

type RunResult = { claimed: number; drafted: { slug: string; warnings: string[] }[]; failed: { error: string }[] };

async function runGenerator(body: { limit?: number; topicId?: string }): Promise<RunResult> {
  const res = await fetch('/api/content/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as RunResult & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Generation failed (${res.status})`);
  return json;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--surface)',
  color: 'var(--dark)',
  fontSize: 14,
  fontFamily: 'inherit',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: 20,
};

export default function AdminContentPage() {
  const [topics, setTopics] = useState<ContentTopic[]>([]);
  const [articles, setArticles] = useState<ContentArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [form, setForm] = useState({ topic: '', target_query: '', audience: 'student' as ContentAudience, notes: '' });
  const [articleFilter, setArticleFilter] = useState<'all' | ArticleStatus>('draft');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [t, a] = await Promise.all([getContentTopics(), getContentArticles()]);
    setTopics(t);
    setArticles(a);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // A run can take a few minutes; poll while any topic is generating so the
  // draft shows up without a manual refresh.
  const generating = topics.some((t) => t.status === 'generating');
  useEffect(() => {
    if (!generating) return;
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [generating, load]);

  function say(kind: 'ok' | 'error', text: string) {
    setNotice({ kind, text });
  }

  async function submitTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!form.topic.trim()) return;
    setBusy('add-topic');
    try {
      const created = await addContentTopic(form);
      setTopics((prev) => [created, ...prev]);
      setForm({ topic: '', target_query: '', audience: form.audience, notes: '' });
      say('ok', 'Topic queued.');
    } catch (err) {
      say('error', err instanceof Error ? err.message : 'Could not add that topic.');
    } finally {
      setBusy(null);
    }
  }

  async function generate(body: { limit?: number; topicId?: string }, key: string) {
    setBusy(key);
    setNotice(null);
    if (body.topicId) setTopics((prev) => prev.map((t) => (t.id === body.topicId ? { ...t, status: 'generating', last_error: null } : t)));
    try {
      const result = await runGenerator(body);
      const warn = result.drafted.flatMap((d) => d.warnings.map((w) => `${d.slug}: ${w}`));
      if (result.claimed === 0) say('ok', 'Nothing queued.');
      else if (result.failed.length > 0) say('error', `${result.drafted.length} drafted, ${result.failed.length} failed: ${result.failed.map((f) => f.error).join(' · ')}`);
      else say('ok', `${result.drafted.length} draft${result.drafted.length === 1 ? '' : 's'} ready for review.${warn.length ? ` Notes: ${warn.join(' · ')}` : ''}`);
      if (result.drafted.length > 0) setArticleFilter('draft');
    } catch (err) {
      say('error', err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setBusy(null);
      await load();
    }
  }

  async function topicAction(id: string, action: 'requeue' | 'skip' | 'delete') {
    setBusy(`topic-${id}`);
    try {
      if (action === 'delete') {
        await deleteContentTopic(id);
        setTopics((prev) => prev.filter((t) => t.id !== id));
      } else {
        await setContentTopicStatus(id, action === 'requeue' ? 'queued' : 'skipped');
        setTopics((prev) => prev.map((t) => (t.id === id ? { ...t, status: action === 'requeue' ? 'queued' : 'skipped', last_error: null } : t)));
      }
    } catch (err) {
      say('error', err instanceof Error ? err.message : 'Could not update that topic.');
    } finally {
      setBusy(null);
    }
  }

  const visibleArticles = useMemo(
    () => (articleFilter === 'all' ? articles : articles.filter((a) => a.status === articleFilter)),
    [articles, articleFilter],
  );
  const queuedCount = topics.filter((t) => t.status === 'queued').length;
  const draftCount = articles.filter((a) => a.status === 'draft').length;

  function onSaved(updated: ContentArticle, message: string) {
    setArticles((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    say('ok', message);
  }

  return (
    <div className="dash-main" style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Content (GEO)</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4, maxWidth: 640 }}>
            Queue a topic, let the agent draft it, then read and publish. Published guides go live at /blog, in the
            sitemap and in /llms.txt. Nothing is published automatically.
          </p>
        </div>
        <button
          className="btn-primary"
          disabled={busy !== null || queuedCount === 0}
          onClick={() => generate({ limit: Math.min(queuedCount, 3) }, 'run-queue')}
        >
          {busy === 'run-queue' ? 'Drafting…' : `Draft next ${Math.min(queuedCount, 3) || ''} queued`}
        </button>
      </div>

      {notice && (
        <div
          role="status"
          style={{
            margin: '12px 0 20px',
            padding: '10px 14px',
            borderRadius: 10,
            background: notice.kind === 'ok' ? 'var(--chip-green-bg)' : 'var(--danger-bg)',
            color: notice.kind === 'ok' ? 'var(--chip-green-ink)' : 'var(--danger-fg)',
            fontSize: 14,
          }}
        >
          {notice.text}
        </div>
      )}

      {/* ---------------- Topics ---------------- */}
      <section style={{ ...cardStyle, marginTop: 16 }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12 }}>Topic queue</h3>
        <form onSubmit={submitTopic} style={{ display: 'grid', gap: 10, gridTemplateColumns: '2fr 2fr 1fr auto', alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
            Topic
            <input style={inputStyle} required value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="How to find a summer internship as a sophomore" />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
            Question people search
            <input style={inputStyle} value={form.target_query} onChange={(e) => setForm({ ...form, target_query: e.target.value })} placeholder="can a sophomore get an internship" />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
            Audience
            <select style={inputStyle} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as ContentAudience })}>
              {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </label>
          <button className="btn-primary" type="submit" disabled={busy === 'add-topic'}>Add</button>
          <label style={{ gridColumn: '1 / -1', display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
            Notes for the writer (optional)
            <input style={inputStyle} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Angle, things to include or avoid" />
          </label>
        </form>

        {loading ? (
          <p style={{ color: 'var(--text-light)', marginTop: 16 }}>Loading…</p>
        ) : topics.length === 0 ? (
          <p style={{ color: 'var(--text-light)', marginTop: 16 }}>No topics yet. Add the questions you want InternFirst to be the answer to.</p>
        ) : (
          <ul style={{ listStyle: 'none', marginTop: 16, display: 'grid', gap: 8 }}>
            {topics.map((t) => (
              <li key={t.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, flexWrap: 'wrap' }}>
                <Pill {...TOPIC_PILL[t.status]} />
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ fontWeight: 600 }}>{t.topic}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
                    {AUDIENCES.find((a) => a.value === t.audience)?.label}
                    {t.target_query ? ` · “${t.target_query}”` : ''} · {relativeTime(t.created_at)}
                  </div>
                  {t.last_error && <div style={{ fontSize: 12, color: 'var(--danger-fg)', marginTop: 4 }}>{t.last_error}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(t.status === 'queued' || t.status === 'failed') && (
                    <button className="btn-secondary" disabled={busy !== null} onClick={() => generate({ topicId: t.id }, `gen-${t.id}`)}>
                      {busy === `gen-${t.id}` ? 'Drafting…' : t.status === 'failed' ? 'Retry' : 'Draft now'}
                    </button>
                  )}
                  {(t.status === 'skipped' || t.status === 'generated') && (
                    <button className="btn-secondary" disabled={busy !== null} onClick={() => topicAction(t.id, 'requeue')}>Re-queue</button>
                  )}
                  {t.status === 'queued' && (
                    <button className="btn-secondary" disabled={busy !== null} onClick={() => topicAction(t.id, 'skip')}>Skip</button>
                  )}
                  {t.status !== 'generating' && (
                    <button className="btn-secondary" disabled={busy !== null} onClick={() => topicAction(t.id, 'delete')} aria-label={`Delete topic ${t.topic}`}>Delete</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------- Articles ---------------- */}
      <section style={{ ...cardStyle, marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
            Articles {draftCount > 0 && <span style={{ fontSize: 13, color: 'var(--text-light)', fontWeight: 500 }}>· {draftCount} awaiting review</span>}
          </h3>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['draft', 'published', 'archived', 'all'] as const).map((f) => (
              <button
                key={f}
                className={articleFilter === f ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '6px 12px', fontSize: 13 }}
                onClick={() => setArticleFilter(f)}
              >
                {f === 'all' ? 'All' : ARTICLE_PILL[f].label}
              </button>
            ))}
          </div>
        </div>

        {visibleArticles.length === 0 ? (
          <p style={{ color: 'var(--text-light)' }}>Nothing here.</p>
        ) : (
          <ul style={{ listStyle: 'none', display: 'grid', gap: 8 }}>
            {visibleArticles.map((a) => (
              <li key={a.id} style={{ border: '1px solid var(--border)', borderRadius: 10 }}>
                <button
                  onClick={() => setOpenId(openId === a.id ? null : a.id)}
                  aria-expanded={openId === a.id}
                  style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit' }}
                >
                  <Pill {...ARTICLE_PILL[a.status]} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{a.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
                      /blog/{a.slug} · {AUDIENCES.find((x) => x.value === a.audience)?.label} · {a.generated_by ?? 'manual'} · updated {relativeTime(a.updated_at)}
                    </div>
                  </div>
                  <span aria-hidden="true" style={{ color: 'var(--text-light)' }}>{openId === a.id ? '▾' : '▸'}</span>
                </button>
                {openId === a.id && <ArticleEditor article={a} busy={busy} setBusy={setBusy} onSaved={onSaved} onError={(m) => say('error', m)} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ArticleEditor({
  article,
  busy,
  setBusy,
  onSaved,
  onError,
}: {
  article: ContentArticle;
  busy: string | null;
  setBusy: (b: string | null) => void;
  onSaved: (a: ContentArticle, message: string) => void;
  onError: (m: string) => void;
}) {
  const [draft, setDraft] = useState(() => ({
    title: article.title,
    slug: article.slug,
    description: article.description,
    body_markdown: article.body_markdown,
    key_takeaways: article.key_takeaways.join('\n'),
    faq: article.faq.length > 0 ? article.faq : [{ question: '', answer: '' }],
    tags: article.tags.join(', '),
    audience: article.audience,
  }));
  const [preview, setPreview] = useState(false);
  const warnings = (article.generation_meta?.warnings as string[] | undefined) ?? [];

  function toPatch() {
    return {
      title: draft.title,
      slug: draft.slug,
      description: draft.description,
      body_markdown: draft.body_markdown,
      key_takeaways: draft.key_takeaways.split('\n').map((s) => s.trim()).filter(Boolean),
      faq: draft.faq.filter((f) => f.question.trim() && f.answer.trim()),
      tags: draft.tags.split(',').map((s) => s.trim()).filter(Boolean),
      audience: draft.audience,
    };
  }

  async function save(status?: ArticleStatus) {
    const key = `save-${article.id}`;
    setBusy(key);
    try {
      const updated = await patchArticle(article.id, { ...toPatch(), ...(status ? { status } : {}) });
      onSaved(
        updated,
        status === 'published' ? `Published at /blog/${updated.slug}.` : status === 'draft' ? 'Unpublished.' : status === 'archived' ? 'Archived.' : 'Saved.',
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setBusy(null);
    }
  }

  const disabled = busy !== null;
  const field = (label: string, el: React.ReactNode) => (
    <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
      {label}
      {el}
    </label>
  );

  return (
    <div style={{ padding: '4px 12px 16px', display: 'grid', gap: 12, borderTop: '1px solid var(--border)' }}>
      {warnings.length > 0 && (
        <div style={{ fontSize: 13, color: 'var(--chip-amber-ink)', background: 'var(--chip-amber-bg)', padding: '8px 12px', borderRadius: 8 }}>
          Generator notes: {warnings.join(' · ')}
        </div>
      )}
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '2fr 1fr' }}>
        {field('Title', <input style={inputStyle} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />)}
        {field('Slug', <input style={inputStyle} value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />)}
      </div>
      {field('Description (the direct answer; also the meta description)', <textarea style={{ ...inputStyle, minHeight: 60 }} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />)}
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr 1fr' }}>
        {field('Key takeaways (one per line)', <textarea style={{ ...inputStyle, minHeight: 90 }} value={draft.key_takeaways} onChange={(e) => setDraft({ ...draft, key_takeaways: e.target.value })} />)}
        <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
          {field('Tags (comma separated)', <input style={inputStyle} value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} />)}
          {field('Audience', (
            <select style={inputStyle} value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value as ContentAudience })}>
              {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          ))}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Body (Markdown)</span>
          <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setPreview(!preview)}>
            {preview ? 'Edit' : 'Preview'}
          </button>
        </div>
        {preview ? (
          <div className="markdown-content guide-body" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, maxHeight: 520, overflow: 'auto' }}>
            <ReactMarkdown>{draft.body_markdown}</ReactMarkdown>
          </div>
        ) : (
          <textarea style={{ ...inputStyle, minHeight: 360, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 }} value={draft.body_markdown} onChange={(e) => setDraft({ ...draft, body_markdown: e.target.value })} />
        )}
      </div>

      <div>
        <span style={{ fontSize: 13, fontWeight: 600 }}>FAQ</span>
        <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
          {draft.faq.map((item: FaqItem, i: number) => (
            <div key={i} style={{ display: 'grid', gap: 6, gridTemplateColumns: '1fr 2fr auto' }}>
              <input style={inputStyle} placeholder="Question" value={item.question} onChange={(e) => setDraft({ ...draft, faq: draft.faq.map((f, j) => (j === i ? { ...f, question: e.target.value } : f)) })} />
              <input style={inputStyle} placeholder="Answer" value={item.answer} onChange={(e) => setDraft({ ...draft, faq: draft.faq.map((f, j) => (j === i ? { ...f, answer: e.target.value } : f)) })} />
              <button className="btn-secondary" aria-label="Remove question" onClick={() => setDraft({ ...draft, faq: draft.faq.filter((_, j) => j !== i) })}>×</button>
            </div>
          ))}
          <button className="btn-secondary" style={{ justifySelf: 'start', padding: '4px 10px', fontSize: 12 }} onClick={() => setDraft({ ...draft, faq: [...draft.faq, { question: '', answer: '' }] })}>
            + Add question
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn-secondary" disabled={disabled} onClick={() => save()}>Save</button>
        {article.status !== 'published' && (
          <button className="btn-primary" disabled={disabled} onClick={() => save('published')}>Save &amp; publish</button>
        )}
        {article.status === 'published' && (
          <>
            <a href={`/blog/${article.slug}`} target="_blank" rel="noreferrer" className="btn-secondary">View live</a>
            <button className="btn-secondary" disabled={disabled} onClick={() => save('draft')}>Unpublish</button>
          </>
        )}
        {article.status !== 'archived' && (
          <button className="btn-secondary" disabled={disabled} onClick={() => save('archived')}>Archive</button>
        )}
        {article.status === 'archived' && (
          <button className="btn-secondary" disabled={disabled} onClick={() => save('draft')}>Restore to draft</button>
        )}
      </div>
    </div>
  );
}
