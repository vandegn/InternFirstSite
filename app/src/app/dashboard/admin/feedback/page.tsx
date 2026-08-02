'use client';

import { useEffect, useState, useMemo } from 'react';
import { getFeedbackSubmissions, updateFeedbackStatus, type FeedbackSubmission } from '@/lib/supabase';

const CATEGORY_PILL: Record<string, { bg: string; color: string; label: string }> = {
  bug: { bg: 'var(--danger-bg)', color: 'var(--danger-fg)', label: 'Bug' },
  idea: { bg: 'var(--chip-indigo-bg)', color: 'var(--chip-indigo-ink)', label: 'Idea' },
  other: { bg: 'var(--chip-neutral-bg)', color: 'var(--chip-neutral-ink)', label: 'General' },
};

const STATUS_PILL: Record<string, { bg: string; color: string; label: string }> = {
  new: { bg: 'var(--chip-amber-bg)', color: 'var(--chip-amber-ink)', label: 'New' },
  reviewed: { bg: 'var(--chip-blue-bg)', color: 'var(--chip-blue-ink)', label: 'Reviewed' },
  resolved: { bg: 'var(--chip-green-bg)', color: 'var(--chip-green-ink)', label: 'Resolved' },
};

const FILTERS = [
  { value: 'open', label: 'Open' },
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'resolved', label: 'Resolved' },
] as const;

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

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<FeedbackSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('open');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getFeedbackSubmissions().then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, []);

  async function refresh() {
    setRefreshing(true);
    setItems(await getFeedbackSubmissions());
    setRefreshing(false);
  }

  async function setStatus(id: string, status: 'new' | 'reviewed' | 'resolved') {
    setBusyId(id);
    setError('');
    try {
      const updated = await updateFeedbackStatus(id, status);
      setItems((prev) => prev.map((f) => (f.id === id ? updated : f)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update that item.');
    } finally {
      setBusyId(null);
    }
  }

  const visible = useMemo(() => {
    if (filter === 'all') return items;
    // "Open" is the default working view: anything not yet closed out.
    if (filter === 'open') return items.filter((f) => f.status !== 'resolved');
    return items.filter((f) => f.status === filter);
  }, [items, filter]);

  const newCount = items.filter((f) => f.status === 'new').length;

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
          Feedback{' '}
          {newCount > 0 && (
            <span style={{
              fontSize: '0.8rem', fontWeight: 700, verticalAlign: 'middle',
              padding: '3px 10px', borderRadius: 999,
              background: 'var(--chip-amber-bg)', color: 'var(--chip-amber-ink)',
            }}>
              {newCount} new
            </span>
          )}
        </h2>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="btn-secondary"
          style={{ fontSize: '0.85rem', padding: '8px 16px', cursor: refreshing ? 'wait' : 'pointer' }}
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '20px' }}>
        Submitted from the Feedback button on the student and employer dashboards.
      </p>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              style={{
                padding: '6px 14px', borderRadius: 999, fontSize: '0.8rem',
                fontWeight: active ? 600 : 500, cursor: 'pointer',
                border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                background: active ? 'var(--primary-light)' : 'var(--surface)',
                color: active ? 'var(--primary)' : 'var(--text-secondary)',
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: '16px',
          background: 'var(--danger-bg)', color: 'var(--danger-fg)',
          border: '1px solid var(--danger-border)', fontSize: '0.85rem',
        }}>{error}</div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
      ) : visible.length === 0 ? (
        <div style={{
          padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)',
          border: '1px dashed var(--border)', borderRadius: 12,
        }}>
          <p style={{ fontSize: '1rem', fontWeight: 500 }}>
            {items.length === 0 ? 'No feedback yet' : 'Nothing in this view'}
          </p>
          <p style={{ fontSize: '0.85rem', marginTop: 6 }}>
            {items.length === 0
              ? 'Submissions from the Feedback button will appear here.'
              : 'Try a different filter.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {visible.map((f) => {
            const cat = CATEGORY_PILL[f.category] ?? CATEGORY_PILL.other;
            const st = STATUS_PILL[f.status] ?? STATUS_PILL.new;
            return (
              <div
                key={f.id}
                style={{
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${f.status === 'new' ? 'var(--chip-amber-ink)' : 'var(--border)'}`,
                  borderRadius: 12,
                  padding: '16px 18px',
                  background: 'var(--surface)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  <span style={{ padding: '2px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, background: cat.bg, color: cat.color }}>
                    {cat.label}
                  </span>
                  <span style={{ padding: '2px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, background: st.bg, color: st.color }}>
                    {st.label}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {f.submitter_name || f.submitter_email || 'Deleted account'}
                    {f.submitter_role && ` · ${f.submitter_role}`}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-light)' }}>
                    {relativeTime(f.created_at)}
                  </span>
                </div>

                <p style={{ fontSize: '0.92rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: '0 0 10px' }}>
                  {f.message}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {f.page_path && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontFamily: 'monospace' }}>
                      {f.page_path}
                    </span>
                  )}
                  {f.submitter_email && (
                    <a href={`mailto:${f.submitter_email}`} style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>
                      {f.submitter_email}
                    </a>
                  )}
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                    {f.status !== 'reviewed' && f.status !== 'resolved' && (
                      <button type="button" onClick={() => setStatus(f.id, 'reviewed')} disabled={busyId === f.id} style={actionBtn(false)}>
                        Mark reviewed
                      </button>
                    )}
                    {f.status !== 'resolved' ? (
                      <button type="button" onClick={() => setStatus(f.id, 'resolved')} disabled={busyId === f.id} style={actionBtn(true)}>
                        Resolve
                      </button>
                    ) : (
                      <button type="button" onClick={() => setStatus(f.id, 'new')} disabled={busyId === f.id} style={actionBtn(false)}>
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function actionBtn(primary: boolean): React.CSSProperties {
  return {
    padding: '5px 12px',
    fontSize: '0.78rem',
    fontWeight: 600,
    borderRadius: 6,
    cursor: 'pointer',
    border: `1px solid ${primary ? 'var(--primary)' : 'var(--border)'}`,
    background: primary ? 'var(--primary)' : 'var(--surface)',
    color: primary ? 'var(--on-primary)' : 'var(--text-secondary)',
  };
}
