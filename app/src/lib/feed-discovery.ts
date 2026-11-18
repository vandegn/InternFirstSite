// ============================================
// CAREER EVENTS — feed finder, pure rules
// ============================================
// Finds public iCal feeds for a school from nothing but its web domain. Two
// sources of candidate addresses:
//
//   * guesses — the addresses campus calendar platforms put feeds at:
//     Anthology Engage (<slug>.campuslabs.com/engage/events.ics), Localist
//     (calendar.<domain>/calendar.ics), LiveWhale (/live/ical/events) and The
//     Events Calendar for WordPress (/events/?ical=1);
//   * links — the school's events pages are scanned for .ics / webcal links
//     and platform fingerprints (a Localist page, a Trumba embed's webName, a
//     25Live Publisher calendar), which are turned into feed addresses.
//
// Every candidate is then fetched and scored with the same reader + window +
// keyword filter the sync uses (eventsFromFeed), so a suggestion's counts are
// exactly what an approved source would import. Network and storage live in
// feed-discovery-service.ts; nothing here does I/O.

import {
  eventsFromFeed,
  normalizeFeedUrl,
  parseContentLine,
  resolveTimeZone,
  unescapeText,
  unfoldLines,
} from './career-events';

// ----- Vocabulary -----

export const FEED_PLATFORMS = ['engage', 'localist', 'trumba', 'livewhale', 'events_calendar', '25live', 'other'] as const;
export type FeedPlatform = (typeof FEED_PLATFORMS)[number];

export const FEED_PLATFORM_LABELS: Record<FeedPlatform, string> = {
  engage: 'Engage',
  localist: 'Localist',
  trumba: 'Trumba',
  livewhale: 'LiveWhale',
  events_calendar: 'The Events Calendar',
  '25live': '25Live',
  other: 'Calendar feed',
};

/**
 * The keyword list a "career events only" source is created with — and the
 * list career_count is measured with. Substring matches (matchesKeywords),
 * so "recruit" also catches recruiting/recruiter and "job" catches jobs.
 */
export const CAREER_KEYWORDS = [
  'career', 'internship', 'employer', 'recruit', 'job', 'resume', 'résumé',
  'networking', 'interview', 'hiring', 'co-op', 'handshake',
];

/** Below this share of career events, an approval defaults to the career-only filter. */
export const CAREER_ONLY_THRESHOLD = 0.5;

export const RECHECK_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
export const DEFAULT_SCHOOLS_PER_RUN = 5;
export const MAX_LINKS_PER_SCHOOL = 10;

// ----- Schools and domains -----

export type DiscoveryTarget = {
  schoolId: number;
  schoolName: string;
  schoolState: string | null;
  domain: string;
};

const EDU_HOST = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.edu$/;
const HOST = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/**
 * The school's registrable domain from a student's email: `cs.unc.edu` →
 * `unc.edu`. Every .edu is registered directly under .edu, so it is always
 * the last two labels. Non-.edu addresses return null.
 */
export function eduDomainFromEmail(email: string | null | undefined): string | null {
  const host = email?.split('@')[1]?.trim().toLowerCase();
  if (!host || !EDU_HOST.test(host)) return null;
  return host.split('.').slice(-2).join('.');
}

/** An admin-typed domain or URL → bare domain (`https://www.unc.edu/x` → `unc.edu`). */
export function normalizeDomainInput(input: string): { ok: true; domain: string } | { ok: false; error: string } {
  const host = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '')
    .replace(/^www\./, '')
    .replace(/\.$/, '');
  if (!HOST.test(host)) return { ok: false, error: 'Enter the school’s web domain, e.g. unc.edu' };
  if (!normalizeFeedUrl(`https://${host}/`).ok) return { ok: false, error: 'That domain is not a public address.' };
  return { ok: true, domain: host };
}

export type StudentSchoolRow = {
  school_id: number | null;
  school_name: string | null;
  school_state: string | null;
  email: string | null;
};

/** One target per school, using the .edu domain most of its students signed up with. */
export function targetsFromStudents(rows: StudentSchoolRow[]): DiscoveryTarget[] {
  const bySchool = new Map<number, { name: string; state: string | null; domains: Map<string, number> }>();
  for (const row of rows) {
    if (row.school_id == null || !row.school_name) continue;
    const domain = eduDomainFromEmail(row.email);
    if (!domain) continue;
    const entry = bySchool.get(row.school_id) ?? { name: row.school_name, state: row.school_state, domains: new Map() };
    entry.domains.set(domain, (entry.domains.get(domain) ?? 0) + 1);
    bySchool.set(row.school_id, entry);
  }
  return [...bySchool.entries()].map(([schoolId, e]) => {
    const [domain] = [...e.domains.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length || a[0].localeCompare(b[0]))[0];
    return { schoolId, schoolName: e.name, schoolState: e.state, domain };
  });
}

/** Never-checked schools first (in input order), then ones not checked for 30 days, oldest first. */
export function dueTargets(
  targets: DiscoveryTarget[],
  checks: { school_id: number; checked_at: string }[],
  now: Date,
  limit = DEFAULT_SCHOOLS_PER_RUN,
): DiscoveryTarget[] {
  const checkedAt = new Map(checks.map((c) => [c.school_id, new Date(c.checked_at).getTime()]));
  const never = targets.filter((t) => !checkedAt.has(t.schoolId));
  const stale = targets
    .filter((t) => checkedAt.has(t.schoolId) && now.getTime() - checkedAt.get(t.schoolId)! >= RECHECK_AFTER_MS)
    .sort((a, b) => checkedAt.get(a.schoolId)! - checkedAt.get(b.schoolId)!);
  return [...never, ...stale].slice(0, Math.max(0, limit));
}

// ----- Where to look -----

export type FeedLink = { url: string; platform: FeedPlatform };

/** Feed addresses worth trying blind for a domain. */
export function guessedFeeds(domain: string): FeedLink[] {
  const slug = domain.split('.')[0];
  return [
    { url: `https://${slug}.campuslabs.com/engage/events.ics`, platform: 'engage' },
    { url: `https://calendar.${domain}/calendar.ics`, platform: 'localist' },
    { url: `https://events.${domain}/calendar.ics`, platform: 'localist' },
    { url: `https://events.${domain}/live/ical/events`, platform: 'livewhale' },
    { url: `https://calendar.${domain}/live/ical/events`, platform: 'livewhale' },
    { url: `https://careers.${domain}/events/?ical=1`, platform: 'events_calendar' },
    { url: `https://career.${domain}/events/?ical=1`, platform: 'events_calendar' },
  ];
}

/** Pages to scan for feed links and platform fingerprints. */
export function pagesToScan(domain: string): string[] {
  return [
    `https://events.${domain}/`,
    `https://calendar.${domain}/`,
    `https://www.${domain}/events/`,
    `https://careers.${domain}/events/`,
    `https://career.${domain}/events/`,
    `https://careerservices.${domain}/events/`,
  ];
}

export function platformForUrl(url: string, hint: FeedPlatform = 'other'): FeedPlatform {
  if (/\.campuslabs\.com\/engage\//i.test(url)) return 'engage';
  if (/trumba\.com\/calendars\//i.test(url)) return 'trumba';
  if (/25livepub\.collegenet\.com\//i.test(url)) return '25live';
  if (/\/live\/ical\//i.test(url)) return 'livewhale';
  if (/[?&]ical=1\b/i.test(url)) return 'events_calendar';
  return hint;
}

const ATTR_RE = /\b(?:href|src|data-url|data-href|data-ical|data-feed|value)\s*=\s*["']([^"'<>\s]{4,500})["']/gi;
const FEED_LIKE = /^webcals?:|\.ics(?:$|[?#])|[?&]ical=1\b|\/live\/ical\/|[?&]format=(?:ics|ical)\b/i;

function decodeEntities(value: string): string {
  return value.replace(/&amp;/gi, '&').replace(/&#x2f;|&#47;/gi, '/').replace(/&#58;/g, ':');
}

/**
 * Feed addresses found in a page: explicit .ics / webcal links (relative ones
 * resolved against the page) plus what platform fingerprints imply. `pageUrl`
 * should be the address after redirects, since a Localist feed lives on the
 * calendar's own host.
 */
export function feedLinksFromHtml(html: string, pageUrl: string): FeedLink[] {
  const found: FeedLink[] = [];
  const add = (raw: string, platform: FeedPlatform = 'other') => {
    let absolute: string;
    try {
      absolute = new URL(decodeEntities(raw).replace(/^webcals?:\/\//i, 'https://'), pageUrl).toString();
    } catch {
      return;
    }
    const safe = normalizeFeedUrl(absolute);
    if (safe.ok) found.push({ url: safe.url, platform: platformForUrl(safe.url, platform) });
  };

  for (const m of html.matchAll(ATTR_RE)) if (FEED_LIKE.test(m[1])) add(m[1]);

  for (const m of html.matchAll(/webName\s*:\s*["']([A-Za-z0-9._-]{1,120})["']/g)) {
    add(`https://www.trumba.com/calendars/${m[1]}.ics`, 'trumba');
  }
  for (const m of html.matchAll(/25livepub\.collegenet\.com\/calendars\/([A-Za-z0-9._-]{1,120}?)(?:\.(?:html?|ics|rss|xml))?["'?#/]/gi)) {
    add(`https://25livepub.collegenet.com/calendars/${m[1]}.ics`, '25live');
  }
  for (const m of html.matchAll(/https?:\/\/([a-z0-9-]+)\.campuslabs\.com\/engage\b/gi)) {
    add(`https://${m[1].toLowerCase()}.campuslabs.com/engage/events.ics`, 'engage');
  }

  let origin: string | null = null;
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    origin = null;
  }
  if (origin) {
    if (/localist-images|localist\.com|data-localist/i.test(html)) add(`${origin}/calendar.ics`, 'localist');
    if (/livewhale/i.test(html)) add(`${origin}/live/ical/events`, 'livewhale');
  }

  const seen = new Set<string>();
  return found.filter((f) => !seen.has(f.url) && seen.add(f.url)).slice(0, MAX_LINKS_PER_SCHOOL);
}

// ----- Scoring a feed -----

export type FeedAssessment = {
  calendarName: string | null;
  timezone: string;
  upcoming: number;
  career: number;
  sampleTitles: string[];
  /** Same events at two addresses → same fingerprint, so a feed is suggested once. */
  fingerprint: string;
};

/** Primary zone per state — the fallback when a feed doesn't name its own. */
const CENTRAL = ['Alabama', 'Arkansas', 'Illinois', 'Iowa', 'Kansas', 'Louisiana', 'Minnesota', 'Mississippi', 'Missouri', 'Nebraska', 'North Dakota', 'Oklahoma', 'South Dakota', 'Tennessee', 'Texas', 'Wisconsin'];
const MOUNTAIN = ['Colorado', 'Idaho', 'Montana', 'New Mexico', 'Utah', 'Wyoming'];
const PACIFIC = ['California', 'Nevada', 'Oregon', 'Washington'];

export function timeZoneForState(state: string | null | undefined): string {
  if (!state) return 'America/New_York';
  if (CENTRAL.includes(state)) return 'America/Chicago';
  if (MOUNTAIN.includes(state)) return 'America/Denver';
  if (PACIFIC.includes(state)) return 'America/Los_Angeles';
  if (state === 'Arizona') return 'America/Phoenix';
  if (state === 'Alaska') return 'America/Anchorage';
  if (state === 'Hawaii') return 'Pacific/Honolulu';
  if (state === 'Puerto Rico') return 'America/Puerto_Rico';
  return 'America/New_York';
}

/** Calendar-level properties (before the first component). */
function calendarProps(text: string): Record<string, string> {
  const props: Record<string, string> = {};
  for (const line of unfoldLines(text)) {
    const cl = parseContentLine(line);
    if (!cl) continue;
    if (cl.name === 'BEGIN' && cl.value.toUpperCase() !== 'VCALENDAR') break;
    if (cl.name.startsWith('X-WR-') && !(cl.name in props)) props[cl.name] = unescapeText(cl.value).trim();
  }
  return props;
}

/**
 * Null when the text isn't an iCal calendar. Otherwise the counts the sync
 * would import: `upcoming` with no filter, `career` with CAREER_KEYWORDS.
 */
export function assessFeed(text: string, now: Date, fallbackTimeZone = 'America/New_York'): FeedAssessment | null {
  if (!/BEGIN:VCALENDAR/i.test(text)) return null;
  const props = calendarProps(text);
  const timezone = resolveTimeZone(props['X-WR-TIMEZONE'] || undefined, fallbackTimeZone);
  const probe = {
    id: 'probe', school_id: null, school_name: null, city: null, state: null,
    default_category: 'other' as const, default_timezone: timezone, include_keywords: null,
  };
  let all, career;
  try {
    all = eventsFromFeed(text, probe, now);
    career = eventsFromFeed(text, { ...probe, include_keywords: CAREER_KEYWORDS }, now);
  } catch {
    return null;
  }
  const titles = [...career, ...all].map((e) => e.title).filter((t, i, list) => list.indexOf(t) === i);
  // Localist names its feeds "<Site name> Calendar" + " Calendar".
  const name = props['X-WR-CALNAME']?.replace(/\s+/g, ' ').replace(/\b(\w+) \1$/i, '$1').trim();
  return {
    calendarName: name ? name.slice(0, 200) : null,
    timezone,
    upcoming: all.length,
    career: career.length,
    sampleTitles: titles.slice(0, 5),
    fingerprint: `${all.length}|${all.slice(0, 25).map((e) => e.external_id).join('|')}`,
  };
}

/** Whether approving should default to importing only career events. */
export function suggestCareerOnly(c: { upcoming_count: number; career_count: number }): boolean {
  if (c.upcoming_count === 0) return false;
  return c.career_count / c.upcoming_count < CAREER_ONLY_THRESHOLD;
}

/** Name for the event source an approved candidate becomes. */
export function candidateSourceName(c: { school_name: string; calendar_name: string | null; platform: string }): string {
  const label = c.calendar_name || FEED_PLATFORM_LABELS[(FEED_PLATFORMS as readonly string[]).includes(c.platform) ? (c.platform as FeedPlatform) : 'other'];
  const name = label.toLowerCase().includes(c.school_name.toLowerCase()) ? label : `${c.school_name} — ${label}`;
  return name.slice(0, 200);
}

// ----- Adding feeds without review -----

export type AutoAddDecision<C> =
  | { candidate: C; add: true; careerOnly: boolean }
  | { candidate: C; add: false; reason: string };

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return url;
  }
}

/** How many events a feed would import under the filter it gets added with. */
export function importCount(c: { upcoming_count: number; career_count: number }): number {
  return suggestCareerOnly(c) ? c.career_count : c.upcoming_count;
}

/**
 * Which newly found feeds become event sources straight away. Students only
 * ever see a campus feed's events if they attend that school, so the rules
 * just keep out noise and duplicates:
 *   * a whole-campus feed (under half career-related) imports career events
 *     only;
 *   * a feed that would import nothing under that rule is skipped;
 *   * one feed per site — Localist serves the same calendar at several
 *     addresses — keeping the one that imports the most. A site that already
 *     has a registered source counts as taken.
 * Decisions come back in input order.
 */
export function planAutoAdd<C extends { ical_url: string; upcoming_count: number; career_count: number }>(
  found: C[],
  takenHosts: ReadonlySet<string>,
): AutoAddDecision<C>[] {
  const winner = new Map<string, C>();
  for (const c of [...found].sort((a, b) => importCount(b) - importCount(a))) {
    if (importCount(c) === 0) continue;
    const host = hostOf(c.ical_url);
    if (!takenHosts.has(host) && !winner.has(host)) winner.set(host, c);
  }
  return found.map((c): AutoAddDecision<C> => {
    const host = hostOf(c.ical_url);
    if (importCount(c) === 0) return { candidate: c, add: false, reason: 'No career-related events in this feed.' };
    if (takenHosts.has(host)) return { candidate: c, add: false, reason: `A feed from ${host} is already a source.` };
    const best = winner.get(host)!;
    if (best !== c) return { candidate: c, add: false, reason: `Same site as ${best.ical_url}, which has more events.` };
    return { candidate: c, add: true, careerOnly: suggestCareerOnly(c) };
  });
}
