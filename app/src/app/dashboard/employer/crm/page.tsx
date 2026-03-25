'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase, getEmployerByUserId, getEmployerApplications, getEmployerListings, updateApplicationStatus } from '@/lib/supabase';

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

const COLUMNS = [
  { key: 'applied', label: 'New', color: '#e0e7ff', textColor: '#3730a3' },
  { key: 'reviewed', label: 'Under Review', color: '#fef3c7', textColor: '#92400e' },
  { key: 'interviewing', label: 'Interviewing', color: '#dbeafe', textColor: '#1e40af' },
  { key: 'offered', label: 'Offered', color: '#d1fae5', textColor: '#065f46' },
  { key: 'rejected', label: 'Not Selected', color: '#fee2e2', textColor: '#991b1b' },
];

export default function EmployerCRMPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [listings, setListings] = useState<{ id: string; title: string }[]>([]);
  const [filterListing, setFilterListing] = useState('');
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const employer = await getEmployerByUserId(user.id);
      if (!employer) return;

      const [appsData, listingsData] = await Promise.all([
        getEmployerApplications(employer.id),
        getEmployerListings(employer.id, 1, 100),
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

      setApplications(normalizedApps as Application[]);
      setListings(listingsData.data.map((l: any) => ({ id: l.id, title: l.title })));
      setLoading(false);
    }
    fetchData();
  }, []);

  const filteredApps = filterListing
    ? applications.filter(a => a.listing.id === filterListing)
    : applications;

  const handleDragStart = useCallback((e: React.DragEvent, appId: string) => {
    setDraggingId(appId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', appId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const appId = e.dataTransfer.getData('text/plain');
    if (!appId) return;

    const app = applications.find(a => a.id === appId);
    if (!app || app.status === newStatus) {
      setDraggingId(null);
      return;
    }

    // Optimistic update
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));
    setDraggingId(null);

    try {
      await updateApplicationStatus(appId, newStatus);
    } catch {
      // Revert on failure
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: app.status } : a));
    }
  }, [applications]);

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
    <div className="dash-main" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Candidate Pipeline</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {filteredApps.length} candidate{filteredApps.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            value={filterListing}
            onChange={(e) => setFilterListing(e.target.value)}
            style={{
              padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
              fontSize: '0.85rem', background: '#fff', minWidth: '200px',
            }}
          >
            <option value="">All Listings</option>
            {listings.map(l => (
              <option key={l.id} value={l.id}>{l.title}</option>
            ))}
          </select>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
            Drag and drop candidates between columns to update status
          </span>
        </div>
      </div>

      {/* Kanban Board */}
      <div style={{
        flex: 1,
        display: 'flex',
        gap: '12px',
        padding: '16px 24px',
        overflowX: 'auto',
        overflowY: 'hidden',
      }}>
        {COLUMNS.map(col => {
          const colApps = filteredApps.filter(a => a.status === col.key);
          return (
            <div
              key={col.key}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.key)}
              style={{
                flex: '1 1 0',
                minWidth: '240px',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--bg)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                overflow: 'hidden',
              }}
            >
              {/* Column header */}
              <div style={{
                padding: '12px 16px',
                borderBottom: '2px solid ' + col.color,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#fff',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', background: col.textColor,
                  }} />
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{col.label}</span>
                </div>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: '10px',
                  background: col.color, color: col.textColor,
                }}>
                  {colApps.length}
                </span>
              </div>

              {/* Cards */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                {colApps.length === 0 && (
                  <div style={{
                    padding: '24px 12px', textAlign: 'center', color: 'var(--text-light)',
                    fontSize: '0.8rem', border: '2px dashed var(--border)', borderRadius: 'var(--radius-sm)',
                    margin: '4px',
                  }}>
                    Drop here
                  </div>
                )}
                {colApps.map(app => {
                  const isExpanded = expandedId === app.id;
                  return (
                    <div
                      key={app.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, app.id)}
                      onClick={() => setExpandedId(isExpanded ? null : app.id)}
                      style={{
                        background: '#fff',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        padding: '12px',
                        cursor: 'grab',
                        opacity: draggingId === app.id ? 0.5 : 1,
                        transition: 'box-shadow 0.15s, opacity 0.15s',
                        boxShadow: draggingId === app.id ? '0 4px 12px rgba(0,0,0,0.15)' : 'var(--shadow)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <img
                          src={app.student.profile.avatar_url || 'https://internfirst-demo.com/wp-content/uploads/2026/02/Ellipse-1.png'}
                          alt={app.student.profile.full_name}
                          style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 600, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {app.student.profile.full_name}
                          </p>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>
                            {app.student.major || 'No major'}
                          </p>
                        </div>
                      </div>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        {app.listing.title}
                      </p>
                      <p style={{ fontSize: '0.68rem', color: 'var(--text-light)' }}>
                        Applied {timeAgo(app.applied_at)}
                      </p>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                          <div style={{ fontSize: '0.78rem', marginBottom: '6px' }}>
                            <span style={{ color: 'var(--text-light)' }}>Email: </span>
                            <span>{app.student.profile.email}</span>
                          </div>
                          {app.student.graduation_year && (
                            <div style={{ fontSize: '0.78rem', marginBottom: '6px' }}>
                              <span style={{ color: 'var(--text-light)' }}>Class of </span>
                              <span>{app.student.graduation_year}</span>
                            </div>
                          )}
                          {app.student.bio && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4 }}>
                              {app.student.bio}
                            </p>
                          )}
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {app.resume && (
                              <a
                                href={app.resume.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontSize: '0.72rem', padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--primary)', color: 'var(--primary)',
                                  textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px',
                                }}
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                                Resume
                              </a>
                            )}
                            <Link
                              href="/dashboard/employer/inbox"
                              style={{
                                fontSize: '0.72rem', padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border)', color: 'var(--text)',
                                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px',
                              }}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                              Message
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
