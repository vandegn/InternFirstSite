import { describe, it, expect } from 'vitest';
import {
  applicationStageType,
  applicationsForTab,
  countApplicationsByTab,
  emptyStateFor,
  initialViewFromParams,
  tabForApplication,
  OPEN_STATUS_FILTER_OPTIONS,
  type StageType,
  type TabbableApplication,
} from './application-tabs';

function app(
  id: string,
  stageType: StageType | null,
  opts: { status?: string | null; archived?: boolean } = {},
): TabbableApplication & { id: string } {
  return {
    id,
    status: opts.status ?? (stageType ? 'Label' : null),
    stage: stageType ? { stage_type: stageType } : null,
    archived_at: opts.archived ? '2026-10-09T12:00:00Z' : null,
  };
}

const SAMPLE = [
  app('applied', 'applied'),
  app('reviewing', 'reviewing'),
  app('interviewing', 'interviewing'),
  app('offered', 'offered'),
  app('rejected', 'rejected'),
  app('archived-open', 'interviewing', { archived: true }),
  app('archived-rejected', 'rejected', { archived: true }),
  app('legacy-not-selected', null, { status: 'Not Selected' }),
  app('legacy-under-review', null, { status: 'under_review' }),
];

describe('applicationStageType', () => {
  it('prefers the employer stage over the status text', () => {
    expect(applicationStageType({ status: 'rejected', stage: { stage_type: 'offered' } })).toBe('offered');
  });

  it('maps legacy status text, including mirrored labels', () => {
    expect(applicationStageType({ status: 'Not Selected', stage: null })).toBe('rejected');
    expect(applicationStageType({ status: 'closed', stage: null })).toBe('rejected');
    expect(applicationStageType({ status: 'reviewed', stage: null })).toBe('reviewing');
    expect(applicationStageType({ status: 'Interview Scheduled', stage: null })).toBe('interviewing');
    expect(applicationStageType({ status: 'offered', stage: null })).toBe('offered');
  });

  it('treats unknown or missing status as still in the running', () => {
    expect(applicationStageType({ status: 'Take-home', stage: null })).toBe('applied');
    expect(applicationStageType({ status: null, stage: null })).toBe('applied');
  });
});

describe('tabForApplication', () => {
  it('puts non-archived, non-rejected applications in Open', () => {
    for (const t of ['applied', 'reviewing', 'interviewing', 'offered'] as const) {
      expect(tabForApplication(app(t, t))).toBe('open');
    }
  });

  it('puts non-archived rejected applications in Rejected', () => {
    expect(tabForApplication(app('r', 'rejected'))).toBe('rejected');
    expect(tabForApplication(app('l', null, { status: 'Not Selected' }))).toBe('rejected');
  });

  it('puts every archived application in Archive regardless of status', () => {
    expect(tabForApplication(app('a', 'offered', { archived: true }))).toBe('archive');
    expect(tabForApplication(app('b', 'rejected', { archived: true }))).toBe('archive');
  });

  it('restoring lands an application by its current status', () => {
    // Archived while interviewing, then the employer rejected it.
    const a = app('x', 'interviewing', { archived: true });
    const employerRejected = { ...a, stage: { stage_type: 'rejected' as const } };
    expect(tabForApplication(employerRejected)).toBe('archive'); // no auto-restore
    expect(tabForApplication({ ...employerRejected, archived_at: null })).toBe('rejected');
  });
});

describe('countApplicationsByTab', () => {
  it('counts each application exactly once', () => {
    const counts = countApplicationsByTab(SAMPLE);
    expect(counts).toEqual({ open: 5, rejected: 2, archive: 2 });
    expect(counts.open + counts.rejected + counts.archive).toBe(SAMPLE.length);
  });

  it('is empty-safe', () => {
    expect(countApplicationsByTab([])).toEqual({ open: 0, rejected: 0, archive: 0 });
  });
});

describe('applicationsForTab', () => {
  it('returns disjoint tab lists that cover every application', () => {
    const ids = (tab: 'open' | 'rejected' | 'archive') =>
      applicationsForTab(SAMPLE, tab).map((a) => a.id);
    const all = [...ids('open'), ...ids('rejected'), ...ids('archive')];
    expect(new Set(all).size).toBe(SAMPLE.length);
    expect(all).toHaveLength(SAMPLE.length);
    expect(ids('archive')).toEqual(['archived-open', 'archived-rejected']);
    expect(ids('rejected')).toEqual(['rejected', 'legacy-not-selected']);
  });

  it('filters Open by status', () => {
    expect(applicationsForTab(SAMPLE, 'open', 'reviewing').map((a) => a.id))
      .toEqual(['reviewing', 'legacy-under-review']);
    expect(applicationsForTab(SAMPLE, 'open', 'offered').map((a) => a.id)).toEqual(['offered']);
  });

  it('never surfaces archived applications through the Open filter', () => {
    expect(applicationsForTab(SAMPLE, 'open', 'interviewing').map((a) => a.id)).toEqual(['interviewing']);
  });

  it('ignores the status filter outside Open', () => {
    expect(applicationsForTab(SAMPLE, 'archive', 'applied')).toHaveLength(2);
    expect(applicationsForTab(SAMPLE, 'rejected', 'applied')).toHaveLength(2);
  });

  it('tab counts are unaffected by the filter', () => {
    const filtered = applicationsForTab(SAMPLE, 'open', 'offered');
    expect(filtered).toHaveLength(1);
    expect(countApplicationsByTab(SAMPLE).open).toBe(5);
  });
});

describe('OPEN_STATUS_FILTER_OPTIONS', () => {
  it('defaults to All statuses and never offers Rejected', () => {
    expect(OPEN_STATUS_FILTER_OPTIONS[0]).toEqual({ value: '', label: 'All statuses' });
    expect(OPEN_STATUS_FILTER_OPTIONS.map((o) => o.value)).not.toContain('rejected');
    expect(OPEN_STATUS_FILTER_OPTIONS.map((o) => o.label)).toEqual(
      expect.arrayContaining(['Under Review', 'Interview Requested']),
    );
  });
});

describe('initialViewFromParams', () => {
  const view = (q: string) => initialViewFromParams(new URLSearchParams(q));

  it('defaults to Open with no filter', () => {
    expect(view('')).toEqual({ tab: 'open', statusFilter: '' });
  });

  it('maps legacy ?status= deep links onto tab + filter', () => {
    expect(view('status=offered')).toEqual({ tab: 'open', statusFilter: 'offered' });
    expect(view('status=rejected')).toEqual({ tab: 'rejected', statusFilter: '' });
    expect(view('status=bogus')).toEqual({ tab: 'open', statusFilter: '' });
  });

  it('accepts ?tab=', () => {
    expect(view('tab=archive')).toEqual({ tab: 'archive', statusFilter: '' });
    expect(view('tab=nope')).toEqual({ tab: 'open', statusFilter: '' });
  });
});

describe('emptyStateFor', () => {
  it('has distinct copy for each tab and the filtered case', () => {
    const titles = new Set([
      emptyStateFor('open', { filtered: false, hasAnyApplications: false }).title,
      emptyStateFor('open', { filtered: false, hasAnyApplications: true }).title,
      emptyStateFor('open', { filtered: true, hasAnyApplications: true }).title,
      emptyStateFor('rejected', { filtered: false, hasAnyApplications: true }).title,
      emptyStateFor('archive', { filtered: false, hasAnyApplications: true }).title,
    ]);
    expect(titles.size).toBe(5);
  });
});
