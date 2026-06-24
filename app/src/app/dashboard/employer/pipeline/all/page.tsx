'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  supabase,
  getEmployerByUserId,
  getEmployerApplications,
  getListingStages,
  updateApplicationStage,
  type PipelineStage,
} from '@/lib/supabase';

type Application = {
  id: string;
  status: string;
  stage_id: string | null;
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

function PipelineAllInner() {
  const params = useSearchParams();
  const listingId = params.get('listing') ?? '';
  const stageId = params.get('stage') ?? '';

  const [applications, setApplications] = useState<Application[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [listingTitle, setListingTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!listingId || !stageId) {
        setLoading(false);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const employer = await getEmployerByUserId(user.id);
      if (!employer) return;

      const [appsData, stageList] = await Promise.all([
        getEmployerApplications(employer.id),
        getListingStages(listingId),
      ]);

      const normalized = appsData.map((app: any) => ({
        ...app,
        listing: Array.isArray(app.listing) ? app.listing[0] : app.listing,
        resume: Array.isArray(app.resume) ? app.resume[0] || null : app.resume,
        student: (() => {
          const s = Array.isArray(app.student) ? app.student[0] : app.student;
          return s ? { ...s, profile: Array.isArray(s.profile) ? s.profile[0] : s.profile } : s;
        })(),
      })) as Application[];

      const inListing = normalized.filter(a => a.listing.id === listingId);
      if (inListing.length > 0) setListingTitle(inListing[0].listing.title);

      const inStage = inListing
        .filter(a => a.stage_id === stageId)
        .sort((a, b) => new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime());

      setApplications(inStage);
      setStages(stageList);
      setLoading(false);
    }
    load();
  }, [listingId, stageId]);

  const stage = stages.find(s => s.id === stageId);

  async function moveApplication(appId: string, newStageId: string) {
    if (!newStageId || newStageId === stageId) return;
    setApplications(prev => prev.filter(a => a.id !== appId));
    try {
      await updateApplicationStage(appId, newStageId);
    } catch {
      // soft fail; reload would recover
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
      <div className="dash-main" style={{ padding: 32, color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    );
  }

  if (!listingId || !stageId) {
    return (
      <div className="dash-main" style={{ padding: 32 }}>
        <p>Missing listing or stage in the URL.</p>
        <Link href="/dashboard/employer/pipeline" className="btn-secondary">Back to pipeline</Link>
      </div>
    );
  }

  return (
    <div className="dash-main" style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Link
            href="/dashboard/employer/pipeline"
            style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textDecoration: 'none' }}
          >
            ← Back to pipeline
          </Link>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: 6 }}>
            {stage?.label ?? 'Stage'} — {listingTitle}
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {applications.length} candidate{applications.length === 1 ? '' : 's'} · sorted by application time (oldest first)
          </p>
        </div>
      </div>

      {applications.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No candidates in this column.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {applications.map((app, idx) => {
            const isExpanded = expandedId === app.id;
            return (
              <div
                key={app.id}
                onClick={() => setExpandedId(isExpanded ? null : app.id)}
                style={{
                  background: '#fff',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 14,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-light)',
                    minWidth: 26, textAlign: 'right',
                  }}>
                    #{idx + 1}
                  </span>
                  <img
                    src={app.student.profile.avatar_url || 'https://internfirst-demo.com/wp-content/uploads/2026/02/Ellipse-1.png'}
                    alt={app.student.profile.full_name}
                    style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                      {app.student.profile.full_name}
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>
                      {app.student.major || 'No major'} · Applied {timeAgo(app.applied_at)}
                    </p>
                  </div>
                  <select
                    value={app.stage_id ?? ''}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => moveApplication(app.id, e.target.value)}
                    style={{
                      padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)',
                      fontSize: '0.82rem', background: '#fff',
                    }}
                  >
                    {stages.map(s => (
                      <option key={s.id} value={s.id}>Move to: {s.label}</option>
                    ))}
                  </select>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                    <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-light)' }}>Email: </span>
                      {app.student.profile.email}
                    </div>
                    {app.student.graduation_year && (
                      <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-light)' }}>Class of </span>
                        {app.student.graduation_year}
                      </div>
                    )}
                    {app.student.bio && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.5 }}>
                        {app.student.bio}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      {app.resume && (
                        <a
                          href={app.resume.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: '0.8rem', padding: '5px 12px', borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--primary)', color: 'var(--primary)',
                            textDecoration: 'none',
                          }}
                        >
                          View resume
                        </a>
                      )}
                      <Link
                        href="/dashboard/employer/inbox"
                        style={{
                          fontSize: '0.8rem', padding: '5px 12px', borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)', color: 'var(--text)',
                          textDecoration: 'none',
                        }}
                      >
                        Message
                      </Link>
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

export default function PipelineAllPage() {
  return (
    <Suspense fallback={<div className="dash-main" style={{ padding: 32 }}>Loading...</div>}>
      <PipelineAllInner />
    </Suspense>
  );
}
