import { absoluteUrl } from '@/lib/site';
import type { PublicListing } from './listing-public';

// Pure metadata and structured-data builders for a single listing. No Next, no
// Supabase, no React — generateMetadata and the page body both consume it, and
// listing-seo.test.ts covers it directly.

// Markdown, flattened for a <meta> description. Google shows ~155-160
// characters, so we cut on a word boundary just under that rather than mid-word
// with an ellipsis dangling off a half-typed noun.
export function toMetaDescription(markdown: string | null, fallback: string) {
  const text = (markdown ?? '')
    .replace(/```[\s\S]*?```/g, ' ')       // fenced code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> their text
    .replace(/[#>*_`~-]/g, ' ')            // leftover markdown punctuation
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return fallback;
  if (text.length <= 155) return text;
  return `${text.slice(0, 155).replace(/\s+\S*$/, '')}…`;
}

// A listing's public URL. One definition, used by the canonical, the OG url and
// the JobPosting `url`, so they can never disagree.
export function listingUrl(id: string) {
  return absoluteUrl(`/internships/${id}`);
}

// Employer-authored text ends up inside a <script type="application/ld+json">
// block. JSON.stringify escapes quotes and backslashes but NOT angle brackets,
// so a listing whose body contains the literal text "</script>" would close the
// tag early and let everything after it be parsed as markup. Escaping the three
// characters that matter keeps the JSON valid — < decodes back to '<' for
// any JSON parser, Google's included — while making tag breakout impossible.
export function serializeJsonLd(json: Record<string, unknown>) {
  return JSON.stringify(json)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineMarkdown(text: string) {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> their text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '$1');
}

// Google renders a JobPosting description as HTML and shows every other
// character literally — a listing written with "- " bullets and **bold**, which
// is exactly what the listing editor tells employers to write, would appear in
// the Google Jobs panel with the hyphens and asterisks visible. This converts
// that markdown subset into the tags Google documents as supported.
//
// The source is HTML-escaped BEFORE conversion, so the only tags that can reach
// the output are the ones generated here: an employer cannot inject their own
// markup through a listing body.
export function markdownToJobPostingHtml(markdown: string) {
  const blocks = escapeHtml(markdown).split(/\n\s*\n/);
  const out: string[] = [];

  for (const raw of blocks) {
    const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    if (lines.every((line) => /^[-*]\s+/.test(line))) {
      const items = lines
        .map((line) => `<li>${inlineMarkdown(line.replace(/^[-*]\s+/, ''))}</li>`)
        .join('');
      out.push(`<ul>${items}</ul>`);
      continue;
    }

    if (lines.length === 1 && /^#{1,6}\s+/.test(lines[0])) {
      const heading = inlineMarkdown(lines[0].replace(/^#{1,6}\s+/, ''));
      out.push(`<p><strong>${heading}</strong></p>`);
      continue;
    }

    out.push(`<p>${lines.map(inlineMarkdown).join('<br>')}</p>`);
  }

  return out.join('');
}

// schema.org JobPosting. This is what makes a listing eligible for the Google
// Jobs experience — the rich result that sits above the normal blue links on
// internship queries. Worth more than the page's own ranking for a job board.
//
// Deliberately omitted: `baseSalary`. Compensation is a preset string
// ("$15-20/hr", "Unpaid", "Stipend"), and Google requires a currency, a numeric
// value and a unit. Parsing those presets into a number would guess, and a
// wrong salary in structured data is a manual-action risk. Add it properly when
// compensation becomes structured on the listing itself.
export function jobPostingJsonLd(listing: PublicListing) {
  const description = markdownToJobPostingHtml(
    [listing.description, listing.requirements, listing.key_responsibilities]
      .filter(Boolean)
      .join('\n\n'),
  );

  const remote = listing.is_remote && !listing.is_hybrid;

  const json: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: listing.title,
    description,
    identifier: {
      '@type': 'PropertyValue',
      name: listing.employers?.company_name ?? 'InternFirst',
      value: listing.id,
    },
    datePosted: listing.created_at,
    employmentType: 'INTERN',
    url: listingUrl(listing.id),
    // Applications are completed on InternFirst, never off-site — the closed
    // ecosystem is exactly what this property is for.
    directApply: true,
    hiringOrganization: {
      '@type': 'Organization',
      name: listing.employers?.company_name ?? 'InternFirst employer',
      ...(listing.employers?.logo_url ? { logo: listing.employers.logo_url } : {}),
      ...(listing.employers?.website ? { sameAs: listing.employers.website } : {}),
    },
  };

  if (listing.application_deadline) {
    // Google wants an ISO 8601 datetime; the column is a date.
    json.validThrough = `${listing.application_deadline}T23:59:59`;
  }

  // `location` is free text ("Chicago, IL"), not a structured address. Google
  // accepts addressLocality on its own, so we pass the string through rather
  // than inventing a city/region split that could be wrong.
  if (listing.location) {
    json.jobLocation = {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: listing.location,
        addressCountry: 'US',
      },
    };
  }

  if (remote) {
    json.jobLocationType = 'TELECOMMUTE';
    // Required by Google whenever jobLocationType is TELECOMMUTE.
    json.applicantLocationRequirements = { '@type': 'Country', name: 'USA' };
  }

  if (listing.preferred_skills && listing.preferred_skills.length > 0) {
    json.skills = listing.preferred_skills.join(', ');
  }

  if (listing.industry) {
    json.industry = listing.industry;
  }

  return json;
}
