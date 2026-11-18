import { describe, expect, it } from 'vitest';
import {
  runFeedDiscovery,
  type DiscoveryCheck,
  type FeedCandidateRow,
  type FeedDiscoveryRepo,
  type NewSourceRow,
  type PageFetcher,
} from './feed-discovery-service';
import { CAREER_KEYWORDS, type StudentSchoolRow } from './feed-discovery';

const NOW = new Date('2026-11-17T12:00:00Z');

function ics(name: string, events: [string, string][]): string {
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', `X-WR-CALNAME:${name}`,
    ...events.flatMap(([uid, summary], i) => ['BEGIN:VEVENT', `UID:${uid}`, `SUMMARY:${summary}`, `DTSTART:202611${20 + i}T150000Z`, 'END:VEVENT']),
    'END:VCALENDAR',
  ].join('\r\n');
}

// In-memory repo mirroring the real one: unique ical_url on sources and on the
// feed log (ignore-duplicate inserts), refreshes that leave status alone, one
// check row per school.
function memoryRepo(init: { students: StudentSchoolRow[]; sources?: string[]; checks?: DiscoveryCheck[] }) {
  let seq = 0;
  const state = {
    log: [] as FeedCandidateRow[],
    checks: new Map((init.checks ?? []).map((c) => [c.school_id, c])),
    sources: (init.sources ?? []).map((url) => ({ id: `pre${++seq}`, ical_url: url } as NewSourceRow & { id: string })),
  };
  const repo: FeedDiscoveryRepo = {
    async listStudentSchools() { return init.students; },
    async listChecks() { return [...state.checks.values()]; },
    async listSourceUrls() { return state.sources.map((s) => s.ical_url); },
    async getCandidateUrls(urls) { return state.log.filter((c) => urls.includes(c.ical_url)).map((c) => c.ical_url); },
    async createSource(row) {
      if (state.sources.some((s) => s.ical_url === row.ical_url)) return null;
      const id = `src${++seq}`;
      state.sources.push({ ...row, id });
      return id;
    },
    async insertCandidates(rows) {
      for (const r of rows) if (!state.log.some((c) => c.ical_url === r.ical_url)) state.log.push({ ...r });
    },
    async refreshCandidates(rows) {
      for (const r of rows) {
        const c = state.log.find((x) => x.ical_url === r.ical_url)!;
        Object.assign(c, { upcoming_count: r.upcoming_count, career_count: r.career_count, sample_titles: r.sample_titles, last_checked_at: r.last_checked_at });
      }
    },
    async recordCheck(check) { state.checks.set(check.school_id, check); },
  };
  return { repo, state };
}

function webFrom(pages: Record<string, string | { status: number; redirect?: string }>): PageFetcher {
  return async (url) => {
    let current = url;
    for (let i = 0; i < 4; i++) {
      const page = pages[current];
      if (page === undefined) throw new Error('ENOTFOUND');
      if (typeof page === 'string') return { status: 200, url: current, text: page };
      if (page.redirect) { current = page.redirect; continue; }
      return { status: page.status, url: current, text: '' };
    }
    throw new Error('loop');
  };
}

const UNC: StudentSchoolRow = { school_id: 199120, school_name: 'UNC', school_state: 'North Carolina', email: 's@unc.edu' };
const UNC_TARGET = { schoolId: 199120, schoolName: 'UNC', schoolState: 'North Carolina', domain: 'unc.edu' };

describe('runFeedDiscovery', () => {
  it('adds useful feeds as sources tagged to the school, with the career filter on campus-wide feeds', async () => {
    const fetcher = webFrom({
      // Mostly career events: added with no filter.
      'https://unc.campuslabs.com/engage/events.ics': ics('Engage', [['e1', 'Resume clinic'], ['e2', 'Internship panel']]),
      // Whole-campus calendar: added career-only.
      'https://events.unc.edu/': { status: 301, redirect: 'https://calendar.unc.edu/' },
      'https://calendar.unc.edu/': '<script src="https://localist-images.azureedge.net/x.js"></script>',
      'https://calendar.unc.edu/calendar.ics': ics('UNC Calendar', [['a', 'Career Fair'], ['b', 'Concert'], ['c', 'Football'], ['d', 'Lecture']]),
      // Nothing career-related: skipped.
      'https://www.unc.edu/events/': '<a href="_data/current.ics">ics</a>',
      'https://www.unc.edu/events/_data/current.ics': ics('News', [['n1', 'Board meeting']]),
    });
    const { repo, state } = memoryRepo({ students: [UNC] });

    const summary = await runFeedDiscovery(repo, fetcher, NOW);

    expect(summary.added).toBe(2);
    expect(summary.newSourceIds).toHaveLength(2);
    expect(summary.schools[0]).toMatchObject({ found: 3, added: 2, skipped: 1 });

    const engage = state.sources.find((s) => s.ical_url.includes('campuslabs'))!;
    expect(engage).toMatchObject({ school_id: 199120, school_name: 'UNC', school_state: 'North Carolina', include_keywords: null, default_timezone: 'America/New_York' });
    const localist = state.sources.find((s) => s.ical_url === 'https://calendar.unc.edu/calendar.ics')!;
    expect(localist.include_keywords).toEqual(CAREER_KEYWORDS);
    expect(localist.name).toBe('UNC Calendar'); // already names the school

    const skipped = state.log.find((c) => c.ical_url.endsWith('current.ics'))!;
    expect(skipped).toMatchObject({ status: 'dismissed', source_id: null, note: 'No career-related events in this feed.' });
    expect(state.log.filter((c) => c.status === 'approved').every((c) => c.source_id)).toBe(true);
    expect(state.checks.get(199120)).toMatchObject({ domain: 'unc.edu', feeds_found: 3, error: null });
  });

  it('keeps one feed per site, the one importing the most', async () => {
    const fetcher = webFrom({
      'https://calendar.unc.edu/calendar.ics': ics('All', [['a', 'Career Fair'], ['b', 'Concert'], ['c', 'Football']]),
      'https://calendar.unc.edu/': '<a href="/calendar/1.ics">Featured</a>',
      'https://calendar.unc.edu/calendar/1.ics': ics('Featured', [['x', 'Career Fair'], ['y', 'Employer info session'], ['z', 'Concert']]),
    });
    const { repo, state } = memoryRepo({ students: [UNC] });

    await runFeedDiscovery(repo, fetcher, NOW);

    expect(state.sources.map((s) => s.ical_url)).toEqual(['https://calendar.unc.edu/calendar/1.ics']);
    expect(state.log.find((c) => c.ical_url.endsWith('/calendar.ics'))!.note).toContain('Same site as https://calendar.unc.edu/calendar/1.ics');
  });

  it('never re-adds a logged feed, so removing a source sticks; skips sites that already have a source', async () => {
    const feed = ics('Engage', [['e1', 'Career Fair']]);
    const fetcher = webFrom({
      'https://unc.campuslabs.com/engage/events.ics': feed,
      'https://careers.unc.edu/events/?ical=1': feed, // same events, second address
      'https://calendar.unc.edu/calendar.ics': ics('Cal', [['c1', 'Career Expo']]),
    });
    const { repo, state } = memoryRepo({ students: [UNC], sources: ['https://calendar.unc.edu/feeds/other.ics'] });

    await runFeedDiscovery(repo, fetcher, NOW);
    // Same feed at two addresses → one; calendar.unc.edu already has a source → skipped.
    expect(state.sources.map((s) => s.ical_url).sort()).toEqual(['https://calendar.unc.edu/feeds/other.ics', 'https://unc.campuslabs.com/engage/events.ics']);
    expect(state.log.find((c) => c.ical_url === 'https://calendar.unc.edu/calendar.ics')!.note).toBe('A feed from calendar.unc.edu is already a source.');

    // The admin removes the Engage source; a re-run must not bring it back.
    state.sources = state.sources.filter((s) => !s.ical_url.includes('campuslabs'));
    const again = await runFeedDiscovery(repo, fetcher, NOW, { target: UNC_TARGET });
    expect(again.added).toBe(0);
    expect(state.sources.some((s) => s.ical_url.includes('campuslabs'))).toBe(false);
  });

  it('isolates an unreachable school and skips schools checked recently', async () => {
    const fetcher = webFrom({
      'https://unc.campuslabs.com/engage/events.ics': ics('Engage', [['e1', 'Career Fair']]),
    });
    const { repo, state } = memoryRepo({
      students: [
        UNC,
        { school_id: 2, school_name: 'Ghost U', school_state: 'Texas', email: 'g@ghost.edu' },
        { school_id: 3, school_name: 'Recent U', school_state: 'Ohio', email: 'r@recent.edu' },
      ],
      checks: [{ school_id: 3, school_name: 'Recent U', school_state: 'Ohio', domain: 'recent.edu', checked_at: '2026-11-10T00:00:00Z', feeds_found: 0, error: null }],
    });

    const summary = await runFeedDiscovery(repo, fetcher, NOW);

    expect(summary.schools.map((s) => s.schoolId)).toEqual([199120, 2]);
    expect(summary.schools[1]).toMatchObject({ found: 0, added: 0, error: 'Could not reach any address at ghost.edu.' });
    expect(state.checks.get(2)?.error).toContain('ghost.edu');
    expect(state.sources).toHaveLength(1);
  });

  it('ignores feeds with nothing upcoming and pages that are not calendars', async () => {
    const fetcher = webFrom({
      'https://unc.campuslabs.com/engage/events.ics': ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:x', 'SUMMARY:Old', 'DTSTART:20200101T000000Z', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'),
      'https://calendar.unc.edu/calendar.ics': '<html>Not found</html>',
    });
    const { repo, state } = memoryRepo({ students: [UNC] });
    const summary = await runFeedDiscovery(repo, fetcher, NOW);
    expect(summary.added).toBe(0);
    expect(state.log).toHaveLength(0);
    expect(state.checks.get(199120)).toMatchObject({ feeds_found: 0, error: null });
  });
});
