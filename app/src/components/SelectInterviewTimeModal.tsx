'use client';

import { useState, useEffect, useRef } from 'react';
import ModalPortal from '@/components/ModalPortal';
import {
  groupSlotsByDay,
  enumerateStartTimes,
  formatDayLabel,
  formatTime,
  formatWindowLabel,
  validateConfirmedTime,
  type AvailabilityRequest,
} from '@/lib/interview-availability';

type Props = {
  open: boolean;
  onClose: () => void;
  request: AvailabilityRequest | null;
  candidateName?: string;
  listingTitle?: string;
  onConfirm: (data: { scheduledAt: string; durationMinutes: number; notes: string }) => Promise<void> | void;
  /** None of the offered times work — withdraw so a new window can be asked for. */
  onRequestNewWindow: () => Promise<void> | void;
};

// Step 3 of the interview handshake: the employer sees exactly what the
// candidate offered and picks one time out of it. Every button here is
// generated from the student's own frames, so an out-of-bounds pick isn't
// reachable through the UI — validateConfirmedTime is the backstop.
export default function SelectInterviewTimeModal({
  open,
  onClose,
  request,
  candidateName,
  listingTitle,
  onConfirm,
  onRequestNewWindow,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<string>('');
  const [notes, setNotes] = useState('');
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setError('');
    setPicked('');
    setNotes('');
  }, [open, request?.id]);

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

  if (!visible || !request) return null;

  const duration = request.duration_minutes;
  const slots = request.slots ?? [];
  const byDay = groupSlotsByDay(slots);
  const hasSlots = slots.length > 0;

  async function handleConfirm() {
    setError('');
    const check = validateConfirmedTime(picked, duration, slots);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm({ scheduledAt: picked, durationMinutes: duration, notes: notes.trim() });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNewWindow() {
    setError('');
    setSubmitting(true);
    try {
      await onRequestNewWindow();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalPortal>
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
        aria-label="Pick an interview time"
        style={{
          width: '100%', maxWidth: 520, maxHeight: '86vh', background: 'var(--surface)', borderRadius: 16,
          boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.15)',
          border: '1px solid var(--border, #e5e7eb)',
          transform: animating ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
          opacity: animating ? 1 : 0,
          transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '24px 28px 16px', borderBottom: '1px solid var(--border, #f3f4f6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, marginBottom: 2 }}>
                Pick an Interview Time
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                {candidateName && listingTitle
                  ? `${candidateName} · ${listingTitle}`
                  : candidateName || listingTitle || 'Choose from the candidate’s availability'}
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

        {/* Body */}
        <div style={{ padding: '18px 28px 8px', overflowY: 'auto', flex: 1 }}>
          {request.student_note && (
            <p style={{
              fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5,
              margin: '0 0 14px', padding: '8px 10px', borderRadius: 8,
              background: 'var(--bg-light)', borderLeft: '3px solid var(--primary)',
            }}>
              <strong style={{ color: 'var(--text)' }}>From the candidate:</strong> {request.student_note}
            </p>
          )}

          {/* The student said nothing in the window worked — there is nothing
              to pick, so the only move offered is asking for a new window. */}
          {!hasSlots ? (
            <div style={{
              padding: '14px 16px', borderRadius: 10,
              background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
              marginBottom: 12,
            }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--danger-fg)', margin: '0 0 4px' }}>
                No availability in this window
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--danger-fg)', margin: 0, lineHeight: 1.5 }}>
                {candidateName ?? 'The candidate'} couldn’t make any time between{' '}
                {formatWindowLabel(request.window_start, request.window_end)}. Withdraw
                this request and propose different dates.
              </p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.5 }}>
                {candidateName ?? 'The candidate'} is free at these times. Pick one
                {request.student_timezone ? ` — their time zone is ${request.student_timezone}` : ''}.
                Times below are shown in yours.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {byDay.map(({ day, slots: daySlots }) => (
                  <div key={day} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
                    <p style={{ fontSize: '0.78rem', fontWeight: 700, margin: '0 0 8px' }}>
                      {formatDayLabel(day)}
                    </p>
                    {daySlots.map(slot => {
                      const starts = enumerateStartTimes(slot, duration);
                      return (
                        <div key={slot.starts_at} style={{ marginBottom: 8 }}>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-light)', margin: '0 0 5px' }}>
                            Offered {formatTime(slot.starts_at)} – {formatTime(slot.ends_at)}
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {starts.map(iso => {
                              const active = picked === iso;
                              return (
                                <button
                                  key={iso}
                                  type="button"
                                  aria-pressed={active}
                                  onClick={() => { setPicked(iso); setError(''); }}
                                  style={{
                                    fontSize: '0.72rem', fontWeight: 600, padding: '5px 10px',
                                    borderRadius: 999, cursor: 'pointer',
                                    border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                                    background: active ? 'var(--primary)' : 'var(--surface)',
                                    color: active ? 'var(--on-primary)' : 'var(--text-secondary)',
                                    transition: 'all 0.15s',
                                  }}
                                >
                                  {formatTime(iso)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>
                  Notes for the candidate (optional)
                </span>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Anything to prepare, who they’ll meet with, etc."
                  rows={2}
                  style={{
                    padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)',
                    fontSize: '0.82rem', fontFamily: 'inherit', color: 'var(--text)', resize: 'vertical',
                  }}
                />
              </label>
            </>
          )}

          {error && (
            <div role="alert" style={{
              padding: '8px 12px', borderRadius: 8, marginTop: 12,
              background: 'var(--danger-bg)', color: 'var(--danger-fg)',
              fontSize: '0.78rem', border: '1px solid var(--danger-border)',
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 28px 20px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', gap: 8, borderTop: '1px solid var(--border, #f3f4f6)',
        }}>
          <button
            onClick={handleNewWindow}
            disabled={submitting}
            style={{
              padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text-secondary)',
              fontSize: '0.78rem', fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {hasSlots ? 'None work — ask again' : 'Request a new window'}
          </button>
          {hasSlots && (
            <button
              onClick={handleConfirm}
              disabled={submitting || !picked}
              style={{
                padding: '8px 18px', borderRadius: 8, border: 'none',
                background: submitting || !picked ? 'var(--border)' : 'var(--primary)',
                color: 'var(--on-primary)', fontSize: '0.82rem', fontWeight: 600,
                cursor: submitting || !picked ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Scheduling…' : 'Confirm Interview'}
            </button>
          )}
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
