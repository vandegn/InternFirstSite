'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const FREE_RESOURCES = [
  {
    title: 'Resume Writing Guides',
    description: 'Learn how to craft a compelling resume that stands out to employers. Includes templates, formatting tips, and examples for various industries.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    buttonLabel: 'Read Guide',
    href: '/dashboard/student/resources/resume-guide',
    disabled: false,
  },
  {
    title: 'Interview Tips',
    description: 'Prepare for behavioral, technical, and case interviews with proven strategies. Covers common questions, body language, and follow-up etiquette.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    buttonLabel: 'Read Guide',
    href: '/dashboard/student/resources/interview-tips',
    disabled: false,
  },
  {
    title: 'Career Development Articles',
    description: 'Explore articles on networking, personal branding, salary negotiation, and career planning to help you navigate your professional journey.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    buttonLabel: 'Browse Articles',
    href: '/dashboard/student/resources/career-articles',
    disabled: false,
  },
  {
    title: 'Blogs & Educational Content',
    description: 'Read insights from industry professionals, hiring managers, and career coaches. Stay up to date with internship trends and workplace tips.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    buttonLabel: 'Coming Soon',
    href: '',
    disabled: true,
  },
];

const PREMIUM_SERVICES = [
  {
    title: '1:1 Resume Review',
    description: 'Get personalized feedback on your resume from an experienced career advisor. Receive actionable suggestions to improve clarity, impact, and formatting.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
  {
    title: '1:1 Career Coaching',
    description: 'Work one-on-one with a career coach to define your goals, build a strategy, and gain confidence for your internship search and beyond.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    title: '1:1 Interview Prep',
    description: 'Practice with a real interviewer in a mock session. Get feedback on your answers, delivery, and overall presentation before the real thing.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    ),
  },
];

export default function StudentResources() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="dash-main" style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
      <Link href="/dashboard/student" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '24px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        Back to Dashboard
      </Link>

      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Career Resources</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Tools, guides, and services to help you land the right internship.</p>

      {/* ── Free Resources ── */}
      <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ background: '#f0fdf4', color: '#166534', fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: '999px', border: '1px solid #bbf7d0' }}>Free</span>
        Resources
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {FREE_RESOURCES.map((resource) => (
          <div key={resource.title} className="profile-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {resource.icon}
            </div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>{resource.title}</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.55, margin: 0, flex: 1 }}>{resource.description}</p>
            {resource.disabled ? (
              <button
                disabled
                style={{
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text-secondary)',
                  cursor: 'default',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  alignSelf: 'flex-start',
                  opacity: 0.7,
                }}
              >
                {resource.buttonLabel}
              </button>
            ) : (
              <Link
                href={resource.href}
                className="btn-primary"
                style={{
                  padding: '10px 20px',
                  fontSize: '0.9rem',
                  textDecoration: 'none',
                  display: 'inline-block',
                  alignSelf: 'flex-start',
                }}
              >
                {resource.buttonLabel}
              </Link>
            )}
          </div>
        ))}

      </div>

      {/* ── Premium Services ── */}
      <div style={{ marginTop: '40px', padding: '32px', borderRadius: 'var(--radius)', background: 'linear-gradient(135deg, rgba(26, 45, 73, 0.04) 0%, rgba(26, 45, 73, 0.10) 100%)', border: '1px solid rgba(26, 45, 73, 0.15)' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ background: 'var(--primary)', color: '#fff', fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: '999px' }}>Premium</span>
          Services
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
          Upgrade your internship search with expert one-on-one support.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {PREMIUM_SERVICES.map((service) => (
            <div key={service.title} style={{
              padding: '24px',
              borderRadius: 'var(--radius)',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {service.icon}
              </div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>{service.title}</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.55, margin: 0, flex: 1 }}>{service.description}</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>Contact for pricing</p>
              <button
                disabled
                style={{
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--primary)',
                  background: 'transparent',
                  color: 'var(--primary)',
                  cursor: 'default',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  alignSelf: 'flex-start',
                  opacity: 0.7,
                }}
              >
                Learn More
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
