'use client';

import { useState, useEffect, useRef } from 'react';

type Action = 'accept' | 'decline' | 'reschedule';

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (action: Action, message?: string) => Promise<void> | void;
  companyName: string;
  listingTitle: string;
  scheduledAt: string;
  durationMinutes: number;
  notes?: string | null;
};

function formatWhen(iso: string, durationMinutes: number) {
  const start = new Date(iso);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const dateStr = start.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return { dateStr, range: `${startTime} – ${endTime}`, tz };
}

export default function InterviewResponseModal({
  open,
  onClose,
  onSubmit,
  companyName,
  listingTitle,
  scheduledAt,
  durationMinutes,
  notes,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [submitting, setSubmitting] = useState<Action | null>(null);
  const [error, setError] = useState('');
  const [rescheduleMessage, setRescheduleMessage] = useState('');
  const [showRescheduleField, setShowRescheduleField] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setError('');
    setShowRescheduleField(false);
    setRescheduleMessage(`Hi! I appreciate the invitation, but I'm not available at that time. Could we look at a different slot?`);
  }, [open]);

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
    } else {
      setAnimating(false);
      const t = setTimeout(() => setVisible(false), 240);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && submitting === null) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, submitting]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!visible) return null;

  const when = formatWhen(scheduledAt, durationMinutes);

  async function handleAction(action: Action) {
    if (action === 'reschedule' && !showRescheduleField) {
      setShowRescheduleField(true);
      return;
    }
    setError('');
    setSubmitting(action);
    try {
      await onSubmit(action, action === 'reschedule' ? rescheduleMessage.trim() : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(null);
    }
  }

  return (
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current && submitting === null) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: animating ? 'rgba(15, 23, 42, 0.45)' : 'rgba(15, 23, 42, 0)',
        backdropFilter: animating ? 'blur(4px)' : 'blur(0px)',
        WebkitBackdropFilter: animating ? 'blur(4px)' : 'blur(0px)',
        transition: 'background 0.24s cubic-bezier(0.16, 1, 0.3, 1), backdrop-filter 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 480, background: 'var(--surface)', borderRadius: 16,
          boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.15)',
          border: '1px solid var(--border, #e5e7eb)',
          transform: animating ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
          opacity: animating ? 1 : 0,
          transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '24px 28px 16px', borderBottom: '1px solid var(--border, #f3f4f6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, marginBottom: 2 }}>
                Interview Invitation
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                {companyName} · {listingTitle}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={submitting !== null}
              aria-label="Close"
              style={{
                background: 'none', border: 'none', padding: 4, cursor: 'pointer',
                color: 'var(--text-secondary)', borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{
            padding: '14px 16px', borderRadius: 10, background: 'var(--bg, #f8f9fc)',
            border: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                {when.dateStr}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {when.range} ({when.tz}) · {durationMinutes} min
              </div>
            </div>
          </div>

          {notes && (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--text)', fontWeight: 600 }}>From the employer:</strong>
              <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{notes}</div>
            </div>
          )}

          {showRescheduleField && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>
                Message to {companyName}
              </span>
              <textarea
                value={rescheduleMessage}
                onChange={e => setRescheduleMessage(e.target.value)}
                rows={3}
                style={{
                  padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
                  fontSize: '0.85rem', fontFamily: 'inherit', color: 'var(--text)', resize: 'vertical',
                }}
              />
            </label>
          )}

          {error && (
            <div style={{
              padding: '8px 12px', borderRadius: 8,
              background: 'var(--danger-bg)', color: 'var(--danger-fg)',
              fontSize: '0.78rem', border: '1px solid var(--danger-border)',
            }}>
              {error}
            </div>
          )}
        </div>

        <div style={{
          padding: '16px 28px 20px', display: 'flex', gap: 8,
          borderTop: '1px solid var(--border, #f3f4f6)',
        }}>
          <button
            onClick={() => handleAction('decline')}
            disabled={submitting !== null}
            style={{
              padding: '9px 14px', borderRadius: 8, border: '1px solid var(--danger-border)',
              background: 'var(--surface)', color: 'var(--danger-accent)', fontSize: '0.82rem', fontWeight: 600,
              cursor: submitting !== null ? 'not-allowed' : 'pointer', flex: 1,
            }}
          >
            {submitting === 'decline' ? 'Declining…' : 'Decline'}
          </button>
          <button
            onClick={() => handleAction('reschedule')}
            disabled={submitting !== null}
            style={{
              padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text)', fontSize: '0.82rem', fontWeight: 600,
              cursor: submitting !== null ? 'not-allowed' : 'pointer', flex: 1,
            }}
          >
            {showRescheduleField
              ? (submitting === 'reschedule' ? 'Sending…' : 'Send Request')
              : 'Request Reschedule'}
          </button>
          <button
            onClick={() => handleAction('accept')}
            disabled={submitting !== null}
            style={{
              padding: '9px 14px', borderRadius: 8, border: 'none',
              background: 'var(--accent, #9FC63C)', color: 'var(--on-accent)',
              fontSize: '0.82rem', fontWeight: 600,
              cursor: submitting !== null ? 'not-allowed' : 'pointer', flex: 1,
            }}
          >
            {submitting === 'accept' ? 'Accepting…' : 'Accept'}
          </button>
        </div>
      </div>
    </div>
  );
}
