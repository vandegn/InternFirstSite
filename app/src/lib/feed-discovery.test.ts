import { describe, expect, it } from 'vitest';
import {
  assessFeed,
  candidateSourceName,
  dueTargets,
  eduDomainFromEmail,
  feedLinksFromHtml,
  guessedFeeds,
  importCount,
  normalizeDomainInput,
  planAutoAdd,
  platformForUrl,
  suggestCareerOnly,
  targetsFromStudents,
  timeZoneForState,
} from './feed-discovery';

const NOW = new Date('2026-11-17T12:00:00Z');

function ics(events: { uid: string; summary: string; start: string }[], header = ''): string {
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', header,
    ...events.flatMap((e) => ['BEGIN:VEVENT', `UID:${e.uid}`, `SUMMARY:${e.summary}`, `DTSTART:${e.start}`, 'END:VEVENT']),
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

describe('domains', () => {
  it('takes the registrable .edu domain from a student email', () => {
    expect(eduDomainFromEmail('a@unc.edu')).toBe('unc.edu');
    expect(eduDomainFromEmail('a@kenan-flagler.unc.edu')).toBe('unc.edu');
    expect(eduDomainFromEmail('A@CSU.Fullerton.EDU')).toBe('fullerton.edu');
    expect(eduDomainFromEmail('a@gmail.com')).toBeNull();
    expect(eduDomainFromEmail('nope')).toBeNull();
    expect(eduDomainFromEmail(null)).toBeNull();
  });

  it('normalizes admin-typed domains and refuses private ones', () => {
    expect(normalizeDomainInput('https://www.UNC.edu/events?x=1')).toEqual({ ok: true, domain: 'unc.edu' });
    expect(normalizeDomainInput('txst.edu')).toEqual({ ok: true, domain: 'txst.edu' });
    expect(normalizeDomainInput('localhost').ok).toBe(false);
    expect(normalizeDomainInput('10.0.0.1').ok).toBe(false);
    expect(normalizeDomainInput('not a domain').ok).toBe(false);
  });

  it('picks the domain most of a school’s students use', () => {
    const targets = targetsFromStudents([
      { school_id: 1, school_name: 'UNC', school_state: 'North Carolina', email: 'a@unc.edu' },
      { school_id: 1, school_name: 'UNC', school_state: 'North Carolina', email: 'b@kenan-flagler.unc.edu' },
      { school_id: 1, school_name: 'UNC', school_state: 'North Carolina', email: 'c@live.unc.edu' },
      { school_id: 2, school_name: 'Other', school_state: 'Texas', email: 'x@gmail.com' },
      { school_id: null, school_name: null, school_state: null, email: 'y@ncsu.edu' },
    ]);
    expect(targets).toEqual([{ schoolId: 1, schoolName: 'UNC', schoolState: 'North Carolina', domain: 'unc.edu' }]);
  });

  it('checks never-checked schools first, then ones a month stale, oldest first', () => {
    const t = (id: number) => ({ schoolId: id, schoolName: `S${id}`, schoolState: null, domain: `s${id}.edu` });
    const due = dueTargets([t(1), t(2), t(3), t(4)], [
      { school_id: 1, checked_at: '2026-11-10T00:00:00Z' }, // recent — skip
      { school_id: 2, checked_at: '2026-09-01T00:00:00Z' },
      { school_id: 3, checked_at: '2026-08-01T00:00:00Z' },
    ], NOW, 3);
    expect(due.map((d) => d.schoolId)).toEqual([4, 3, 2]);
  });
});

describe('where to look', () => {
  it('guesses the platform addresses for a domain', () => {
    const urls = guessedFeeds('unc.edu').map((g) => g.url);
    expect(urls).toContain('https://unc.campuslabs.com/engage/events.ics');
    expect(urls).toContain('https://calendar.unc.edu/calendar.ics');
    expect(urls).toContain('https://careers.unc.edu/events/?ical=1');
  });

  it('labels feed URLs by platform', () => {
    expect(platformForUrl('https://unc.campuslabs.com/engage/events.ics')).toBe('engage');
    expect(platformForUrl('https://www.trumba.com/calendars/x.ics')).toBe('trumba');
    expect(platformForUrl('https://x.edu/live/ical/events')).toBe('livewhale');
    expect(platformForUrl('https://x.edu/events/?ical=1')).toBe('events_calendar');
    expect(platformForUrl('https://x.edu/a.ics', 'localist')).toBe('localist');
  });

  it('resolves relative .ics links and webcal links', () => {
    const html = `<a href="_data/current.ics">Subscribe</a> <a href='webcal://cal.example.edu/feed.ics'>iCal</a>
      <a href="/img/logo.png">x</a> <a href="https://x.edu/events/?ical=1&amp;tribe-bar-date=2026">Export</a>`;
    const links = feedLinksFromHtml(html, 'https://www.uncw.edu/events/');
    expect(links.map((l) => l.url)).toEqual([
      'https://www.uncw.edu/events/_data/current.ics',
      'https://cal.example.edu/feed.ics',
      'https://x.edu/events/?ical=1&tribe-bar-date=2026',
    ]);
  });

  it('turns a Trumba embed into its feed', () => {
    const html = `<script>addTrumbaSpud({ webName:  'calendar.1400280', spudType: 'tabchooser' });</script>`;
    expect(feedLinksFromHtml(html, 'https://events.txst.edu/')).toEqual([
      { url: 'https://www.trumba.com/calendars/calendar.1400280.ics', platform: 'trumba' },
    ]);
  });

  it('turns a Localist page into /calendar.ics on the page’s own host', () => {
    const html = `<script src="https://localist-images.azureedge.net/packs/js/runtime.js"></script>`;
    expect(feedLinksFromHtml(html, 'https://calendar.unc.edu/')).toEqual([
      { url: 'https://calendar.unc.edu/calendar.ics', platform: 'localist' },
    ]);
  });

  it('turns 25Live and Engage links into their feeds', () => {
    const html = `<a href="https://25livepub.collegenet.com/calendars/career-events.html">Cal</a>
      <a href="https://ncsu.campuslabs.com/engage/events">Orgs</a>`;
    expect(feedLinksFromHtml(html, 'https://ncsu.edu/').map((l) => [l.url, l.platform])).toEqual([
      ['https://25livepub.collegenet.com/calendars/career-events.ics', '25live'],
      ['https://ncsu.campuslabs.com/engage/events.ics', 'engage'],
    ]);
  });

  it('drops links to private addresses and duplicates', () => {
    const html = `<a href="http://127.0.0.1/a.ics">x</a><a href="http://localhost/a.ics">y</a>
      <a href="https://x.edu/a.ics">1</a><a href="https://x.edu/a.ics">2</a>`;
    expect(feedLinksFromHtml(html, 'https://x.edu/').map((l) => l.url)).toEqual(['https://x.edu/a.ics']);
  });
});

describe('scoring a feed', () => {
  const feed = ics([
    { uid: '1', summary: 'Fall Career Fair', start: '20261120T150000Z' },
    { uid: '2', summary: 'Basketball vs Duke', start: '20261121T000000Z' },
    { uid: '3', summary: 'Resume Workshop', start: '20261122T150000Z' },
    { uid: '4', summary: 'Concert', start: '20261123T150000Z' },
    { uid: '5', summary: 'Old talk', start: '20250101T150000Z' }, // outside the window
  ], 'X-WR-CALNAME:UNC Events\r\nX-WR-TIMEZONE:America/New_York');

  it('counts upcoming and career events the way the sync would', () => {
    const a = assessFeed(feed, NOW, 'America/Chicago')!;
    expect(a.upcoming).toBe(4);
    expect(a.career).toBe(2);
    expect(a.calendarName).toBe('UNC Events');
    expect(a.timezone).toBe('America/New_York');
    expect(a.sampleTitles.slice(0, 2)).toEqual(['Fall Career Fair', 'Resume Workshop']);
  });

  it('drops Localist’s doubled "Calendar Calendar"', () => {
    const doubled = ics([{ uid: '1', summary: 'x', start: '20261120T150000Z' }], 'X-WR-CALNAME:NC State University Calendar Calendar');
    expect(assessFeed(doubled, NOW)!.calendarName).toBe('NC State University Calendar');
  });

  it('falls back to the given zone and rejects non-calendars', () => {
    expect(assessFeed(ics([{ uid: '1', summary: 'x', start: '20261120T150000Z' }]), NOW, 'America/Chicago')!.timezone).toBe('America/Chicago');
    expect(assessFeed('<html>nope</html>', NOW)).toBeNull();
  });

  it('gives the same fingerprint to the same feed', () => {
    expect(assessFeed(feed, NOW)!.fingerprint).toBe(assessFeed(feed, NOW)!.fingerprint);
    expect(assessFeed(feed, NOW)!.fingerprint).not.toBe(assessFeed(ics([{ uid: '9', summary: 'x', start: '20261120T150000Z' }]), NOW)!.fingerprint);
  });

  it('defaults mostly-non-career feeds to the career-only filter', () => {
    expect(suggestCareerOnly({ upcoming_count: 400, career_count: 30 })).toBe(true);
    expect(suggestCareerOnly({ upcoming_count: 10, career_count: 8 })).toBe(false);
    expect(suggestCareerOnly({ upcoming_count: 0, career_count: 0 })).toBe(false);
  });

  it('names sources and maps states to zones', () => {
    expect(candidateSourceName({ school_name: 'Texas State University', calendar_name: 'Texas State University Events', platform: 'trumba' }))
      .toBe('Texas State University Events');
    expect(candidateSourceName({ school_name: 'UNC', calendar_name: null, platform: 'engage' })).toBe('UNC — Engage');
    expect(timeZoneForState('Texas')).toBe('America/Chicago');
    expect(timeZoneForState('California')).toBe('America/Los_Angeles');
    expect(timeZoneForState(null)).toBe('America/New_York');
  });
});

describe('adding feeds without review', () => {
  const feed = (url: string, upcoming: number, career: number) => ({ ical_url: url, upcoming_count: upcoming, career_count: career });

  it('adds campus-wide feeds career-only, skips empty ones, keeps one per site', () => {
    const decisions = planAutoAdd([
      feed('https://calendar.x.edu/calendar.ics', 600, 40),
      feed('https://calendar.x.edu/calendar/1.ics', 500, 80),
      feed('https://x.campuslabs.com/engage/events.ics', 10, 8),
      feed('https://www.trumba.com/calendars/x.ics', 200, 0),
    ], new Set());
    expect(decisions.map((d) => (d.add ? `add${d.careerOnly ? ':career' : ''}` : 'skip'))).toEqual(['skip', 'add:career', 'add', 'skip']);
    expect(decisions[3]).toMatchObject({ add: false, reason: 'No career-related events in this feed.' });
  });

  it('treats a site that already has a source as taken', () => {
    const [d] = planAutoAdd([feed('https://calendar.x.edu/calendar.ics', 10, 9)], new Set(['calendar.x.edu']));
    expect(d).toMatchObject({ add: false, reason: 'A feed from calendar.x.edu is already a source.' });
  });

  it('counts what the chosen filter would import', () => {
    expect(importCount(feed('a', 600, 40))).toBe(40);
    expect(importCount(feed('a', 10, 8))).toBe(10);
  });
});
