import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { absoluteUrl, pageMetadata } from '@/lib/site';
import { faqPageJsonLd } from '@/lib/content-articles';
import { serializeJsonLd } from '@/lib/structured-data';
import { HOME_FAQ } from '../home-faq-data';
import HomeFaq from '../HomeFaq';

// The FAQ used to live on the homepage and was dropped when the "Every
// Campus" design shipped — which also dropped the most quotable text on the
// site for AI answer engines. It now has a page of its own with FAQPage
// structured data. The accordion is a client component but the questions and
// answers are server-rendered into the HTML either way.

export const metadata: Metadata = pageMetadata({
  title: 'Frequently Asked Questions',
  description:
    'Who can use InternFirst, what it costs students and employers, how employers are reviewed, and where the platform operates. Direct answers to the questions we hear most.',
  path: '/faq',
});

export default function FaqPage() {
  const json = faqPageJsonLd(HOME_FAQ, absoluteUrl('/faq'));
  return (
    <>
      {json && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(json) }} />}
      <Header />
      <main id="main-content">
        <section className="hero" style={{ padding: '64px 0 32px' }}>
          <div className="container">
            <div className="hero-badge">FAQ</div>
            <h1>Frequently asked questions</h1>
            <p className="hero-subtitle">
              The short version of how InternFirst works for students and employers.
            </p>
          </div>
        </section>
        <section style={{ padding: '20px 0 80px', background: 'var(--bg)' }}>
          <div className="container" style={{ maxWidth: 820 }}>
            <HomeFaq />
            <p style={{ marginTop: 32, color: 'var(--text-secondary)' }}>
              Something else? <Link href="/contact">Contact the team</Link> or{' '}
              <Link href="/blog">read the guides</Link>.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
