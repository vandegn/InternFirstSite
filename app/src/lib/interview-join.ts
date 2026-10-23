// When a confirmed interview can be joined, and how. One place for the window
// rule so the Interviews page, the dashboards and the video room can't drift:
// the room opens 10 minutes before the start and stays open until 30 minutes
// after the scheduled end, and /api/livekit/token enforces the same window.

export const JOIN_OPENS_BEFORE_MINUTES = 10;
export const JOIN_CLOSES_AFTER_MINUTES = 30;

export type JoinWindowStatus = 'too_early' | 'open' | 'ended';

export function joinOpensAt(scheduledAt: string): Date {
  return new Date(new Date(scheduledAt).getTime() - JOIN_OPENS_BEFORE_MINUTES * 60_000);
}

export function joinWindowStatus(scheduledAt: string, durationMinutes: number, now = Date.now()): JoinWindowStatus {
  const start = new Date(scheduledAt).getTime();
  const end = start + (durationMinutes + JOIN_CLOSES_AFTER_MINUTES) * 60_000;
  if (now < start - JOIN_OPENS_BEFORE_MINUTES * 60_000) return 'too_early';
  if (now > end) return 'ended';
  return 'open';
}

/** A meeting is over once its scheduled end has passed (no join grace). */
export function interviewHasEnded(scheduledAt: string, durationMinutes: number, now = Date.now()): boolean {
  return new Date(scheduledAt).getTime() + durationMinutes * 60_000 <= now;
}

type Timed = { scheduledAt: string; durationMinutes: number };

/**
 * Upcoming (soonest first) vs past (most recent first). "Upcoming" includes a
 * meeting that is running right now — it's still joinable.
 */
export function splitInterviewsByTime<T extends Timed>(interviews: T[], now = Date.now()): { upcoming: T[]; past: T[] } {
  const byStart = (a: T, b: T) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt);
  const upcoming = interviews.filter(iv => !interviewHasEnded(iv.scheduledAt, iv.durationMinutes, now)).sort(byStart);
  const past = interviews.filter(iv => interviewHasEnded(iv.scheduledAt, iv.durationMinutes, now)).sort((a, b) => byStart(b, a));
  return { upcoming, past };
}

export type JoinAction = {
  href: string;
  /** The employer's own link: open in a new tab. */
  external: boolean;
  label: string;
  status: JoinWindowStatus;
  /** Shown under the button while the room isn't open yet. */
  hint: string | null;
};

type Joinable = Timed & {
  id: string;
  format?: string | null;
  meetingUrl?: string | null;
  meetingType?: string | null;
};

/**
 * The one join control for a confirmed meeting, or null when there is nothing
 * to click (a phone screen — the employer calls). The InternFirst room is
 * always linked: before the window it shows "Almost time" and lets the person
 * in by itself, so the button stays the way in rather than a dead end.
 */
export function joinAction(iv: Joinable, role: 'student' | 'employer', now = Date.now()): JoinAction | null {
  const type = iv.meetingType === 'screening' ? 'screening' : 'interview';
  const status = joinWindowStatus(iv.scheduledAt, iv.durationMinutes, now);
  if (iv.format === 'phone') return null;
  if (iv.format === 'external_link' && iv.meetingUrl) {
    return { href: iv.meetingUrl, external: true, label: `Join ${type}`, status, hint: null };
  }
  const opens = joinOpensAt(iv.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return {
    href: `/dashboard/${role}/interviews/${iv.id}`,
    external: false,
    label: status === 'open' ? `Join ${type} now` : `Join ${type}`,
    status,
    hint: status === 'too_early' ? `Room opens at ${opens}` : null,
  };
}
