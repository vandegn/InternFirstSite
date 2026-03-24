'use client';

import Link from 'next/link';

const portals = [
  {
    role: 'student',
    title: 'Student',
    subtitle: 'Find your dream internship',
    description: 'Browse thousands of opportunities, apply with one click, and launch your career.',
    gradient: 'linear-gradient(135deg, #1A2D49 0%, #0f1d33 100%)',
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" />
      </svg>
    ),
  },
  {
    role: 'employer',
    title: 'Employer',
    subtitle: 'Hire top emerging talent',
    description: 'Post internships, review applicants, and connect with the brightest students.',
    gradient: 'linear-gradient(135deg, #1a1a4e 0%, #2d2d7c 100%)',
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        <line x1="12" y1="12" x2="12" y2="12.01" />
      </svg>
    ),
  },
  {
    role: 'university_admin',
    title: 'University',
    subtitle: 'Track student placements',
    description: 'Monitor outcomes, manage partnerships, and support your students\u2019 success.',
    gradient: 'linear-gradient(135deg, #0d7c66 0%, #15a88a 100%)',
    icon: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18" />
        <path d="M5 21V7l7-4 7 4v14" />
        <path d="M9 21v-6h6v6" />
        <path d="M9 10h1" />
        <path d="M14 10h1" />
      </svg>
    ),
  },
];

export default function LandingPage() {
  return (
    <div className="landing-page">
      <div className="landing-header">
        <img
          src="https://internfirst-demo.com/wp-content/uploads/2026/02/Top-Rated-2.png"
          alt="InternFirst"
          className="landing-logo"
        />
      </div>

      <div className="landing-content">
        <h1 className="landing-title">Welcome to InternFirst</h1>
        <p className="landing-subtitle">
          Choose your portal to get started
        </p>

        <div className="portal-grid">
          {portals.map((portal) => (
            <Link
              key={portal.role}
              href={`/login?role=${portal.role}`}
              className="portal-card"
              style={{ background: portal.gradient }}
            >
              <div className="portal-icon">{portal.icon}</div>
              <h2 className="portal-title">{portal.title}</h2>
              <p className="portal-subtitle">{portal.subtitle}</p>
              <p className="portal-description">{portal.description}</p>
              <span className="portal-cta">
                Enter Portal
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </div>

      <p className="landing-footer-text">
        &copy; {new Date().getFullYear()} InternFirst. All rights reserved.
      </p>
    </div>
  );
}
