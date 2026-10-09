// ============================================
// POSTED JOBS — Archive/End Hiring and Unarchive (pure)
// ============================================
// The rules behind the two posting-level actions on /dashboard/employer/
// posted-jobs. No I/O: the database does the real work in one transaction each
// (archive_listing_and_end_hiring / unarchive_listing in
// supabase/migrations/20261009_listing_archive_end_hiring.sql). This module is
// the reference model of those functions — planEndHiring() and the
// applyArchive / applyUnarchive / canStudentApply model mirror the SQL so the
// rules are tested here — plus the copy and list filtering the page uses.

import { applicationStageType, type StageType } from './application-tabs';

// ---- Copy (verbatim product wording) ----
export const ARCHIVE_CONFIRM = {
  title: 'Archive this job and end hiring?',
  paragraphs: [
    'Archiving this posting will end the hiring process. All applicants who are not currently in the Offered category will have their application status changed to Rejected. Applicants in Offered will retain their current status.',
    'If you later unarchive this posting, it will return as a closed job with no candidate data attached. You can reopen it from Posted Jobs, but its previous candidate data will not be restored.',
  ],
  cancelLabel: 'Cancel',
  confirmLabel: 'Archive & End Hiring',
  busyLabel: 'Archiving…',
} as const;

export const UNARCHIVE_CONFIRM = {
  title: 'Unarchive this job?',
  paragraphs: [
    'This posting will return to Posted Jobs as a closed job with no candidate data attached. Previous candidates will not be restored. You can reopen the posting when you are ready to accept new applications.',
  ],
  cancelLabel: 'Cancel',
  confirmLabel: 'Unarchive as Closed',
  busyLabel: 'Unarchiving…',
} as const;

// ---- Listing state ----
export type ArchivableListing = {
  status: string;
  application_deadline: string | null;
  archived_at?: string | null;
};

export function isArchivedListing(listing: Pick<ArchivableListing, 'archived_at'>): boolean {
  return !!listing.archived_at;
}

// The status chip on Posted Jobs. Archived outranks everything (an archived
// posting is always closed underneath). Active listings past their deadline are
// invisible to students and get closed by the daily cron, so they read
// "Expired" rather than a green "Active".
export function postedJobStatus(listing: ArchivableListing, now: number = Date.now()): string {
  if (isArchivedListing(listing)) return 'archived';
  if (
    listing.status === 'active' &&
    listing.application_deadline &&
    new Date(listing.application_deadline).getTime() < now
  ) {
    return 'expired';
  }
  return listing.status;
}

// Filter chips on Posted Jobs. '' = All. Archived postings live only under
// "Archived" — they are out of the normal list, including "All" and "Closed".
export const POSTED_JOB_FILTERS = ['', 'active', 'scheduled', 'draft', 'expired', 'paused', 'closed', 'archived'] as const;
export type PostedJobFilter = (typeof POSTED_JOB_FILTERS)[number];

export function filterPostedListings<T extends ArchivableListing>(
  listings: T[],
  filter: PostedJobFilter,
  now: number = Date.now(),
): T[] {
  if (filter === 'archived') return listings.filter(isArchivedListing);
  const live = listings.filter((l) => !isArchivedListing(l));
  return filter ? live.filter((l) => postedJobStatus(l, now) === filter) : live;
}

// ---- End hiring ----
export type HiringApplication = {
  id: string;
  status: string | null;
  stage: { stage_type: StageType } | null;
};

// Who moves when hiring ends: everyone outside Offered goes to Rejected;
// Offered keeps its status; already-rejected applicants are left where they are
// (they may sit in a differently named rejection column).
export function planEndHiring<T extends HiringApplication>(apps: T[]) {
  const reject: string[] = [];
  const keepOffered: string[] = [];
  const alreadyRejected: string[] = [];
  for (const app of apps) {
    const type = applicationStageType(app);
    if (type === 'offered') keepOffered.push(app.id);
    else if (type === 'rejected') alreadyRejected.push(app.id);
    else reject.push(app.id);
  }
  return { reject, keepOffered, alreadyRejected };
}

export type ArchiveResult = {
  already_archived?: boolean;
  rejected: number;
  kept_offered: number;
  already_rejected?: number;
};

export function describeArchiveResult(title: string, r: ArchiveResult): string {
  if (r.already_archived) return `“${title}” was already archived.`;
  const parts = [`“${title}” is archived and no longer accepting applications.`];
  parts.push(
    r.rejected === 0
      ? 'No applicants needed to be moved to Rejected.'
      : `${r.rejected} applicant${r.rejected === 1 ? '' : 's'} moved to Rejected.`,
  );
  if (r.kept_offered > 0) {
    parts.push(`${r.kept_offered} in Offered kept their status.`);
  }
  return parts.join(' ');
}

export function describeUnarchiveResult(title: string): string {
  return `“${title}” is back in Posted Jobs as a closed job with no candidates attached. Reopen it when you’re ready for new applications.`;
}

// PostgREST error -> what the employer reads. The RPCs raise their own
// readable messages for the expected cases (permission, not found); anything
// else (network, missing migration) gets a generic line so the dialog never
// shows SQL.
export function archiveErrorMessage(
  err: { code?: string; message?: string } | null | undefined,
  action: 'archive' | 'unarchive',
): string {
  const fallback = action === 'archive'
    ? 'We couldn’t archive this posting. Nothing was changed — please try again.'
    : 'We couldn’t unarchive this posting. Nothing was changed — please try again.';
  if (!err) return fallback;
  if (err.code === '42501' || err.code === 'P0002') return err.message || fallback;
  return fallback;
}

// ---- Reference model of the two transactions ----
// What the employer and the student can see of one posting's applications
// across hiring cycles. Mirrors the SQL; used by the tests to pin the rules.
export type ModelApplication = HiringApplication & {
  student_id: string;
  detached_at: string | null;
};

export type ModelListing = {
  status: string;
  archived_at: string | null;
  applications: ModelApplication[];
};

const REJECTED_STAGE = { stage_type: 'rejected' as const };

export function applyArchive(listing: ModelListing, now: string): ModelListing {
  if (listing.archived_at) return listing;
  const attached = listing.applications.filter((a) => !a.detached_at);
  const { reject } = planEndHiring(attached);
  return {
    status: 'closed',
    archived_at: now,
    applications: listing.applications.map((a) =>
      reject.includes(a.id) ? { ...a, stage: REJECTED_STAGE, status: 'Rejected' } : a,
    ),
  };
}

export function applyUnarchive(listing: ModelListing, now: string): ModelListing {
  if (!listing.archived_at) return listing;
  return {
    status: 'closed',
    archived_at: null,
    applications: listing.applications.map((a) => (a.detached_at ? a : { ...a, detached_at: now })),
  };
}

// The existing Reopen action. Refused while archived (the DB check
// internship_listings_archived_is_closed enforces the same).
export function applyReopen(listing: ModelListing): ModelListing {
  if (listing.archived_at) throw new Error('Unarchive the posting before reopening it.');
  return { ...listing, status: 'active' };
}

// The employer's view: attached applications only.
export function employerVisibleApplications(listing: ModelListing): ModelApplication[] {
  return listing.applications.filter((a) => !a.detached_at);
}

// Whether a new application from this student would be accepted: the posting
// is live, not archived, and the student has no attached application on it.
export function canStudentApply(listing: ModelListing, studentId: string): boolean {
  if (listing.archived_at || listing.status !== 'active') return false;
  return !listing.applications.some((a) => a.student_id === studentId && !a.detached_at);
}
