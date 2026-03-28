'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase, getStudentByUserId, getStudentApplications } from '@/lib/supabase';

type Application = {
  id: string;
  status: string;
  applied_at: string;
  updated_at: string;
  resume_id: string | null;
  listing: {
    id: string;
    title: string;
    location: string | null;
    is_remote: boolean;
    compensation: string | null;
    industry: string;
    employers: {
      company_name: string;
      logo_url: string | null;
    };
  };
};

const STATUS_LABELS: Record<string, string> = {
  applied: 'Application Submitted',
  under_review: 'Under Review',
  reviewed: 'Under Review',
  interviewing: 'Interview Requested',
  interview_scheduled: 'Interview Scheduled',
  offered: 'Offer Extended',
  rejected: 'Rejected/Closed',
  closed: 'Rejected/Closed',
  not_selected: 'Rejected/Closed',
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  applied: { bg: '#eff6ff', color: '#2563eb' },
  under_review: { bg: '#fef3c7', color: '#92400e' },
  reviewed: { bg: '#fef3c7', color: '#92400e' },
  interviewing: { bg: '#f5f3ff', color: '#7c3aed' },
  interview_scheduled: { bg: '#ecfdf5', color: '#059669' },
  offered: { bg: '#ecfdf5', color: '#059669' },
  rejected: { bg: '#fef2f2', color: '#dc2626' },
  closed: { bg: '#f3f4f6', color: '#6b7280' },
  not_selected: { bg: '#fef2f2', color: '#dc2626' },
};

const FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'applied', label: 'Application Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'interviewing', label: 'Interview Requested' },
  { value: 'interview_scheduled', label: 'Interview Scheduled' },
  { value: 'offered', label: 'Offer Extended' },
  { value: 'rejected', label: 'Rejected/Closed' },
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
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

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

      const raw = await getStudentApplications(student.id);

      // Normalize Supabase nested joins (may return arrays instead of objects)
      const normalized = raw.map((app: any) => {
        const listing = Array.isArray(app.listing) ? app.listing[0] : app.listing;
        return {
          ...app,
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
    ? applications.filter((a) => a.status === statusFilter)
    : applications;

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
              background: '#fff',
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
            const statusStyle = STATUS_COLORS[app.status] || STATUS_COLORS.applied;

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
                        background: statusStyle.bg,
                        color: statusStyle.color,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {STATUS_LABELS[app.status] || app.status}
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
                        {app.listing.is_remote && ' (Remote)'}
                      </span>
                    )}
                    {!app.listing.location && app.listing.is_remote && (
                      <span>Remote</span>
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
