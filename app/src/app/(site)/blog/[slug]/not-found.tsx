import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function GuideNotFound() {
  return (
    <>
      <Header />
      <main id="main-content" className="guide-page">
        <div className="guide-article" style={{ textAlign: 'center' }}>
          <h1>That guide isn&apos;t here</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '12px 0 24px' }}>
            It may have been unpublished or the link may be wrong.
          </p>
          <Link href="/blog" className="btn-primary">See all guides</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
