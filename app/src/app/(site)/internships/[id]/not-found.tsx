import type { Metadata } from 'next';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

// Reached via notFound() in page.tsx when a listing is missing, closed, or past
// its deadline. The same message used to render with a 200, which is a soft 404
// — Google indexes those and then reports them as errors. This returns a real
// 404. No `robots` here on purpose — Next already emits noindex for a
// not-found render, and setting it again produced two <meta name="robots"> tags.
export const metadata: Metadata = {
  title: 'Internship not found',
};

export default function ListingNotFound() {
  return (
    <>
      <Header />
      <div style={{ padding: '120px 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, marginBottom: 12 }}>Internship not found</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
          This role may have been closed or removed.
        </p>
        <Link href="/internships" className="btn-primary">
          Browse all internships
        </Link>
      </div>
      <Footer />
    </>
  );
}
