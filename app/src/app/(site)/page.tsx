import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { pageMetadata } from '@/lib/site';
import HomeFaq from './HomeFaq';
import HomeNewsletter from './HomeNewsletter';

// This was a client component that rendered nothing but "Loading..." until a
// Supabase session check resolved. Crawlers got no session and, in Ahrefs'
// case, never waited for the second render — so the homepage's HTML contained
// one word and no links. Being a client component also meant '/' could not
// export metadata at all, which is why its title was the bare root fallback.
//
// It's now a static server component. The "send logged-in users to their
// dashboard" behaviour that useEffect was doing moved into middleware.ts, where
// it happens as a 302 before any HTML is sent — same UX, no flash, and
// anonymous visitors (and crawlers) skip the auth call entirely.

export const metadata: Metadata = pageMetadata({
  absoluteTitle: 'InternFirst | Find Internships for College Students',
  description:
    'Browse open internships from reviewed employers — no account needed to look. Students with a .edu email apply, message, and interview entirely on InternFirst.',
  path: '/',
});

// Categories are navigation into the real search, not a claim about inventory —
// the "N open roles" counts that used to sit here were invented.
const categories = [
  'Creative Design',
  'Software Development',
  'Marketing',
  'Video & Media',
  'Data & Analytics',
  'Customer Success',
  'Finance & Accounting',
  'Operations',
];

export default function LandingPage() {
  return (
    <>
      <Header />

      {/* HERO */}
      <section className="hero">
        <div className="container">
          <div className="hero-badge">#1 platform for early talent</div>
          <h1>The easiest way to find an internship</h1>
          <p className="hero-subtitle">
            Browse opportunities from reviewed employers — no account needed. Sign in only when you&apos;re ready to apply.
          </p>
          <div className="cta-buttons" style={{ marginTop: 8, marginBottom: 40 }}>
            <Link href="/internships" className="btn-primary">Browse Internships</Link>
            <Link href="/register" className="btn-secondary">Create Account</Link>
          </div>
          <div className="hero-image">
            <img
              src="https://internfirst-demo.com/wp-content/uploads/2026/01/Frame-1321314341.png"
              alt="InternFirst platform preview"
            />
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="categories">
        <div className="container">
          <h2 className="section-title">Browse internships by category</h2>
          <p className="section-subtitle">
            Start your search by selecting the category that best fits your professional goals.
          </p>
          <div className="category-grid">
            {categories.map((name) => (
              <Link key={name} href="/internships" className="category-card">
                <div className="category-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
                <h3>{name}</h3>
              </Link>
            ))}
          </div>
          <div className="section-cta">
            <Link href="/internships" className="btn-outline">See all internships</Link>
          </div>
        </div>
      </section>

      {/* VALUE PROP / CTA */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2>Find the one that&apos;s right for you</h2>
            <p>Reviewed employers. Verified students. Everything happens on the platform — from first browse to first day.</p>
            <ul className="cta-features">
              <li>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="10" fill="#9FC63C" />
                  <path d="M6 10l3 3 5-5" stroke="var(--on-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Browse freely — no account required
              </li>
              <li>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="10" fill="#9FC63C" />
                  <path d="M6 10l3 3 5-5" stroke="var(--on-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Apply in-platform with one click
              </li>
              <li>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="10" fill="#9FC63C" />
                  <path d="M6 10l3 3 5-5" stroke="var(--on-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Verified .edu network and real employers
              </li>
            </ul>
            <div className="cta-buttons">
              <Link href="/internships" className="btn-primary">Browse Internships</Link>
              <Link href="/register" className="btn-secondary">Post an Internship</Link>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="how-it-works">
        <div className="container">
          <h2 className="section-title">How it works</h2>
          <div className="steps">
            <div className="step">
              <div className="step-icon">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Group.png" alt="Browse" />
              </div>
              <h3>1. Browse openly</h3>
              <p>Explore live internships from reviewed employers — no signup required.</p>
            </div>
            <div className="step-connector">
              <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Vector-30.png" alt="" />
            </div>
            <div className="step">
              <div className="step-icon">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Group-1.png" alt="Create" />
              </div>
              <h3>2. Create your profile</h3>
              <p>Set up a verified .edu profile when you find a role worth applying for.</p>
            </div>
            <div className="step-connector">
              <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Vector-30.png" alt="" />
            </div>
            <div className="step">
              <div className="step-icon">
                <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Group-2.png" alt="Apply" />
              </div>
              <h3>3. Apply in one click</h3>
              <p>Apply, message, and interview — all inside InternFirst.</p>
            </div>
          </div>
        </div>
      </section>

      {/* MATCHED CTA */}
      <section className="matched-section">
        <div className="container">
          <div className="matched-inner">
            <span className="matched-badge">#1 INTERNSHIP PLATFORM</span>
            <h2>Get matched in a few minutes</h2>
            <p>Tell us what you want — we&apos;ll line up roles that fit.</p>
            <Link href="/register" className="btn-white">Get started</Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq-section">
        <div className="container">
          <h2 className="section-title">Frequently asked questions</h2>
          <HomeFaq />
        </div>
      </section>

      {/* NEWSLETTER, currently doesn't do anything, come here for newsletter stuff in future*/}
      <section className="newsletter">
        <div className="container">
          <div className="newsletter-inner">
            <h2>Get launch updates</h2>
            <HomeNewsletter />
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
