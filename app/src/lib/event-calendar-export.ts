// ============================================
// CAREER EVENTS — "Add to calendar"
// ============================================
// Pure builders for the two ways a student can put a career event on their
// own calendar: a Google Calendar "new event" link, and a one-event .ics file
// (Apple Calendar, Outlook and anything else that opens iCalendar). Both use
// only the event row the page already has, so nothing touches the server.

import { localDateKey, type CareerEvent } from './career-events';

export type ExportableEvent = Pick<
  CareerEvent,
  'id' | 'title' | 'description' | 'starts_at' | 'ends_at' | 'all_day' | 'timezone' | 'location' | 'virtual_url' | 'url' | 'organizer' | 'city' | 'state'
>;

/** Timed events with no end are shown as an hour long. */
const DEFAULT_DURATION_MS = 60 * 60 * 1000;

function utcStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function dateStamp(key: string): string {
  return key.replace(/-/g, '');
}

function nextDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/**
 * Start/end for the calendar entry. All-day: local dates (end exclusive, as
 * both Google and iCalendar expect — the sync stores an all-day end the same
 * way). Timed: UTC instants.
 */
export function calendarRange(e: ExportableEvent): { allDay: true; start: string; end: string } | { allDay: false; start: string; end: string } {
  if (e.all_day) {
    const tz = e.timezone ?? undefined;
    const start = localDateKey(e.starts_at, tz);
    const endKey = e.ends_at ? localDateKey(e.ends_at, tz) : null;
    return { allDay: true, start: dateStamp(start), end: dateStamp(endKey && endKey > start ? endKey : nextDay(start)) };
  }
  const end = e.ends_at && new Date(e.ends_at) > new Date(e.starts_at)
    ? e.ends_at
    : new Date(new Date(e.starts_at).getTime() + DEFAULT_DURATION_MS).toISOString();
  return { allDay: false, start: utcStamp(e.starts_at), end: utcStamp(end) };
}

export function eventLocation(e: ExportableEvent): string {
  if (e.location) return e.location;
  if (e.city && e.state) return `${e.city}, ${e.state}`;
  return e.virtual_url ?? '';
}

/** Description plus the links a student needs on the day. */
export function eventDetails(e: ExportableEvent, maxDescription = 1500): string {
  const desc = (e.description ?? '').trim();
  const parts = [
    desc.length > maxDescription ? `${desc.slice(0, maxDescription - 1).trimEnd()}…` : desc,
    e.organizer ? `Hosted by ${e.organizer}` : '',
    e.virtual_url ? `Join online: ${e.virtual_url}` : '',
    e.url ? `Event details: ${e.url}` : '',
    'From InternFirst Career Events',
  ];
  return parts.filter(Boolean).join('\n\n');
}

export function googleCalendarUrl(e: ExportableEvent): string {
  const range = calendarRange(e);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${range.start}/${range.end}`,
    // Google limits the whole URL; keep the description short there.
    details: eventDetails(e, 800),
  });
  const location = eventLocation(e);
  if (location) params.set('location', location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// ----- .ics -----

/** RFC 5545 TEXT escaping. */
export function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** RFC 5545 §3.1: lines longer than 75 octets continue on the next line after a space. */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + size > limit) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n ');
}

export function eventIcs(e: ExportableEvent, now = new Date()): string {
  const range = calendarRange(e);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//InternFirst//Career Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.id}@intern-first.com`,
    `DTSTAMP:${utcStamp(now.toISOString())}`,
    range.allDay ? `DTSTART;VALUE=DATE:${range.start}` : `DTSTART:${range.start}`,
    range.allDay ? `DTEND;VALUE=DATE:${range.end}` : `DTEND:${range.end}`,
    `SUMMARY:${escapeIcsText(e.title)}`,
    `DESCRIPTION:${escapeIcsText(eventDetails(e))}`,
  ];
  const location = eventLocation(e);
  if (location) lines.push(`LOCATION:${escapeIcsText(location)}`);
  if (e.url) lines.push(`URL:${e.url}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

/** A filesystem-safe name: "Fall Career Fair!" → "fall-career-fair.ics". */
export function icsFilename(title: string): string {
  const slug = title.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 60);
  return `${slug || 'event'}.ics`;
}
