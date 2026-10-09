'use client';

import { useState, useEffect, useMemo } from 'react';
import DialogShell, { primaryButton, secondaryButton } from '@/components/DialogShell';
import {
  validateWindow,
  validateProposedSlots,
  localToday,
  localTimeZone,
  timeZoneAbbr,
  enumerateDays,
  countDays,
  formatDayLabel,
  formatWindowLabel,
  formatTime,
  formatMinuteOfDay,
  rangeTimeOptions,
  slotsForRange,
  MAX_WINDOW_DAYS,
  DURATION_OPTIONS,
  DEFAULT_DURATION_MINUTES,
  MEETING_TYPE_LABELS,
  type AvailabilityRange,
  type AvailabilitySlot,
  type MeetingType,
} from '@/lib/interview-availability';

export type RequestTimesFormData = {
  windowStart: string;
  windowEnd: string;
  durationMinutes: number;
  slots: AvailabilitySlot[];
  note: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: RequestTimesFormData) => Promise<void> | void;
  candidateName?: string;
  listingTitle?: string;
  meetingType?: MeetingType;
};

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d));
  next.setUTCDate(next.getUTCDate() + days);
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

type RangeRow = AvailabilityRange & { key: number };

const TIME_OPTIONS = rangeTimeOptions();

const fieldStyle: React.CSSProperties = {
  padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)',
  fontSize: '0.82rem', fontFamily: 'inherit', color: 'var(--text)', background: 'var(--surface)',
};

const labelText: React.CSSProperties = { fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' };

// Step 1 of scheduling: the employer picks a meeting length, a date window,
// and when they're available on dates inside it. Each availability range is
// cut into back-to-back slots of exactly the meeting length (1:00–3:00 PM at
// 30 minutes -> 1:00, 1:30, 2:00, 2:30); the employer can untick any slot, and
// the candidate picks one of what's left.
export default function RequestTimesModal({
  open,
  onClose,
  onSubmit,
  candidateName,
  listingTitle,
  meetingType = 'interview',
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [duration, setDuration] = useState(DEFAULT_DURATION_MINUTES);
  const [ranges, setRanges] = useState<RangeRow[]>([]);
  // Slots the employer unticked, by start instant.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [nextKey, setNextKey] = useState(1);

  const tz = localTimeZone();

  useEffect(() => {
    if (!open) return;
    setError('');
    // Default to "sometime next week", the overwhelmingly common ask.
    const start = addDays(localToday(), 1);
    setWindowStart(start);
    setWindowEnd(addDays(start, 6));
    setDuration(DEFAULT_DURATION_MINUTES);
    setRanges([{ key: 0, date: start, startMinute: 13 * 60, endMinute: 15 * 60 }]);
    setExcluded(new Set());
    setNote('');
    setNextKey(1);
  }, [open]);

  const windowCheck = windowStart && windowEnd ? validateWindow(windowStart, windowEnd, localToday()) : null;
  const days = windowCheck?.ok ? enumerateDays(windowStart, windowEnd) : [];
  const dayCount = windowStart && windowEnd ? countDays(windowStart, windowEnd) : 0;

  // Every slot the ranges produce, de-duplicated (two ranges may cover the
  // same time) and in order.
  const generated = useMemo(() => {
    const byStart = new Map<string, AvailabilitySlot>();
    for (const r of ranges) {
      for (const s of slotsForRange(r, duration)) {
        if (!byStart.has(s.starts_at)) byStart.set(s.starts_at, s);
      }
    }
    return Array.from(byStart.values()).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  }, [ranges, duration]);

  const offered = generated.filter(s => !excluded.has(s.starts_at));
  const slotCheck = windowCheck?.ok
    ? validateProposedSlots(offered, { window_start: windowStart, window_end: windowEnd }, duration)
    : null;
  const canSubmit = Boolean(windowCheck?.ok && slotCheck?.ok) && !submitting;
  const visibleError = error
    || (windowCheck && !windowCheck.ok ? windowCheck.error : '')
    || (ranges.length > 0 && slotCheck && !slotCheck.ok ? slotCheck.error : '');

  function updateRange(key: number, patch: Partial<AvailabilityRange>) {
    setError('');
    setRanges(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRange() {
    setError('');
    const last = ranges[ranges.length - 1];
    const date = last && days.includes(last.date)
      ? (days[days.indexOf(last.date) + 1] ?? last.date)
      : days[0] ?? windowStart;
    setRanges(prev => [...prev, { key: nextKey, date, startMinute: last?.startMinute ?? 13 * 60, endMinute: last?.endMinute ?? 15 * 60 }]);
    setNextKey(k => k + 1);
  }

  function toggleSlot(startsAt: string) {
    setError('');
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(startsAt)) next.delete(startsAt);
      else next.add(startsAt);
      return next;
    });
  }

  async function handleSubmit() {
    setError('');
    const w = validateWindow(windowStart, windowEnd, localToday());
    if (!w.ok) return setError(w.error);
    const s = validateProposedSlots(offered, { window_start: windowStart, window_end: windowEnd }, duration);
    if (!s.ok) return setError(s.error);
    setSubmitting(true);
    try {
      await onSubmit({ windowStart, windowEnd, durationMinutes: duration, slots: offered, note: note.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  const minEnd = windowStart || localToday();
  const maxEnd = windowStart ? addDays(windowStart, MAX_WINDOW_DAYS - 1) : undefined;
  const typeLabel = MEETING_TYPE_LABELS[meetingType];
  const zoneLabel = `${tz} (${timeZoneAbbr(new Date().toISOString(), tz)})`;

  // Generated slots grouped by the employer's calendar day for the preview.
  const byDay = new Map<string, AvailabilitySlot[]>();
  for (const s of generated) byDay.set(s.slot_date, [...(byDay.get(s.slot_date) ?? []), s]);

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      busy={submitting}
      width={600}
      zIndex={10000}
      title={`Request Time — ${typeLabel}`}
      subtitle={candidateName && listingTitle ? `${candidateName} · ${listingTitle}` : candidateName || listingTitle}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={submitting} style={secondaryButton(!submitting)}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={!canSubmit} style={primaryButton(canSubmit)}>
            {submitting ? 'Sending…' : `Send ${offered.length} time${offered.length === 1 ? '' : 's'}`}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          Choose a meeting length and the times you’re free. The candidate picks
          one of these slots, then you confirm it.
        </p>

        <p data-testid="request-timezone" style={{
          margin: 0, padding: '7px 10px', borderRadius: 8, fontSize: '0.76rem', fontWeight: 600,
          background: 'var(--chip-blue-bg)', color: 'var(--chip-blue-ink)',
        }}>
          All times are in your time zone: {zoneLabel}
        </p>

        <div role="group" aria-label="Meeting length" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelText}>Meeting length</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {DURATION_OPTIONS.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => { setDuration(d); setExcluded(new Set()); setError(''); }}
                aria-pressed={duration === d}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8,
                  border: `1px solid ${duration === d ? 'var(--primary)' : 'var(--border)'}`,
                  background: duration === d ? 'var(--primary)' : 'var(--surface)',
                  color: duration === d ? 'var(--on-primary)' : 'var(--text)',
                  fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                {d} min
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelText}>Start date</span>
            <input
              type="date"
              aria-label="Start date"
              value={windowStart}
              min={localToday()}
              onChange={e => {
                const next = e.target.value;
                setWindowStart(next);
                setError('');
                if (next && windowEnd && windowEnd < next) setWindowEnd(next);
              }}
              style={fieldStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={labelText}>End date</span>
            <input
              type="date"
              aria-label="End date"
              value={windowEnd}
              min={minEnd}
              max={maxEnd}
              onChange={e => { setWindowEnd(e.target.value); setError(''); }}
              style={fieldStyle}
            />
          </label>
        </div>
        {windowCheck?.ok && (
          <p style={{ margin: '-8px 0 0', fontSize: '0.74rem', color: 'var(--text-light)' }}>
            {formatWindowLabel(windowStart, windowEnd)} · {dayCount} day{dayCount === 1 ? '' : 's'}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={labelText}>When you’re available</span>
          {ranges.map((r, i) => (
            <div key={r.key} role="group" aria-label={`Availability ${i + 1}`} style={{
              display: 'grid', gridTemplateColumns: 'minmax(120px, 1.3fr) 1fr 1fr auto', gap: 6, alignItems: 'center',
            }}>
              <select
                aria-label={`Availability ${i + 1} date`}
                value={r.date}
                onChange={e => updateRange(r.key, { date: e.target.value })}
                style={fieldStyle}
              >
                {!days.includes(r.date) && <option value={r.date}>{r.date ? formatDayLabel(r.date) : 'Pick a date'}</option>}
                {days.map(d => <option key={d} value={d}>{formatDayLabel(d)}</option>)}
              </select>
              <select
                aria-label={`Availability ${i + 1} from`}
                value={r.startMinute}
                onChange={e => {
                  const start = Number(e.target.value);
                  updateRange(r.key, { startMinute: start, endMinute: Math.max(r.endMinute, start + duration) });
                }}
                style={fieldStyle}
              >
                {TIME_OPTIONS.filter(m => m < 24 * 60).map(m => <option key={m} value={m}>{formatMinuteOfDay(m)}</option>)}
              </select>
              <select
                aria-label={`Availability ${i + 1} to`}
                value={r.endMinute}
                onChange={e => updateRange(r.key, { endMinute: Number(e.target.value) })}
                style={fieldStyle}
              >
                {TIME_OPTIONS.filter(m => m > r.startMinute).map(m => <option key={m} value={m}>{formatMinuteOfDay(m)}</option>)}
              </select>
              <button
                type="button"
                aria-label={`Remove availability ${i + 1}`}
                onClick={() => setRanges(prev => prev.filter(x => x.key !== r.key))}
                style={{ ...secondaryButton(), padding: '6px 9px' }}
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" onClick={addRange} disabled={!windowCheck?.ok} style={{ ...secondaryButton(Boolean(windowCheck?.ok)), alignSelf: 'flex-start' }}>
            + Add availability
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={labelText}>
            Time slots to offer ({offered.length} of {generated.length}) — {duration} min each
          </span>
          {generated.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-light)' }}>
              Add availability that’s at least {duration} minutes long to create slots.
            </p>
          ) : (
            Array.from(byDay.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([day, daySlots]) => (
              <div key={day} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px' }}>
                <p style={{ fontSize: '0.76rem', fontWeight: 700, margin: '0 0 6px' }}>{formatDayLabel(day)}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {daySlots.map(s => {
                    const on = !excluded.has(s.starts_at);
                    return (
                      <button
                        key={s.starts_at}
                        type="button"
                        aria-pressed={on}
                        aria-label={`${formatDayLabel(day)} ${formatTime(s.starts_at)} to ${formatTime(s.ends_at)}`}
                        onClick={() => toggleSlot(s.starts_at)}
                        style={{
                          fontSize: '0.72rem', fontWeight: 600, padding: '5px 9px', borderRadius: 999, cursor: 'pointer',
                          border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                          background: on ? 'var(--primary)' : 'var(--surface)',
                          color: on ? 'var(--on-primary)' : 'var(--text-light)',
                          textDecoration: on ? 'none' : 'line-through',
                        }}
                      >
                        {formatTime(s.starts_at)} – {formatTime(s.ends_at)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelText}>Note for the candidate (optional)</span>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Who they’ll meet with, what to prepare, etc."
            rows={2}
            style={{ ...fieldStyle, padding: '9px 11px', resize: 'vertical' }}
          />
        </label>

        {visibleError && (
          <div role="alert" style={{
            padding: '8px 12px', borderRadius: 8,
            background: 'var(--danger-bg)', color: 'var(--danger-fg)',
            fontSize: '0.78rem', border: '1px solid var(--danger-border)',
          }}>
            {visibleError}
          </div>
        )}
      </div>
    </DialogShell>
  );
}
