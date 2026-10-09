'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getAvailabilityRequest,
  selectInterviewSlot,
} from '@/lib/supabase';
import {
  groupSlotsByDay,
  formatWindowLabel,
  formatTime,
  formatSlotRange,
  formatMeetingWhen,
  localTimeZone,
  timeZoneAbbr,
  selectedSlotOf,
  isMeetingType,
  MEETING_TYPE_LABELS,
  STUDENT_STATUS_LABELS,
  EMPLOYER_STATUS_LABELS,
  STATUS_CHIP,
  type AvailabilityRequest,
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

// Step 2 of scheduling, rendered inline in the inbox thread in place of a
// plain message bubble. The employer proposed exact slots; the student picks
// one. The pick is tentative until the employer confirms it.
//
// The thread polls every few seconds; this card keeps its own state and is
// keyed by message id, so a poll never resets a half-made selection.
export default function AvailabilityRequestCard({ requestId, canRespond, onResponded }: Props) {
  const [request, setRequest] = useState<LoadedRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<string>('');
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
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>Loading scheduling request…</p>
      </div>
    );
  }

  // Deleted, or withdrawn by an employer whose RLS scope no longer overlaps.
  if (!request) {
    return (
      <div style={cardStyle}>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
          This scheduling request is no longer available.
        </p>
      </div>
    );
  }

  const status = request.status as AvailabilityStatus;
  const chip = STATUS_CHIP[status];
  const companyName = request.employer?.company_name ?? 'The employer';
  const listingTitle = request.listing?.title ?? 'the role';
  const meetingType = isMeetingType(request.meeting_type) ? request.meeting_type : 'interview';
  const typeLabel = MEETING_TYPE_LABELS[meetingType];
  const isOpenForStudent = canRespond && status === 'awaiting_student';
  const tz = localTimeZone();
  const now = Date.now();
  const slots = (request.slots ?? []).filter(s => !isOpenForStudent || Date.parse(s.starts_at) > now);
  const byDay = groupSlotsByDay(slots, tz);
  const selected = selectedSlotOf(request);
  const zoneNote = slots[0] ? `${tz} (${timeZoneAbbr(slots[0].starts_at, tz)})` : tz;

  async function handleSelect() {
    if (!picked) return;
    setError('');
    setSubmitting(true);
    try {
      const updated = await selectInterviewSlot(requestId, { slotId: picked, note: note.trim() });
      setRequest(prev => (prev ? { ...prev, ...updated } : prev));
      onResponded?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your pick');
    } finally {
      setSubmitting(false);
    }
  }

  // Nothing offered works. Recorded as a real outcome so the employer is told
  // and can send different times.
  async function handleNoneWork() {
    setError('');
    setSubmitting(true);
    try {
      const updated = await selectInterviewSlot(requestId, { note: note.trim(), noneWork: true });
      setRequest(prev => (prev ? { ...prev, ...updated } : prev));
      setConfirmNone(false);
      onResponded?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send your response');
    } finally {
      setSubmitting(false);
    }
  }

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
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </span>
          <div>
            <p style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0 }}>{typeLabel} time</p>
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
          {canRespond ? STUDENT_STATUS_LABELS[status] : EMPLOYER_STATUS_LABELS[status]}
        </span>
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 8px', lineHeight: 1.5 }}>
        {request.duration_minutes}-minute {typeLabel.toLowerCase()} between{' '}
        <strong style={{ color: 'var(--text)' }}>{formatWindowLabel(request.window_start, request.window_end)}</strong>.
      </p>
      <p style={{ fontSize: '0.72rem', color: 'var(--text-light)', margin: '0 0 12px' }}>
        Times shown in your time zone: {zoneNote}
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

      {/* ---- The student's turn: pick one slot ---- */}
      {isOpenForStudent && (
        <>
          {slots.length === 0 ? (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0 0 10px' }}>
              All of the offered times have passed. Let {companyName} know none of them work.
            </p>
          ) : (
            <div role="radiogroup" aria-label="Offered times" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {byDay.map(({ day, label, slots: daySlots }) => (
                <div key={day} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, margin: '0 0 6px' }}>{label}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {daySlots.map(slot => {
                      const active = picked === slot.id;
                      return (
                        <button
                          key={slot.id ?? slot.starts_at}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          aria-label={`${label} ${formatSlotRange(slot, tz)}`}
                          onClick={() => { setPicked(slot.id ?? ''); setError(''); }}
                          style={{
                            fontSize: '0.72rem', fontWeight: 600, padding: '5px 10px',
                            borderRadius: 999, cursor: 'pointer',
                            border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                            background: active ? 'var(--primary)' : 'var(--surface)',
                            color: active ? 'var(--on-primary)' : 'var(--text-secondary)',
                          }}
                        >
                          {formatTime(slot.starts_at, tz)} – {formatTime(slot.ends_at, tz)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <textarea aria-label="Note to the employer (optional)"
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
              onClick={handleSelect}
              disabled={submitting || !picked}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: submitting || !picked ? 'var(--border)' : 'var(--primary)',
                color: 'var(--on-primary)', fontSize: '0.8rem', fontWeight: 600,
                cursor: submitting || !picked ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Sending…' : 'Select this time'}
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
              None of these work
            </button>
          </div>

          {confirmNone && (
            <div style={{
              marginTop: 10, padding: '10px 12px', borderRadius: 8,
              background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
            }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--danger-fg)', margin: '0 0 8px', lineHeight: 1.5 }}>
                We’ll tell {companyName} that none of these times work so they can
                send different ones. You can add a note above first.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleNoneWork}
                  disabled={submitting}
                  style={{
                    padding: '6px 12px', borderRadius: 8, border: 'none',
                    background: 'var(--danger-fg)', color: 'var(--on-fill)',
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

      {/* ---- Read-only offer (the employer's view while waiting) ---- */}
      {!isOpenForStudent && status === 'awaiting_student' && (
        <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0 }}>
          {slots.length} time{slots.length === 1 ? '' : 's'} offered — awaiting the candidate’s selection.
        </p>
      )}

      {/* ---- Picked, waiting on the employer ---- */}
      {status === 'awaiting_employer' && selected && (
        <div style={{
          padding: '9px 12px', borderRadius: 8,
          background: 'var(--chip-amber-bg)', color: 'var(--chip-amber-ink)', fontSize: '0.8rem',
        }}>
          <strong>Selected {formatMeetingWhen(selected.starts_at, tz)}</strong>
          <span style={{ display: 'block', fontSize: '0.74rem', marginTop: 2 }}>
            {canRespond
              ? `Tentative — ${companyName} still needs to confirm it. You’ll get the final details here.`
              : 'Tentative until confirmed.'}
          </span>
        </div>
      )}

      {status === 'scheduled' && request.scheduled_at_confirmed && (
        <div style={{
          padding: '9px 12px', borderRadius: 8,
          background: 'var(--chip-green-bg)', color: 'var(--chip-green-ink)',
          fontSize: '0.8rem', fontWeight: 600,
        }}>
          {typeLabel} confirmed for {formatMeetingWhen(request.scheduled_at_confirmed, tz)} · {request.duration_minutes} min
        </div>
      )}

      {status === 'no_availability' && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          {canRespond ? `You let ${companyName} know` : 'The candidate said'} that none of these times work.
        </p>
      )}

      {status === 'cancelled' && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          {companyName} withdrew these times.
        </p>
      )}

      {request.student_note && status !== 'awaiting_student' && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', margin: '8px 0 0', fontStyle: 'italic' }}>
          {canRespond ? 'Your note' : 'Candidate’s note'}: {request.student_note}
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
