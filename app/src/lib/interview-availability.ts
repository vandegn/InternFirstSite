// ============================================
// INTERVIEW AVAILABILITY HANDSHAKE — domain rules
// ============================================
// The employer proposes concrete time slots inside a date window, the student
// picks one (tentative), the employer confirms it. Everything here is pure: no
// Supabase, no React, no clock reads that aren't passed in. The API routes and
// both UIs import from this file so the rules can't drift between them.
//
// The DB mirrors the same state machine in
// supabase/migrations/20260802_interview_availability.sql; the employer-proposed
// slots and the tentative selection come from
// supabase/migrations/20261009_employer_proposed_interview_slots.sql.

export type AvailabilityStatus =
  | 'requested'         // row + proposed slots written, inbox message not attached yet
  | 'awaiting_student'  // message delivered; the student picks one of the slots
  | 'awaiting_employer' // student selected a slot (tentative); the employer confirms
  | 'scheduled'         // confirmed — an interview_schedules row exists
  | 'no_availability'   // student: none of the proposed slots work
  | 'cancelled';        // employer withdrew, usually to re-request

/** Whether the meeting is a screening or an interview — from the pipeline stage. */
export type MeetingType = 'screening' | 'interview';

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  screening: 'Screening',
  interview: 'Interview',
};

export function isMeetingType(v: unknown): v is MeetingType {
  return v === 'screening' || v === 'interview';
}

/**
 * The scheduling category a pipeline stage puts a candidate in, or null when
 * scheduling doesn't apply (Applied, Reviewing, Offered, Rejected…). Scheduling
 * actions are only ever shown for a non-null category.
 *
 * Before 20261009 there was no 'screening' stage_type, so a "Phone Screening"
 * column was stored as 'reviewing'; the label fallback keeps those boards
 * working until the migration re-buckets them.
 */
export function meetingTypeForStage(
  stage: { stage_type?: string | null; label?: string | null } | null | undefined,
): MeetingType | null {
  if (!stage) return null;
  if (stage.stage_type === 'screening') return 'screening';
  if (stage.stage_type === 'interviewing') return 'interview';
  if (stage.stage_type === 'reviewing' && /screen/i.test(stage.label ?? '')) return 'screening';
  return null;
}

export type AvailabilitySlot = {
  id?: string;
  slot_date: string;  // YYYY-MM-DD, the employer's local calendar day
  starts_at: string;  // ISO instant
  ends_at: string;    // ISO instant — always starts_at + the meeting duration
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
  // Added by 20261009 — absent on rows read from a database without it.
  meeting_type?: MeetingType | null;
  employer_timezone?: string | null;
  /** The slot the student picked. Tentative until the employer confirms. */
  selected_slot_id?: string | null;
  selected_at?: string | null;
  requested_by?: string | null;
  slots?: AvailabilitySlot[];
};

// A window longer than this is almost always a mis-drag, and it makes the
// slot editor unusable — 60+ days to fill in.
export const MAX_WINDOW_DAYS = 30;
// Below this the student has no real choice to make.
export const MIN_WINDOW_DAYS = 1;

export const DEFAULT_DURATION_MINUTES = 30;
export const DURATION_OPTIONS = [15, 30, 45, 60];

// More than this many proposed slots is a wall the student has to scroll
// through, and almost always means a range was entered as a whole day.
export const MAX_PROPOSED_SLOTS = 60;

// The employer's availability ranges snap to this grid in the editor.
export const RANGE_STEP_MINUTES = 15;

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
  // The student either picks one of the proposed slots or says none work.
  awaiting_student:  ['awaiting_employer', 'no_availability', 'cancelled'],
  // The employer confirms the student's pick, or withdraws and re-requests.
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
  requested:         'Awaiting Student Selection',
  awaiting_student:  'Awaiting Student Selection',
  awaiting_employer: 'Time selected — confirm',
  scheduled:         'Confirmed',
  no_availability:   'No times worked',
  cancelled:         'Request withdrawn',
};

export const STUDENT_STATUS_LABELS: Record<AvailabilityStatus, string> = {
  requested:         'Pick a time',
  awaiting_student:  'Pick a time',
  awaiting_employer: 'Selected — awaiting confirmation',
  scheduled:         'Confirmed',
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
 * The employer's date window.
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
    return fail('The date window cannot start in the past');
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
 * Step 1 — the employer's proposed slots.
 *
 * Every slot is exactly one meeting long, sits on a day inside the window,
 * hasn't started yet, and doesn't overlap another slot — so whichever one the
 * student picks is a real, bookable meeting with no further arithmetic.
 */
export function validateProposedSlots(
  slots: AvailabilitySlot[],
  window: { window_start: string; window_end: string },
  durationMinutes: number,
  now: Date = new Date(),
): ValidationResult {
  if (!(durationMinutes > 0)) return fail('Pick a valid meeting length');
  if (slots.length === 0) return fail('Pick at least one time slot to offer');
  if (slots.length > MAX_PROPOSED_SLOTS) {
    return fail(`Offer ${MAX_PROPOSED_SLOTS} time slots or fewer`);
  }

  const outside = slots.filter(s => !slotIsInsideWindow(s, window));
  if (outside.length > 0) {
    const one = outside.length === 1;
    return fail(`${outside.length} time slot${one ? '' : 's'} ${one ? 'falls' : 'fall'} outside the date window`);
  }

  const parsed: { start: number; end: number }[] = [];
  for (const slot of slots) {
    const start = Date.parse(slot.starts_at);
    const end = Date.parse(slot.ends_at);
    if (Number.isNaN(start) || Number.isNaN(end)) return fail('A time slot has an invalid time');
    if (end - start !== durationMinutes * 60_000) {
      return fail(`Each time slot must be exactly ${durationMinutes} minutes`);
    }
    if (start <= now.getTime()) return fail('A time slot has already passed');
    parsed.push({ start, end });
  }

  parsed.sort((a, b) => a.start - b.start);
  for (let i = 1; i < parsed.length; i++) {
    if (parsed[i].start < parsed[i - 1].end) return fail('Two of your time slots overlap');
  }
  return ok;
}

/** Step 2 — the student's pick must be one of the slots that were offered. */
export function validateSlotChoice(
  slotId: string | null | undefined,
  slots: AvailabilitySlot[],
  now: Date = new Date(),
): ValidationResult {
  if (!slotId) return fail('Pick one of the offered times');
  const slot = slots.find(s => s.id === slotId);
  if (!slot) return fail('That time is not one of the offered slots');
  if (Date.parse(slot.starts_at) <= now.getTime()) return fail('That time has already passed — pick another');
  return ok;
}

/** The slot the student picked, if it's still on the request. */
export function selectedSlotOf(request: Pick<AvailabilityRequest, 'selected_slot_id' | 'slots'>): AvailabilitySlot | null {
  if (!request.selected_slot_id) return null;
  return (request.slots ?? []).find(s => s.id === request.selected_slot_id) ?? null;
}

// ---- slot construction ----

/**
 * A local wall-clock frame on `dateStr` as real instants.
 * Runs on the client, where the browser's zone *is* the employer's zone.
 */
export function buildSlot(dateStr: string, startMinute: number, endMinute: number): AvailabilitySlot {
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = new Date(y, m - 1, d, Math.floor(startMinute / 60), startMinute % 60, 0, 0);
  const end = new Date(y, m - 1, d, Math.floor(endMinute / 60), endMinute % 60, 0, 0);
  return { slot_date: dateStr, starts_at: start.toISOString(), ends_at: end.toISOString() };
}

/** An availability range the employer entered: one day, start to end (minutes from midnight). */
export type AvailabilityRange = { date: string; startMinute: number; endMinute: number };

/**
 * Cuts an availability range into back-to-back meeting slots that each fit
 * entirely inside it. 1:00–3:00 PM at 30 minutes gives 1:00, 1:30, 2:00 and
 * 2:30; a trailing remainder shorter than the meeting is dropped.
 */
export function slotsForRange(range: AvailabilityRange, durationMinutes: number): AvailabilitySlot[] {
  if (!(durationMinutes > 0) || !isDateOnly(range.date)) return [];
  const slots: AvailabilitySlot[] = [];
  for (let m = range.startMinute; m + durationMinutes <= range.endMinute; m += durationMinutes) {
    slots.push(buildSlot(range.date, m, m + durationMinutes));
  }
  return slots;
}

/** Minutes-from-midnight options for the range editor, on the RANGE_STEP_MINUTES grid. */
export function rangeTimeOptions(step = RANGE_STEP_MINUTES): number[] {
  const out: number[] = [];
  for (let m = 0; m <= 24 * 60; m += step) out.push(m);
  return out;
}

/** 780 -> "1:00 PM". */
export function formatMinuteOfDay(minute: number): string {
  if (minute >= 24 * 60) return '12:00 AM (midnight)';
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

// ---- formatting ----
// Every time shown in the flow carries its zone. Formatting in the viewer's own
// zone (the default) is what each party needs; passing a zone renders the same
// instant somewhere else, which the server does for chat messages.

function safeZone(timeZone?: string | null): string | undefined {
  if (!timeZone) return undefined;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return undefined;
  }
}

/** The viewer's IANA zone, e.g. "America/New_York". */
export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Short zone name at that instant, e.g. "EDT" (or "GMT-4" where there's no abbreviation). */
export function timeZoneAbbr(iso: string, timeZone?: string | null): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeZone(timeZone), timeZoneName: 'short', hour: 'numeric',
  }).formatToParts(new Date(iso));
  return parts.find(p => p.type === 'timeZoneName')?.value ?? '';
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

export function formatTime(iso: string, timeZone?: string | null): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: safeZone(timeZone) });
}

/** "Tue, Oct 14" for an instant, in the given (or viewer's) zone. */
export function formatMeetingDate(iso: string, timeZone?: string | null): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: safeZone(timeZone),
  });
}

/** "Tue, Oct 14 at 2:00 PM EDT". */
export function formatMeetingWhen(iso: string, timeZone?: string | null): string {
  return `${formatMeetingDate(iso, timeZone)} at ${formatTime(iso, timeZone)} ${timeZoneAbbr(iso, timeZone)}`.trim();
}

/** "2:00 PM – 2:30 PM EDT" for a slot. */
export function formatSlotRange(slot: Pick<AvailabilitySlot, 'starts_at' | 'ends_at'>, timeZone?: string | null): string {
  return `${formatTime(slot.starts_at, timeZone)} – ${formatTime(slot.ends_at, timeZone)} ${timeZoneAbbr(slot.starts_at, timeZone)}`.trim();
}

/** The banner at the top of the application: "Selected Tue, Oct 14 at 2:00 PM EDT". */
export function formatSelectedLabel(iso: string, timeZone?: string | null): string {
  return `Selected ${formatMeetingWhen(iso, timeZone)}`;
}

/**
 * Groups slots by the day they fall on *in the viewer's zone* (or the given
 * one), days and slots in order. Grouping by instant rather than slot_date
 * keeps an 11 PM Pacific slot under the right day for an Eastern viewer.
 */
export function groupSlotsByDay(
  slots: AvailabilitySlot[],
  timeZone?: string | null,
): { day: string; label: string; slots: AvailabilitySlot[] }[] {
  const tz = safeZone(timeZone);
  const keyOf = (iso: string) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(iso));
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  };
  const byDay = new Map<string, AvailabilitySlot[]>();
  for (const slot of slots) {
    const key = keyOf(slot.starts_at);
    const list = byDay.get(key) ?? [];
    list.push(slot);
    byDay.set(key, list);
  }
  return Array.from(byDay.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([day, list]) => {
      const sorted = [...list].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
      return { day, label: formatMeetingDate(sorted[0].starts_at, timeZone), slots: sorted };
    });
}

// ============================================
// What the employer sees — one scheduling state, one primary action
// ============================================
// Drives the candidate modal and the pipeline card alike so the visibility
// rules can't drift: scheduling actions appear only for a Screening or
// Interview category, and there is never more than one primary action.

export type InterviewSummary = {
  id: string;
  application_id?: string;
  status: string;
  scheduled_at: string;
  duration_minutes: number;
  format?: string | null;
  meeting_url?: string | null;
  meeting_type?: string | null;
  employer_notes?: string | null;
};

/** Interview rows that still have to happen (mirrors the one-active unique index). */
export const LIVE_INTERVIEW_STATUSES = ['pending', 'accepted', 'reschedule_requested'];

export function isLiveInterviewStatus(status: string): boolean {
  return LIVE_INTERVIEW_STATUSES.includes(status);
}

export type SchedulingView =
  /** Not a Screening/Interview category and nothing booked: no scheduling UI. */
  | { kind: 'hidden' }
  /** Before requesting: the one action is "Request Time". */
  | { kind: 'request'; meetingType: MeetingType; lastOutcome: 'no_availability' | 'cancelled' | null }
  /** Request sent; the student hasn't picked yet. */
  | { kind: 'awaiting_student'; meetingType: MeetingType; request: AvailabilityRequest; canAct: boolean }
  /** The student picked a slot (tentative); the one action is Confirm Screening/Interview. */
  | { kind: 'selected'; meetingType: MeetingType; request: AvailabilityRequest; slot: AvailabilitySlot; canAct: boolean }
  /** Confirmed meeting. `canAct` gates the secondary "Request new time". */
  | { kind: 'confirmed'; meetingType: MeetingType; interview: InterviewSummary; canAct: boolean };

export function employerSchedulingView(input: {
  stage: { stage_type?: string | null; label?: string | null } | null | undefined;
  /** The newest availability request for the application, if any (with slots). */
  request: AvailabilityRequest | null | undefined;
  /** The application's live interview, if any. */
  interview: InterviewSummary | null | undefined;
}): SchedulingView {
  const category = meetingTypeForStage(input.stage);
  const canAct = category !== null;
  const { request, interview } = input;

  // An open negotiation wins: it's what the employer has to act on next, and
  // it may be a reschedule of an interview that's already booked.
  if (request && isLiveAvailabilityStatus(request.status)) {
    const meetingType = category ?? (isMeetingType(request.meeting_type) ? request.meeting_type : 'interview');
    if (request.status === 'awaiting_employer') {
      const slot = selectedSlotOf(request);
      if (slot) return { kind: 'selected', meetingType, request, slot, canAct };
    }
    return { kind: 'awaiting_student', meetingType, request, canAct };
  }

  if (interview && isLiveInterviewStatus(interview.status)) {
    const meetingType = isMeetingType(interview.meeting_type) ? interview.meeting_type : category ?? 'interview';
    return { kind: 'confirmed', meetingType, interview, canAct };
  }

  if (!category) return { kind: 'hidden' };

  const lastOutcome = request && (request.status === 'no_availability' || request.status === 'cancelled')
    ? request.status
    : null;
  return { kind: 'request', meetingType: category, lastOutcome };
}

/** The label of the view's single primary action, or null when there isn't one. */
export function primarySchedulingAction(view: SchedulingView): string | null {
  switch (view.kind) {
    case 'request': return 'Request Time';
    case 'selected': return view.canAct ? `Confirm ${MEETING_TYPE_LABELS[view.meetingType]}` : null;
    default: return null;
  }
}

/** Short status line for a card chip / the modal's status row. */
export function schedulingStatusLabel(view: SchedulingView): string | null {
  switch (view.kind) {
    case 'hidden': return null;
    case 'request': return view.lastOutcome === 'no_availability' ? 'No times worked — request again' : 'Not scheduled';
    case 'awaiting_student': return 'Awaiting Student Selection';
    case 'selected': return formatSelectedLabel(view.slot.starts_at);
    case 'confirmed':
      return view.interview.status === 'accepted'
        ? `${MEETING_TYPE_LABELS[view.meetingType]} confirmed`
        : view.interview.status === 'reschedule_requested'
          ? 'Candidate asked to reschedule'
          : 'Invite sent — awaiting reply';
  }
}
