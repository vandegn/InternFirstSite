import { describe, expect, it } from 'vitest';
import { parseIcal } from './career-events';
import {
  calendarRange,
  escapeIcsText,
  eventIcs,
  foldIcsLine,
  googleCalendarUrl,
  icsFilename,
  type ExportableEvent,
} from './event-calendar-export';

const base: ExportableEvent = {
  id: 'ev-1',
  title: 'Fall Career Fair',
  description: 'Bring resumes, wear business casual.',
  starts_at: '2026-11-20T15:00:00.000Z',
  ends_at: '2026-11-20T19:00:00.000Z',
  all_day: false,
  timezone: 'America/New_York',
  location: 'Student Union, Ballroom A',
  virtual_url: null,
  url: 'https://calendar.unc.edu/event/fall-fair',
  organizer: 'University Career Services',
  city: null,
  state: 'North Carolina',
};

describe('calendar range', () => {
  it('uses UTC instants for timed events', () => {
    expect(calendarRange(base)).toEqual({ allDay: false, start: '20261120T150000Z', end: '20261120T190000Z' });
  });

  it('makes an event with no end an hour long', () => {
    expect(calendarRange({ ...base, ends_at: null }).end).toBe('20261120T160000Z');
  });

  it('uses local dates with an exclusive end for all-day events', () => {
    // Midnight Eastern on Nov 20 is 05:00Z.
    const oneDay = { ...base, all_day: true, starts_at: '2026-11-20T05:00:00.000Z', ends_at: null };
    expect(calendarRange(oneDay)).toEqual({ allDay: true, start: '20261120', end: '20261121' });
    const threeDays = { ...oneDay, ends_at: '2026-11-23T05:00:00.000Z' };
    expect(calendarRange(threeDays)).toEqual({ allDay: true, start: '20261120', end: '20261123' });
  });
});

describe('Google Calendar link', () => {
  it('fills title, dates, place and the links', () => {
    const url = new URL(googleCalendarUrl(base));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('Fall Career Fair');
    expect(url.searchParams.get('dates')).toBe('20261120T150000Z/20261120T190000Z');
    expect(url.searchParams.get('location')).toBe('Student Union, Ballroom A');
    expect(url.searchParams.get('details')).toContain('Event details: https://calendar.unc.edu/event/fall-fair');
    expect(url.searchParams.get('details')).toContain('Hosted by University Career Services');
  });

  it('keeps long descriptions short enough for a URL', () => {
    const url = googleCalendarUrl({ ...base, description: 'x'.repeat(10000) });
    expect(url.length).toBeLessThan(2500);
  });

  it('falls back to the online link for location', () => {
    const url = new URL(googleCalendarUrl({ ...base, location: null, virtual_url: 'https://zoom.us/j/1' }));
    expect(url.searchParams.get('location')).toBe('https://zoom.us/j/1');
  });
});

describe('.ics file', () => {
  it('escapes text and folds long lines at 75 octets', () => {
    expect(escapeIcsText('a, b; c\\d\ne')).toBe('a\\, b\\; c\\\\d\\ne');
    const folded = foldIcsLine(`DESCRIPTION:${'é'.repeat(80)}`);
    for (const line of folded.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(`DESCRIPTION:${'é'.repeat(80)}`);
  });

  it('round-trips through our own iCal reader', () => {
    const text = eventIcs({ ...base, description: 'Line one\nLine two, with commas; and semicolons' }, new Date('2026-11-17T12:00:00Z'));
    expect(text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    const [ev] = parseIcal(text);
    expect(ev.uid).toBe('ev-1@intern-first.com');
    expect(ev.summary).toBe('Fall Career Fair');
    expect(ev.start).toMatchObject({ date: '20261120', time: '150000', utc: true });
    expect(ev.location).toBe('Student Union, Ballroom A');
    expect(ev.description).toContain('Line two, with commas; and semicolons');
    expect(ev.url).toBe('https://calendar.unc.edu/event/fall-fair');
  });

  it('writes all-day events as dates', () => {
    const text = eventIcs({ ...base, all_day: true, starts_at: '2026-11-20T05:00:00.000Z', ends_at: null });
    expect(text).toContain('DTSTART;VALUE=DATE:20261120');
    expect(text).toContain('DTEND;VALUE=DATE:20261121');
  });

  it('names the file after the event', () => {
    expect(icsFilename('Fall Career Fair!')).toBe('fall-career-fair.ics');
    expect(icsFilename('💼')).toBe('event.ics');
  });
});
