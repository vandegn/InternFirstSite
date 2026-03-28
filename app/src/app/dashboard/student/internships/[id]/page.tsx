'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { supabase, getListingById, getStudentByUserId, applyToListingWithResume, getApplicationStatus, getEmployerUserIdByListingId, sendMessage, getStudentResumes } from '@/lib/supabase';
import ReactMarkdown from 'react-markdown';

type Listing = {
  id: string;
  title: string;
  description: string;
  location: string | null;
  is_remote: boolean;
  compensation: string | null;
  requirements: string | null;
  key_responsibilities: string | null;
  industry: string;
  created_at: string;
  employers: {
    company_name: string;
    logo_url: string | null;
    website: string | null;
  };
};

export default function InternshipDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [resumes, setResumes] = useState<{ id: string; name: string; file_url: string; uploaded_at: string }[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [messageSending, setMessageSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const [listingData, student] = await Promise.all([
        getListingById(id),
        getStudentByUserId(user.id),
      ]);

      if (listingData) setListing(listingData as Listing);
      if (student) {
        setStudentId(student.id);
        const [status, studentResumes] = await Promise.all([
          getApplicationStatus(student.id, id),
          getStudentResumes(student.id),
        ]);
        if (status) setApplicationStatus(status);
        setResumes(studentResumes);
        if (studentResumes.length > 0) setSelectedResumeId(studentResumes[0].id);
      }
      setLoading(false);
    }
    fetchData();
  }, [id]);

  async function handleMessageEmployer() {
    if (!currentUserId) return;
    setMessageSending(true);
    try {
      const employerUserId = await getEmployerUserIdByListingId(id);
      if (!employerUserId) throw new Error('Employer not found');
      // Send an intro message so the conversation appears in inbox
      await sendMessage(currentUserId, employerUserId, `Hi! I'm interested in the "${listing?.title}" position.`);
      router.push('/dashboard/student/inbox');
    } catch {
      setError('Failed to start conversation.');
      setMessageSending(false);
    }
  }

  async function handleApply() {
    if (!studentId) return;
    setApplying(true);
    setError(null);
    try {
      await applyToListingWithResume(studentId, id, selectedResumeId);
      setApplicationStatus('applied');
      setShowApplyForm(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to apply. Please try again.';
      setError(message);
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div className="dash-main" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="dash-main" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
        <p>Listing not found.</p>
        <Link href="/dashboard/student/internships">Back to Internships</Link>
      </div>
    );
  }

  const statusLabels: Record<string, string> = {
    applied: 'Applied',
    reviewed: 'Under Review',
    interviewing: 'Interviewing',
    offered: 'Offer Received',
    rejected: 'Not Selected',
  };

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
      <Link href="/dashboard/student/internships" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '24px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Internships
      </Link>

      <div className="profile-card" style={{ padding: '32px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          {listing.employers?.logo_url ? (
            <img src={listing.employers.logo_url} alt={listing.employers.company_name} style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary)', fontSize: '1.4rem' }}>
              {listing.employers?.company_name?.charAt(0) || '?'}
            </div>
          )}
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>{listing.title}</h2>
            <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0' }}>{listing.employers?.company_name}</p>
          </div>
        </div>

        {/* Meta info */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          {listing.location && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {listing.location}
            </div>
          )}
          {listing.is_remote && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              Remote
            </div>
          )}
          {listing.compensation && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              {listing.compensation}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            {listing.industry}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Posted {new Date(listing.created_at).toLocaleDateString()}
          </div>
        </div>

        <div className="sidebar-divider" style={{ margin: '24px 0' }}></div>

        {/* Qualifications */}
        {listing.requirements && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '12px' }}>Qualifications</h3>
            <div className="markdown-content"><ReactMarkdown>{listing.requirements}</ReactMarkdown></div>
          </div>
        )}

        {/* Job Overview */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '12px' }}>Job Overview</h3>
          <div className="markdown-content"><ReactMarkdown>{listing.description}</ReactMarkdown></div>
        </div>

        {/* Key Responsibilities */}
        {listing.key_responsibilities && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '12px' }}>Key Responsibilities</h3>
            <div className="markdown-content"><ReactMarkdown>{listing.key_responsibilities || ''}</ReactMarkdown></div>
          </div>
        )}

        {/* Employer website */}
        {listing.employers?.website && (
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '12px' }}>Company Website</h3>
            <a href={listing.employers.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
              {listing.employers.website}
            </a>
          </div>
        )}

        <div className="sidebar-divider" style={{ margin: '24px 0' }}></div>

        {/* Apply & Message section */}
        {applicationStatus ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', background: 'var(--bg-secondary, #f5f5f5)', borderRadius: '10px', flex: 1 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <span style={{ fontWeight: 600 }}>Status: {statusLabels[applicationStatus] || applicationStatus}</span>
            </div>
            <button
              onClick={handleMessageEmployer}
              disabled={messageSending}
              style={{ padding: '12px 24px', fontSize: '0.9rem', borderRadius: '10px', border: '1.5px solid var(--primary)', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Message Employer
            </button>
          </div>
        ) : (
          <div>
            {error && (
              <p style={{ color: '#e53e3e', fontSize: '0.9rem', marginBottom: '12px' }}>{error}</p>
            )}
            {!showApplyForm ? (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button
                  className="btn-primary"
                  onClick={() => setShowApplyForm(true)}
                  style={{ padding: '12px 32px', fontSize: '1rem' }}
                >
                  Apply Now
                </button>
                <button
                  onClick={handleMessageEmployer}
                  disabled={messageSending}
                  style={{ padding: '12px 24px', fontSize: '0.9rem', borderRadius: '10px', border: '1.5px solid var(--primary)', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  Message Employer
                </button>
              </div>
            ) : (
              <div style={{ background: 'var(--bg-secondary, #f9fafb)', borderRadius: 'var(--radius, 12px)', padding: '20px', border: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>Submit Application</h4>

                {resumes.length > 0 ? (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '8px' }}>Select a Resume</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {resumes.map((r) => (
                        <label
                          key={r.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                            borderRadius: 'var(--radius-sm, 8px)',
                            border: selectedResumeId === r.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                            background: selectedResumeId === r.id ? 'var(--primary-light, #e8ecf1)' : 'var(--bg)',
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                        >
                          <input
                            type="radio"
                            name="resume"
                            value={r.id}
                            checked={selectedResumeId === r.id}
                            onChange={() => setSelectedResumeId(r.id)}
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{r.name}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                              Uploaded {new Date(r.uploaded_at).toLocaleDateString()}
                            </span>
                          </div>
                          <a href={r.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>View</a>
                        </label>
                      ))}
                      <label
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                          borderRadius: 'var(--radius-sm, 8px)',
                          border: selectedResumeId === null ? '2px solid var(--primary)' : '1px solid var(--border)',
                          background: selectedResumeId === null ? 'var(--primary-light, #e8ecf1)' : 'var(--bg)',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        <input
                          type="radio"
                          name="resume"
                          checked={selectedResumeId === null}
                          onChange={() => setSelectedResumeId(null)}
                          style={{ accentColor: 'var(--primary)' }}
                        />
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Apply without a resume</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    No resumes uploaded yet. You can <a href="/dashboard/student/settings" style={{ color: 'var(--primary)' }}>upload one in Settings</a> or apply without one.
                  </p>
                )}

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button
                    className="btn-primary"
                    onClick={handleApply}
                    disabled={applying}
                    style={{ padding: '10px 28px', fontSize: '0.95rem' }}
                  >
                    {applying ? 'Submitting...' : 'Submit Application'}
                  </button>
                  <button
                    onClick={() => setShowApplyForm(false)}
                    style={{ padding: '10px 20px', fontSize: '0.9rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
