'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { supabase, getProfile, DASHBOARD_ROUTES } from '@/lib/supabase';

const faqData = [
  {
    question: 'Do I need an account to browse internships?',
    answer:
      'No. Anyone can browse open internships on InternFirst without signing up. You only need to create an account when you want to apply, message an employer, or save listings to your profile.',
  },
  {
    question: 'Who can apply on InternFirst?',
    answer:
      'Students with a valid .edu email address can register and apply. We verify every student account to keep the platform high-signal for employers and universities.',
  },
  {
    question: 'How long does the application process take?',
    answer:
      'Most students complete their first application in under five minutes once their profile is set up. Employers respond inside the platform — no external emails, no off-platform redirects.',
  },
  {
    question: 'Is InternFirst free for students?',
    answer:
      'Yes. Students apply, message, schedule interviews, and track outcomes for free. Employers and universities subscribe for posting, ATS, CRM, and analytics features.',
  },
  {
    question: 'How do I get a receipt or manage billing?',
    answer:
      'Receipts are automatically emailed to the billing contact after every successful payment. You can also download past invoices anytime from the Billing section in your account settings.',
  },
];

const categories = [
  { name: 'Creative Design', count: 68 },
  { name: 'Software Development', count: 120 },
  { name: 'Marketing', count: 200 },
  { name: 'Video & Media', count: 124 },
  { name: 'Data & Analytics', count: 26 },
  { name: 'Customer Success', count: 100 },
  { name: 'Finance & Accounting', count: 68 },
  { name: 'Operations', count: 42 },
];

const featuredJobs = [
  { title: 'Product Designer', location: 'Syracuse, CT', img: 'https://internfirst-demo.com/wp-content/uploads/2026/02/9-1024x1024.png' },
  { title: 'Medical Assistant', location: 'Kent, UT', img: 'https://internfirst-demo.com/wp-content/uploads/2026/02/6-1024x1024.png' },
  { title: 'Marketing Coordinator', location: 'Lansing, IL', img: 'https://internfirst-demo.com/wp-content/uploads/2026/02/5-1024x1024.png' },
  { title: 'Web Designer', location: 'Lafayette, CA', img: 'https://internfirst-demo.com/wp-content/uploads/2026/02/8-1024x1024.png' },
];

export default function LandingPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [email, setEmail] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function redirectIfLoggedIn() {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session?.user) {
        setAuthChecked(true);
        return;
      }
      const profile = await getProfile(session.user.id);
      if (cancelled) return;
      const route = profile ? DASHBOARD_ROUTES[profile.role] : null;
      if (route) {
        router.replace(route);
        // keep loader visible while the route transition happens
      } else {
        setAuthChecked(true);
      }
    }
    redirectIfLoggedIn();
    return () => { cancelled = true; };
  }, [router]);

  if (!authChecked) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: '#888' }}>
        Loading...
      </div>
    );
  }

  return (
    <>
      <Header />

      {/* HERO */}
      <section className="hero">
        <div className="container">
          <div className="hero-badge">#1 platform for early talent</div>
          <h1>The easiest way to find an internship</h1>
          <p className="hero-subtitle">
            Browse opportunities from verified employers — no account needed. Sign in only when you&apos;re ready to apply.
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

      {/* PARTNERS */}
      <section className="partners">
        <div className="container">
          <div className="partners-track">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <img
                key={n}
                src={`https://internfirst-demo.com/wp-content/uploads/2026/02/${n}-150x150.png`}
                alt={`Partner ${n}`}
              />
            ))}
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
            {categories.map((c) => (
              <Link key={c.name} href="/internships" className="category-card">
                <div className="category-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
                <h3>{c.name}</h3>
                <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 500 }}>
                  {c.count} open roles
                </span>
              </Link>
            ))}
          </div>
          <div className="section-cta">
            <Link href="/internships" className="btn-outline">See all internships</Link>
          </div>
        </div>
      </section>

      {/* FEATURED INTERNSHIPS */}
      <section className="internships">
        <div className="container">
          <h2 className="section-title">Featured opportunities</h2>
          <p className="section-subtitle">
            A preview of what&apos;s live on the platform right now.
          </p>
          <div className="internship-grid">
            {featuredJobs.map((job) => (
              <article key={job.title} className="internship-card">
                <div className="internship-img">
                  <img src={job.img} alt={job.title} />
                </div>
                <div className="internship-body">
                  <h3>{job.title}</h3>
                  <p className="location">{job.location}</p>
                  <div className="internship-meta">
                    <span className="badge-type">Full time</span>
                    <span className="badge-salary">$1,500 / mo</span>
                  </div>
                  <div className="tags">
                    <span>Figma</span>
                    <span>Remote OK</span>
                  </div>
                  <Link href="/internships" className="btn-apply">View role</Link>
                </div>
              </article>
            ))}
          </div>
          <div className="section-cta">
            <Link href="/internships" className="btn-outline">Browse all internships</Link>
          </div>
        </div>
      </section>

      {/* VALUE PROP / CTA */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2>Find the one that&apos;s right for you</h2>
            <p>Verified employers. Verified students. Everything happens on the platform — from first browse to first day.</p>
            <ul className="cta-features">
              <li>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="10" fill="#9FC63C" />
                  <path d="M6 10l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Browse freely — no account required
              </li>
              <li>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="10" fill="#9FC63C" />
                  <path d="M6 10l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Apply in-platform with one click
              </li>
              <li>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="10" fill="#9FC63C" />
                  <path d="M6 10l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
              <p>Explore live internships from verified employers — no signup required.</p>
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
          <div className="faq-list">
            {faqData.map((faq, index) => (
              <div key={index} className={`faq-item${activeFaq === index ? ' active' : ''}`}>
                <button
                  className="faq-question"
                  onClick={() => setActiveFaq(activeFaq === index ? null : index)}
                >
                  <span>{faq.question}</span>
                  <svg
                    className="faq-icon"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
                <div className="faq-answer">
                  <p>{faq.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NEWSLETTER, currently doesn't do anything, come here for newsletter stuff in future*/}
      <section className="newsletter">
        <div className="container">
          <div className="newsletter-inner">
            <h2>Get launch updates</h2>
            <form className="newsletter-form" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder="you@school.edu"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button type="submit">Subscribe</button>
            </form>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
