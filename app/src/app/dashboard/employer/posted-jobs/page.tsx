'use client';

import ReactMarkdown from 'react-markdown';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  supabase,
  getEmployerByUserId,
  getEmployerListingsWithStats,
  getEmployerApplications,
  getEmployerInterviews,
  createInterview,
  rescheduleInterview,
  updateListing,
  updateApplicationStage,
  getListingStages,
  type PipelineStage,
} from '@/lib/supabase';
import ScheduleInterviewModal from '@/components/ScheduleInterviewModal';
import type { ScheduleInterviewFormData } from '@/components/ScheduleInterviewModal';

type ListingWithStats = {
  id: string;
  title: string;
  location: string | null;
  is_remote: boolean;
  is_hybrid: boolean;
  compensation: string | null;
  status: string;
  industry: string;
  description: string;
  requirements: string | null;
  key_responsibilities: string | null;
  application_deadline: string | null;
  created_at: string;
  applicant_count: number;
  view_count: number;
};

type Application = {
  id: string;
  status: string;
  stage_id: string | null;
  applied_at: string;
  resume: { id: string; name: string; file_url: string } | null;
  listing: { id: string; title: string };
  stage: {
    id: string;
    label: string;
    color_bg: string;
    color_text: string;
    stage_type: PipelineStage['stage_type'];
  } | null;
  student: {
    id: string;
    major: string | null;
    graduation_year: number | null;
    bio: string | null;
    user_id: string;
    profile: { full_name: string; email: string; avatar_url: string | null };
  };
};

const FALLBACK_PILL = { bg: '#e0e7ff', color: '#3730a3', label: 'Applied' };

const LISTING_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active: { bg: '#d1fae5', color: '#065f46' },
  paused: { bg: '#fef3c7', color: '#92400e' },
  closed: { bg: '#fee2e2', color: '#991b1b' },
};

type Interview = {
  id: string;
  application_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: 'pending' | 'accepted' | 'declined' | 'reschedule_requested' | 'cancelled' | 'completed';
  employer_notes: string | null;
};

function joinWindowStatus(scheduledAt: string, durationMinutes: number): 'too_early' | 'open' | 'ended' {
  const now = Date.now();
  const start = new Date(scheduledAt).getTime();
  const end = start + (durationMinutes + 30) * 60 * 1000;
  if (now < start - 10 * 60 * 1000) return 'too_early';
  if (now > end) return 'ended';
  return 'open';
}

const INTERVIEW_STATUS_LABELS: Record<string, string> = {
  pending: 'Interview Pending',
  accepted: 'Interview Confirmed',
  declined: 'Interview Declined',
  reschedule_requested: 'Reschedule Requested',
  cancelled: 'Interview Cancelled',
  completed: 'Interview Completed',
};

const INTERVIEW_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#fef3c7', color: '#92400e' },
  accepted: { bg: '#d1fae5', color: '#065f46' },
  declined: { bg: '#fee2e2', color: '#991b1b' },
  reschedule_requested: { bg: '#fef3c7', color: '#92400e' },
  cancelled: { bg: '#f3f4f6', color: '#4b5563' },
  completed: { bg: '#e0e7ff', color: '#3730a3' },
};

function formatInterviewWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function PostedJobsPage() {
  const [listings, setListings] = useState<ListingWithStats[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [employerId, setEmployerId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [updatingAppStatus, setUpdatingAppStatus] = useState<string | null>(null);
  const [scheduleModalApp, setScheduleModalApp] = useState<Application | null>(null);
  const [scheduleModalInterview, setScheduleModalInterview] = useState<Interview | null>(null);
  // Pipeline stages for the currently-selected listing — drives the
  // per-applicant status dropdown.
  const [selectedListingStages, setSelectedListingStages] = useState<PipelineStage[]>([]);

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const employer = await getEmployerByUserId(user.id);
      if (!employer) return;
      setEmployerId(employer.id);

      const [listingsData, appsData, interviewsData] = await Promise.all([
        getEmployerListingsWithStats(employer.id),
        getEmployerApplications(employer.id),
        getEmployerInterviews(employer.id),
      ]);

      const normalizedApps = appsData.map((app: any) => ({
        ...app,
        listing: Array.isArray(app.listing) ? app.listing[0] : app.listing,
        resume: Array.isArray(app.resume) ? app.resume[0] || null : app.resume,
        stage: Array.isArray(app.stage) ? app.stage[0] || null : (app.stage ?? null),
        student: (() => {
          const s = Array.isArray(app.student) ? app.student[0] : app.student;
          return s ? { ...s, profile: Array.isArray(s.profile) ? s.profile[0] : s.profile } : s;
        })(),
      }));

      setListings(listingsData as ListingWithStats[]);
      setApplications(normalizedApps as Application[]);
      setInterviews(interviewsData as unknown as Interview[]);
      if (listingsData.length > 0) setSelectedId(listingsData[0].id);
      setLoading(false);
    }
    fetchData();
  }, []);

  // Whenever the selected listing changes, load its pipeline stages so
  // the per-applicant dropdown shows that listing's actual columns.
  useEffect(() => {
    if (!selectedId) {
      setSelectedListingStages([]);
      return;
    }
    getListingStages(selectedId).then(setSelectedListingStages);
  }, [selectedId]);

  function activeInterviewForApp(applicationId: string): Interview | undefined {
    return interviews.find(i =>
      i.application_id === applicationId &&
      !['declined', 'cancelled', 'completed'].includes(i.status)
    );
  }

  function openScheduleModal(app: Application) {
    setScheduleModalInterview(activeInterviewForApp(app.id) ?? null);
    setScheduleModalApp(app);
  }

  function closeScheduleModal() {
    setScheduleModalApp(null);
    setScheduleModalInterview(null);
  }

  async function handleScheduleSubmit(data: ScheduleInterviewFormData) {
    if (!scheduleModalApp || !employerId) return;
    if (scheduleModalInterview) {
      const updated = await rescheduleInterview(scheduleModalInterview.id, {
        scheduledAt: data.scheduledAt,
        durationMinutes: data.durationMinutes,
        notes: data.notes,
      });
      setInterviews(prev => prev.map(i => i.id === updated.id ? (updated as unknown as Interview) : i));
    } else {
      const created = await createInterview({
        applicationId: scheduleModalApp.id,
        employerId,
        studentId: scheduleModalApp.student.id,
        listingId: scheduleModalApp.listing.id,
        scheduledAt: data.scheduledAt,
        durationMinutes: data.durationMinutes,
        notes: data.notes,
      });
      setInterviews(prev => [...prev, created as unknown as Interview]);
      setApplications(prev => prev.map(a =>
        a.id === scheduleModalApp.id ? { ...a, status: 'interviewing' } : a,
      ));
    }
    closeScheduleModal();
  }

  async function handleCancelInterview(interviewId: string) {
    const res = await fetch(`/api/interviews/${interviewId}/cancel`, { method: 'POST' });
    if (res.ok) {
      const cancelled = await res.json();
      setInterviews(prev => prev.map(i => i.id === cancelled.id ? (cancelled as unknown as Interview) : i));
    }
  }

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

  async function handleAppStageChange(appId: string, newStageId: string) {
    setUpdatingAppStatus(appId);
    try {
      await updateApplicationStage(appId, newStageId);
      const newStage = selectedListingStages.find(s => s.id === newStageId);
      setApplications(prev => prev.map(a =>
        a.id === appId
          ? {
              ...a,
              stage_id: newStageId,
              status: newStage?.label ?? a.status,
              stage: newStage
                ? {
                    id: newStage.id,
                    label: newStage.label,
                    color_bg: newStage.color_bg,
                    color_text: newStage.color_text,
                    stage_type: newStage.stage_type,
                  }
                : a.stage,
            }
          : a
      ));
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
                    {listing.location || 'No location'}{listing.is_remote ? ' (Remote)' : listing.is_hybrid ? ' (Hybrid)' : ''} &middot; {listing.industry}
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
                  {selectedListing.location || 'No location'}{selectedListing.is_remote ? ' (Remote)' : selectedListing.is_hybrid ? ' (Hybrid)' : ''} &middot; {selectedListing.industry} &middot; {selectedListing.compensation || 'TBD'}
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

            {/* Listing content */}
            <div className="profile-card" style={{ padding: '24px', marginBottom: '20px' }}>
              {selectedListing.requirements && (
                <>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Qualifications</h3>
                  <div className="markdown-content"><ReactMarkdown>{selectedListing.requirements}</ReactMarkdown></div>
                </>
              )}
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginTop: selectedListing.requirements ? '20px' : '0', marginBottom: '12px' }}>Job Overview</h3>
              <div className="markdown-content"><ReactMarkdown>{selectedListing.description}</ReactMarkdown></div>
              {selectedListing.key_responsibilities && (
                <>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginTop: '20px', marginBottom: '12px' }}>Key Responsibilities</h3>
                  <div className="markdown-content"><ReactMarkdown>{selectedListing.key_responsibilities || ''}</ReactMarkdown></div>
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
                    const pillBg = app.stage?.color_bg ?? FALLBACK_PILL.bg;
                    const pillColor = app.stage?.color_text ?? FALLBACK_PILL.color;
                    const pillLabel = app.stage?.label ?? app.status ?? FALLBACK_PILL.label;
                    const interview = activeInterviewForApp(app.id);
                    const interviewBadge = interview ? INTERVIEW_STATUS_COLORS[interview.status] : null;
                    return (
                      <div key={app.id} style={{
                        display: 'flex', flexDirection: 'column', gap: 10,
                        padding: '14px 16px', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)', background: 'var(--bg)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
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
                                background: pillBg, color: pillColor,
                              }}>
                                {pillLabel}
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
                              value={app.stage_id ?? ''}
                              onChange={(e) => handleAppStageChange(app.id, e.target.value)}
                              disabled={updatingAppStatus === app.id || selectedListingStages.length === 0}
                              style={{
                                padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border)', fontSize: '0.78rem', background: '#fff',
                              }}
                            >
                              {selectedListingStages.map(s => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => openScheduleModal(app)}
                              title={interview ? 'Reschedule interview' : 'Schedule interview'}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border)', background: '#fff', color: 'var(--primary)',
                                cursor: 'pointer',
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                              </svg>
                            </button>
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
                        {interview && interviewBadge && (() => {
                          const ws = joinWindowStatus(interview.scheduled_at, interview.duration_minutes);
                          const canJoin = ws === 'open';
                          return (
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '8px 12px', borderRadius: 8,
                              background: '#fff', border: '1px solid var(--border)',
                            }}>
                              <span style={{
                                fontSize: '0.65rem', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
                                background: interviewBadge.bg, color: interviewBadge.color,
                              }}>
                                {INTERVIEW_STATUS_LABELS[interview.status]}
                              </span>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                {formatInterviewWhen(interview.scheduled_at)} · {interview.duration_minutes} min
                              </span>
                              <div style={{ flex: 1 }} />
                              {interview.status === 'accepted' && (
                                <Link
                                  href={canJoin ? `/dashboard/employer/interviews/${interview.id}` : '#'}
                                  onClick={e => { if (!canJoin) e.preventDefault(); }}
                                  title={ws === 'too_early' ? `Joinable at ${new Date(new Date(interview.scheduled_at).getTime() - 10 * 60 * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ws === 'ended' ? 'Interview ended' : 'Join Interview'}
                                  style={{
                                    fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                                    background: canJoin ? 'var(--primary)' : 'var(--border)',
                                    color: canJoin ? '#fff' : 'var(--text-secondary)',
                                    textDecoration: 'none', whiteSpace: 'nowrap',
                                    cursor: canJoin ? 'pointer' : 'not-allowed',
                                  }}
                                >
                                  {ws === 'too_early' ? 'Not yet open' : ws === 'ended' ? 'Ended' : 'Join Interview'}
                                </Link>
                              )}
                              <button
                                onClick={() => openScheduleModal(app)}
                                style={{
                                  fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                                  border: '1px solid var(--border)', background: '#fff', color: 'var(--text)',
                                  cursor: 'pointer',
                                }}
                              >
                                Reschedule
                              </button>
                              <button
                                onClick={() => handleCancelInterview(interview.id)}
                                style={{
                                  fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                                  border: '1px solid #fca5a5', background: '#fff', color: '#dc2626',
                                  cursor: 'pointer',
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ScheduleInterviewModal
        open={scheduleModalApp !== null}
        onClose={closeScheduleModal}
        onSubmit={handleScheduleSubmit}
        candidateName={scheduleModalApp?.student.profile.full_name}
        listingTitle={scheduleModalApp?.listing.title}
        mode={scheduleModalInterview ? 'reschedule' : 'create'}
        initialData={scheduleModalInterview ? {
          scheduledAt: scheduleModalInterview.scheduled_at,
          durationMinutes: scheduleModalInterview.duration_minutes,
          notes: scheduleModalInterview.employer_notes || '',
        } : null}
      />
    </div>
  );
}
