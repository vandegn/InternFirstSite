import { describe, expect, it } from 'vitest';
import { runFeedDiscovery, type DiscoveryCheck, type FeedCandidateInput, type FeedDiscoveryRepo, type PageFetcher } from './feed-discovery-service';
import type { StudentSchoolRow } from './feed-discovery';

const NOW = new Date('2026-11-17T12:00:00Z');

function ics(name: string, events: [string, string][]): string {
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', `X-WR-CALNAME:${name}`,
    ...events.flatMap(([uid, summary], i) => ['BEGIN:VEVENT', `UID:${uid}`, `SUMMARY:${summary}`, `DTSTART:202611${20 + i}T150000Z`, 'END:VEVENT']),
    'END:VCALENDAR',
  ].join('\r\n');
}

// In-memory repo mirroring the real one: unique ical_url with ignore-duplicate
// inserts, refreshes that leave status alone, one check row per school.
function memoryRepo(init: { students: StudentSchoolRow[]; sources?: string[]; checks?: DiscoveryCheck[] }) {
  const state = {
    candidates: [] as (FeedCandidateInput & { status: string })[],
    checks: new Map((init.checks ?? []).map((c) => [c.school_id, c])),
    sources: init.sources ?? [],
  };
  const repo: FeedDiscoveryRepo = {
    async listStudentSchools() { return init.students; },
    async listChecks() { return [...state.checks.values()]; },
    async listSourceUrls() { return state.sources; },
    async getCandidateUrls(urls) { return state.candidates.filter((c) => urls.includes(c.ical_url)).map((c) => c.ical_url); },
    async insertCandidates(rows) {
      for (const r of rows) if (!state.candidates.some((c) => c.ical_url === r.ical_url)) state.candidates.push({ ...r, status: 'new' });
    },
    async refreshCandidates(rows) {
      for (const r of rows) {
        const c = state.candidates.find((x) => x.ical_url === r.ical_url)!;
        Object.assign(c, { upcoming_count: r.upcoming_count, career_count: r.career_count, sample_titles: r.sample_titles, last_checked_at: r.last_checked_at });
      }
    },
    async recordCheck(check) { state.checks.set(check.school_id, check); },
  };
  return { repo, state };
}

function webFrom(pages: Record<string, string | { status: number; redirect?: string }>): { fetcher: PageFetcher; hits: string[] } {
  const hits: string[] = [];
  const fetcher: PageFetcher = async (url) => {
    hits.push(url);
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
  return { fetcher, hits };
}

const UNC: StudentSchoolRow = { school_id: 199120, school_name: 'UNC', school_state: 'North Carolina', email: 's@unc.edu' };

describe('runFeedDiscovery', () => {
  it('finds guessed and linked feeds, scores them, and records the check', async () => {
    const localist = ics('UNC Calendar', [['a', 'Career Fair'], ['b', 'Concert'], ['c', 'Football'], ['d', 'Lecture']]);
    const { fetcher } = webFrom({
      'https://unc.campuslabs.com/engage/events.ics': ics('Engage', [['e1', 'Resume clinic'], ['e2', 'Internship panel']]),
      'https://events.unc.edu/': { status: 301, redirect: 'https://calendar.unc.edu/' },
      'https://calendar.unc.edu/': '<script src="https://localist-images.azureedge.net/x.js"></script>',
      'https://calendar.unc.edu/calendar.ics': localist,
      'https://www.unc.edu/events/': '<a href="_data/current.ics">ics</a>',
      'https://www.unc.edu/events/_data/current.ics': ics('News', [['n1', 'Board meeting']]),
    });
    const { repo, state } = memoryRepo({ students: [UNC] });

    const summary = await runFeedDiscovery(repo, fetcher, NOW);

    expect(summary.added).toBe(3);
    expect(state.candidates.map((c) => [c.ical_url, c.platform, c.upcoming_count, c.career_count]).sort()).toEqual([
      ['https://calendar.unc.edu/calendar.ics', 'localist', 4, 1],
      ['https://unc.campuslabs.com/engage/events.ics', 'engage', 2, 2],
      ['https://www.unc.edu/events/_data/current.ics', 'other', 1, 0],
    ]);
    const linked = state.candidates.find((c) => c.ical_url.endsWith('current.ics'))!;
    expect(linked.found_on).toBe('https://www.unc.edu/events/');
    expect(linked.timezone).toBe('America/New_York');
    expect(state.checks.get(199120)).toMatchObject({ domain: 'unc.edu', feeds_found: 3, error: null });
  });

  it('suggests the same feed once, skips registered sources, and keeps a dismissal on re-run', async () => {
    const feed = ics('Engage', [['e1', 'Career Fair']]);
    const { fetcher } = webFrom({
      'https://unc.campuslabs.com/engage/events.ics': feed,
      'https://careers.unc.edu/events/?ical=1': feed, // same events, second address
      'https://calendar.unc.edu/calendar.ics': ics('Cal', [['c1', 'Concert']]),
    });
    const { repo, state } = memoryRepo({ students: [UNC], sources: ['https://calendar.unc.edu/calendar.ics'] });

    await runFeedDiscovery(repo, fetcher, NOW);
    expect(state.candidates).toHaveLength(1);
    state.candidates[0].status = 'dismissed';

    const again = await runFeedDiscovery(repo, fetcher, NOW, { target: { schoolId: 199120, schoolName: 'UNC', schoolState: 'North Carolina', domain: 'unc.edu' } });
    expect(again.added).toBe(0);
    expect(state.candidates).toHaveLength(1);
    expect(state.candidates[0].status).toBe('dismissed');
  });

  it('isolates an unreachable school and skips schools checked recently', async () => {
    const { fetcher } = webFrom({
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
    expect(summary.schools[1]).toMatchObject({ found: 0, error: 'Could not reach any address at ghost.edu.' });
    expect(state.checks.get(2)?.error).toContain('ghost.edu');
    expect(state.candidates).toHaveLength(1);
  });

  it('ignores feeds with nothing upcoming and pages that are not calendars', async () => {
    const { fetcher } = webFrom({
      'https://unc.campuslabs.com/engage/events.ics': ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:x', 'SUMMARY:Old', 'DTSTART:20200101T000000Z', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'),
      'https://calendar.unc.edu/calendar.ics': '<html>Not found</html>',
    });
    const { repo, state } = memoryRepo({ students: [UNC] });
    const summary = await runFeedDiscovery(repo, fetcher, NOW);
    expect(summary.added).toBe(0);
    expect(state.candidates).toHaveLength(0);
    expect(state.checks.get(199120)).toMatchObject({ feeds_found: 0, error: null });
  });
});
