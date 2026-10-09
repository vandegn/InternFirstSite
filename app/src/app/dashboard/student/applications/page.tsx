'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  supabase,
  getStudentByUserId,
  getStudentApplications,
  getStudentOffers,
  respondToOffer,
  type StudentOffer,
} from '@/lib/supabase';
import {
  APPLICATION_TABS,
  OPEN_STATUS_FILTER_OPTIONS,
  applicationStageType,
  applicationsForTab,
  countApplicationsByTab,
  emptyStateFor,
  initialViewFromParams,
  isOpenStatusFilter,
  tabForApplication,
  type ApplicationTab,
  type OpenStatusFilter,
  type StageType,
} from '@/lib/application-tabs';
import { useApplicationArchive } from '@/lib/use-application-archive';
import ApplicationRowAction from '@/components/ApplicationRowAction';
import ArchiveToast from '@/components/ArchiveToast';
import { stageColor } from '@/lib/stage-colors';

type Application = {
  id: string;
  status: string;
  stage_id: string | null;
  applied_at: string;
  updated_at: string;
  resume_id: string | null;
  stage: {
    label: string;
    color_bg: string;
    color_text: string;
    stage_type: StageType;
  } | null;
  listing: {
    id: string;
    title: string;
    location: string | null;
    is_remote: boolean;
    is_hybrid: boolean;
    compensation: string | null;
    industry: string;
    employers: {
      company_name: string;
      logo_url: string | null;
    };
  };
};

// Fallback styling when an application has no stage joined (e.g., legacy
// rows). Keyed by stage_type — used by the filter buckets too.
const STAGE_TYPE_FALLBACK: Record<StageType, { bg: string; color: string; label: string }> = {
  applied:      { bg: 'var(--chip-blue-bg)', color: 'var(--chip-blue-ink)', label: 'Application Submitted' },
  reviewing:    { bg: 'var(--chip-amber-bg)', color: 'var(--chip-amber-ink)', label: 'Under Review' },
  screening:    { bg: 'var(--chip-blue-bg)', color: 'var(--chip-blue-ink)', label: 'Screening' },
  interviewing: { bg: 'var(--chip-violet-bg)', color: 'var(--chip-violet-ink)', label: 'Interview Requested' },
  offered:      { bg: 'var(--chip-green-bg)', color: 'var(--chip-green-ink)', label: 'Offer Extended' },
  rejected:     { bg: 'var(--danger-bg)', color: 'var(--danger-accent)', label: 'Rejected/Closed' },
};

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function MyApplications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [offers, setOffers] = useState<StudentOffer[]>([]);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [offerError, setOfferError] = useState('');
  // Declining is the one irreversible answer here, so it asks again.
  const [decliningOffer, setDecliningOffer] = useState<StudentOffer | null>(null);
  // The offer a deep link pointed at: scrolled to once, and outlined so it's
  // obvious which of several applications the link meant.
  const [focusOfferId, setFocusOfferId] = useState<string | null>(null);
  const focusScrolled = useRef(false);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState<string | null>(null);
  // Open / Rejected / Archive. The status filter only exists in Open.
  const [tab, setTab] = useState<ApplicationTab>('open');
  const [statusFilter, setStatusFilter] = useState<OpenStatusFilter>('');
  const tabRefs = useRef<Record<ApplicationTab, HTMLButtonElement | null>>({
    open: null,
    rejected: null,
    archive: null,
  });
  // Set once the ?offer= deep link has picked the tab its application sits in.
  const offerTabResolved = useRef(false);

  // The student's archive filing, persisted in student_application_archives
  // and shared with the dashboard home list.
  const archiveState = useApplicationArchive(studentId);
  const { archivedAt, loadState: archiveLoadState } = archiveState;

  // Deep links, read from window rather than useSearchParams so this client
  // page doesn't need a Suspense boundary: ?status=offered from the dashboard
  // stat cards (mapped onto a tab + filter), ?tab=, and ?offer=<id> from the
  // tracker row, the offer notification and the inbox card — all three of
  // which mean "show me that offer".
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = initialViewFromParams(params);
    setTab(view.tab);
    setStatusFilter(view.statusFilter);
    const offer = params.get('offer');
    if (offer) setFocusOfferId(offer);
  }, []);

  useEffect(() => {
    async function fetchApplications() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const student = await getStudentByUserId(user.id);
      if (!student) { setLoading(false); return; }
      setStudentId(student.id);

      const [raw, offerRows] = await Promise.all([
        getStudentApplications(student.id),
        getStudentOffers(student.id),
      ]);
      setOffers(offerRows);

      // Normalize Supabase nested joins (may return arrays instead of objects)
      const normalized = raw.map((app: any) => {
        const listing = Array.isArray(app.listing) ? app.listing[0] : app.listing;
        const stage = Array.isArray(app.stage) ? app.stage[0] : app.stage;
        return {
          ...app,
          stage: stage ?? null,
          listing: listing
            ? {
                ...listing,
                employers: Array.isArray(listing.employers)
                  ? listing.employers[0]
                  : listing.employers,
              }
            : null,
        };
      });

      setApplications(normalized.filter((a: any) => a.listing) as Application[]);
      setLoading(false);
    }
    fetchApplications();
  }, []);

  // Hiring status comes from the application; the archive flag from the
  // student's own filing. The two never write to each other.
  const withArchive = useMemo(
    () => applications.map((a) => ({ ...a, archived_at: archivedAt[a.id] ?? null })),
    [applications, archivedAt],
  );
  const counts = useMemo(() => countApplicationsByTab(withArchive), [withArchive]);
  const visible = useMemo(
    () => applicationsForTab(withArchive, tab, statusFilter),
    [withArchive, tab, statusFilter],
  );
  const tabTotal = counts[tab];
  const archiveReady = archiveLoadState === 'ready';
  const ready = !loading
    && (studentId === null || archiveLoadState === 'ready' || archiveLoadState === 'error');

  // ?offer= deep link: once everything has loaded, open whichever tab that
  // offer's application is in (it may be archived or rejected), so the
  // focused offer panel is actually on screen.
  useEffect(() => {
    if (!focusOfferId || !ready || offerTabResolved.current) return;
    offerTabResolved.current = true;
    const offer = offers.find((o) => o.id === focusOfferId);
    const app = offer && withArchive.find((a) => a.id === offer.application_id);
    if (!app) return;
    setTab(tabForApplication(app));
    setStatusFilter('');
  }, [focusOfferId, ready, offers, withArchive]);

  function selectTab(next: ApplicationTab, focus = false) {
    setTab(next);
    if (focus) tabRefs.current[next]?.focus();
  }

  // ARIA tabs keyboard model: arrows move between tabs (automatic
  // activation), Home/End jump to the ends.
  function handleTabKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    const ids = APPLICATION_TABS.map((t) => t.id);
    const i = ids.indexOf(tab);
    let next: ApplicationTab | null = null;
    if (e.key === 'ArrowRight') next = ids[(i + 1) % ids.length];
    else if (e.key === 'ArrowLeft') next = ids[(i - 1 + ids.length) % ids.length];
    else if (e.key === 'Home') next = ids[0];
    else if (e.key === 'End') next = ids[ids.length - 1];
    if (next) {
      e.preventDefault();
      selectTab(next, true);
    }
  }

  function rowLabel(app: Application) {
    return `${app.listing.title} at ${app.listing.employers?.company_name ?? 'this company'}`;
  }

  // Where a restored application lands, by its current hiring status.
  function restoreDestination(app: Application) {
    return applicationStageType(app) === 'rejected' ? 'Rejected' : 'Open';
  }

  // The employer's offer on an application, if there is one. Withdrawn rows
  // are history — nothing is shown for them.
  function offerFor(applicationId: string) {
    return offers.find((o) => o.application_id === applicationId && o.status !== 'withdrawn');
  }

  // Ref callback rather than an effect: the panel only exists once offers and
  // applications have both loaded and the row it belongs to has rendered.
  function focusOfferRef(node: HTMLDivElement | null) {
    if (!node || focusScrolled.current) return;
    focusScrolled.current = true;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function handleRespond(offer: StudentOffer, action: 'accept' | 'decline') {
    if (respondingTo) return;
    setRespondingTo(offer.id);
    setOfferError('');
    try {
      const updated = await respondToOffer(offer.id, action);
      setOffers((prev) => prev.map((o) => (o.id === offer.id ? { ...o, ...updated } : o)));
      setDecliningOffer(null);
    } catch (err) {
      setOfferError(
        err instanceof Error ? err.message : 'We couldn’t record your answer. Please try again.'
      );
    } finally {
      setRespondingTo(null);
    }
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>My Applications</h2>
        <Link
          href="/dashboard/student"
          className="btn-secondary"
          style={{ fontSize: '0.85rem', padding: '8px 16px', textDecoration: 'none' }}
        >
          Back to Dashboard
        </Link>
      </div>

      {/* Tabs: Open / Rejected / Archive (ARIA tabs pattern). Counts are each
          tab's total, independent of the Open status filter. */}
      <div role="tablist" aria-label="Application groups" className="app-tabs">
        {APPLICATION_TABS.map((t) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              ref={(node) => { tabRefs.current[t.id] = node; }}
              type="button"
              role="tab"
              id={`applications-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`applications-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              className="app-tab"
              onClick={() => selectTab(t.id)}
              onKeyDown={handleTabKeyDown}
            >
              {t.label}
              <span className="app-tab-count" aria-label={`${ready ? counts[t.id] : 'loading'} applications`}>
                {ready ? counts[t.id] : '–'}
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`applications-panel-${tab}`}
        aria-labelledby={`applications-tab-${tab}`}
        tabIndex={0}
        style={{ outlineOffset: 4 }}
      >
      {archiveLoadState === 'error' && (
        <div className="app-notice" role="alert">
          <span>{archiveState.loadError} Archived applications may be listed under Open or Rejected until it loads.</span>
          <button type="button" onClick={() => void archiveState.reload()}>Try again</button>
        </div>
      )}

      {/* Status filter — Open tab only. Stays visible when it matches nothing. */}
      {tab === 'open' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}>
          <select
            className="app-status-select"
            aria-label="Filter open applications by status"
            value={statusFilter}
            onChange={(e) => {
              const value = e.target.value;
              if (isOpenStatusFilter(value)) setStatusFilter(value);
            }}
            style={{ fontWeight: statusFilter ? 600 : 500 }}
          >
            {OPEN_STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {ready && (
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }} aria-live="polite">
              {statusFilter
                ? `${visible.length} of ${tabTotal} open application${tabTotal !== 1 ? 's' : ''}`
                : `${visible.length} application${visible.length !== 1 ? 's' : ''}`}
            </span>
          )}
        </div>
      )}

      {/* Content */}
      {!ready ? (
        <p style={{ color: 'var(--text-secondary)' }} role="status">Loading applications...</p>
      ) : visible.length === 0 ? (
        (() => {
          const empty = emptyStateFor(tab, {
            filtered: tab === 'open' && !!statusFilter && tabTotal > 0,
            hasAnyApplications: applications.length > 0,
          });
          return (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginBottom: '16px', opacity: 0.5 }}
                aria-hidden="true"
              >
                {tab === 'archive' ? (
                  <>
                    <polyline points="21 8 21 21 3 21 3 8" />
                    <rect x="1" y="3" width="22" height="5" />
                    <line x1="10" y1="12" x2="14" y2="12" />
                  </>
                ) : (
                  <>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </>
                )}
              </svg>
              <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>{empty.title}</p>
              <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>{empty.body}</p>
              {empty.browse && (
                <Link
                  href="/dashboard/student/internships"
                  className="btn-secondary"
                  style={{ display: 'inline-block', marginTop: '20px', textDecoration: 'none', fontSize: '0.9rem', padding: '10px 20px' }}
                >
                  Browse Internships
                </Link>
              )}
            </div>
          );
        })()
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {visible.map((app) => {
            const employer = app.listing.employers;
            const fallback = STAGE_TYPE_FALLBACK[applicationStageType(app)];
            const statusBg = stageColor(app.stage?.color_bg) ?? fallback.bg;
            const statusColor = stageColor(app.stage?.color_text) ?? fallback.color;
            const statusLabel = app.stage?.label ?? app.status ?? fallback.label;
            const archived = !!app.archived_at;

            return (
              <div
                key={app.id}
                className="listing-card app-row"
                style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '20px' }}
              >
                {/* Logo */}
                {employer?.logo_url ? (
                  <img
                    src={employer.logo_url}
                    alt={employer.company_name}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 'var(--radius-sm)',
                      objectFit: 'cover',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--primary-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      color: 'var(--primary)',
                      fontSize: '1.2rem',
                      flexShrink: 0,
                    }}
                  >
                    {employer?.company_name?.charAt(0) || '?'}
                  </div>
                )}

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <Link
                        href={`/dashboard/student/internships/${app.listing.id}`}
                        style={{ fontSize: '1.05rem', fontWeight: 600, color: 'inherit', textDecoration: 'none' }}
                      >
                        {app.listing.title}
                      </Link>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '2px' }}>
                        {employer?.company_name}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {/* Archive is the student's own filing, so the employer's
                          status pill is shown unchanged in every tab. */}
                      <span
                        style={{
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          background: statusBg,
                          color: statusColor,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        {statusLabel}
                      </span>
                      <ApplicationRowAction
                        mode={archived ? 'restore' : 'archive'}
                        itemLabel={rowLabel(app)}
                        pending={archiveState.isPending(app.id)}
                        disabled={!archiveReady}
                        onActivate={() => {
                          if (archived) void archiveState.restore(app.id, app.listing.title, restoreDestination(app));
                          else void archiveState.archive(app.id, app.listing.title);
                        }}
                      />
                    </div>
                  </div>
                  {archived && app.archived_at && (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                      Archived {formatDate(app.archived_at)} · Restores to {restoreDestination(app)}
                    </p>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {app.listing.location && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        {app.listing.location}
                        {app.listing.is_remote ? ' (Remote)' : app.listing.is_hybrid ? ' (Hybrid)' : ''}
                      </span>
                    )}
                    {!app.listing.location && app.listing.is_remote && (
                      <span>Remote</span>
                    )}
                    {!app.listing.location && !app.listing.is_remote && app.listing.is_hybrid && (
                      <span>Hybrid</span>
                    )}
                    {app.listing.compensation && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="1" x2="12" y2="23" />
                          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                        {app.listing.compensation}
                      </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      Applied {formatDate(app.applied_at)}
                    </span>
                  </div>

                  {app.listing.industry && (
                    <div style={{ marginTop: '10px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: '20px',
                          fontSize: '0.78rem',
                          fontWeight: 500,
                          background: 'var(--primary-light)',
                          color: 'var(--primary)',
                        }}
                      >
                        {app.listing.industry}
                      </span>
                    </div>
                  )}

                  {/* The offer, once the employer sends it. It outranks the
                      status pill above, so it gets its own panel rather than
                      another chip. */}
                  {(() => {
                    const offer = offerFor(app.id);
                    if (!offer) return null;
                    const answered = offer.status !== 'extended';
                    const isFocused = offer.id === focusOfferId;
                    return (
                      <div
                        ref={isFocused ? focusOfferRef : undefined}
                        style={{
                          marginTop: '14px',
                          padding: '14px 16px',
                          borderRadius: '10px',
                          border: '1px solid var(--chip-green-ink)',
                          borderLeft: '4px solid var(--chip-green-ink)',
                          background: 'var(--chip-green-bg)',
                          boxShadow: isFocused ? '0 0 0 3px rgba(16, 185, 129, 0.25)' : 'none',
                          transition: 'box-shadow 0.2s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.92rem', fontWeight: 700 }}>
                            {offer.status === 'accepted'
                              ? 'You accepted this offer'
                              : offer.status === 'declined'
                                ? 'You declined this offer'
                                : `${employer?.company_name ?? 'The employer'} is offering you this role`}
                          </span>
                          <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                            {answered && offer.responded_at
                              ? formatDate(offer.responded_at)
                              : `Sent ${formatDate(offer.extended_at)}`}
                          </span>
                        </div>

                        {offer.note && (
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                            {offer.note}
                          </p>
                        )}

                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {offer.storage_path && (
                            <a
                              href={`/api/files/offer/${offer.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '7px 14px', borderRadius: '8px',
                                border: '1px solid var(--chip-green-ink)', background: 'var(--surface)',
                                color: 'var(--chip-green-ink)', fontSize: '0.82rem', fontWeight: 600,
                                textDecoration: 'none',
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                              View offer letter
                            </a>
                          )}
                          {!answered && (
                            <>
                              <button
                                onClick={() => handleRespond(offer, 'accept')}
                                disabled={respondingTo === offer.id}
                                style={{
                                  padding: '7px 16px', borderRadius: '8px', border: 'none',
                                  background: 'var(--chip-green-ink)', color: 'var(--on-fill)',
                                  fontSize: '0.82rem', fontWeight: 700,
                                  cursor: respondingTo === offer.id ? 'not-allowed' : 'pointer',
                                  opacity: respondingTo === offer.id ? 0.6 : 1,
                                }}
                              >
                                {respondingTo === offer.id ? 'Saving…' : 'Accept offer'}
                              </button>
                              <button
                                onClick={() => { setOfferError(''); setDecliningOffer(offer); }}
                                disabled={respondingTo === offer.id}
                                style={{
                                  padding: '7px 16px', borderRadius: '8px',
                                  border: '1px solid var(--border)', background: 'var(--surface)',
                                  color: 'var(--text)', fontSize: '0.82rem', fontWeight: 600,
                                  cursor: respondingTo === offer.id ? 'not-allowed' : 'pointer',
                                }}
                              >
                                Decline
                              </button>
                            </>
                          )}
                          {!answered && !offer.storage_path && (
                            <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                              No letter attached yet — message them if you need the details in writing.
                            </span>
                          )}
                        </div>

                        {offerError && respondingTo === null && (
                          <p role="alert" style={{ marginTop: '10px', fontSize: '0.78rem', color: 'var(--danger-fg)' }}>
                            {offerError}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      <ArchiveToast toast={archiveState.toast} onDismiss={archiveState.dismissToast} />

      {/* Declining tells the employer the search is back on for this role, and
          there's no undo, so it asks once more. */}
      {decliningOffer && (
        <div
          onClick={() => { if (!respondingTo) setDecliningOffer(null); }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: '24px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            style={{
              background: 'var(--surface)', borderRadius: 'var(--radius)',
              width: 'min(420px, 92vw)', padding: '24px',
            }}
          >
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 10 }}>
              Decline this offer?
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 18 }}>
              {decliningOffer.employer?.company_name ?? 'The employer'} will be told you turned down
              {decliningOffer.listing?.title ? ` ${decliningOffer.listing.title}` : ' the role'}.
              You can&apos;t take this back from here — you&apos;d have to message them.
            </p>
            {offerError && (
              <p role="alert" style={{ fontSize: '0.8rem', color: 'var(--danger-fg)', marginBottom: 12 }}>
                {offerError}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDecliningOffer(null)}
                disabled={respondingTo !== null}
                className="btn-secondary"
                style={{ fontSize: '0.85rem', padding: '7px 14px' }}
              >
                Keep it open
              </button>
              <button
                onClick={() => handleRespond(decliningOffer, 'decline')}
                disabled={respondingTo !== null}
                style={{
                  fontSize: '0.85rem', padding: '7px 14px', borderRadius: 6,
                  border: '1px solid var(--danger-border)', background: 'var(--danger-bg)',
                  color: 'var(--danger-fg)', fontWeight: 600,
                  cursor: respondingTo !== null ? 'not-allowed' : 'pointer',
                }}
              >
                {respondingTo !== null ? 'Sending…' : 'Yes, decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
