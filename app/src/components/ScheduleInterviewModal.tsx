'use client';

import { useState, useEffect, useRef } from 'react';

const DURATION_OPTIONS = [15, 30, 45, 60];

export type ScheduleInterviewFormData = {
  scheduledAt: string; // ISO string in UTC
  durationMinutes: number;
  notes: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ScheduleInterviewFormData) => Promise<void> | void;
  candidateName?: string;
  listingTitle?: string;
  mode?: 'create' | 'reschedule';
  initialData?: { scheduledAt: string; durationMinutes: number; notes: string } | null;
};

function toLocalInputValue(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mn = String(d.getMinutes()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mn}` };
}

export default function ScheduleInterviewModal({
  open,
  onClose,
  onSubmit,
  candidateName,
  listingTitle,
  mode = 'create',
  initialData,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const backdropRef = useRef<HTMLDivElement>(null);

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (initialData) {
      const { date: d, time: t } = toLocalInputValue(initialData.scheduledAt);
      setDate(d);
      setTime(t);
      setDuration(initialData.durationMinutes);
      setNotes(initialData.notes);
    } else {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      const { date: d, time: t } = toLocalInputValue(tomorrow.toISOString());
      setDate(d);
      setTime(t);
      setDuration(30);
      setNotes('');
    }
  }, [open, initialData]);

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

  const canSubmit = date.length > 0 && time.length > 0 && duration > 0 && !submitting;

  async function handleSubmit() {
    setError('');
    const localDate = new Date(`${date}T${time}:00`);
    if (isNaN(localDate.getTime())) {
      setError('Invalid date or time');
      return;
    }
    if (localDate.getTime() < Date.now() + 5 * 60 * 1000) {
      setError('Pick a time at least 5 minutes from now');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        scheduledAt: localDate.toISOString(),
        durationMinutes: duration,
        notes: notes.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  const tzLabel = Intl.DateTimeFormat().resolvedOptions().timeZone;

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
                {mode === 'reschedule' ? 'Reschedule Interview' : 'Schedule Interview'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                {candidateName && listingTitle
                  ? `${candidateName} · ${listingTitle}`
                  : candidateName || listingTitle || 'Propose a time for the interview'}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>Date</span>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={{
                  padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
                  fontSize: '0.85rem', fontFamily: 'inherit', color: 'var(--text)',
                }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>Time</span>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                style={{
                  padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
                  fontSize: '0.85rem', fontFamily: 'inherit', color: 'var(--text)',
                }}
              />
            </label>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>Duration</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {DURATION_OPTIONS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
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
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>Notes for the candidate (optional)</span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Anything to prepare, who they'll meet with, etc."
              rows={3}
              style={{
                padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
                fontSize: '0.85rem', fontFamily: 'inherit', color: 'var(--text)', resize: 'vertical',
              }}
            />
          </label>

          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            Times shown in your local time zone ({tzLabel}).
          </div>

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
            {submitting ? 'Saving…' : mode === 'reschedule' ? 'Send New Time' : 'Send Interview Invite'}
          </button>
        </div>
      </div>
    </div>
  );
}
