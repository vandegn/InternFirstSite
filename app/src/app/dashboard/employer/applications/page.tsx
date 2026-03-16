'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase, getEmployerByUserId, getEmployerApplications, updateApplicationStatus } from '@/lib/supabase';

type Application = {
  id: string;
  status: string;
  applied_at: string;
  updated_at: string;
  listing: {
    id: string;
    title: string;
    employer_id: string;
  };
  student: {
    id: string;
    major: string | null;
    graduation_year: number | null;
    bio: string | null;
    user_id: string;
    profile: {
      full_name: string;
      email: string;
      avatar_url: string | null;
    };
  };
};

const STATUS_OPTIONS = ['applied', 'reviewed', 'interviewing', 'offered', 'rejected'] as const;

const STATUS_LABELS: Record<string, string> = {
  applied: 'Applied',
  reviewed: 'Under Review',
  interviewing: 'Interviewing',
  offered: 'Offered',
  rejected: 'Not Selected',
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  applied: { bg: '#e0e7ff', color: '#3730a3' },
  reviewed: { bg: '#fef3c7', color: '#92400e' },
  interviewing: { bg: '#dbeafe', color: '#1e40af' },
  offered: { bg: '#d1fae5', color: '#065f46' },
  rejected: { bg: '#fee2e2', color: '#991b1b' },
};

export default function EmployerApplications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterListing, setFilterListing] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const employer = await getEmployerByUserId(user.id);
      if (!employer) return;
      const apps = await getEmployerApplications(employer.id);
      // Supabase returns nested joins as arrays, normalize to single objects
      const normalized = apps.map((app: any) => ({
        ...app,
        listing: Array.isArray(app.listing) ? app.listing[0] : app.listing,
        student: (() => {
          const s = Array.isArray(app.student) ? app.student[0] : app.student;
          return s ? { ...s, profile: Array.isArray(s.profile) ? s.profile[0] : s.profile } : s;
        })(),
      }));
      setApplications(normalized as Application[]);
      setLoading(false);
    }
    fetchData();
  }, []);

  async function handleStatusChange(applicationId: string, newStatus: string) {
    setUpdating(applicationId);
    try {
      await updateApplicationStatus(applicationId, newStatus);
      setApplications(prev => prev.map(app =>
        app.id === applicationId ? { ...app, status: newStatus } : app
      ));
    } catch {
      // silently fail
    } finally {
      setUpdating(null);
    }
  }

  // Get unique listing titles for the filter
  const listingTitles = Array.from(new Set(applications.map(a => a.listing.title)));

  const filtered = applications.filter(app => {
    if (filterStatus && app.status !== filterStatus) return false;
    if (filterListing && app.listing.title !== filterListing) return false;
    return true;
  });

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Applications</h2>
        <Link href="/dashboard/employer" className="btn-secondary" style={{ fontSize: '0.85rem', padding: '8px 16px', textDecoration: 'none' }}>
          Back to Dashboard
        </Link>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.85rem', background: 'var(--bg)' }}
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select
          value={filterListing}
          onChange={(e) => setFilterListing(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.85rem', background: 'var(--bg)' }}
        >
          <option value="">All Listings</option>
          {listingTitles.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
          {filtered.length} application{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading applications...</p>
      ) : applications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px', opacity: 0.5 }}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>No applications yet</p>
          <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>Applications will appear here when students apply to your listings.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', padding: '20px 0' }}>No applications match your filters.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map((app) => {
            const isExpanded = expandedId === app.id;
            const statusStyle = STATUS_COLORS[app.status] || STATUS_COLORS.applied;
            return (
              <div
                key={app.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  background: 'var(--bg)',
                  overflow: 'hidden',
                  transition: 'var(--transition)',
                }}
              >
                {/* Main row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : app.id)}
                  style={{
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    cursor: 'pointer',
                  }}
                >
                  <img
                    src={app.student.profile.avatar_url || 'https://internfirst-demo.com/wp-content/uploads/2026/02/Ellipse-1.png'}
                    alt={app.student.profile.full_name}
                    style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{app.student.profile.full_name}</span>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '2px 10px',
                        borderRadius: '10px',
                        background: statusStyle.bg,
                        color: statusStyle.color,
                      }}>
                        {STATUS_LABELS[app.status]}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                      Applied for: {app.listing.title}
                    </p>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', flexShrink: 0 }}>{timeAgo(app.applied_at)}</span>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-light)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '16px 0' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 600 }}>Email</span>
                        <p style={{ fontSize: '0.9rem', margin: '4px 0 0' }}>{app.student.profile.email}</p>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 600 }}>Major</span>
                        <p style={{ fontSize: '0.9rem', margin: '4px 0 0' }}>{app.student.major || 'Not specified'}</p>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 600 }}>Graduation Year</span>
                        <p style={{ fontSize: '0.9rem', margin: '4px 0 0' }}>{app.student.graduation_year || 'Not specified'}</p>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 600 }}>Applied</span>
                        <p style={{ fontSize: '0.9rem', margin: '4px 0 0' }}>{new Date(app.applied_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    {app.student.bio && (
                      <div style={{ marginBottom: '16px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 600 }}>Bio</span>
                        <p style={{ fontSize: '0.9rem', margin: '4px 0 0', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{app.student.bio}</p>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Update status:</span>
                      <select
                        value={app.status}
                        onChange={(e) => handleStatusChange(app.id, e.target.value)}
                        disabled={updating === app.id}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                          fontSize: '0.85rem',
                          background: 'var(--bg)',
                          cursor: updating === app.id ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {STATUS_OPTIONS.map(s => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                      {updating === app.id && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Saving...</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
