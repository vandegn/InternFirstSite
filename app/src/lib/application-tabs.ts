// ============================================
// MY APPLICATIONS — tabs, status buckets, archive filter (pure)
// ============================================
// Shared by the full My Applications page and the dashboard home list so the
// two can't disagree about which tab an application belongs to. No I/O.
//
// Two independent axes decide where an application shows up:
//   * hiring status — the employer's pipeline stage (stage_type), and
//   * the student's archive flag — their own filing, stored separately in
//     student_application_archives and never written to the application.
// Archive wins: an archived application lives in the Archive tab whatever its
// hiring status, and restoring it drops it back into Open or Rejected by
// whatever its status is *now* (an employer may have moved it meanwhile).

export type StageType = 'applied' | 'reviewing' | 'screening' | 'interviewing' | 'offered' | 'rejected';

export type ApplicationTab = 'open' | 'rejected' | 'archive';

export const APPLICATION_TABS: { id: ApplicationTab; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'archive', label: 'Archive' },
];

// The status filter shown in the Open tab. Labels are the existing student-
// facing stage_type labels from the applications page — no new statuses.
// Rejected is absent on purpose: rejected applications never sit in Open.
export type OpenStatusFilter = '' | Exclude<StageType, 'rejected'>;

export const OPEN_STATUS_FILTER_OPTIONS: { value: OpenStatusFilter; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'applied', label: 'Application Submitted' },
  { value: 'reviewing', label: 'Under Review' },
  { value: 'screening', label: 'Screening' },
  { value: 'interviewing', label: 'Interview Requested' },
  { value: 'offered', label: 'Offer Extended' },
];

export type TabbableApplication = {
  status: string | null;
  stage: { stage_type: StageType } | null;
  // When the student archived it; null/undefined = not archived.
  archived_at?: string | null;
};

// Legacy rows with no stage joined carry only the status text — either an old
// snake_case value or a mirrored stage label ("Not Selected").
function normalizeStatus(status: string | null | undefined): string {
  return (status ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

const LEGACY_STATUS_TYPES: Record<string, StageType> = {
  applied: 'applied',
  application_submitted: 'applied',
  reviewed: 'reviewing',
  reviewing: 'reviewing',
  under_review: 'reviewing',
  screening: 'screening',
  phone_screening: 'screening',
  interviewing: 'interviewing',
  interview_scheduled: 'interviewing',
  interview_requested: 'interviewing',
  offered: 'offered',
  offer_extended: 'offered',
  rejected: 'rejected',
  closed: 'rejected',
  not_selected: 'rejected',
  'rejected/closed': 'rejected',
};

// The canonical bucket for an application: the employer's stage wins, the
// legacy status text is the fallback, and anything unrecognised counts as
// "applied" (still in the running) rather than silently rejected.
export function applicationStageType(app: Pick<TabbableApplication, 'status' | 'stage'>): StageType {
  if (app.stage?.stage_type) return app.stage.stage_type;
  return LEGACY_STATUS_TYPES[normalizeStatus(app.status)] ?? 'applied';
}

export function isRejectedApplication(app: Pick<TabbableApplication, 'status' | 'stage'>): boolean {
  return applicationStageType(app) === 'rejected';
}

export function isArchivedApplication(app: Pick<TabbableApplication, 'archived_at'>): boolean {
  return !!app.archived_at;
}

// Exactly one tab per application.
export function tabForApplication(app: TabbableApplication): ApplicationTab {
  if (isArchivedApplication(app)) return 'archive';
  return isRejectedApplication(app) ? 'rejected' : 'open';
}

// Tab totals, independent of the Open tab's status filter.
export function countApplicationsByTab(apps: TabbableApplication[]): Record<ApplicationTab, number> {
  const counts: Record<ApplicationTab, number> = { open: 0, rejected: 0, archive: 0 };
  for (const app of apps) counts[tabForApplication(app)] += 1;
  return counts;
}

// What a tab shows. The status filter only applies inside Open; other tabs
// ignore it, so switching tabs can't strand the student on an empty list.
export function applicationsForTab<T extends TabbableApplication>(
  apps: T[],
  tab: ApplicationTab,
  statusFilter: OpenStatusFilter = '',
): T[] {
  return apps.filter((app) => {
    if (tabForApplication(app) !== tab) return false;
    if (tab === 'open' && statusFilter) return applicationStageType(app) === statusFilter;
    return true;
  });
}

export function isApplicationTab(value: string | null | undefined): value is ApplicationTab {
  return value === 'open' || value === 'rejected' || value === 'archive';
}

export function isOpenStatusFilter(value: string | null | undefined): value is OpenStatusFilter {
  return OPEN_STATUS_FILTER_OPTIONS.some((o) => o.value === value);
}

// Deep links into the page (dashboard stat cards, notifications) still use
// ?status=<stage_type>. Map that onto a tab + filter: ?status=rejected opens
// the Rejected tab, any Open status opens Open with that filter applied, and
// ?tab= picks a tab directly.
export function initialViewFromParams(params: URLSearchParams): {
  tab: ApplicationTab;
  statusFilter: OpenStatusFilter;
} {
  const tab = params.get('tab');
  const status = params.get('status');
  if (status === 'rejected') return { tab: 'rejected', statusFilter: '' };
  if (status && isOpenStatusFilter(status)) return { tab: 'open', statusFilter: status };
  if (isApplicationTab(tab)) return { tab, statusFilter: '' };
  return { tab: 'open', statusFilter: '' };
}

// The empty-state copy for a tab. `filtered` = Open with a status filter that
// matched nothing, while the tab itself isn't empty.
export function emptyStateFor(
  tab: ApplicationTab,
  opts: { filtered: boolean; hasAnyApplications: boolean },
): { title: string; body: string; browse: boolean } {
  if (tab === 'open' && opts.filtered) {
    return {
      title: 'No open applications with this status',
      body: 'Choose another status, or pick “All statuses” to see every open application.',
      browse: false,
    };
  }
  if (tab === 'open') {
    return opts.hasAnyApplications
      ? {
          title: 'No open applications',
          body: 'Everything you’ve applied to is either rejected or archived. Keep exploring new internships.',
          browse: true,
        }
      : {
          title: 'You haven’t applied to any internships yet',
          body: 'Browse internships and start applying!',
          browse: true,
        };
  }
  if (tab === 'rejected') {
    return {
      title: 'No rejected applications',
      body: 'Applications an employer closes out will show up here, unless you’ve archived them.',
      browse: false,
    };
  }
  return {
    title: 'Your archive is empty',
    body: 'Archive an application from Open or Rejected to file it away. It stays visible to the employer and keeps its status.',
    browse: false,
  };
}
