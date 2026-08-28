import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { pageMetadata } from '@/lib/site';

// This page used to render a full mock student dashboard to the public: a fake
// sidebar linking into /dashboard/*, a demo avatar, and a profile card for
// "Ben Smith / bensmith@isu.edu / Open to work". None of it was real, all of it
// was crawlable, and the sitemap was asking Google to index it. What's left is
// the only honest part — a description of the resources themselves.
//
// It was noindex'd while those cards linked nowhere. They now point at
// /register and the services they describe exist behind it (see
// /dashboard/student/resources), so the page is indexable and back in the
// sitemap. Note the hero deliberately says "free to start", not "free": the
// three 1:1 services are listed in-product as "Contact for pricing".

export const metadata: Metadata = pageMetadata({
  title: 'Career Resources',
  description:
    'Resume advice, interview preparation, and career coaching for students searching for an internship — free to start with an InternFirst account.',
  path: '/career-resources',
});

const RESOURCES = [
  {
    title: 'Resume Advice',
    body:
      'Expert resume advice to help you craft a compelling resume that highlights your strengths and catches the eye of top employers.',
    icon: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </>
    ),
  },
  {
    title: 'Live Interview Prep',
    body:
      'Practice with real interview scenarios, receive instant feedback, and build the confidence you need to ace your next interview.',
    icon: (
      <>
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </>
    ),
  },
  {
    title: 'Career Coaching',
    body:
      'One-on-one sessions with experienced career coaches who will guide your professional journey and help you reach your goals.',
    icon: (
      <>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
  },
  {
    title: 'Resume Building',
    body:
      'Build a professional resume using our guided templates and tools designed specifically for students and early-career professionals.',
    icon: (
      <>
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </>
    ),
  },
];

export default function CareerResources() {
  return (
    <>
      <Header />

      <section className="hero" style={{ padding: '64px 0 32px' }}>
        <div className="container">
          <div className="hero-badge">Career Resources</div>
          <h1>Tools and guidance for your internship search</h1>
          <p className="hero-subtitle">
            Everything students need to go from a first draft resume to a signed offer. Free to
            start with an InternFirst account, with 1:1 resume review, interview prep, and career
            coaching available.
          </p>
        </div>
      </section>

      <section style={{ padding: '20px 0 80px', background: 'var(--bg)' }}>
        <div className="container">
          <div className="resource-grid two-col">
            {RESOURCES.map((r) => (
              <div key={r.title} className="resource-card large">
                <div className="resource-icon">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {r.icon}
                  </svg>
                </div>
                <h4>{r.title}</h4>
                <p>{r.body}</p>
                <Link href="/register" className="resource-link">
                  Get Started &rarr;
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
