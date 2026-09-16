// Only explicit, non-sensitive labels are accepted. Never send form contents.
export const CLIENT_EVENTS = ['listing_viewed', 'cta_clicked', 'registration_started', 'application_started', 'job_posting_started'] as const;
export type ClientEvent = typeof CLIENT_EVENTS[number];
export const CTAS = ['register', 'apply', 'post_job', 'browse_internships', 'waitlist'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string { return typeof value === 'string' && UUID.test(value); }
export function parseEvent(input: unknown) {
  if (!input || typeof input !== 'object') return null;
  const v = input as Record<string, unknown>;
  if (!CLIENT_EVENTS.includes(v.name as ClientEvent) || !isUuid(v.id) || !isUuid(v.sessionId)) return null;
  if (typeof v.path !== 'string' || !/^\/[a-zA-Z0-9/_-]*$/.test(v.path) || v.path.length > 200) return null;
  if (v.name === 'cta_clicked' && !CTAS.includes(v.cta as typeof CTAS[number])) return null;
  if (['listing_viewed', 'application_started'].includes(String(v.name)) && !isUuid(v.listingId)) return null;
  if (['registration_started', 'job_posting_started'].includes(String(v.name)) && !isUuid(v.flowId)) return null;
  if (v.name === 'registration_started' && !['student', 'employer'].includes(String(v.role))) return null;
  return { id: v.id, sessionId: v.sessionId, name: v.name as ClientEvent, path: v.path.replace(/^\/join\/[^/]+$/, '/join'),
    cta: v.name === 'cta_clicked' ? String(v.cta) : null,
    listingId: isUuid(v.listingId) ? v.listingId : null,
    flowId: isUuid(v.flowId) ? v.flowId : null,
    role: v.role === 'employer' ? 'employer' : 'student' };
}

export type AnalyticsReport = {
  events: { name: string; role: string; count: number }[];
  daily: { day: string; name: string; count: number }[];
  ctas: { cta: string; path: string; count: number }[];
  funnels: { name: string; role: string; started: number; completed: number }[];
  totals: { registrations: number; applications: number; listings: number; uniqueListingViews: number; waitlist: number };
};
export function conversionRate(started: number, completed: number): string {
  return started ? `${((completed / started) * 100).toFixed(1)}%` : '—';
}
