'use client';

import { useState, useEffect } from 'react';
import DialogShell, { primaryButton, secondaryButton } from '@/components/DialogShell';
import InterviewFormatPicker from '@/components/InterviewFormatPicker';
import { validateInterviewFormat, type InterviewFormat } from '@/lib/interview-format';
import {
  formatMeetingWhen,
  formatSlotRange,
  localTimeZone,
  MEETING_TYPE_LABELS,
  type AvailabilityRequest,
  type AvailabilitySlot,
  type MeetingType,
} from '@/lib/interview-availability';

export type ConfirmMeetingData = {
  notes: string;
  format: InterviewFormat;
  meetingUrl: string | null;
  timeZone: string;
  meetingType: MeetingType;
};

type Props = {
  open: boolean;
  onClose: () => void;
  request: AvailabilityRequest | null;
  /** The slot the candidate selected. */
  slot: AvailabilitySlot | null;
  meetingType: MeetingType;
  candidateName?: string;
  listingTitle?: string;
  onConfirm: (data: ConfirmMeetingData) => Promise<void> | void;
  /** The pick no longer works — withdraw so new times can be sent. */
  onWithdraw: () => Promise<void> | void;
};

// Step 3 of scheduling: the candidate's pick is tentative until the employer
// confirms it here, choosing how the meeting happens (InternFirst video, their
// own link, or a phone call). Confirming books it for both parties.
export default function ConfirmMeetingModal({
  open,
  onClose,
  request,
  slot,
  meetingType,
  candidateName,
  listingTitle,
  onConfirm,
  onWithdraw,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [format, setFormat] = useState<InterviewFormat>('internfirst');
  const [meetingUrl, setMeetingUrl] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setNotes('');
    setFormat('internfirst');
    setMeetingUrl('');
  }, [open, request?.id]);

  const typeLabel = MEETING_TYPE_LABELS[meetingType];
  const tz = localTimeZone();

  async function run(fn: () => Promise<void> | void) {
    setError('');
    setSubmitting(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  function handleConfirm() {
    const check = validateInterviewFormat({ format, meetingUrl });
    if (!check.ok) return setError(check.error);
    return run(() => onConfirm({
      notes: notes.trim(),
      format: check.format,
      meetingUrl: check.meetingUrl,
      timeZone: tz,
      meetingType,
    }));
  }

  const duration = slot ? Math.round((Date.parse(slot.ends_at) - Date.parse(slot.starts_at)) / 60_000) : 0;

  return (
    <DialogShell
      open={open && Boolean(request && slot)}
      onClose={onClose}
      busy={submitting}
      zIndex={10000}
      title={`Confirm ${typeLabel}`}
      subtitle={candidateName && listingTitle ? `${candidateName} · ${listingTitle}` : candidateName || listingTitle}
      footer={
        <>
          <button type="button" onClick={() => run(onWithdraw)} disabled={submitting} style={{ ...secondaryButton(!submitting), marginRight: 'auto' }}>
            Can’t make it — withdraw &amp; send new times
          </button>
          <button type="button" onClick={handleConfirm} disabled={submitting} style={primaryButton(!submitting)}>
            {submitting ? 'Confirming…' : `Confirm ${typeLabel}`}
          </button>
        </>
      }
    >
      {slot && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{
            padding: '12px 14px', borderRadius: 10,
            background: 'var(--chip-amber-bg)', color: 'var(--chip-amber-ink)',
          }}>
            <p style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700 }}>
              Selected {formatMeetingWhen(slot.starts_at, tz)}
            </p>
            <p style={{ margin: '3px 0 0', fontSize: '0.78rem' }}>
              {formatSlotRange(slot, tz)} · {duration} min {typeLabel.toLowerCase()} · tentative until you confirm
            </p>
            {request?.student_timezone && request.student_timezone !== tz && (
              <p style={{ margin: '3px 0 0', fontSize: '0.76rem' }}>
                Candidate’s time: {formatMeetingWhen(slot.starts_at, request.student_timezone)} ({request.student_timezone})
              </p>
            )}
          </div>

          {request?.student_note && (
            <p style={{
              fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0,
              padding: '8px 10px', borderRadius: 8, background: 'var(--bg-light)', borderLeft: '3px solid var(--primary)',
            }}>
              <strong style={{ color: 'var(--text)' }}>From the candidate:</strong> {request.student_note}
            </p>
          )}

          <InterviewFormatPicker
            format={format}
            meetingUrl={meetingUrl}
            onFormatChange={f => { setFormat(f); setError(''); }}
            onMeetingUrlChange={u => { setMeetingUrl(u); setError(''); }}
            disabled={submitting}
          />

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>Notes for the candidate (optional)</span>
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

          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-light)', lineHeight: 1.5 }}>
            Confirming sends the final details — type, date, time, time zone, duration and
            where it happens — to both of you in Messages, and adds it to both Upcoming
            Interviews pages.
          </p>

          {error && (
            <div role="alert" style={{
              padding: '8px 12px', borderRadius: 8,
              background: 'var(--danger-bg)', color: 'var(--danger-fg)',
              fontSize: '0.78rem', border: '1px solid var(--danger-border)',
            }}>
              {error}
            </div>
          )}
        </div>
      )}
    </DialogShell>
  );
}
