'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase, getEmployerByUserId, getEmployerListingsWithStats, getEmployerApplications, updateListing, updateApplicationStatus } from '@/lib/supabase';

type ListingWithStats = {
  id: string;
  title: string;
  location: string | null;
  is_remote: boolean;
  compensation: string | null;
  status: string;
  industry: string;
  description: string;
  requirements: string | null;
  application_deadline: string | null;
  created_at: string;
  applicant_count: number;
  view_count: number;
};

type Application = {
  id: string;
  status: string;
  applied_at: string;
  resume: { id: string; name: string; file_url: string } | null;
  listing: { id: string; title: string };
  student: {
    id: string;
    major: string | null;
    graduation_year: number | null;
    bio: string | null;
    user_id: string;
    profile: { full_name: string; email: string; avatar_url: string | null };
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

const LISTING_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active: { bg: '#d1fae5', color: '#065f46' },
  paused: { bg: '#fef3c7', color: '#92400e' },
  closed: { bg: '#fee2e2', color: '#991b1b' },
};

export default function PostedJobsPage() {
  const [listings, setListings] = useState<ListingWithStats[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [updatingAppStatus, setUpdatingAppStatus] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const employer = await getEmployerByUserId(user.id);
      if (!employer) return;

      const [listingsData, appsData] = await Promise.all([
        getEmployerListingsWithStats(employer.id),
        getEmployerApplications(employer.id),
      ]);

      const normalizedApps = appsData.map((app: any) => ({
        ...app,
        listing: Array.isArray(app.listing) ? app.listing[0] : app.listing,
        resume: Array.isArray(app.resume) ? app.resume[0] || null : app.resume,
        student: (() => {
          const s = Array.isArray(app.student) ? app.student[0] : app.student;
          return s ? { ...s, profile: Array.isArray(s.profile) ? s.profile[0] : s.profile } : s;
        })(),
      }));

      setListings(listingsData as ListingWithStats[]);
      setApplications(normalizedApps as Application[]);
      if (listingsData.length > 0) setSelectedId(listingsData[0].id);
      setLoading(false);
    }
    fetchData();
  }, []);

  const filteredListings = filterStatus
    ? listings.filter(l => l.status === filterStatus)
    : listings;

  const selectedListing = listings.find(l => l.id === selectedId);
  const selectedApps = applications.filter(a => a.listing.id === selectedId);

  async function handleToggleStatus(listingId: string, currentStatus: string) {
    setUpdatingStatus(listingId);
    try {
      const newStatus = currentStatus === 'active' ? 'paused' : currentStatus === 'paused' ? 'active' : 'active';
      await updateListing(listingId, { status: newStatus });
      setListings(prev => prev.map(l => l.id === listingId ? { ...l, status: newStatus } : l));
    } catch { /* silently fail */ } finally {
      setUpdatingStatus(null);
    }
  }

  async function handleCloseListing(listingId: string) {
    setUpdatingStatus(listingId);
    try {
      await updateListing(listingId, { status: 'closed' });
      setListings(prev => prev.map(l => l.id === listingId ? { ...l, status: 'closed' } : l));
    } catch { /* silently fail */ } finally {
      setUpdatingStatus(null);
    }
  }

  async function handleAppStatusChange(appId: string, newStatus: string) {
    setUpdatingAppStatus(appId);
    try {
      await updateApplicationStatus(appId, newStatus);
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));
    } catch { /* silently fail */ } finally {
      setUpdatingAppStatus(null);
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  if (loading) {
    return (
      <div className="dash-main" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    );
  }

  return (
    <div className="dash-main" style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Left panel - Job list */}
      <div style={{
        width: '380px',
        minWidth: '380px',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Posted Jobs</h2>
            <Link href="/dashboard/employer/listings/new" style={{
              background: 'var(--primary)', color: '#fff', padding: '6px 14px', borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none',
            }}>+ New</Link>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['', 'active', 'paused', 'closed'].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                style={{
                  padding: '4px 12px', borderRadius: '16px', border: '1px solid var(--border)',
                  fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
                  background: filterStatus === s ? 'var(--primary)' : '#fff',
                  color: filterStatus === s ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredListings.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p>No listings found</p>
            </div>
          ) : (
            filteredListings.map(listing => {
              const isSelected = listing.id === selectedId;
              const statusColors = LISTING_STATUS_COLORS[listing.status] || LISTING_STATUS_COLORS.active;
              return (
                <div
                  key={listing.id}
                  onClick={() => setSelectedId(listing.id)}
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--primary-light)' : '#fff',
                    borderLeft: isSelected ? '3px solid var(--primary)' : '3px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, flex: 1, marginRight: '8px' }}>{listing.title}</h4>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
                      background: statusColors.bg, color: statusColors.color, flexShrink: 0,
                    }}>
                      {listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    {listing.location || 'No location'}{listing.is_remote ? ' (Remote)' : ''} &middot; {listing.industry}
                  </p>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', color: 'var(--text-light)' }}>
                    <span>{listing.applicant_count} applicant{listing.applicant_count !== 1 ? 's' : ''}</span>
                    <span>{listing.view_count} view{listing.view_count !== 1 ? 's' : ''}</span>
                    <span>{timeAgo(listing.created_at)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right panel - Detail */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
        {!selectedListing ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>
            <div style={{ textAlign: 'center' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 12px', opacity: 0.4 }}>
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
              <p>Select a job to view details</p>
            </div>
          </div>
        ) : (
          <div style={{ padding: '28px 32px' }}>
            {/* Listing header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '4px' }}>{selectedListing.title}</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  {selectedListing.location || 'No location'}{selectedListing.is_remote ? ' (Remote)' : ''} &middot; {selectedListing.industry} &middot; {selectedListing.compensation || 'TBD'}
                </p>
                {selectedListing.application_deadline && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                    Deadline: {new Date(selectedListing.application_deadline).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Link href={`/dashboard/employer/listings/${selectedListing.id}/edit`} style={{
                  padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                  fontSize: '0.8rem', fontWeight: 500, textDecoration: 'none', color: 'var(--text)',
                  background: '#fff',
                }}>Edit</Link>
                {selectedListing.status !== 'closed' && (
                  <button
                    onClick={() => handleToggleStatus(selectedListing.id, selectedListing.status)}
                    disabled={updatingStatus === selectedListing.id}
                    style={{
                      padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                      fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', background: '#fff', color: 'var(--text)',
                    }}
                  >
                    {selectedListing.status === 'active' ? 'Pause' : 'Resume'}
                  </button>
                )}
                {selectedListing.status !== 'closed' ? (
                  <button
                    onClick={() => handleCloseListing(selectedListing.id)}
                    disabled={updatingStatus === selectedListing.id}
                    style={{
                      padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid #fca5a5',
                      fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', background: '#fff', color: '#dc2626',
                    }}
                  >Close</button>
                ) : (
                  <button
                    onClick={() => handleToggleStatus(selectedListing.id, selectedListing.status)}
                    disabled={updatingStatus === selectedListing.id}
                    style={{
                      padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid #86efac',
                      fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', background: '#fff', color: '#16a34a',
                    }}
                  >Reopen</button>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
              <div className="stat-card">
                <div className="stat-icon blue">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </div>
                <div>
                  <div className="stat-label">Views</div>
                  <div className="stat-value">{selectedListing.view_count}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon green">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div>
                  <div className="stat-label">Applicants</div>
                  <div className="stat-value">{selectedListing.applicant_count}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon purple">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                </div>
                <div>
                  <div className="stat-label">Conversion</div>
                  <div className="stat-value">
                    {selectedListing.view_count > 0
                      ? Math.round((selectedListing.applicant_count / selectedListing.view_count) * 100) + '%'
                      : '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="profile-card" style={{ padding: '24px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Description</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {selectedListing.description}
              </p>
              {selectedListing.requirements && (
                <>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginTop: '20px', marginBottom: '12px' }}>Requirements</h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                    {selectedListing.requirements}
                  </p>
                </>
              )}
            </div>

            {/* Candidates */}
            <div className="profile-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>
                  Candidates ({selectedApps.length})
                </h3>
              </div>
              {selectedApps.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '20px 0' }}>
                  No applications yet for this listing.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {selectedApps.map(app => {
                    const statusStyle = STATUS_COLORS[app.status] || STATUS_COLORS.applied;
                    return (
                      <div key={app.id} style={{
                        display: 'flex', alignItems: 'center', gap: '14px',
                        padding: '14px 16px', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)', background: 'var(--bg)',
                      }}>
                        <img
                          src={app.student.profile.avatar_url || 'https://internfirst-demo.com/wp-content/uploads/2026/02/Ellipse-1.png'}
                          alt={app.student.profile.full_name}
                          style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{app.student.profile.full_name}</span>
                            <span style={{
                              fontSize: '0.65rem', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
                              background: statusStyle.bg, color: statusStyle.color,
                            }}>
                              {STATUS_LABELS[app.status]}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                            {app.student.major || 'No major'}{app.student.graduation_year ? ` · Class of ${app.student.graduation_year}` : ''} &middot; {app.student.profile.email}
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          {app.resume && (
                            <a
                              href={app.resume.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View Resume"
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border)', background: '#fff', color: 'var(--primary)',
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            </a>
                          )}
                          <select
                            value={app.status}
                            onChange={(e) => handleAppStatusChange(app.id, e.target.value)}
                            disabled={updatingAppStatus === app.id}
                            style={{
                              padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border)', fontSize: '0.78rem', background: '#fff',
                            }}
                          >
                            {STATUS_OPTIONS.map(s => (
                              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                            ))}
                          </select>
                          <Link
                            href="/dashboard/employer/inbox"
                            title="Message"
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border)', background: '#fff', color: 'var(--primary)',
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
