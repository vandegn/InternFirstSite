import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { pageMetadata } from '@/lib/site';
import { organizationJsonLd, serializeJsonLd } from '@/lib/structured-data';
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
      {/* schema.org Organization. This is the entity Google and the AI answer
          engines attach the brand's name, logo and social profiles to — without
          it "InternFirst" is just a string on a page. Homepage only: one
          Organization node per site, on the page its @id points at. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationJsonLd()) }}
      />

      <Header />

      {/* HERO */}
      <section className="hero">
        <div className="container">
          <div className="hero-badge">#1 platform for early talent</div>
          {/* alt="" on purpose: the header logo already announces the brand to
              a screen reader, and the H1 directly below says the same thing in
              words. A third announcement here would be noise. Intrinsic
              width/height are set so the browser reserves the space before the
              image loads — this sits above the fold on the ad landing page,
              where a late layout shift is what CLS actually measures. */}
          <div className="hero-logo">
            <img src="/internfirst-logo.png" alt="" width={622} height={98} />
          </div>
          <h1>The easiest way to find an internship</h1>
          <p className="hero-subtitle">
            Browse opportunities from reviewed employers — no account needed. Sign in only when you&apos;re ready to apply.
          </p>
          <div className="cta-buttons" style={{ marginTop: 8, marginBottom: 40 }}>
            <Link href="/internships" className="btn-primary">Browse Internships</Link>
            <Link href="/register?role=student" className="btn-secondary">Create Account</Link>
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
              <Link href="/register?role=employer" data-analytics-cta="post_job" className="btn-secondary">Post an Internship</Link>
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
                <StepIcon>
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </StepIcon>
              </div>
              <h3>1. Browse openly</h3>
              <p>Explore live internships from reviewed employers — no signup required.</p>
            </div>
            <StepConnector />
            <div className="step">
              <div className="step-icon">
                <StepIcon>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </StepIcon>
              </div>
              <h3>2. Create your profile</h3>
              <p>Set up a verified .edu profile when you find a role worth applying for.</p>
            </div>
            <StepConnector />
            <div className="step">
              <div className="step-icon">
                <StepIcon>
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </StepIcon>
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

      {/* NEWSLETTER — see HomeNewsletter.tsx; this now actually records the
          address rather than swallowing it. */}
      <section className="newsletter">
        <div className="container">
          <div className="newsletter-inner">
            <h2>Get internship alerts</h2>
            <p className="newsletter-sub">
              New roles land every week. We&apos;ll email you when listings that fit go live —
              no spam, and nothing off-platform.
            </p>
            <HomeNewsletter />
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}

// The three "how it works" icons and the arrows between them used to be hot-
// linked from internfirst-demo.com, which now answers 503 — so the section
// rendered three empty circles and two gaps in production. Inline SVG instead:
// no third-party host to go dark, no extra requests, and it matches how the
// rest of the site draws icons.
function StepIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--primary)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function StepConnector() {
  return (
    <div className="step-connector" aria-hidden="true">
      <svg viewBox="0 0 80 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="1" y1="4" x2="73" y2="4" strokeDasharray="4 4" />
        <polyline points="70 1 74 4 70 7" />
      </svg>
    </div>
  );
}
