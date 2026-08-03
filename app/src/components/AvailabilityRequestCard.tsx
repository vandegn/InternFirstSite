'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getAvailabilityRequest,
  submitStudentAvailability,
} from '@/lib/supabase';
import {
  enumerateDays,
  groupSlotsByDay,
  buildSlot,
  formatDayLabel,
  formatWindowLabel,
  formatTime,
  validateSlots,
  TIME_PRESETS,
  STUDENT_STATUS_LABELS,
  STATUS_CHIP,
  type AvailabilityRequest,
  type AvailabilitySlot,
  type AvailabilityStatus,
} from '@/lib/interview-availability';

type LoadedRequest = AvailabilityRequest & {
  listing?: { id: string; title: string } | null;
  employer?: { id: string; company_name: string; logo_url: string | null } | null;
};

type Props = {
  requestId: string;
  /** The student can act on it; the employer sees the same card read-only. */
  canRespond: boolean;
  onResponded?: (request: AvailabilityRequest) => void;
};

const cellKey = (day: string, presetKey: string) => `${day}|${presetKey}`;

// Step 2 of the interview handshake, rendered inline in the inbox thread in
// place of a plain message bubble. The student marks the frames that work
// inside the employer's window and submits without leaving the conversation.
export default function AvailabilityRequestCard({ requestId, canRespond, onResponded }: Props) {
  const [request, setRequest] = useState<LoadedRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmNone, setConfirmNone] = useState(false);

  const load = useCallback(async () => {
    const data = await getAvailabilityRequest(requestId);
    setRequest(data as LoadedRequest | null);
    setLoading(false);
  }, [requestId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={cardStyle}>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>Loading interview request…</p>
      </div>
    );
  }

  // Deleted, or withdrawn by an employer whose RLS scope no longer overlaps.
  if (!request) {
    return (
      <div style={cardStyle}>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
          This interview request is no longer available.
        </p>
      </div>
    );
  }

  const status = request.status as AvailabilityStatus;
  const chip = STATUS_CHIP[status];
  const days = enumerateDays(request.window_start, request.window_end);
  const companyName = request.employer?.company_name ?? 'The employer';
  const listingTitle = request.listing?.title ?? 'the role';
  const isOpenForStudent = canRespond && status === 'awaiting_student';

  function toggle(day: string, presetKey: string) {
    setError('');
    setSelected(prev => {
      const next = new Set(prev);
      const key = cellKey(day, presetKey);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function buildSelectedSlots(): AvailabilitySlot[] {
    const slots: AvailabilitySlot[] = [];
    for (const key of selected) {
      const [day, presetKey] = key.split('|');
      const preset = TIME_PRESETS.find(p => p.key === presetKey);
      if (!preset) continue;
      slots.push(buildSlot(day, preset.startMinute, preset.endMinute));
    }
    return slots.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  }

  async function handleSubmit() {
    setError('');
    const slots = buildSelectedSlots();
    // Validate before the round trip so the student gets the message inline;
    // the server re-checks the identical rule.
    const check = validateSlots(slots, request!, request!.duration_minutes);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setSubmitting(true);
    try {
      const updated = await submitStudentAvailability(requestId, { slots, note: note.trim() });
      setRequest(prev => (prev ? { ...prev, ...updated, slots } : prev));
      onResponded?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send your availability');
    } finally {
      setSubmitting(false);
    }
  }

  // The edge case the employer needs told explicitly: nothing in this window
  // works. Recorded as a real outcome so the board can prompt a re-request.
  async function handleNoneWork() {
    setError('');
    setSubmitting(true);
    try {
      const updated = await submitStudentAvailability(requestId, {
        slots: [],
        note: note.trim(),
        noneWork: true,
      });
      setRequest(prev => (prev ? { ...prev, ...updated, slots: [] } : prev));
      setConfirmNone(false);
      onResponded?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send your response');
    } finally {
      setSubmitting(false);
    }
  }

  const submittedSlots = groupSlotsByDay(request.slots ?? []);

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: 'var(--primary-light)', color: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </span>
          <div>
            <p style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0 }}>Interview availability</p>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-light)', margin: 0 }}>
              {companyName} · {listingTitle}
            </p>
          </div>
        </div>
        <span style={{
          flexShrink: 0, fontSize: '0.65rem', fontWeight: 700,
          padding: '3px 8px', borderRadius: 10,
          background: chip.bg, color: chip.color,
        }}>
          {STUDENT_STATUS_LABELS[status]}
        </span>
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.5 }}>
        {companyName} is interviewing between{' '}
        <strong style={{ color: 'var(--text)' }}>{formatWindowLabel(request.window_start, request.window_end)}</strong>
        {' '}· {request.duration_minutes} minute interview.
      </p>

      {request.employer_note && (
        <p style={{
          fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5,
          margin: '0 0 12px', padding: '8px 10px', borderRadius: 8,
          background: 'var(--bg-light)', borderLeft: '3px solid var(--primary)',
        }}>
          {request.employer_note}
        </p>
      )}

      {/* ---- Interactive picker: the student's turn ---- */}
      {isOpenForStudent && (
        <>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>
            Tap every time frame that works for you
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {days.map(day => (
              <div key={day} style={{
                border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px',
              }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, margin: '0 0 6px' }}>
                  {formatDayLabel(day)}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {TIME_PRESETS.map(preset => {
                    const active = selected.has(cellKey(day, preset.key));
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        aria-pressed={active}
                        aria-label={`${formatDayLabel(day)} ${preset.label}`}
                        onClick={() => toggle(day, preset.key)}
                        style={{
                          fontSize: '0.7rem', fontWeight: 600, padding: '5px 9px',
                          borderRadius: 999, cursor: 'pointer',
                          border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                          background: active ? 'var(--primary)' : 'var(--surface)',
                          color: active ? 'var(--on-primary)' : 'var(--text-secondary)',
                          transition: 'all 0.15s',
                        }}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Anything they should know? (optional)"
            rows={2}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 8,
              border: '1px solid var(--border)', fontSize: '0.8rem',
              fontFamily: 'inherit', color: 'var(--text)', resize: 'vertical',
              marginBottom: 10,
            }}
          />

          {error && (
            <div role="alert" style={{
              padding: '7px 10px', borderRadius: 8, marginBottom: 10,
              background: 'var(--danger-bg)', color: 'var(--danger-fg)',
              fontSize: '0.75rem', border: '1px solid var(--danger-border)',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || selected.size === 0}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: submitting || selected.size === 0 ? 'var(--border)' : 'var(--primary)',
                color: 'var(--on-primary)', fontSize: '0.8rem', fontWeight: 600,
                cursor: submitting || selected.size === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Sending…' : `Send ${selected.size || ''} time${selected.size === 1 ? '' : 's'}`.trim()}
            </button>
            <button
              type="button"
              onClick={() => setConfirmNone(true)}
              disabled={submitting}
              style={{
                padding: '8px 14px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--surface)',
                color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              None of these days work
            </button>
          </div>

          {confirmNone && (
            <div style={{
              marginTop: 10, padding: '10px 12px', borderRadius: 8,
              background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
            }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--danger-fg)', margin: '0 0 8px', lineHeight: 1.5 }}>
                We’ll tell {companyName} that nothing in this window works and ask
                them to propose different dates. You can add a note above first.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleNoneWork}
                  disabled={submitting}
                  style={{
                    padding: '6px 12px', borderRadius: 8, border: 'none',
                    background: 'var(--danger-fg)', color: '#fff',
                    fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {submitting ? 'Sending…' : 'Yes, none work'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmNone(false)}
                  disabled={submitting}
                  style={{
                    padding: '6px 12px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--surface)',
                    color: 'var(--text)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Go back
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ---- Submitted: what the student offered ---- */}
      {(status === 'awaiting_employer' || status === 'scheduled') && submittedSlots.length > 0 && (
        <div>
          {/* The status chip above already says whether this was sent or
              booked, so this heading only names what the list is. */}
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>
            You offered
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {submittedSlots.map(({ day, slots }) => (
              <div key={day} style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text)' }}>{formatDayLabel(day)}</strong>
                {' — '}
                {slots.map(s => `${formatTime(s.starts_at)}–${formatTime(s.ends_at)}`).join(', ')}
              </div>
            ))}
          </div>
          {status === 'awaiting_employer' && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', margin: '8px 0 0' }}>
              Waiting on {companyName} to pick a final time.
            </p>
          )}
        </div>
      )}

      {status === 'scheduled' && request.scheduled_at_confirmed && (
        <div style={{
          marginTop: 10, padding: '9px 12px', borderRadius: 8,
          background: 'var(--chip-green-bg)', color: 'var(--chip-green-ink)',
          fontSize: '0.8rem', fontWeight: 600,
        }}>
          Confirmed for {formatDayLabel(request.scheduled_at_confirmed.slice(0, 10))}
          {', '}
          {formatTime(request.scheduled_at_confirmed)}
        </div>
      )}

      {status === 'no_availability' && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          You let {companyName} know that none of these dates worked. They’ve
          been asked to propose a new window.
        </p>
      )}

      {status === 'cancelled' && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          {companyName} withdrew this request.
        </p>
      )}

      {request.student_note && status !== 'awaiting_student' && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', margin: '8px 0 0', fontStyle: 'italic' }}>
          Your note: {request.student_note}
        </p>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  maxWidth: '85%',
  width: 420,
  padding: '14px 16px',
  borderRadius: 16,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow)',
};
