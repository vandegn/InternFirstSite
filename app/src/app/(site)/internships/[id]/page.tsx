import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ListingBanner, RoleTagPills } from '@/components/ListingCustomBlocks';
import { normalizeSectionOrder, CORE_SECTIONS } from '@/lib/listing-sections';
import { SITE_NAME } from '@/lib/site';
import ApplyButton from './ApplyButton';
import {
  getPublicListing,
  getPublicListingSections,
  type PublicListing,
} from '@/lib/listing-public';
import { jobPostingJsonLd, listingUrl, serializeJsonLd, toMetaDescription } from '@/lib/listing-seo';

// This page was entirely client-rendered: the server sent "Loading internship..."
// and the role, the company, and the description only existed after the browser
// ran JS and made two round trips. Every one of these URLs is in sitemap.xml, so
// we were inviting Google to index thousands of pages whose HTML was one
// sentence long and whose <title> was the bare site fallback.
//
// It's a server component now — same layout, same apply flow (see
// ApplyButton.tsx), but the listing is in the initial HTML along with a real
// title, description, canonical, and JobPosting structured data.
//
// ISR, matching /internships: listings change on the order of hours, and this
// keeps crawler traffic off the database.
export const revalidate = 3600;

type PageProps = { params: Promise<{ id: string }> };

// A listing that isn't live shouldn't sit in the index. RLS already hides
// non-public rows from the anon client, but status is restated here for the
// same reason sitemap.ts restates it: a policy change shouldn't be able to
// quietly start serving indexable pages for closed roles.
function isPubliclyVisible(listing: PublicListing) {
  if (listing.status && listing.status !== 'active') return false;
  if (listing.application_deadline) {
    const today = new Date().toISOString().slice(0, 10);
    if (listing.application_deadline < today) return false;
  }
  return true;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const listing = await getPublicListing(id);

  if (!listing || !isPubliclyVisible(listing)) {
    // Nothing to describe, and nothing that should be indexed.
    return { title: 'Internship not found', robots: { index: false, follow: true } };
  }

  const company = listing.employers?.company_name ?? SITE_NAME;
  const where = listing.location ?? (listing.is_remote ? 'Remote' : null);

  // "Marketing Intern at Acme (Chicago, IL)" — the role and the company are what
  // students actually search, so both go in front of the brand.
  const title = [`${listing.title} at ${company}`, where ? `(${where})` : null]
    .filter(Boolean)
    .join(' ');

  const description = toMetaDescription(
    listing.description,
    `${listing.title} at ${company}. Apply on InternFirst — browse and apply with a verified .edu account.`,
  );

  const url = listingUrl(listing.id);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      siteName: SITE_NAME,
      locale: 'en_US',
      url,
      title: `${title} | ${SITE_NAME}`,
      description,
      // The employer's own banner makes a far better share card than the
      // generic site one when they've uploaded a real image.
      images: listing.banner_url ? [listing.banner_url] : ['/opengraph-image'],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [listing.banner_url ?? '/opengraph-image'],
    },
  };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function PublicListingDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [listing, sections] = await Promise.all([
    getPublicListing(id),
    getPublicListingSections(id),
  ]);

  // A real 404, not the soft 404 this page used to serve. A 200 response saying
  // "Internship not found" is a page Google will index and then flag.
  if (!listing || !isPubliclyVisible(listing)) notFound();

  return (
    <>
      {/* Structured data for the Google Jobs rich result. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jobPostingJsonLd(listing)) }}
      />

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
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 32,
              marginBottom: 24,
            }}
          >
            <ListingBanner bannerUrl={listing.banner_url} accentColor={listing.accent_color} />

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

            <RoleTagPills tags={listing.role_tags} />

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <ApplyButton listingId={listing.id} className="btn-primary" />
              <p style={{ color: 'var(--text-light)', fontSize: 13, alignSelf: 'center' }}>
                You&apos;ll be asked to sign in before applying.
              </p>
            </div>
          </div>

          {/* Body sections, in the order the employer arranged them. This page
              wraps each one in its own card, so it maps the order itself
              rather than using the shared ListingCoreSectionsView. */}
          {normalizeSectionOrder(listing.section_order).map((key) => {
            const body = listing[key];
            if (!body) return null;
            return (
              <Section key={key} title={CORE_SECTIONS[key].label}>
                <div className="markdown-content">
                  <ReactMarkdown>{body}</ReactMarkdown>
                </div>
              </Section>
            );
          })}

          {listing.preferred_skills && listing.preferred_skills.length > 0 && (
            <Section title="Preferred Skills">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {listing.preferred_skills.map((skill) => (
                  <span key={skill} style={{
                    padding: '4px 12px', borderRadius: 6, fontSize: '0.8rem',
                    background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 500,
                  }}>{skill}</span>
                ))}
              </div>
            </Section>
          )}

          {/* Employer's custom sections. This page uses card-per-section
              styling, so they're rendered through Section rather than the
              shared ListingCustomBlocks used on the dashboard pages. */}
          {sections.map((section) => (
            <Section key={section.id} title={section.heading} accentColor={listing.accent_color}>
              <div className="markdown-content">
                <ReactMarkdown>{section.body}</ReactMarkdown>
              </div>
            </Section>
          ))}

          {/* Bottom CTA */}
          <div
            style={{
              background: 'linear-gradient(135deg, var(--panel-dark) 0%, var(--panel-dark-2) 100%)',
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
            <ApplyButton listingId={listing.id} className="btn-white" />
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}

function Section({ title, children, accentColor }: { title: string; children: React.ReactNode; accentColor?: string | null }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 28,
        marginBottom: 16,
      }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--dark)', marginBottom: accentColor ? 8 : 14 }}>
        {title}
      </h2>
      {accentColor && (
        <div style={{ width: 32, height: 3, borderRadius: 999, background: accentColor, marginBottom: 14 }} />
      )}
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
