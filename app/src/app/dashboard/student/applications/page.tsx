'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  supabase,
  getStudentByUserId,
  getStudentApplications,
  getStudentOffers,
  respondToOffer,
  type StudentOffer,
} from '@/lib/supabase';

type StageType = 'applied' | 'reviewing' | 'interviewing' | 'offered' | 'rejected';

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
  interviewing: { bg: 'var(--chip-violet-bg)', color: 'var(--chip-violet-ink)', label: 'Interview Requested' },
  offered:      { bg: 'var(--chip-green-bg)', color: 'var(--chip-green-ink)', label: 'Offer Extended' },
  rejected:     { bg: 'var(--danger-bg)', color: 'var(--danger-accent)', label: 'Rejected/Closed' },
};

const FILTER_OPTIONS: { value: '' | StageType; label: string }[] = [
  { value: '',             label: 'All Statuses' },
  { value: 'applied',      label: 'Application Submitted' },
  { value: 'reviewing',    label: 'Under Review' },
  { value: 'interviewing', label: 'Interview Requested' },
  { value: 'offered',      label: 'Offer Extended' },
  { value: 'rejected',     label: 'Rejected/Closed' },
];

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
  const [statusFilter, setStatusFilter] = useState('');
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  // Deep links, read from window rather than useSearchParams so this client
  // page doesn't need a Suspense boundary: ?status=offered from the dashboard
  // stat cards, and ?offer=<id> from the tracker row, the offer notification
  // and the inbox card — all three of which mean "show me that offer".
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    if (status && FILTER_OPTIONS.some((o) => o.value === status)) setStatusFilter(status);
    const offer = params.get('offer');
    if (offer) setFocusOfferId(offer);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    async function fetchApplications() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const student = await getStudentByUserId(user.id);
      if (!student) return;

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

  const filtered = statusFilter
    ? applications.filter((a) => a.stage?.stage_type === statusFilter)
    : applications;

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

      {/* Filter bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '24px',
        flexWrap: 'wrap',
      }}>
        <div ref={statusRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setStatusOpen(!statusOpen)}
            style={{
              padding: '8px 32px 8px 12px',
              borderRadius: '8px',
              border: `1.5px solid ${statusOpen ? 'var(--primary)' : 'var(--border)'}`,
              fontSize: '0.82rem',
              fontWeight: statusFilter ? 600 : 500,
              background: 'var(--bg)',
              color: 'var(--text-primary)',
              outline: 'none',
              cursor: 'pointer',
              appearance: 'none' as const,
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%236b7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 10px center',
              transition: 'border-color 0.15s ease',
              whiteSpace: 'nowrap' as const,
            }}
          >
            {FILTER_OPTIONS.find(o => o.value === statusFilter)?.label || 'All Statuses'}
          </button>
          {statusOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              minWidth: '160px',
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              borderRadius: '10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              zIndex: 100,
              overflow: 'hidden',
              padding: '4px 0',
            }}>
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setStatusFilter(opt.value); setStatusOpen(false); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '7px 12px',
                    border: 'none',
                    background: statusFilter === opt.value ? 'var(--primary-light)' : 'transparent',
                    color: statusFilter === opt.value ? 'var(--primary)' : 'var(--text-primary)',
                    fontWeight: statusFilter === opt.value ? 600 : 400,
                    fontSize: '0.82rem',
                    textAlign: 'left' as const,
                    cursor: 'pointer',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={(e) => { if (statusFilter !== opt.value) e.currentTarget.style.background = 'var(--bg)'; }}
                  onMouseLeave={(e) => { if (statusFilter !== opt.value) e.currentTarget.style.background = 'transparent'; }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {filtered.length} application{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Content */}
      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading applications...</p>
      ) : filtered.length === 0 ? (
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
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>
            {statusFilter ? 'No applications match this filter' : 'You haven\'t applied to any internships yet'}
          </p>
          <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>
            {statusFilter
              ? 'Try selecting a different status filter.'
              : 'Browse internships and start applying!'}
          </p>
          {!statusFilter && (
            <Link
              href="/dashboard/student/internships"
              className="btn-secondary"
              style={{ display: 'inline-block', marginTop: '20px', textDecoration: 'none', fontSize: '0.9rem', padding: '10px 20px' }}
            >
              Browse Internships
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filtered.map((app) => {
            const employer = app.listing.employers;
            const fallback = STAGE_TYPE_FALLBACK[app.stage?.stage_type ?? 'applied'];
            const statusBg = app.stage?.color_bg ?? fallback.bg;
            const statusColor = app.stage?.color_text ?? fallback.color;
            const statusLabel = app.stage?.label ?? app.status ?? fallback.label;

            return (
              <div
                key={app.id}
                className="listing-card"
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
                  </div>

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
                                  background: 'var(--chip-green-ink)', color: '#fff',
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
