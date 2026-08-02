'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

type Category = 'bug' | 'idea' | 'other';

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'bug', label: 'Something is broken' },
  { value: 'idea', label: 'I have an idea' },
  { value: 'other', label: 'General feedback' },
];

// Persistent floating trigger on every dashboard page. Submissions go to
// /api/feedback, which records them in feedback_submissions for review on the
// admin-only Feedback tab (/dashboard/admin/feedback).
export default function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>('bug');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !submitting) close(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, submitting]);

  function close() {
    setOpen(false);
    // Reset after the dialog is gone so the user doesn't watch it clear.
    setTimeout(() => {
      setMessage('');
      setCategory('bug');
      setSent(false);
      setError('');
    }, 200);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, message, pagePath: pathname }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Could not send your feedback.');
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your feedback.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        style={{
          position: 'fixed', right: 20, bottom: 20, zIndex: 900,
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', borderRadius: 999,
          background: 'var(--primary)', color: 'var(--on-primary)',
          border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
          boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Feedback
      </button>

      {open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget && !submitting) close(); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 950, padding: 24,
            background: 'rgba(15,23,42,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--radius)',
            width: '100%', maxWidth: 460, padding: 28,
            boxShadow: 'var(--shadow-lg)', maxHeight: '90vh', overflowY: 'auto',
          }}>
            {sent ? (
              <>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 8 }}>Thanks — got it</h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
                  Your feedback went straight to the InternFirst team. If we need more
                  detail, we&apos;ll reach out by email.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={close} className="btn-primary" style={{ padding: '9px 20px' }}>
                    Done
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Send feedback</h3>
                  <button
                    type="button"
                    onClick={close}
                    disabled={submitting}
                    aria-label="Close"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-secondary)', padding: 0 }}
                  >
                    ×
                  </button>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                  Goes directly to the InternFirst team.
                </p>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                  {CATEGORIES.map((c) => {
                    const active = category === c.value;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setCategory(c.value)}
                        style={{
                          padding: '6px 12px', borderRadius: 999, fontSize: '0.78rem',
                          fontWeight: active ? 600 : 500, cursor: 'pointer',
                          border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                          background: active ? 'var(--primary-light)' : 'var(--surface)',
                          color: active ? 'var(--primary)' : 'var(--text-secondary)',
                        }}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  autoFocus
                  maxLength={4000}
                  placeholder={
                    category === 'bug'
                      ? 'What were you doing, and what happened instead?'
                      : 'Tell us what would make InternFirst better…'
                  }
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)', fontSize: '0.88rem',
                    fontFamily: 'inherit', resize: 'vertical',
                    background: 'var(--surface)', color: 'var(--text)',
                  }}
                />
                <p style={{ fontSize: '0.72rem', color: 'var(--text-light)', margin: '6px 0 16px' }}>
                  We&apos;ll include the page you&apos;re on ({pathname}) so we can find it faster.
                </p>

                {error && (
                  <div style={{
                    padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: 14,
                    background: 'var(--danger-bg)', color: 'var(--danger-fg)',
                    border: '1px solid var(--danger-border)', fontSize: '0.8rem',
                  }}>
                    {error}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" onClick={close} disabled={submitting} className="btn-secondary" style={{ padding: '9px 18px' }}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !message.trim()}
                    className="btn-primary"
                    style={{
                      padding: '9px 20px',
                      opacity: submitting || !message.trim() ? 0.55 : 1,
                      cursor: submitting || !message.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {submitting ? 'Sending…' : 'Send feedback'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
