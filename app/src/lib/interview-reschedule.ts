// Which interview row a direct reschedule should move.
//
// interview_schedules allows one live row per application (unique index
// interview_schedules_one_active_per_application, live = anything but
// declined/cancelled/completed). The reschedule route used to update whatever
// id the client sent and force it back to 'pending' — so a stale board that
// still showed an old, already-cancelled/declined/completed row "revived" it
// alongside the application's real live interview, and Postgres rejected the
// write with a duplicate-key error. The server now decides: the application's
// live interview is the one being rescheduled.

/** Statuses the unique index treats as live (everything but declined/cancelled/completed). */
export const LIVE_INTERVIEW_STATUSES = ['pending', 'accepted', 'reschedule_requested'];

export function resolveRescheduleTarget(
  target: { id: string },
  liveForApplication: { id: string } | null,
): string {
  // The live row is the interview that's actually on — when the client's id
  // is a stale, closed row, this is still what the employer means to move.
  if (liveForApplication) return liveForApplication.id;
  // No live row: moving the requested one back to 'pending' can't collide.
  return target.id;
}

/** Postgres unique_violation — the race where a second live row appeared mid-request. */
export function isUniqueViolation(error: { code?: string } | null | undefined): boolean {
  return error?.code === '23505';
}
