import { describe, it, expect } from 'vitest';
import {
  applyArchive,
  applyReopen,
  applyUnarchive,
  archiveErrorMessage,
  canStudentApply,
  describeArchiveResult,
  employerVisibleApplications,
  filterPostedListings,
  planEndHiring,
  postedJobStatus,
  ARCHIVE_CONFIRM,
  UNARCHIVE_CONFIRM,
  type ModelApplication,
  type ModelListing,
} from './listing-archive';
import { tabForApplication, type StageType } from './application-tabs';

function app(id: string, stageType: StageType | null, status: string | null = null): ModelApplication {
  return {
    id,
    student_id: `student-${id}`,
    status: status ?? (stageType ? stageType : null),
    stage: stageType ? { stage_type: stageType } : null,
    detached_at: null,
  };
}

const NOW = Date.parse('2026-10-09T12:00:00Z');

describe('planEndHiring', () => {
  it('rejects everyone outside Offered and keeps Offered', () => {
    const plan = planEndHiring([
      app('applied', 'applied'),
      app('review', 'reviewing'),
      app('interview', 'interviewing'),
      app('offer', 'offered'),
      app('hired', 'offered'), // "Hired" column is stage_type offered too
      app('rejected', 'rejected'),
      app('legacy-offer', null, 'offered'),
      app('legacy-closed', null, 'Not Selected'),
      app('legacy-unknown', null, 'Take-home'),
    ]);
    expect(plan.reject).toEqual(['applied', 'review', 'interview', 'legacy-unknown']);
    expect(plan.keepOffered).toEqual(['offer', 'hired', 'legacy-offer']);
    expect(plan.alreadyRejected).toEqual(['rejected', 'legacy-closed']);
  });

  it('handles an empty board', () => {
    expect(planEndHiring([])).toEqual({ reject: [], keepOffered: [], alreadyRejected: [] });
  });
});

describe('archive / unarchive / reopen model', () => {
  const base = (): ModelListing => ({
    status: 'active',
    archived_at: null,
    applications: [app('a', 'applied'), app('b', 'interviewing'), app('c', 'offered'), app('d', 'rejected')],
  });

  it('archiving closes the posting, rejects every non-Offered applicant and keeps Offered', () => {
    const archived = applyArchive(base(), '2026-10-09T12:00:00Z');
    expect(archived.status).toBe('closed');
    expect(archived.archived_at).toBeTruthy();
    const types = Object.fromEntries(archived.applications.map((a) => [a.id, a.stage?.stage_type]));
    expect(types).toEqual({ a: 'rejected', b: 'rejected', c: 'offered', d: 'rejected' });
    expect(canStudentApply(archived, 'student-new')).toBe(false);
  });

  it('students see the new status, and their own archive preference is untouched', () => {
    const archived = applyArchive(base(), '2026-10-09T12:00:00Z');
    const b = archived.applications.find((x) => x.id === 'b')!;
    expect(tabForApplication({ ...b, archived_at: null })).toBe('rejected');
    // A student who had archived their application keeps it in Archive.
    const d = archived.applications.find((x) => x.id === 'd')!;
    expect(tabForApplication({ ...d, archived_at: '2026-10-01T00:00:00Z' })).toBe('archive');
  });

  it('is idempotent', () => {
    const once = applyArchive(base(), 't1');
    expect(applyArchive(once, 't2')).toBe(once);
  });

  it('an archived posting cannot be reopened directly', () => {
    expect(() => applyReopen(applyArchive(base(), 't1'))).toThrow();
  });

  it('unarchiving returns a closed posting with no candidate data for the employer', () => {
    const unarchived = applyUnarchive(applyArchive(base(), 't1'), 't2');
    expect(unarchived.status).toBe('closed');
    expect(unarchived.archived_at).toBeNull();
    expect(employerVisibleApplications(unarchived)).toEqual([]);
    // ...while the students' records and final statuses survive.
    expect(unarchived.applications).toHaveLength(4);
    expect(unarchived.applications.find((a) => a.id === 'c')!.stage?.stage_type).toBe('offered');
    expect(unarchived.applications.find((a) => a.id === 'a')!.stage?.stage_type).toBe('rejected');
  });

  it('reopening accepts new applications, including from previous applicants, without restoring old ones', () => {
    const reopened = applyReopen(applyUnarchive(applyArchive(base(), 't1'), 't2'));
    expect(reopened.status).toBe('active');
    expect(canStudentApply(reopened, 'student-a')).toBe(true); // old application is detached
    expect(canStudentApply(reopened, 'student-new')).toBe(true);
    expect(employerVisibleApplications(reopened)).toEqual([]);

    const withFresh: ModelListing = {
      ...reopened,
      applications: [...reopened.applications, { ...app('a2', 'applied'), student_id: 'student-a' }],
    };
    expect(employerVisibleApplications(withFresh).map((a) => a.id)).toEqual(['a2']);
    expect(canStudentApply(withFresh, 'student-a')).toBe(false); // one live application per posting
  });

  it('a second archive later only touches the new cycle', () => {
    const reopened = applyReopen(applyUnarchive(applyArchive(base(), 't1'), 't2'));
    const next = applyArchive(
      { ...reopened, applications: [...reopened.applications, app('e', 'reviewing')] },
      't3',
    );
    expect(employerVisibleApplications(next).map((a) => [a.id, a.stage?.stage_type])).toEqual([['e', 'rejected']]);
  });
});

describe('Posted Jobs list', () => {
  const listings = [
    { id: 'active', status: 'active', application_deadline: null, archived_at: null },
    { id: 'expired', status: 'active', application_deadline: '2026-01-01', archived_at: null },
    { id: 'closed', status: 'closed', application_deadline: null, archived_at: null },
    { id: 'archived', status: 'closed', application_deadline: null, archived_at: '2026-10-01T00:00:00Z' },
  ];
  const ids = (f: Parameters<typeof filterPostedListings>[1]) =>
    filterPostedListings(listings, f, NOW).map((l) => l.id);

  it('keeps archived postings out of the normal list', () => {
    expect(ids('')).toEqual(['active', 'expired', 'closed']);
    expect(ids('closed')).toEqual(['closed']);
  });

  it('shows archived postings under Archived only', () => {
    expect(ids('archived')).toEqual(['archived']);
  });

  it('labels archived and expired postings', () => {
    expect(postedJobStatus(listings[3], NOW)).toBe('archived');
    expect(postedJobStatus(listings[1], NOW)).toBe('expired');
    expect(postedJobStatus(listings[0], NOW)).toBe('active');
  });
});

describe('copy and messages', () => {
  it('uses the exact confirmation wording', () => {
    expect(ARCHIVE_CONFIRM.title).toBe('Archive this job and end hiring?');
    expect(ARCHIVE_CONFIRM.confirmLabel).toBe('Archive & End Hiring');
    expect(UNARCHIVE_CONFIRM.title).toBe('Unarchive this job?');
    expect(UNARCHIVE_CONFIRM.confirmLabel).toBe('Unarchive as Closed');
  });

  it('summarises the result', () => {
    expect(describeArchiveResult('Intern', { rejected: 3, kept_offered: 1 }))
      .toBe('“Intern” is archived and no longer accepting applications. 3 applicants moved to Rejected. 1 in Offered kept their status.');
    expect(describeArchiveResult('Intern', { rejected: 0, kept_offered: 0 }))
      .toContain('No applicants needed');
    expect(describeArchiveResult('Intern', { rejected: 0, kept_offered: 0, already_archived: true }))
      .toBe('“Intern” was already archived.');
  });

  it('never leaks raw database errors', () => {
    expect(archiveErrorMessage({ code: '42501', message: 'You don’t have permission to archive this posting.' }, 'archive'))
      .toMatch(/permission/);
    expect(archiveErrorMessage({ code: 'PGRST202', message: 'Could not find the function' }, 'archive'))
      .toMatch(/Nothing was changed/);
    expect(archiveErrorMessage(null, 'unarchive')).toMatch(/unarchive/);
  });
});
