// ============================================
// CAREER EVENTS — feed finder, server flow
// ============================================
// One run = pick the schools that are due (or the one an admin asked for),
// try every guessed address and scan every events page for each, score the
// feeds that answer, and store the useful ones as *suggestions*
// (feed_candidates). Approving a suggestion is an admin action on the events
// page; this flow never creates an event source.
//
// Same seam as the sync (career-events-service.ts): a narrow repo (Supabase
// implementation in feed-discovery-repo.ts) and an injected page fetcher, so
// the whole run is testable with no network or database. Each school is
// isolated — one unreachable site records its error and the rest carry on.

import { normalizeFeedUrl } from './career-events';
import {
  assessFeed,
  dueTargets,
  feedLinksFromHtml,
  guessedFeeds,
  pagesToScan,
  targetsFromStudents,
  timeZoneForState,
  DEFAULT_SCHOOLS_PER_RUN,
  MAX_LINKS_PER_SCHOOL,
  type DiscoveryTarget,
  type FeedLink,
  type FeedPlatform,
  type StudentSchoolRow,
} from './feed-discovery';

export type FeedCandidateInput = {
  school_id: number;
  school_name: string;
  school_state: string | null;
  domain: string;
  ical_url: string;
  platform: FeedPlatform;
  found_on: string | null;
  calendar_name: string | null;
  timezone: string;
  upcoming_count: number;
  career_count: number;
  sample_titles: string[];
  last_checked_at: string;
};

export type DiscoveryCheck = {
  school_id: number;
  school_name: string;
  school_state: string | null;
  domain: string;
  checked_at: string;
  feeds_found: number;
  error: string | null;
};

export type FeedDiscoveryRepo = {
  listStudentSchools(): Promise<StudentSchoolRow[]>;
  listChecks(): Promise<{ school_id: number; checked_at: string }[]>;
  /** ical_url of every registered event source. */
  listSourceUrls(): Promise<string[]>;
  /** Which of these URLs are already suggestions (any status). */
  getCandidateUrls(urls: string[]): Promise<string[]>;
  /** Insert, ignoring URLs that already exist. */
  insertCandidates(rows: FeedCandidateInput[]): Promise<void>;
  /** Refresh counts/samples of existing suggestions. Never touches status. */
  refreshCandidates(rows: FeedCandidateInput[]): Promise<void>;
  recordCheck(check: DiscoveryCheck): Promise<void>;
};

export type FetchedPage = { status: number; url: string; text: string };
export type PageFetcher = (url: string) => Promise<FetchedPage>;

export type SchoolDiscoveryResult = {
  schoolId: number;
  schoolName: string;
  domain: string;
  found: number;
  added: number;
  error?: string;
};

export type DiscoverySummary = { schools: SchoolDiscoveryResult[]; added: number };

function message(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.length > 500 ? `${m.slice(0, 497)}...` : m;
}

/** Runs `fn` over `items` with at most `limit` in flight, keeping order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Every useful feed for one school. `reachable` is false when no address answered at all. */
export async function discoverForTarget(
  target: DiscoveryTarget,
  fetchPage: PageFetcher,
  now: Date,
): Promise<{ candidates: FeedCandidateInput[]; reachable: boolean }> {
  const fallbackTz = timeZoneForState(target.schoolState);
  const tried = new Set<string>();
  const fingerprints = new Set<string>();
  const byUrl = new Map<string, FeedCandidateInput>();
  const derived: { link: FeedLink; foundOn: string }[] = [];
  let reachable = false;

  const consider = (page: FetchedPage, link: FeedLink, foundOn: string | null) => {
    const a = assessFeed(page.text, now, fallbackTz);
    if (!a || a.upcoming === 0 || fingerprints.has(a.fingerprint)) return;
    const safe = normalizeFeedUrl(page.url || link.url);
    const url = safe.ok ? safe.url : link.url;
    if (byUrl.has(url)) return;
    fingerprints.add(a.fingerprint);
    byUrl.set(url, {
      school_id: target.schoolId,
      school_name: target.schoolName,
      school_state: target.schoolState,
      domain: target.domain,
      ical_url: url,
      platform: link.platform,
      found_on: foundOn,
      calendar_name: a.calendarName,
      timezone: a.timezone,
      upcoming_count: a.upcoming,
      career_count: a.career,
      sample_titles: a.sampleTitles,
      last_checked_at: now.toISOString(),
    });
  };

  const fetchOnce = async (url: string): Promise<FetchedPage | null> => {
    if (tried.has(url)) return null;
    tried.add(url);
    try {
      const page = await fetchPage(url);
      reachable = true;
      return page.status >= 200 && page.status < 300 ? page : null;
    } catch {
      return null;
    }
  };

  type Job = { kind: 'feed'; link: FeedLink } | { kind: 'page'; url: string };
  const firstPass: Job[] = [
    ...guessedFeeds(target.domain).map((link) => ({ kind: 'feed' as const, link })),
    ...pagesToScan(target.domain).map((url) => ({ kind: 'page' as const, url })),
  ];

  await mapLimit(firstPass, 4, async (job) => {
    const url = job.kind === 'feed' ? job.link.url : job.url;
    const page = await fetchOnce(url);
    if (!page) return;
    if (job.kind === 'feed') return consider(page, job.link, null);
    // Some "pages" are feeds already; otherwise mine them for links.
    if (/BEGIN:VCALENDAR/i.test(page.text.slice(0, 2000))) return consider(page, { url, platform: 'other' }, null);
    for (const link of feedLinksFromHtml(page.text, page.url || url)) derived.push({ link, foundOn: page.url || url });
  });

  const seen = new Set<string>();
  const secondPass = derived.filter(({ link }) => !tried.has(link.url) && !seen.has(link.url) && seen.add(link.url)).slice(0, MAX_LINKS_PER_SCHOOL);
  await mapLimit(secondPass, 4, async ({ link, foundOn }) => {
    const page = await fetchOnce(link.url);
    if (page) consider(page, link, foundOn);
  });

  return { candidates: [...byUrl.values()], reachable };
}

export async function runFeedDiscovery(
  repo: FeedDiscoveryRepo,
  fetchPage: PageFetcher,
  now: Date,
  opts: { target?: DiscoveryTarget; limit?: number } = {},
): Promise<DiscoverySummary> {
  let targets: DiscoveryTarget[];
  if (opts.target) {
    targets = [opts.target];
  } else {
    const [rows, checks] = await Promise.all([repo.listStudentSchools(), repo.listChecks()]);
    targets = dueTargets(targetsFromStudents(rows), checks, now, opts.limit ?? DEFAULT_SCHOOLS_PER_RUN);
  }
  if (targets.length === 0) return { schools: [], added: 0 };

  const registered = new Set((await repo.listSourceUrls()).map((u) => {
    const safe = normalizeFeedUrl(u);
    return safe.ok ? safe.url : u;
  }));

  const schools = await mapLimit(targets, 2, async (t): Promise<SchoolDiscoveryResult> => {
    const base = { schoolId: t.schoolId, schoolName: t.schoolName, domain: t.domain };
    const check = (feeds: number, error: string | null): DiscoveryCheck => ({
      school_id: t.schoolId, school_name: t.schoolName, school_state: t.schoolState, domain: t.domain,
      checked_at: now.toISOString(), feeds_found: feeds, error,
    });
    try {
      const { candidates, reachable } = await discoverForTarget(t, fetchPage, now);
      const found = candidates.filter((c) => !registered.has(c.ical_url));
      const existing = new Set(found.length ? await repo.getCandidateUrls(found.map((c) => c.ical_url)) : []);
      const fresh = found.filter((c) => !existing.has(c.ical_url));
      const stale = found.filter((c) => existing.has(c.ical_url));
      if (fresh.length) await repo.insertCandidates(fresh);
      if (stale.length) await repo.refreshCandidates(stale);
      const error = reachable ? null : `Could not reach any address at ${t.domain}.`;
      await repo.recordCheck(check(candidates.length, error));
      return { ...base, found: candidates.length, added: fresh.length, ...(error ? { error } : {}) };
    } catch (e) {
      const error = message(e);
      try {
        await repo.recordCheck(check(0, error));
      } catch {
        // recording the failure must not stop the other schools
      }
      return { ...base, found: 0, added: 0, error };
    }
  });

  return { schools, added: schools.reduce((n, s) => n + s.added, 0) };
}

// ----- Real page fetcher -----

export const MAX_PAGE_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 4;

async function readCapped(res: Response, max: number): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new Error('Response is larger than 5 MB');
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/**
 * Follows redirects by hand so every hop is re-checked against
 * normalizeFeedUrl — a public site can't bounce the server onto its own
 * network.
 */
export const httpPageFetcher: PageFetcher = async (start) => {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const safe = normalizeFeedUrl(url);
    if (!safe.ok) throw new Error(safe.error);
    const res = await fetch(safe.url, {
      headers: {
        Accept: 'text/calendar, text/html;q=0.9, */*;q=0.5',
        'User-Agent': 'InternFirst-FeedFinder/1.0 (+https://www.intern-first.com)',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel();
      url = new URL(location, safe.url).toString();
      continue;
    }
    if (res.status < 200 || res.status >= 300) {
      await res.body?.cancel();
      return { status: res.status, url: safe.url, text: '' };
    }
    return { status: res.status, url: safe.url, text: await readCapped(res, MAX_PAGE_BYTES) };
  }
  throw new Error('Too many redirects');
};
