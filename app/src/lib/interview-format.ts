// ============================================
// INTERVIEW FORMAT — how an interview happens
// ============================================
// The employer picks one when they schedule (or reschedule) an interview:
//   internfirst   — the built-in InternFirst video room
//   external_link — their own meeting link, sent to the student in chat
//   phone         — a phone screen; the student is asked in chat for a number
//
// Pure module: imported by the scheduling modals, the API routes and the
// interview surfaces so the rules and the chat wording can't drift.

export type InterviewFormat = 'internfirst' | 'external_link' | 'phone';

export const INTERVIEW_FORMATS: InterviewFormat[] = ['internfirst', 'external_link', 'phone'];

export const INTERVIEW_FORMAT_LABELS: Record<InterviewFormat, string> = {
  internfirst: 'InternFirst video',
  external_link: 'Your own link',
  phone: 'Phone screen',
};

export const INTERVIEW_FORMAT_DESCRIPTIONS: Record<InterviewFormat, string> = {
  internfirst: 'Meet in the built-in InternFirst video room.',
  external_link: 'Zoom, Teams, Meet… we send the link to the candidate in chat.',
  phone: 'We ask the candidate in chat for the best number to call.',
};

export function isInterviewFormat(v: unknown): v is InterviewFormat {
  return typeof v === 'string' && (INTERVIEW_FORMATS as string[]).includes(v);
}

/** Rows written before formats existed have no column value — they were all video. */
export function interviewFormatOf(row: { format?: string | null }): InterviewFormat {
  return isInterviewFormat(row.format) ? row.format : 'internfirst';
}

export type FormatInput = { format?: unknown; meetingUrl?: unknown };

/**
 * Validates the employer's format choice. Returns the normalized pair to
 * store: meeting_url is kept only for external_link.
 */
export function validateInterviewFormat(
  input: FormatInput,
): { ok: true; format: InterviewFormat; meetingUrl: string | null } | { ok: false; error: string } {
  const format = input.format === undefined || input.format === null ? 'internfirst' : input.format;
  if (!isInterviewFormat(format)) return { ok: false, error: 'Pick how the interview will happen' };

  if (format !== 'external_link') return { ok: true, format, meetingUrl: null };

  const raw = typeof input.meetingUrl === 'string' ? input.meetingUrl.trim() : '';
  if (!raw) return { ok: false, error: 'Add the meeting link' };
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, error: 'That meeting link doesn’t look like a valid URL' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, error: 'The meeting link must start with http:// or https://' };
  }
  if (!url.hostname.includes('.')) {
    return { ok: false, error: 'That meeting link doesn’t look like a valid URL' };
  }
  return { ok: true, format, meetingUrl: url.toString() };
}

/**
 * Columns to write for a format. The InternFirst room is the column default, so
 * it writes nothing — the default path keeps working on a database that hasn't
 * had migrations/20261008_interview_format.sql applied yet.
 */
export function interviewFormatColumns(
  format: InterviewFormat,
  meetingUrl: string | null,
): { format?: InterviewFormat; meeting_url?: string | null } {
  return format === 'internfirst' ? {} : { format, meeting_url: meetingUrl };
}

export function safeTimeZone(tz: unknown): string {
  if (typeof tz !== 'string' || !tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

/** "Tuesday, October 14, 2026" and "2:00 PM EDT" in the employer's time zone. */
export function formatInterviewDateTime(iso: string, timeZone?: string): { date: string; time: string } {
  const tz = safeTimeZone(timeZone);
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: tz,
  });
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: tz,
  });
  return { date, time };
}

/**
 * The final details a confirmed screening/interview posts into the shared
 * chat thread — every format, so both parties have the meeting type, date,
 * time, zone, duration and where it happens in their messages. Written in the
 * employer's zone, with the student's own time added when theirs differs.
 */
export function buildConfirmedMeetingMessage(opts: {
  meetingType: 'screening' | 'interview';
  format: InterviewFormat;
  companyName: string;
  listingTitle: string;
  scheduledAt: string;
  durationMinutes: number;
  meetingUrl?: string | null;
  /** The employer's zone. */
  timeZone?: string;
  /** The student's zone, when known. */
  studentTimeZone?: string | null;
  notes?: string | null;
  rescheduled?: boolean;
}): string {
  const typeLabel = opts.meetingType === 'screening' ? 'Screening' : 'Interview';
  const { date, time } = formatInterviewDateTime(opts.scheduledAt, opts.timeZone);
  const employerTz = safeTimeZone(opts.timeZone);
  const studentTz = opts.studentTimeZone ? safeTimeZone(opts.studentTimeZone) : null;
  const studentTime = studentTz && studentTz !== employerTz
    ? formatInterviewDateTime(opts.scheduledAt, studentTz)
    : null;
  const notes = opts.notes?.trim();

  const where =
    opts.format === 'external_link' ? `Link: ${opts.meetingUrl ?? ''}`
    : opts.format === 'phone' ? `Location: Phone call — ${opts.companyName} will call you. Please reply here with the best phone number to reach you.`
    : 'Location: InternFirst video room — use the Join button on your Interviews page when it opens (10 minutes before the start).';

  return [
    `${opts.rescheduled ? 'Updated: ' : ''}${typeLabel} confirmed — ${opts.listingTitle} at ${opts.companyName}`,
    '',
    `Type: ${typeLabel}${opts.format === 'phone' ? ' (phone)' : ''}`,
    `Date: ${date}`,
    `Time: ${time}${studentTime ? ` (${studentTime.time} your time${studentTime.date !== date ? `, ${studentTime.date}` : ''})` : ''}`,
    `Duration: ${opts.durationMinutes} min`,
    where,
    ...(notes ? ['', `Notes: ${notes}`] : []),
    '',
    'This meeting is confirmed and shows on your Interviews page.',
  ].join('\n');
}

/**
 * The chat message the student receives for an off-platform interview, or
 * null for the InternFirst room (that flow already has its own surfaces).
 */
export function buildInterviewFormatMessage(opts: {
  format: InterviewFormat;
  companyName: string;
  listingTitle: string;
  scheduledAt: string;
  durationMinutes: number;
  meetingUrl?: string | null;
  timeZone?: string;
  notes?: string | null;
  rescheduled?: boolean;
}): string | null {
  if (opts.format === 'internfirst') return null;

  const { date, time } = formatInterviewDateTime(opts.scheduledAt, opts.timeZone);
  const notes = opts.notes?.trim();
  const updated = opts.rescheduled ? 'Updated: ' : '';

  if (opts.format === 'external_link') {
    return [
      `${updated}Interview scheduled — ${opts.listingTitle} at ${opts.companyName}`,
      '',
      `Date: ${date}`,
      `Time: ${time} (${opts.durationMinutes} min)`,
      `Link: ${opts.meetingUrl ?? ''}`,
      ...(notes ? ['', `Notes: ${notes}`] : []),
      '',
      'Please confirm the interview from your dashboard.',
    ].join('\n');
  }

  return [
    `${updated}Phone screening — ${opts.listingTitle} at ${opts.companyName}`,
    '',
    `Date: ${date}`,
    `Time: ${time} (${opts.durationMinutes} min)`,
    '',
    `${opts.companyName} will call you for this phone screening. Please reply here with the best phone number to reach you.`,
    ...(notes ? ['', `Notes: ${notes}`] : []),
  ].join('\n');
}
