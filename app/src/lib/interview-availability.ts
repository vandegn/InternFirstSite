// ============================================
// INTERVIEW AVAILABILITY HANDSHAKE — domain rules
// ============================================
// The employer asks for a date window, the student marks the frames that work
// inside it, the employer picks one final time. Everything here is pure: no
// Supabase, no React, no clock reads that aren't passed in. The API routes and
// both UIs import from this file so the rules can't drift between them.
//
// The DB mirrors the same state machine in
// supabase/migrations/20260802_interview_availability.sql.

export type AvailabilityStatus =
  | 'requested'         // row written, inbox message not attached yet
  | 'awaiting_student'  // message delivered; the student owns the next move
  | 'awaiting_employer' // student offered slots; the employer picks one
  | 'scheduled'         // an interview_schedules row exists
  | 'no_availability'   // student: nothing in this window works
  | 'cancelled';        // employer withdrew, usually to re-request

export type AvailabilitySlot = {
  id?: string;
  slot_date: string;  // YYYY-MM-DD, the student's local calendar day
  starts_at: string;  // ISO instant
  ends_at: string;    // ISO instant
};

export type AvailabilityRequest = {
  id: string;
  application_id: string;
  employer_id: string;
  student_id: string;
  listing_id: string;
  window_start: string; // YYYY-MM-DD
  window_end: string;   // YYYY-MM-DD
  status: AvailabilityStatus;
  duration_minutes: number;
  employer_note: string | null;
  student_note: string | null;
  student_timezone: string | null;
  message_id: string | null;
  interview_id: string | null;
  requested_at: string;
  responded_at: string | null;
  scheduled_at_confirmed: string | null;
  slots?: AvailabilitySlot[];
};

// A window longer than this is almost always a mis-drag, and it makes the
// student's picker unusable — 60+ day columns to scroll through.
export const MAX_WINDOW_DAYS = 30;
// Below this the student has no real choice to make.
export const MIN_WINDOW_DAYS = 1;

export const DEFAULT_DURATION_MINUTES = 30;
export const DURATION_OPTIONS = [15, 30, 45, 60];

// The frames the student picks from. Kept coarse on purpose: this step is
// "when are you broadly free", not "book me at 2:15".
export const TIME_PRESETS: { key: string; label: string; startMinute: number; endMinute: number }[] = [
  { key: 'morning',   label: 'Morning',       startMinute: 9 * 60,  endMinute: 12 * 60 },
  { key: 'midday',    label: 'Midday',        startMinute: 11 * 60, endMinute: 14 * 60 },
  { key: 'afternoon', label: 'Afternoon',     startMinute: 13 * 60, endMinute: 17 * 60 },
  { key: 'evening',   label: 'Early evening', startMinute: 17 * 60, endMinute: 20 * 60 },
];

// Statuses where the negotiation is still open. Mirrors the partial unique
// index that allows only one live request per application.
export const LIVE_AVAILABILITY_STATUSES: AvailabilityStatus[] = [
  'requested',
  'awaiting_student',
  'awaiting_employer',
];

export function isLiveAvailabilityStatus(status: string): boolean {
  return (LIVE_AVAILABILITY_STATUSES as string[]).includes(status);
}

// ---- state machine ----

const TRANSITIONS: Record<AvailabilityStatus, AvailabilityStatus[]> = {
  requested:         ['awaiting_student', 'cancelled'],
  // The student either offers slots or tells us the window is unworkable.
  awaiting_student:  ['awaiting_employer', 'no_availability', 'cancelled'],
  // The employer confirms one, or gives up on this window and re-requests.
  awaiting_employer: ['scheduled', 'cancelled'],
  // Terminal. Re-requesting opens a *new* row rather than reviving this one,
  // so the audit trail of what was offered when stays intact.
  scheduled:         [],
  no_availability:   [],
  cancelled:         [],
};

export function canTransition(from: AvailabilityStatus, to: AvailabilityStatus): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

/** Throws with a message safe to surface to the caller. */
export function assertTransition(from: AvailabilityStatus, to: AvailabilityStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Cannot move an interview request from "${from}" to "${to}"`);
  }
}

// Labels for the pipeline chip and the student's inbox card. The employer and
// student read the same row from opposite sides, so each gets its own copy.
export const EMPLOYER_STATUS_LABELS: Record<AvailabilityStatus, string> = {
  requested:         'Times requested',
  awaiting_student:  'Awaiting availability',
  awaiting_employer: 'Pick a time',
  scheduled:         'Interview scheduled',
  no_availability:   'No times worked',
  cancelled:         'Request withdrawn',
};

export const STUDENT_STATUS_LABELS: Record<AvailabilityStatus, string> = {
  requested:         'Interview times requested',
  awaiting_student:  'Share your availability',
  awaiting_employer: 'Availability sent',
  scheduled:         'Interview scheduled',
  no_availability:   'You said none of these worked',
  cancelled:         'Request withdrawn',
};

// Chip colors, reusing the palette in globals.css.
export const STATUS_CHIP: Record<AvailabilityStatus, { bg: string; color: string }> = {
  requested:         { bg: 'var(--chip-blue-bg)',   color: 'var(--chip-blue-ink)' },
  awaiting_student:  { bg: 'var(--chip-blue-bg)',   color: 'var(--chip-blue-ink)' },
  awaiting_employer: { bg: 'var(--chip-amber-bg)',  color: 'var(--chip-amber-ink)' },
  scheduled:         { bg: 'var(--chip-green-bg)',  color: 'var(--chip-green-ink)' },
  no_availability:   { bg: 'var(--danger-bg)',      color: 'var(--danger-fg)' },
  cancelled:         { bg: 'var(--chip-neutral-bg, #f3f4f6)', color: 'var(--chip-neutral-ink)' },
};

// ---- calendar helpers ----
// Date-only values are handled as YYYY-MM-DD strings throughout. They compare
// correctly with < and >, and never pick up a time zone on the way through
// JSON, which is the whole reason the window is stored as `date` in Postgres.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y
    && probe.getUTCMonth() === m - 1
    && probe.getUTCDate() === d;
}

/** Every calendar day in [start, end], inclusive. */
export function enumerateDays(start: string, end: string): string[] {
  if (!isDateOnly(start) || !isDateOnly(end) || end < start) return [];
  const days: string[] = [];
  const [y, m, d] = start.split('-').map(Number);
  // Step in UTC so a DST boundary can't skip or repeat a day.
  const cursor = new Date(Date.UTC(y, m - 1, d));
  while (toDateOnly(cursor) <= end) {
    days.push(toDateOnly(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function toDateOnly(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function countDays(start: string, end: string): number {
  return enumerateDays(start, end).length;
}

/** Today in the *local* zone as YYYY-MM-DD. Pass a clock for testability. */
export function localToday(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// ---- validation ----

export type ValidationResult = { ok: true } | { ok: false; error: string };

const ok: ValidationResult = { ok: true };
const fail = (error: string): ValidationResult => ({ ok: false, error });

/**
 * Step 1 — the employer's window.
 * `today` is the employer's local calendar day; a window may start today but
 * never in the past.
 */
export function validateWindow(
  windowStart: string,
  windowEnd: string,
  today: string,
): ValidationResult {
  if (!isDateOnly(windowStart) || !isDateOnly(windowEnd)) {
    return fail('Pick a valid start and end date');
  }
  if (windowEnd < windowStart) {
    return fail('The end date must come after the start date');
  }
  if (windowStart < today) {
    return fail('The interviewing window cannot start in the past');
  }
  const days = countDays(windowStart, windowEnd);
  if (days < MIN_WINDOW_DAYS) {
    return fail('Pick at least one day');
  }
  if (days > MAX_WINDOW_DAYS) {
    return fail(`Keep the window to ${MAX_WINDOW_DAYS} days or fewer`);
  }
  return ok;
}

/** True when the slot's day sits inside the employer's requested window. */
export function slotIsInsideWindow(slot: AvailabilitySlot, window: { window_start: string; window_end: string }): boolean {
  return slot.slot_date >= window.window_start && slot.slot_date <= window.window_end;
}

/**
 * Step 2 — the student's offered frames.
 *
 * The "no overlap with the requested window" edge case is the point of this
 * function: a student whose every frame falls outside the window is *not*
 * silently accepted, because the employer would see an empty picker with no
 * explanation. They're told to fix the days or use the "none of these work"
 * button, which is a real, recorded outcome (`no_availability`).
 */
export function validateSlots(
  slots: AvailabilitySlot[],
  window: { window_start: string; window_end: string },
  minimumMinutes: number = DEFAULT_DURATION_MINUTES,
): ValidationResult {
  if (slots.length === 0) {
    return fail('Pick at least one time frame, or let them know none of these days work');
  }

  const outside = slots.filter(s => !slotIsInsideWindow(s, window));
  if (outside.length === slots.length) {
    return fail('None of your time frames fall inside the requested window');
  }
  if (outside.length > 0) {
    const plural = outside.length === 1;
    return fail(`${outside.length} time frame${plural ? '' : 's'} ${plural ? 'falls' : 'fall'} outside the requested window`);
  }

  for (const slot of slots) {
    const start = Date.parse(slot.starts_at);
    const end = Date.parse(slot.ends_at);
    if (Number.isNaN(start) || Number.isNaN(end)) return fail('A time frame has an invalid time');
    if (end <= start) return fail('Each time frame must end after it starts');
    if (end - start < minimumMinutes * 60_000) {
      return fail(`Each time frame needs to be at least ${minimumMinutes} minutes long`);
    }
  }

  return ok;
}

/**
 * Step 3 — the employer's final pick.
 * The whole interview, not just its start, has to fit inside one offered frame.
 */
export function validateConfirmedTime(
  scheduledAt: string,
  durationMinutes: number,
  slots: AvailabilitySlot[],
): ValidationResult {
  const start = Date.parse(scheduledAt);
  if (Number.isNaN(start)) return fail('Pick a valid interview time');
  if (!(durationMinutes > 0)) return fail('Pick a valid interview length');

  const end = start + durationMinutes * 60_000;
  const fits = slots.some(slot => {
    const slotStart = Date.parse(slot.starts_at);
    const slotEnd = Date.parse(slot.ends_at);
    return !Number.isNaN(slotStart) && !Number.isNaN(slotEnd)
      && start >= slotStart && end <= slotEnd;
  });

  if (!fits) {
    return fail('Pick a time that fits inside one of the frames the candidate offered');
  }
  return ok;
}

// ---- slot construction & formatting ----

/**
 * A local wall-clock frame on `dateStr` as real instants.
 * Runs on the client, where the browser's zone *is* the student's zone.
 */
export function buildSlot(dateStr: string, startMinute: number, endMinute: number): AvailabilitySlot {
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = new Date(y, m - 1, d, Math.floor(startMinute / 60), startMinute % 60, 0, 0);
  const end = new Date(y, m - 1, d, Math.floor(endMinute / 60), endMinute % 60, 0, 0);
  return { slot_date: dateStr, starts_at: start.toISOString(), ends_at: end.toISOString() };
}

/**
 * Every discrete start time an interview of `durationMinutes` could take
 * inside `slot`, on a `stepMinutes` grid. This is what the employer's final
 * picker lists, so it can only ever offer times that pass
 * validateConfirmedTime.
 */
export function enumerateStartTimes(
  slot: AvailabilitySlot,
  durationMinutes: number,
  stepMinutes = 15,
): string[] {
  const start = Date.parse(slot.starts_at);
  const end = Date.parse(slot.ends_at);
  if (Number.isNaN(start) || Number.isNaN(end)) return [];
  const times: string[] = [];
  const step = stepMinutes * 60_000;
  const duration = durationMinutes * 60_000;
  for (let t = start; t + duration <= end; t += step) {
    times.push(new Date(t).toISOString());
  }
  return times;
}

export function formatDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

export function formatWindowLabel(start: string, end: string): string {
  if (start === end) return formatDayLabel(start);
  return `${formatDayLabel(start)} – ${formatDayLabel(end)}`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function formatSlotLabel(slot: AvailabilitySlot): string {
  return `${formatDayLabel(slot.slot_date)}, ${formatTime(slot.starts_at)} – ${formatTime(slot.ends_at)}`;
}

/** Groups the student's frames by day for display, days in order. */
export function groupSlotsByDay(slots: AvailabilitySlot[]): { day: string; slots: AvailabilitySlot[] }[] {
  const byDay = new Map<string, AvailabilitySlot[]>();
  for (const slot of slots) {
    const list = byDay.get(slot.slot_date) ?? [];
    list.push(slot);
    byDay.set(slot.slot_date, list);
  }
  return Array.from(byDay.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([day, list]) => ({
      day,
      slots: list.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)),
    }));
}
