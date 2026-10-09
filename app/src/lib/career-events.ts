// ============================================
// CAREER EVENTS — pure domain module
// ============================================
// Everything here is side-effect free so it can be shared by the sync route,
// the student page, the admin page and the tests:
//
//   * a minimal iCal (RFC 5545) reader — line unfolding, parameters, text
//     escapes, DATE / DATE-TIME / UTC / TZID times — and the normalisation of a
//     VEVENT into a career_events row;
//   * relevance: which events a student sees and why (campus / local / online);
//   * notification planning: which favorite reminders and "new major event"
//     notifications are due, minus the ones the dedupe ledger already holds.
//
// Deliberately not a full iCal implementation: RRULE recurrences are not
// expanded (campus platforms like Localist emit one VEVENT per occurrence, and
// a RECURRENCE-ID instance is kept as its own row), and VTIMEZONE blocks are
// ignored in favour of the IANA zone named by TZID (resolved through Intl).

// ----- Categories -----

export const EVENT_CATEGORIES = [
  'career_fair',
  'info_session',
  'workshop',
  'networking',
  'employer_event',
  'other',
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  career_fair: 'Career Fair',
  info_session: 'Info Session',
  workshop: 'Workshop',
  networking: 'Networking',
  employer_event: 'Employer Event',
  other: 'Other',
};

export function isEventCategory(value: unknown): value is EventCategory {
  return typeof value === 'string' && (EVENT_CATEGORIES as readonly string[]).includes(value);
}

// ----- Row shapes -----

export type EventSource = {
  id: string;
  name: string;
  ical_url: string;
  school_id: number | null;
  school_name: string | null;
  city: string | null;
  state: string | null;
  default_category: EventCategory;
  default_timezone: string;
  include_keywords: string[] | null;
  is_active: boolean;
  last_synced_at: string | null;
  last_error: string | null;
  last_event_count: number | null;
  created_at?: string;
};

export type CareerEvent = {
  id: string;
  source_id: string | null;
  external_id: string | null;
  origin: 'ical' | 'manual';
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  timezone: string | null;
  location: string | null;
  virtual_url: string | null;
  url: string | null;
  organizer: string | null;
  category: EventCategory;
  school_id: number | null;
  school_name: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  is_major: boolean;
  major_marked_at: string | null;
  status: 'active' | 'cancelled';
  created_at: string;
  updated_at?: string;
};

/** What the sync writes. Omits is_major on purpose so an admin's flag survives re-syncs. */
export type CareerEventUpsert = Omit<
  CareerEvent,
  'id' | 'is_major' | 'major_marked_at' | 'created_at' | 'updated_at'
>;

// ----- iCal reading -----

export type IcalTime = {
  /** YYYYMMDD */
  date: string;
  /** HHMMSS, absent for VALUE=DATE (all-day) */
  time?: string;
  utc: boolean;
  tzid?: string;
};

export type IcalEvent = {
  uid: string;
  recurrenceId?: string;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  organizer?: string;
  categories: string[];
  status?: string;
  start: IcalTime;
  end?: IcalTime;
  /** Raw RRULE, kept for diagnostics — not expanded. */
  rrule?: string;
  geo?: { lat: number; lng: number };
};

type ContentLine = { name: string; params: Record<string, string>; value: string };

/** RFC 5545 §3.1: a line starting with a space or tab continues the previous one. */
export function unfoldLines(text: string): string[] {
  const raw = text.replace(/^﻿/, '').split(/\r\n|\n|\r/);
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else if (line.length > 0) {
      out.push(line);
    }
  }
  return out;
}

/** Splits `NAME;PARAM=a;PARAM2="b:c":value`, respecting quoted parameter values. */
export function parseContentLine(line: string): ContentLine | null {
  let i = 0;
  let inQuotes = false;
  let colon = -1;
  for (; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ':' && !inQuotes) { colon = i; break; }
  }
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);

  const parts: string[] = [];
  let buf = '';
  inQuotes = false;
  for (const ch of head) {
    if (ch === '"') { inQuotes = !inQuotes; buf += ch; }
    else if (ch === ';' && !inQuotes) { parts.push(buf); buf = ''; }
    else buf += ch;
  }
  parts.push(buf);

  const name = parts[0].toUpperCase();
  const params: Record<string, string> = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=');
    if (eq < 0) continue;
    params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name, params, value };
}

/** TEXT value escapes: \\n \\N \\, \\; \\\\ */
export function unescapeText(value: string): string {
  return value.replace(/\\([nN,;\\])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
}

export function parseIcalTime(value: string, params: Record<string, string>): IcalTime | null {
  const m = value.trim().match(/^(\d{8})(?:T(\d{6})(Z)?)?$/);
  if (!m) return null;
  const allDay = params.VALUE === 'DATE' || !m[2];
  if (allDay) return { date: m[1], utc: false };
  return { date: m[1], time: m[2], utc: !!m[3], tzid: m[3] ? undefined : params.TZID };
}

/** Parses every VEVENT in a calendar. Malformed events are skipped, not fatal. */
export function parseIcal(text: string): IcalEvent[] {
  const events: IcalEvent[] = [];
  let current: Partial<IcalEvent> | null = null;
  // Depth inside nested components (VALARM) of the current VEVENT.
  let nested = 0;

  for (const line of unfoldLines(text)) {
    const cl = parseContentLine(line);
    if (!cl) continue;

    if (cl.name === 'BEGIN') {
      if (cl.value.toUpperCase() === 'VEVENT' && !current) {
        current = { categories: [] };
        nested = 0;
      } else if (current) {
        nested++;
      }
      continue;
    }
    if (cl.name === 'END') {
      if (!current) continue;
      if (nested > 0) { nested--; continue; }
      if (cl.value.toUpperCase() === 'VEVENT') {
        if (current.uid && current.start && current.summary) events.push(current as IcalEvent);
        current = null;
      }
      continue;
    }
    if (!current || nested > 0) continue;

    switch (cl.name) {
      case 'UID': current.uid = cl.value.trim(); break;
      case 'SUMMARY': current.summary = unescapeText(cl.value).trim(); break;
      case 'DESCRIPTION': current.description = unescapeText(cl.value).trim(); break;
      case 'LOCATION': current.location = unescapeText(cl.value).trim(); break;
      case 'URL': current.url = cl.value.trim(); break;
      case 'STATUS': current.status = cl.value.trim().toUpperCase(); break;
      case 'RRULE': current.rrule = cl.value.trim(); break;
      case 'RECURRENCE-ID': current.recurrenceId = cl.value.trim(); break;
      case 'ORGANIZER':
        current.organizer = (cl.params.CN ?? cl.value.replace(/^mailto:/i, '')).trim();
        break;
      case 'CATEGORIES':
        current.categories = [
          ...(current.categories ?? []),
          ...unescapeText(cl.value.replace(/\\,/g, '\u0000')).split(',').map((c) => c.replace(/\u0000/g, ',').trim()).filter(Boolean),
        ];
        break;
      case 'GEO': {
        const [lat, lng] = cl.value.split(/[;,]/).map(Number);
        if (Number.isFinite(lat) && Number.isFinite(lng)) current.geo = { lat, lng };
        break;
      }
      case 'DTSTART': {
        const t = parseIcalTime(cl.value, cl.params);
        if (t) current.start = t;
        break;
      }
      case 'DTEND': {
        const t = parseIcalTime(cl.value, cl.params);
        if (t) current.end = t;
        break;
      }
    }
  }
  return events;
}

// ----- Time zones -----

// Outlook/Exchange feeds name zones the Windows way.
const WINDOWS_ZONES: Record<string, string> = {
  'Eastern Standard Time': 'America/New_York',
  'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver',
  'US Mountain Standard Time': 'America/Phoenix',
  'Pacific Standard Time': 'America/Los_Angeles',
  'Alaskan Standard Time': 'America/Anchorage',
  'Hawaiian Standard Time': 'Pacific/Honolulu',
  'Atlantic Standard Time': 'America/Halifax',
  UTC: 'UTC',
};

export function resolveTimeZone(tzid: string | undefined, fallback: string): string {
  const candidates = [tzid ? WINDOWS_ZONES[tzid] ?? tzid.replace(/^\/+/, '') : undefined, fallback, 'UTC'];
  for (const tz of candidates) {
    if (!tz) continue;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return tz;
    } catch {
      // not a zone Intl knows — try the next one
    }
  }
  return 'UTC';
}

function tzOffsetMs(instant: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p: Record<string, number> = {};
  for (const part of dtf.formatToParts(new Date(instant))) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return wall - Math.floor(instant / 1000) * 1000;
}

/** Wall-clock time in `timeZone` → UTC instant (DST-correct for non-gap times). */
export function zonedTimeToUtc(
  y: number, mo: number, d: number, h: number, mi: number, s: number, timeZone: string,
): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const first = guess - tzOffsetMs(guess, timeZone);
  const second = guess - tzOffsetMs(first, timeZone);
  return new Date(second);
}

export function icalTimeToDate(t: IcalTime, fallbackTz: string): Date {
  const y = Number(t.date.slice(0, 4));
  const mo = Number(t.date.slice(4, 6));
  const d = Number(t.date.slice(6, 8));
  if (!t.time) return zonedTimeToUtc(y, mo, d, 0, 0, 0, resolveTimeZone(undefined, fallbackTz));
  const h = Number(t.time.slice(0, 2));
  const mi = Number(t.time.slice(2, 4));
  const s = Number(t.time.slice(4, 6));
  if (t.utc) return new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  return zonedTimeToUtc(y, mo, d, h, mi, s, resolveTimeZone(t.tzid, fallbackTz));
}

// ----- Normalisation -----

const CATEGORY_KEYWORDS: [EventCategory, RegExp][] = [
  ['career_fair', /\b(career|job|internship)\s+(fair|expo)\b|\bcareer\s+expo\b|\bhiring\s+fair\b/i],
  ['info_session', /\binfo(rmation(al)?)?\s+session\b/i],
  ['networking', /\bnetworking\b|\bmixer\b|\bmeet[- ]?up\b|\bcoffee\s+chat\b/i],
  ['workshop', /\bworkshop\b|\bwebinar\b|\bresume\b|\brésumé\b|\bmock\s+interview\b|\bbootcamp\b|\bclinic\b/i],
  ['employer_event', /\bemployer\b|\brecruit(ing|er|ment)?\b|\bon[- ]campus\s+interview/i],
];

export function inferCategory(text: string, fallback: EventCategory): EventCategory {
  for (const [category, re] of CATEGORY_KEYWORDS) if (re.test(text)) return category;
  return fallback;
}

export function matchesKeywords(text: string, keywords: string[] | null | undefined): boolean {
  const list = (keywords ?? []).map((k) => k.trim().toLowerCase()).filter(Boolean);
  if (list.length === 0) return true;
  const hay = text.toLowerCase();
  return list.some((k) => hay.includes(k));
}

const URL_RE = /\bhttps?:\/\/[^\s<>"')]+/i;
const VIRTUAL_HOSTS = /(zoom\.us|teams\.microsoft\.com|meet\.google\.com|webex\.com|gotomeeting\.com|hopin\.com|handshake\.com\/.*virtual)/i;

function safeHttpUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

function clip(value: string | undefined, max: number): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  return v.length > max ? `${v.slice(0, max - 1)}…` : v;
}

export const SYNC_LOOKBACK_MS = 24 * 60 * 60 * 1000;
export const SYNC_HORIZON_MS = 180 * 24 * 60 * 60 * 1000;

/**
 * VEVENT → career_events row, or null when it shouldn't be imported (outside
 * the sync window, filtered out by the source's keywords, unusable times).
 */
export function normalizeIcalEvent(
  ev: IcalEvent,
  source: Pick<EventSource, 'id' | 'school_id' | 'school_name' | 'city' | 'state' | 'default_category' | 'default_timezone' | 'include_keywords'>,
  now: Date,
): CareerEventUpsert | null {
  const searchable = [ev.summary, ev.description ?? '', ev.categories.join(' ')].join(' ');
  if (!matchesKeywords(searchable, source.include_keywords)) return null;

  const tz = resolveTimeZone(ev.start.tzid, source.default_timezone);
  const start = icalTimeToDate(ev.start, tz);
  if (Number.isNaN(start.getTime())) return null;
  let end = ev.end ? icalTimeToDate(ev.end, tz) : null;
  if (end && (Number.isNaN(end.getTime()) || end < start)) end = null;

  const allDay = !ev.start.time;
  // All-day DTEND is exclusive (the next midnight); a one-day event has no real
  // end. 25h, not 24h: the day DST ends is 25 hours long.
  if (allDay && end && end.getTime() - start.getTime() <= 25 * 60 * 60 * 1000) end = null;

  const effectiveEnd = end ?? start;
  if (effectiveEnd.getTime() < now.getTime() - SYNC_LOOKBACK_MS) return null;
  if (start.getTime() > now.getTime() + SYNC_HORIZON_MS) return null;

  const location = clip(ev.location, 500);
  const url = safeHttpUrl(ev.url);
  const locationUrl = location?.match(URL_RE)?.[0];
  const descUrl = ev.description?.match(URL_RE)?.[0];
  const virtualCandidate = [locationUrl, descUrl, url].find((u) => u && VIRTUAL_HOSTS.test(u));
  const isOnline = /\b(virtual|online|zoom|webinar)\b/i.test(location ?? '') || !!(locationUrl && VIRTUAL_HOSTS.test(locationUrl));

  const externalId = ev.recurrenceId ? `${ev.uid}#${ev.recurrenceId}` : ev.uid;

  return {
    source_id: source.id,
    external_id: clip(externalId, 500),
    origin: 'ical',
    title: clip(ev.summary, 300) ?? 'Untitled event',
    description: clip(ev.description, 5000),
    starts_at: start.toISOString(),
    ends_at: end ? end.toISOString() : null,
    all_day: allDay,
    timezone: tz,
    location: isOnline && !location ? 'Online' : location,
    virtual_url: safeHttpUrl(virtualCandidate),
    url,
    organizer: clip(ev.organizer, 200),
    category: inferCategory(searchable, source.default_category),
    school_id: source.school_id,
    school_name: source.school_name,
    city: source.city,
    state: source.state,
    latitude: ev.geo?.lat ?? null,
    longitude: ev.geo?.lng ?? null,
    status: ev.status === 'CANCELLED' ? 'cancelled' : 'active',
  };
}

/** Parse + normalise + dedupe a whole feed. Later duplicates of a UID win. */
export function eventsFromFeed(
  text: string,
  source: Parameters<typeof normalizeIcalEvent>[1],
  now: Date,
  limit = 1000,
): CareerEventUpsert[] {
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('Response is not an iCal (.ics) calendar');
  const byId = new Map<string, CareerEventUpsert>();
  for (const ev of parseIcal(text)) {
    const row = normalizeIcalEvent(ev, source, now);
    if (row?.external_id) byId.set(row.external_id, row);
  }
  return [...byId.values()]
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, limit);
}

// ----- Feed URL safety -----

/**
 * Admins register feed URLs, and the server fetches them, so refuse anything
 * that points at the server's own network. webcal:// is the same as https://.
 */
export function normalizeFeedUrl(input: string): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = input.trim().replace(/^webcals?:\/\//i, 'https://');
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return { ok: false, error: 'Enter a full feed URL, e.g. https://events.example.edu/calendar.ics' };
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, error: 'Feed URL must be http(s) or webcal.' };
  if (u.username || u.password) return { ok: false, error: 'Feed URL must not contain credentials.' };
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const privateHost =
    host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^(::1?|f[cd][0-9a-f]{2}:|fe80:)/.test(host) ||
    !host.includes('.') && !host.includes(':');
  if (privateHost) return { ok: false, error: 'Feed URL must be a public internet address.' };
  return { ok: true, url: u.toString() };
}

// ----- Relevance -----

export type EventScope = 'campus' | 'local' | 'online';

export const EVENT_SCOPE_LABELS: Record<EventScope, string> = {
  campus: 'Campus',
  local: 'Local',
  online: 'Online',
};

export type StudentLocation = { schoolId: number | null; state: string | null };

function sameState(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Why a student sees this event, or null if they shouldn't:
 *   campus — tagged to the student's own school
 *   local  — not a campus event, tagged to the student's school's state
 *   online — no school and no state: open to everyone
 * Other schools' campus events are hidden even in the same state; they're
 * usually closed to outside students.
 */
export function eventScopeFor(
  event: Pick<CareerEvent, 'school_id' | 'state'>,
  student: StudentLocation,
): EventScope | null {
  if (event.school_id != null) {
    return student.schoolId != null && event.school_id === student.schoolId ? 'campus' : null;
  }
  if (event.state) return sameState(event.state, student.state) ? 'local' : null;
  return 'online';
}

export type ScopedEvent<E> = E & { scope: EventScope };

/** Upcoming (or in-progress), active events the student should see, soonest first. */
export function relevantEventsForStudent<E extends Pick<CareerEvent, 'school_id' | 'state' | 'starts_at' | 'ends_at' | 'status'>>(
  events: E[],
  student: StudentLocation,
  now: Date,
): ScopedEvent<E>[] {
  const out: ScopedEvent<E>[] = [];
  for (const ev of events) {
    if (ev.status !== 'active') continue;
    const end = new Date(ev.ends_at ?? ev.starts_at).getTime();
    if (end < now.getTime()) continue;
    const scope = eventScopeFor(ev, student);
    if (scope) out.push({ ...ev, scope });
  }
  return out.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

// ----- Notification planning -----

export type NotificationKind = 'reminder' | 'major';

export type LedgerEntry = { user_id: string; event_id: string; kind: NotificationKind };

export type EventPreferences = { user_id: string; notify_favorites: boolean; notify_major: boolean };

export const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MAJOR_LOOKBACK_MS = 72 * 60 * 60 * 1000;
export const MAX_MAJOR_PER_STUDENT_PER_RUN = 5;

export function ledgerKey(e: LedgerEntry): string {
  return `${e.user_id}|${e.event_id}|${e.kind}`;
}

export type PlannedNotification = LedgerEntry & { title: string; body: string; link: string };

export function eventLink(eventId: string): string {
  return `/dashboard/student/events?event=${eventId}`;
}

/** "Tue, Oct 14 · 3:00 PM EDT" in the event's zone (or the given one). */
export function formatEventWhen(
  event: Pick<CareerEvent, 'starts_at' | 'all_day' | 'timezone'>,
  timeZone?: string,
): string {
  const tz = resolveTimeZone(timeZone ?? event.timezone ?? undefined, 'America/New_York');
  const d = new Date(event.starts_at);
  const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz });
  if (event.all_day) return `${date} · All day`;
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz, timeZoneName: 'short' });
  return `${date} · ${time}`;
}

/**
 * Favorite reminders: favorited, active events that start within the next
 * 24h, for students who haven't turned reminders off, minus anything already
 * in the ledger. The cron runs hourly, so the reminder lands ~24h out; a
 * favorite added later than that still gets one before the event starts.
 */
export function planFavoriteReminders(args: {
  favorites: { user_id: string; event_id: string }[];
  events: Pick<CareerEvent, 'id' | 'title' | 'starts_at' | 'all_day' | 'timezone' | 'status' | 'location'>[];
  preferences: EventPreferences[];
  ledger: LedgerEntry[];
  now: Date;
  windowMs?: number;
}): PlannedNotification[] {
  const { favorites, events, preferences, ledger, now, windowMs = REMINDER_WINDOW_MS } = args;
  const byId = new Map(events.map((e) => [e.id, e]));
  const optedOut = new Set(preferences.filter((p) => !p.notify_favorites).map((p) => p.user_id));
  const sent = new Set(ledger.map(ledgerKey));
  const out: PlannedNotification[] = [];
  for (const fav of favorites) {
    const ev = byId.get(fav.event_id);
    if (!ev || ev.status !== 'active' || optedOut.has(fav.user_id)) continue;
    const startsIn = new Date(ev.starts_at).getTime() - now.getTime();
    if (startsIn <= 0 || startsIn > windowMs) continue;
    const entry: LedgerEntry = { user_id: fav.user_id, event_id: ev.id, kind: 'reminder' };
    const key = ledgerKey(entry);
    if (sent.has(key)) continue;
    sent.add(key);
    out.push({
      ...entry,
      title: `Coming up: ${ev.title}`,
      body: `${formatEventWhen(ev)}${ev.location ? ` · ${ev.location}` : ''}`,
      link: eventLink(ev.id),
    });
  }
  return out;
}

/**
 * New major events: is_major, active, still upcoming, and marked major within
 * the lookback window (so a student who signs up today isn't flooded with
 * every major event of the semester). Each relevant student gets at most
 * MAX_MAJOR_PER_STUDENT_PER_RUN per run, soonest events first; the rest go out
 * on later runs while still inside the window.
 */
export function planMajorEventNotifications(args: {
  events: Pick<CareerEvent, 'id' | 'title' | 'starts_at' | 'all_day' | 'timezone' | 'status' | 'is_major' | 'major_marked_at' | 'school_id' | 'state' | 'school_name' | 'city'>[];
  students: { user_id: string; school_id: number | null; school_state: string | null }[];
  preferences: EventPreferences[];
  ledger: LedgerEntry[];
  now: Date;
  lookbackMs?: number;
  maxPerStudent?: number;
}): PlannedNotification[] {
  const { students, preferences, ledger, now, lookbackMs = MAJOR_LOOKBACK_MS, maxPerStudent = MAX_MAJOR_PER_STUDENT_PER_RUN } = args;
  const events = args.events
    .filter((e) =>
      e.is_major && e.status === 'active' && e.major_marked_at &&
      new Date(e.starts_at).getTime() > now.getTime() &&
      now.getTime() - new Date(e.major_marked_at).getTime() <= lookbackMs)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const optedOut = new Set(preferences.filter((p) => !p.notify_major).map((p) => p.user_id));
  const sent = new Set(ledger.map(ledgerKey));
  const out: PlannedNotification[] = [];

  for (const student of students) {
    if (optedOut.has(student.user_id)) continue;
    let count = 0;
    for (const ev of events) {
      if (count >= maxPerStudent) break;
      const scope = eventScopeFor(ev, { schoolId: student.school_id, state: student.school_state });
      if (!scope) continue;
      const entry: LedgerEntry = { user_id: student.user_id, event_id: ev.id, kind: 'major' };
      const key = ledgerKey(entry);
      if (sent.has(key)) continue;
      sent.add(key);
      count++;
      const where = scope === 'campus' ? (ev.school_name ?? 'your campus') : scope === 'local' ? (ev.city ? `${ev.city}, ${ev.state}` : ev.state) : 'Online';
      out.push({
        ...entry,
        title: `New major event: ${ev.title}`,
        body: `${formatEventWhen(ev)} · ${where}`,
        link: eventLink(ev.id),
      });
    }
  }
  return out;
}

// ----- Display helpers -----

/** YYYY-MM-DD in the viewer's zone (what Calendar keys days by). */
export function localDateKey(iso: string, timeZone?: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return parts;
}

/** HH:MM in the viewer's zone. */
export function localTimeKey(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}
