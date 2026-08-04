'use client';

import { useState, useEffect, useRef } from 'react';
import {
  validateWindow,
  localToday,
  countDays,
  formatWindowLabel,
  MAX_WINDOW_DAYS,
  DURATION_OPTIONS,
  DEFAULT_DURATION_MINUTES,
} from '@/lib/interview-availability';

export type RequestTimesFormData = {
  windowStart: string;
  windowEnd: string;
  durationMinutes: number;
  note: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: RequestTimesFormData) => Promise<void> | void;
  candidateName?: string;
  listingTitle?: string;
};

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d));
  next.setUTCDate(next.getUTCDate() + days);
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

// Step 1 of the interview handshake: the employer bounds the window, the
// candidate fills in the detail. Deliberately dates-only — picking exact times
// here is what the old Schedule Interview flow does, and it's the thing this
// flow exists to replace.
export default function RequestTimesModal({
  open,
  onClose,
  onSubmit,
  candidateName,
  listingTitle,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const backdropRef = useRef<HTMLDivElement>(null);

  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [duration, setDuration] = useState(DEFAULT_DURATION_MINUTES);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    // Default to "sometime next week", the overwhelmingly common ask.
    const start = addDays(localToday(), 1);
    setWindowStart(start);
    setWindowEnd(addDays(start, 6));
    setDuration(DEFAULT_DURATION_MINUTES);
    setNote('');
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
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !submitting) onClose(); };
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

  const check = windowStart && windowEnd
    ? validateWindow(windowStart, windowEnd, localToday())
    : null;
  const dayCount = windowStart && windowEnd ? countDays(windowStart, windowEnd) : 0;
  const canSubmit = Boolean(check?.ok) && !submitting;

  async function handleSubmit() {
    setError('');
    const result = validateWindow(windowStart, windowEnd, localToday());
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ windowStart, windowEnd, durationMinutes: duration, note: note.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  // Keep the end date from being draggable behind the start date in the picker
  // itself, so the inline error is a backstop rather than the primary guard.
  const minEnd = windowStart || localToday();
  const maxEnd = windowStart ? addDays(windowStart, MAX_WINDOW_DAYS - 1) : undefined;

  return (
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current && !submitting) onClose(); }}
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
        role="dialog"
        aria-modal="true"
        aria-label="Request interview times"
        style={{
          width: '100%', maxWidth: 480, background: 'var(--surface)', borderRadius: 16,
          boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.15)',
          border: '1px solid var(--border, #e5e7eb)',
          transform: animating ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
          opacity: animating ? 1 : 0,
          transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
          // Cap the height so a short window can't push the actions below the
          // fold, where `overflow: hidden` would clip them unreachable. Header
          // and footer stay put; the form between them scrolls.
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ padding: '24px 28px 16px', borderBottom: '1px solid var(--border, #f3f4f6)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, marginBottom: 2 }}>
                Request Interview Times
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                {candidateName && listingTitle
                  ? `${candidateName} · ${listingTitle}`
                  : candidateName || listingTitle || 'Ask the candidate when they’re free'}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={submitting}
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

        {/* Form */}
        <div style={{ padding: '20px 28px 8px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            Pick the window you’re interviewing in. We’ll message the candidate
            so they can mark the days and times that work for them, then you
            choose the final slot.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>Start date</span>
              <input
                type="date"
                aria-label="Start date"
                value={windowStart}
                min={localToday()}
                onChange={e => {
                  const next = e.target.value;
                  setWindowStart(next);
                  // Dragging the start past the end should carry the end along
                  // rather than leaving an invalid range on screen.
                  if (next && windowEnd && windowEnd < next) setWindowEnd(next);
                }}
                style={{
                  padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
                  fontSize: '0.85rem', fontFamily: 'inherit', color: 'var(--text)',
                }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>End date</span>
              <input
                type="date"
                aria-label="End date"
                value={windowEnd}
                min={minEnd}
                max={maxEnd}
                onChange={e => setWindowEnd(e.target.value)}
                style={{
                  padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
                  fontSize: '0.85rem', fontFamily: 'inherit', color: 'var(--text)',
                }}
              />
            </label>
          </div>

          {check?.ok && (
            <div style={{
              padding: '8px 12px', borderRadius: 8,
              background: 'var(--chip-blue-bg)', color: 'var(--chip-blue-ink)',
              fontSize: '0.75rem', fontWeight: 600,
            }}>
              {formatWindowLabel(windowStart, windowEnd)} · {dayCount} day{dayCount === 1 ? '' : 's'}
            </div>
          )}

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>Interview length</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {DURATION_OPTIONS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  aria-pressed={duration === d}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8,
                    border: `1px solid ${duration === d ? 'var(--primary)' : 'var(--border)'}`,
                    background: duration === d ? 'var(--primary)' : 'var(--surface)',
                    color: duration === d ? 'var(--on-primary)' : 'var(--text)',
                    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {d} min
                </button>
              ))}
            </div>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>Note for the candidate (optional)</span>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Who they’ll meet with, what to prepare, etc."
              rows={3}
              style={{
                padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
                fontSize: '0.85rem', fontFamily: 'inherit', color: 'var(--text)', resize: 'vertical',
              }}
            />
          </label>

          {(error || (check && !check.ok)) && (
            <div role="alert" style={{
              padding: '8px 12px', borderRadius: 8,
              background: 'var(--danger-bg)', color: 'var(--danger-fg)',
              fontSize: '0.78rem', border: '1px solid var(--danger-border)',
            }}>
              {error || (check && !check.ok ? check.error : '')}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 28px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8,
          borderTop: '1px solid var(--border, #f3f4f6)', marginTop: 8, flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text)', fontSize: '0.82rem', fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: canSubmit ? 'var(--primary)' : 'var(--border)',
              color: 'var(--on-primary)', fontSize: '0.82rem', fontWeight: 600,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? 'Sending…' : 'Send Request'}
          </button>
        </div>
      </div>
    </div>
  );
}
