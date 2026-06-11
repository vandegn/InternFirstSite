'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TestPostingBadge from '@/components/TestPostingBadge';
import { supabase, getListingById, getProfile } from '@/lib/supabase';

type Listing = {
  id: string;
  title: string;
  description: string;
  location: string | null;
  is_remote: boolean;
  is_hybrid: boolean;
  compensation: string | null;
  requirements: string | null;
  industry: string;
  created_at: string;
  application_deadline: string | null;
  key_responsibilities: string | null;
  duration: string | null;
  employers: {
    company_name: string;
    logo_url: string | null;
    website?: string | null;
  };
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function PublicListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      const data = await getListingById(id!);
      if (!cancelled) {
        setListing(data as Listing | null);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleApply() {
    if (!id) return;
    setApplying(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/internships/${id}`)}`);
      return;
    }

    const profile = await getProfile(user.id);
    if (profile?.role === 'student') {
      router.push(`/dashboard/student/internships/${id}`);
    } else {
      // Logged in but not a student — send to register (or back home)
      router.push('/register');
    }
  }

  if (loading) {
    return (
      <>
        <Header />
        <div style={{ padding: '120px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading internship...
        </div>
        <Footer />
      </>
    );
  }

  if (!listing) {
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

  return (
    <>
      <Header />

      <main style={{ background: 'var(--bg)', padding: '40px 0 80px' }}>
        <div className="container" style={{ maxWidth: 880 }}>
          <Link
            href="/internships"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--text-secondary)',
              fontSize: 14,
              marginBottom: 24,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Back to all internships
          </Link>

          {/* Header card */}
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 32,
              marginBottom: 24,
            }}
          >
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 20 }}>
              {listing.employers?.logo_url ? (
                <img
                  src={listing.employers.logo_url}
                  alt={listing.employers.company_name}
                  style={{ width: 72, height: 72, borderRadius: 14, objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 14,
                    background: 'var(--primary-light)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 28,
                    flexShrink: 0,
                  }}
                >
                  {listing.employers?.company_name?.charAt(0) ?? '?'}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ marginBottom: 10 }}><TestPostingBadge /></div>
                <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--dark)', marginBottom: 6 }}>
                  {listing.title}
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: 16, marginBottom: 4 }}>
                  {listing.employers?.company_name}
                </p>
                <p style={{ color: 'var(--text-light)', fontSize: 14 }}>{listing.industry}</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
              {listing.location && <MetaTag>{listing.location}</MetaTag>}
              {listing.is_remote && <MetaTag accent>Remote</MetaTag>}
              {listing.is_hybrid && <MetaTag accent>Hybrid</MetaTag>}
              {listing.compensation && <MetaTag accent>{listing.compensation}</MetaTag>}
              {listing.duration && <MetaTag>{listing.duration}</MetaTag>}
              {listing.application_deadline && (
                <MetaTag>Apply by {formatDate(listing.application_deadline)}</MetaTag>
              )}
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={handleApply}
                disabled={applying}
                className="btn-primary"
                style={{
                  cursor: applying ? 'wait' : 'pointer',
                  opacity: applying ? 0.7 : 1,
                  border: 'none',
                }}
              >
                {applying ? 'Loading…' : 'Apply Now'}
              </button>
              <p style={{ color: 'var(--text-light)', fontSize: 13, alignSelf: 'center' }}>
                You&apos;ll be asked to sign in before applying.
              </p>
            </div>
          </div>

          {/* Body sections */}
          <Section title="Job Overview">
            <div className="markdown-content">
              <ReactMarkdown>{listing.description}</ReactMarkdown>
            </div>
          </Section>

          {listing.key_responsibilities && (
            <Section title="Key Responsibilities">
              <div className="markdown-content">
                <ReactMarkdown>{listing.key_responsibilities}</ReactMarkdown>
              </div>
            </Section>
          )}

          {listing.requirements && (
            <Section title="Qualifications">
              <div className="markdown-content">
                <ReactMarkdown>{listing.requirements}</ReactMarkdown>
              </div>
            </Section>
          )}

          {/* Bottom CTA */}
          <div
            style={{
              background: 'linear-gradient(135deg, var(--dark) 0%, var(--dark-2) 100%)',
              borderRadius: 16,
              padding: 36,
              textAlign: 'center',
              color: '#fff',
              marginTop: 32,
            }}
          >
            <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
              Ready to apply?
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 20 }}>
              Sign in or create a free .edu account to send your application.
            </p>
            <button
              onClick={handleApply}
              disabled={applying}
              className="btn-white"
              style={{ border: 'none', cursor: applying ? 'wait' : 'pointer' }}
            >
              {applying ? 'Loading…' : 'Apply Now'}
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 28,
        marginBottom: 16,
      }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--dark)', marginBottom: 14 }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function MetaTag({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 13,
        padding: '5px 12px',
        borderRadius: 8,
        background: accent ? 'var(--primary-light)' : 'var(--bg-section)',
        color: accent ? 'var(--primary)' : 'var(--text-secondary)',
        fontWeight: accent ? 600 : 500,
      }}
    >
      {children}
    </span>
  );
}
