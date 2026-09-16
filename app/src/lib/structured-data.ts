import { SITE_NAME, SITE_URL, absoluteUrl } from '@/lib/site';

// Site-level structured data. Per-listing JobPosting lives in listing-seo.ts —
// this file is for the nodes that describe InternFirst itself rather than one
// row in the database.

// Employer-authored text can reach a <script type="application/ld+json"> block,
// and JSON.stringify escapes quotes and backslashes but NOT angle brackets — a
// literal "</script>" would close the tag early and let the rest be parsed as
// markup. Escaping the three characters that matter keeps the JSON valid for
// any parser, Google's included, while making tag breakout impossible.
//
// Defined here and re-exported by listing-seo.ts so there is exactly one
// implementation; both call sites were otherwise a copy-paste apart.
export function serializeJsonLd(json: Record<string, unknown>) {
  return JSON.stringify(json)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

// The public profiles that prove this Organization node describes the same
// entity as the accounts people already follow. `sameAs` is what lets Google
// reconcile them into one knowledge-graph entity instead of three strangers.
const SOCIAL_PROFILES = [
  'https://www.linkedin.com/company/intern1st/',
  'https://www.instagram.com/internfirstofficial/',
  'https://www.tiktok.com/@internfirst',
];

// schema.org Organization for the homepage.
//
// `@id` is the stable identifier other nodes can point at, and it's the site
// origin by convention. `areaServed` is deliberately explicit: InternFirst is
// United States only today, and saying so in structured data is the machine-
// readable half of stating it in the FAQ.
export function organizationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    alternateName: 'Intern First',
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: absoluteUrl('/internfirst-logo.png'),
      width: 622,
      height: 98,
    },
    description:
      'InternFirst is an internship platform where students with a verified .edu email browse, apply, message, and interview entirely in-platform, and reviewed employers manage hiring end to end.',
    areaServed: {
      '@type': 'Country',
      name: 'United States',
    },
    sameAs: SOCIAL_PROFILES,
  };
}

// schema.org BreadcrumbList. Google renders it as the breadcrumb trail shown in
// place of the raw URL in a search result, which is worth having on listing
// pages whose URLs are bare UUIDs and communicate nothing on their own.
//
// `items` is ordered root-first; the last entry is the current page.
export function breadcrumbJsonLd(
  items: { name: string; path: string }[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
