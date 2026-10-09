import { describe, expect, it } from 'vitest';
import {
  isoToZonedInput,
  zonedInputToIso,
  eventScopeFor,
  eventsFromFeed,
  inferCategory,
  normalizeFeedUrl,
  normalizeIcalEvent,
  parseContentLine,
  parseIcal,
  planFavoriteReminders,
  planMajorEventNotifications,
  relevantEventsForStudent,
  unfoldLines,
  zonedTimeToUtc,
  type CareerEvent,
  type EventSource,
} from './career-events';

const SOURCE: Pick<EventSource, 'id' | 'school_id' | 'school_name' | 'city' | 'state' | 'default_category' | 'default_timezone' | 'include_keywords'> = {
  id: 'src-1',
  school_id: 199120,
  school_name: 'University of North Carolina at Chapel Hill',
  city: null,
  state: 'North Carolina',
  default_category: 'other',
  default_timezone: 'America/New_York',
  include_keywords: null,
};

const NOW = new Date('2026-10-09T12:00:00Z');

const FEED = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'PRODID:-//Localist//EN',
  'BEGIN:VTIMEZONE',
  'TZID:America/New_York',
  'END:VTIMEZONE',
  'BEGIN:VEVENT',
  'UID:fair-1@unc.localist.com',
  'DTSTART;TZID=America/New_York:20261015T100000',
  'DTEND;TZID=America/New_York:20261015T150000',
  'SUMMARY:Fall Career Fair',
  'DESCRIPTION:Meet 120 employers.\\nBring your resume\\, dress business casual.',
  'LOCATION:Carmichael Arena',
  'URL:https://unc.edu/events/fair',
  'CATEGORIES:Career,Students',
  'ORGANIZER;CN="University Career Services":mailto:ucs@unc.edu',
  'BEGIN:VALARM',
  'SUMMARY:alarm summary must not overwrite the event',
  'END:VALARM',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:ws-1@unc.localist.com',
  'DTSTART:20261020T180000Z',
  'SUMMARY:Resume Workshop with a very long title that is folded across',
  '  two lines',
  'LOCATION:Zoom https://unc.zoom.us/j/123',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:old@unc',
  'DTSTART:20250101T180000Z',
  'SUMMARY:Last year',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:allday@unc',
  'DTSTART;VALUE=DATE:20261101',
  'DTEND;VALUE=DATE:20261102',
  'SUMMARY:Networking Day',
  'STATUS:CANCELLED',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'SUMMARY:No UID — skipped',
  'DTSTART:20261020T180000Z',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('iCal reading', () => {
  it('unfolds continuation lines', () => {
    expect(unfoldLines('SUMMARY:Hello\r\n  world\r\nUID:1')).toEqual(['SUMMARY:Hello world', 'UID:1']);
  });

  it('parses parameters, including quoted values containing colons', () => {
    const cl = parseContentLine('ORGANIZER;CN="Career: Services";ROLE=CHAIR:mailto:a@b.edu');
    expect(cl).toEqual({ name: 'ORGANIZER', params: { CN: 'Career: Services', ROLE: 'CHAIR' }, value: 'mailto:a@b.edu' });
  });

  it('reads VEVENTs, ignores nested components and events without a UID', () => {
    const events = parseIcal(FEED);
    expect(events.map((e) => e.uid)).toEqual(['fair-1@unc.localist.com', 'ws-1@unc.localist.com', 'old@unc', 'allday@unc']);
    const fair = events[0];
    expect(fair.summary).toBe('Fall Career Fair');
    expect(fair.description).toBe('Meet 120 employers.\nBring your resume, dress business casual.');
    expect(fair.organizer).toBe('University Career Services');
    expect(fair.categories).toEqual(['Career', 'Students']);
    expect(fair.start).toEqual({ date: '20261015', time: '100000', utc: false, tzid: 'America/New_York' });
    expect(events[1].summary).toBe('Resume Workshop with a very long title that is folded across two lines');
  });
});

describe('time zones', () => {
  it('converts wall time in a zone to UTC across DST', () => {
    expect(zonedTimeToUtc(2026, 10, 15, 10, 0, 0, 'America/New_York').toISOString()).toBe('2026-10-15T14:00:00.000Z'); // EDT
    expect(zonedTimeToUtc(2026, 12, 15, 10, 0, 0, 'America/New_York').toISOString()).toBe('2026-12-15T15:00:00.000Z'); // EST
    expect(zonedTimeToUtc(2026, 7, 1, 9, 30, 0, 'America/Los_Angeles').toISOString()).toBe('2026-07-01T16:30:00.000Z');
  });

  it('falls back to the source zone for unknown TZIDs and maps Windows zone names', () => {
    const [ev] = parseIcal('BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:a\nSUMMARY:x\nDTSTART;TZID=Pacific Standard Time:20261015T100000\nEND:VEVENT\nEND:VCALENDAR');
    expect(normalizeIcalEvent(ev, SOURCE, NOW)?.starts_at).toBe('2026-10-15T17:00:00.000Z');
    const [bad] = parseIcal('BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:a\nSUMMARY:x\nDTSTART;TZID=Mars/Olympus:20261015T100000\nEND:VEVENT\nEND:VCALENDAR');
    expect(normalizeIcalEvent(bad, SOURCE, NOW)?.starts_at).toBe('2026-10-15T14:00:00.000Z');
  });
});

describe('normalisation', () => {
  it('turns a feed into rows tagged with the source location, inside the sync window', () => {
    const rows = eventsFromFeed(FEED, SOURCE, NOW);
    expect(rows.map((r) => r.external_id)).toEqual(['fair-1@unc.localist.com', 'ws-1@unc.localist.com', 'allday@unc']);

    const [fair, workshop, allDay] = rows;
    expect(fair).toMatchObject({
      origin: 'ical',
      source_id: 'src-1',
      title: 'Fall Career Fair',
      starts_at: '2026-10-15T14:00:00.000Z',
      ends_at: '2026-10-15T19:00:00.000Z',
      all_day: false,
      category: 'career_fair',
      school_id: 199120,
      state: 'North Carolina',
      location: 'Carmichael Arena',
      url: 'https://unc.edu/events/fair',
      status: 'active',
    });
    expect(fair).not.toHaveProperty('is_major');
    expect(workshop).toMatchObject({ category: 'workshop', virtual_url: 'https://unc.zoom.us/j/123' });
    expect(allDay).toMatchObject({ all_day: true, ends_at: null, status: 'cancelled', category: 'networking', starts_at: '2026-11-01T04:00:00.000Z' });
  });

  it('applies the source keyword allow-list', () => {
    const rows = eventsFromFeed(FEED, { ...SOURCE, include_keywords: ['resume'] }, NOW);
    expect(rows.map((r) => r.external_id)).toEqual(['fair-1@unc.localist.com', 'ws-1@unc.localist.com']);
  });

  it('keeps recurrence instances distinct and dedupes repeated UIDs', () => {
    const text = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT', 'UID:s', 'SUMMARY:Series', 'DTSTART:20261012T150000Z', 'END:VEVENT',
      'BEGIN:VEVENT', 'UID:s', 'RECURRENCE-ID:20261019T150000Z', 'SUMMARY:Series', 'DTSTART:20261019T160000Z', 'END:VEVENT',
      'BEGIN:VEVENT', 'UID:s', 'SUMMARY:Series (updated)', 'DTSTART:20261012T150000Z', 'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    const rows = eventsFromFeed(text, SOURCE, NOW);
    expect(rows.map((r) => [r.external_id, r.title])).toEqual([
      ['s', 'Series (updated)'],
      ['s#20261019T150000Z', 'Series'],
    ]);
  });

  it('rejects responses that are not calendars', () => {
    expect(() => eventsFromFeed('<html>Not found</html>', SOURCE, NOW)).toThrow(/not an iCal/);
  });

  it('infers categories from text with a fallback', () => {
    expect(inferCategory('Goldman Sachs Info Session', 'other')).toBe('info_session');
    expect(inferCategory('Spring Internship Fair', 'other')).toBe('career_fair');
    expect(inferCategory('Basketball game', 'workshop')).toBe('workshop');
  });
});

describe('feed URL safety', () => {
  it('accepts public http(s) and webcal URLs', () => {
    expect(normalizeFeedUrl('webcal://events.unc.edu/calendar.ics')).toEqual({ ok: true, url: 'https://events.unc.edu/calendar.ics' });
    expect(normalizeFeedUrl(' https://calendar.duke.edu/events/index.ics ').ok).toBe(true);
  });
  it('rejects private, local and non-http addresses', () => {
    for (const bad of ['http://localhost:3000/x.ics', 'http://127.0.0.1/x', 'http://10.0.0.5/x', 'http://192.168.1.1/x', 'http://172.20.0.1/x', 'http://169.254.169.254/latest', 'http://[::1]/x', 'ftp://a.edu/x', 'file:///etc/passwd', 'http://intranet/x', 'https://u:p@a.edu/x', 'not a url']) {
      expect(normalizeFeedUrl(bad).ok, bad).toBe(false);
    }
  });
});

describe('admin form time conversion', () => {
  it('round-trips datetime-local values through a chosen zone', () => {
    expect(zonedInputToIso('2026-10-15T10:00', 'America/Chicago')).toBe('2026-10-15T15:00:00.000Z');
    expect(zonedInputToIso('2026-10-15', 'America/Chicago')).toBe('2026-10-15T05:00:00.000Z');
    expect(isoToZonedInput('2026-10-15T15:00:00.000Z', 'America/Chicago')).toBe('2026-10-15T10:00');
    expect(zonedInputToIso('garbage', 'America/Chicago')).toBeNull();
  });
});

// ----- Relevance -----

function ev(partial: Partial<CareerEvent>): CareerEvent {
  return {
    id: partial.id ?? 'e',
    source_id: null, external_id: null, origin: 'manual',
    title: 'Event', description: null,
    starts_at: '2026-10-15T14:00:00.000Z', ends_at: null, all_day: false, timezone: 'America/New_York',
    location: null, virtual_url: null, url: null, organizer: null, category: 'other',
    school_id: null, school_name: null, city: null, state: null, latitude: null, longitude: null,
    is_major: false, major_marked_at: null, status: 'active', created_at: '2026-10-01T00:00:00.000Z',
    ...partial,
  };
}

describe('relevance', () => {
  const student = { schoolId: 199120, state: 'North Carolina' };

  it('classifies campus, local and online events', () => {
    expect(eventScopeFor({ school_id: 199120, state: 'North Carolina' }, student)).toBe('campus');
    expect(eventScopeFor({ school_id: 198419, state: 'North Carolina' }, student)).toBeNull(); // another campus
    expect(eventScopeFor({ school_id: null, state: 'north carolina' }, student)).toBe('local');
    expect(eventScopeFor({ school_id: null, state: 'Texas' }, student)).toBeNull();
    expect(eventScopeFor({ school_id: null, state: null }, student)).toBe('online');
  });

  it('a student with no school on file sees only online events', () => {
    expect(eventScopeFor({ school_id: 199120, state: 'North Carolina' }, { schoolId: null, state: null })).toBeNull();
    expect(eventScopeFor({ school_id: null, state: 'North Carolina' }, { schoolId: null, state: null })).toBeNull();
    expect(eventScopeFor({ school_id: null, state: null }, { schoolId: null, state: null })).toBe('online');
  });

  it('filters to active, not-yet-ended events and sorts soonest first', () => {
    const list = relevantEventsForStudent([
      ev({ id: 'later', starts_at: '2026-10-20T14:00:00.000Z', state: 'North Carolina' }),
      ev({ id: 'soon', starts_at: '2026-10-10T14:00:00.000Z', school_id: 199120, state: 'North Carolina' }),
      ev({ id: 'ongoing', starts_at: '2026-10-09T10:00:00.000Z', ends_at: '2026-10-09T15:00:00.000Z' }),
      ev({ id: 'ended', starts_at: '2026-10-09T08:00:00.000Z', ends_at: '2026-10-09T09:00:00.000Z' }),
      ev({ id: 'cancelled', status: 'cancelled' }),
      ev({ id: 'elsewhere', state: 'Texas' }),
    ], student, NOW);
    expect(list.map((e) => [e.id, e.scope])).toEqual([['ongoing', 'online'], ['soon', 'campus'], ['later', 'local']]);
  });
});

// ----- Notification planning -----

describe('favorite reminders', () => {
  const events = [
    ev({ id: 'tomorrow', title: 'Fair', starts_at: '2026-10-10T11:00:00.000Z' }), // 23h out
    ev({ id: 'two-days', starts_at: '2026-10-11T13:00:00.000Z' }),
    ev({ id: 'past', starts_at: '2026-10-09T11:00:00.000Z' }),
    ev({ id: 'cancelled', starts_at: '2026-10-10T11:00:00.000Z', status: 'cancelled' }),
  ];
  const favorites = ['tomorrow', 'two-days', 'past', 'cancelled'].map((event_id) => ({ user_id: 'u1', event_id }));

  it('reminds only for favorites starting within 24h', () => {
    const planned = planFavoriteReminders({ favorites, events, preferences: [], ledger: [], now: NOW });
    expect(planned).toEqual([expect.objectContaining({
      user_id: 'u1', event_id: 'tomorrow', kind: 'reminder', title: 'Coming up: Fair', link: '/dashboard/student/events?event=tomorrow',
    })]);
  });

  it('is idempotent against the ledger and within a single run', () => {
    expect(planFavoriteReminders({ favorites, events, preferences: [], ledger: [{ user_id: 'u1', event_id: 'tomorrow', kind: 'reminder' }], now: NOW })).toEqual([]);
    const doubled = planFavoriteReminders({ favorites: [...favorites, ...favorites], events, preferences: [], ledger: [], now: NOW });
    expect(doubled).toHaveLength(1);
    // A 'major' ledger row for the same event does not suppress the reminder.
    expect(planFavoriteReminders({ favorites, events, preferences: [], ledger: [{ user_id: 'u1', event_id: 'tomorrow', kind: 'major' }], now: NOW })).toHaveLength(1);
  });

  it('respects the reminder opt-out', () => {
    expect(planFavoriteReminders({ favorites, events, preferences: [{ user_id: 'u1', notify_favorites: false, notify_major: true }], ledger: [], now: NOW })).toEqual([]);
  });
});

describe('major event notifications', () => {
  const students = [
    { user_id: 'campus-kid', school_id: 199120, school_state: 'North Carolina' },
    { user_id: 'nc-kid', school_id: 198419, school_state: 'North Carolina' },
    { user_id: 'tx-kid', school_id: 228778, school_state: 'Texas' },
  ];
  const fresh = '2026-10-09T06:00:00.000Z';

  it('notifies students in scope about recently-flagged, upcoming major events', () => {
    const planned = planMajorEventNotifications({
      events: [
        ev({ id: 'campus-fair', is_major: true, major_marked_at: fresh, school_id: 199120, school_name: 'UNC', state: 'North Carolina' }),
        ev({ id: 'nc-expo', is_major: true, major_marked_at: fresh, state: 'North Carolina', city: 'Raleigh' }),
        ev({ id: 'not-major', state: 'North Carolina' }),
        ev({ id: 'stale', is_major: true, major_marked_at: '2026-09-01T00:00:00.000Z', state: 'North Carolina' }),
        ev({ id: 'already-started', is_major: true, major_marked_at: fresh, starts_at: '2026-10-09T11:00:00.000Z', state: 'North Carolina' }),
      ],
      students, preferences: [], ledger: [], now: NOW,
    });
    expect(planned.map((p) => `${p.user_id}:${p.event_id}`)).toEqual(['campus-kid:campus-fair', 'campus-kid:nc-expo', 'nc-kid:nc-expo']);
    expect(planned[1].body).toContain('Raleigh, North Carolina');
  });

  it('online major events reach everyone; ledger and opt-outs suppress', () => {
    const planned = planMajorEventNotifications({
      events: [ev({ id: 'virtual', is_major: true, major_marked_at: fresh })],
      students,
      preferences: [{ user_id: 'tx-kid', notify_favorites: true, notify_major: false }],
      ledger: [{ user_id: 'nc-kid', event_id: 'virtual', kind: 'major' }],
      now: NOW,
    });
    expect(planned.map((p) => p.user_id)).toEqual(['campus-kid']);
  });

  it('caps notifications per student per run, soonest first', () => {
    const events = Array.from({ length: 8 }, (_, i) => ev({
      id: `e${i}`, is_major: true, major_marked_at: fresh, state: 'Texas',
      starts_at: new Date(Date.UTC(2026, 9, 20 - i, 15)).toISOString(),
    }));
    const planned = planMajorEventNotifications({ events, students, preferences: [], ledger: [], now: NOW, maxPerStudent: 3 });
    expect(planned.map((p) => p.event_id)).toEqual(['e7', 'e6', 'e5']);
  });
});
