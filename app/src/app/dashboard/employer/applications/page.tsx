'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  supabase,
  getEmployerByUserId,
  getEmployerApplications,
  getListingStages,
  updateApplicationStage,
  type PipelineStage,
} from '@/lib/supabase';

type ApplicationAnswer = {
  id: string;
  answer_text: string | null;
  answer_options: string[];
  file_url: string | null;
  question: {
    id: string;
    prompt: string;
    question_type: string;
    position: number;
  } | null;
};

// Shape as PostgREST returns it — nested joins arrive as arrays.
type RawAnswer = Omit<ApplicationAnswer, 'question'> & {
  question: ApplicationAnswer['question'] | ApplicationAnswer['question'][];
};

type Application = {
  id: string;
  status: string;
  stage_id: string | null;
  match_score: number | null;
  flagged_knockout: boolean;
  applied_at: string;
  updated_at: string;
  resume_id: string | null;
  resume: {
    id: string;
    name: string;
    file_url: string;
  } | null;
  answers: ApplicationAnswer[];
  listing: {
    id: string;
    title: string;
    employer_id: string;
  };
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
    profile: {
      full_name: string;
      email: string;
      avatar_url: string | null;
    };
  };
};

const FALLBACK_PILL = { bg: '#e0e7ff', color: '#3730a3', label: 'Applied' };

// Match score badge colors: strong (>=70, the PPA-qualifying threshold), fair, weak.
function matchPill(score: number) {
  if (score >= 70) return { bg: '#dcfce7', color: '#166534' };
  if (score >= 40) return { bg: '#fef3c7', color: '#92400e' };
  return { bg: '#f3f4f6', color: '#4b5563' };
}

export default function EmployerApplications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [stagesByListing, setStagesByListing] = useState<Record<string, PipelineStage[]>>({});
  const [loading, setLoading] = useState(true);
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
        resume: Array.isArray(app.resume) ? app.resume[0] || null : app.resume,
        stage: Array.isArray(app.stage) ? app.stage[0] || null : (app.stage ?? null),
        answers: ((app.answers ?? []) as RawAnswer[])
          .map((a) => ({ ...a, question: Array.isArray(a.question) ? a.question[0] || null : a.question }))
          // Show answers in the order the employer wrote the questions.
          .sort((a, b) => (a.question?.position ?? 0) - (b.question?.position ?? 0)),
        student: (() => {
          const s = Array.isArray(app.student) ? app.student[0] : app.student;
          return s ? { ...s, profile: Array.isArray(s.profile) ? s.profile[0] : s.profile } : s;
        })(),
      })) as Application[];
      setApplications(normalized);

      // Pull stages for every unique listing in one batch.
      const listingIds = Array.from(new Set(normalized.map(a => a.listing.id)));
      const stageLists = await Promise.all(listingIds.map(id => getListingStages(id)));
      const stageMap: Record<string, PipelineStage[]> = {};
      listingIds.forEach((id, i) => { stageMap[id] = stageLists[i]; });
      setStagesByListing(stageMap);

      setLoading(false);
    }
    fetchData();
  }, []);

  async function handleStageChange(applicationId: string, newStageId: string) {
    setUpdating(applicationId);
    try {
      await updateApplicationStage(applicationId, newStageId);
      const app = applications.find(a => a.id === applicationId);
      const newStage = app
        ? stagesByListing[app.listing.id]?.find(s => s.id === newStageId)
        : undefined;
      setApplications(prev => prev.map(a =>
        a.id === applicationId
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
    } catch {
      // silently fail
    } finally {
      setUpdating(null);
    }
  }

  // Get unique listing titles for the filter
  const listingTitles = Array.from(new Set(applications.map(a => a.listing.title)));

  const filtered = applications.filter(app => {
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
            const pillBg = app.stage?.color_bg ?? FALLBACK_PILL.bg;
            const pillColor = app.stage?.color_text ?? FALLBACK_PILL.color;
            const pillLabel = app.stage?.label ?? app.status ?? FALLBACK_PILL.label;
            const listingStages = stagesByListing[app.listing.id] ?? [];
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
                        background: pillBg,
                        color: pillColor,
                      }}>
                        {pillLabel}
                      </span>
                      {app.match_score != null && (
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          padding: '2px 10px',
                          borderRadius: '10px',
                          background: matchPill(app.match_score).bg,
                          color: matchPill(app.match_score).color,
                        }}>
                          {app.match_score}% match
                        </span>
                      )}
                      {app.flagged_knockout && (
                        <span
                          title="A screening answer matched a disqualifying response"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '2px 10px',
                            borderRadius: '10px',
                            background: '#fee2e2',
                            color: '#b91c1c',
                          }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                          Screening flag
                        </span>
                      )}
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
                    {app.resume && (
                      <div style={{ marginBottom: '16px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 600 }}>Resume</span>
                        <div style={{ marginTop: '4px' }}>
                          <a
                            href={app.resume.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '6px',
                              padding: '6px 14px', borderRadius: 'var(--radius-sm, 8px)',
                              border: '1px solid var(--primary)', color: 'var(--primary)',
                              fontSize: '0.85rem', fontWeight: 500, textDecoration: 'none',
                              transition: 'all 0.15s',
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            {app.resume.name}
                          </a>
                        </div>
                      </div>
                    )}
                    {app.answers.length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 600 }}>Screening Answers</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                          {app.answers.map((answer) => (
                            <div key={answer.id}>
                              <p style={{ fontSize: '0.82rem', fontWeight: 500, margin: 0 }}>
                                {answer.question?.prompt ?? 'Question removed'}
                              </p>
                              {answer.file_url ? (
                                <a
                                  href={answer.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ fontSize: '0.85rem', color: 'var(--primary)' }}
                                >
                                  {answer.answer_text || 'View file'}
                                </a>
                              ) : (
                                <p style={{ fontSize: '0.88rem', margin: '2px 0 0', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                  {answer.answer_options.length > 0
                                    ? answer.answer_options.join(', ')
                                    : answer.answer_text || '—'}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Move to:</span>
                      <select
                        value={app.stage_id ?? ''}
                        onChange={(e) => handleStageChange(app.id, e.target.value)}
                        disabled={updating === app.id || listingStages.length === 0}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                          fontSize: '0.85rem',
                          background: 'var(--bg)',
                          cursor: updating === app.id ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {listingStages.map(s => (
                          <option key={s.id} value={s.id}>{s.label}</option>
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
