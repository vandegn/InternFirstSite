import { describe, it, expect } from 'vitest';
import {
  toMetaDescription,
  listingUrl,
  jobPostingJsonLd,
  markdownToJobPostingHtml,
  serializeJsonLd,
} from './listing-seo';
import type { PublicListing } from './listing-public';

// The listing detail page is server-rendered against live Supabase data, so the
// interesting parts to pin down are the pure ones: what we put in <meta> and
// what we hand Google as JobPosting structured data. A wrong value in either is
// invisible in the UI and expensive in search.

function makeListing(overrides: Partial<PublicListing> = {}): PublicListing {
  return {
    id: '11111111-2222-3333-4444-555555555555',
    title: 'Marketing Intern',
    description: 'Support the marketing team on campaigns.',
    location: 'Chicago, IL',
    is_remote: false,
    is_hybrid: false,
    compensation: '$15-20/hr',
    requirements: 'Rising junior or senior.',
    industry: 'Marketing',
    created_at: '2026-08-01T12:00:00.000Z',
    application_deadline: null,
    key_responsibilities: 'Draft copy. Report on performance.',
    section_order: null,
    preferred_skills: ['Copywriting', 'Analytics'],
    duration: 'Summer',
    role_tags: null,
    banner_url: null,
    accent_color: null,
    status: 'active',
    employers: {
      company_name: 'Acme Co',
      logo_url: 'https://cdn.example.com/acme.png',
      website: 'https://acme.example.com',
    },
    ...overrides,
  };
}

describe('toMetaDescription', () => {
  it('falls back when the listing has no overview', () => {
    expect(toMetaDescription(null, 'fallback text')).toBe('fallback text');
    expect(toMetaDescription('   ', 'fallback text')).toBe('fallback text');
  });

  it('strips markdown rather than shipping it into the SERP', () => {
    const out = toMetaDescription('## Role\n\n- Build **things**\n- Ship `code`', 'fallback');
    expect(out).not.toMatch(/[#*`]/);
    expect(out).toContain('Build things');
  });

  it('keeps link text and drops the URL', () => {
    const out = toMetaDescription('See [our handbook](https://example.com/handbook).', 'fallback');
    expect(out).toContain('our handbook');
    expect(out).not.toContain('example.com');
  });

  it('truncates on a word boundary, not mid-word', () => {
    const out = toMetaDescription(`${'word '.repeat(60)}finalword`, 'fallback');
    expect(out.length).toBeLessThanOrEqual(156);
    expect(out.endsWith('…')).toBe(true);
    // The character before the ellipsis is the end of a whole word, never a
    // half-cut one followed by a space.
    expect(out).not.toMatch(/\s…$/);
  });

  it('leaves a short description alone', () => {
    expect(toMetaDescription('Short and sweet.', 'fallback')).toBe('Short and sweet.');
  });
});

describe('listingUrl', () => {
  it('is absolute and matches the sitemap shape', () => {
    expect(listingUrl('abc')).toBe('https://www.intern-first.com/internships/abc');
  });
});

describe('jobPostingJsonLd', () => {
  it('emits the fields Google requires for a JobPosting', () => {
    const json = jobPostingJsonLd(makeListing());

    expect(json['@context']).toBe('https://schema.org');
    expect(json['@type']).toBe('JobPosting');
    expect(json.title).toBe('Marketing Intern');
    expect(json.datePosted).toBe('2026-08-01T12:00:00.000Z');
    expect(json.employmentType).toBe('INTERN');
    expect(json.hiringOrganization).toMatchObject({ name: 'Acme Co' });
    expect(json.url).toBe(listingUrl('11111111-2222-3333-4444-555555555555'));
  });

  it('rolls all three core sections into the description', () => {
    const description = jobPostingJsonLd(makeListing()).description as string;
    expect(description).toContain('Support the marketing team');
    expect(description).toContain('Rising junior or senior');
    expect(description).toContain('Draft copy');
  });

  it('sends the description as HTML, not raw markdown', () => {
    const description = jobPostingJsonLd(
      makeListing({ description: `Work with **great** people.

- One
- Two` }),
    ) as { description: string };
    expect(description.description).toContain('<strong>great</strong>');
    expect(description.description).toContain('<li>One</li>');
    // Asterisks and hyphens would render literally in the Google Jobs panel.
    expect(description.description).not.toContain('**');
    expect(description.description).not.toMatch(/^- /m);
  });

  it('marks applications as on-platform — the whole point of the closed ecosystem', () => {
    expect(jobPostingJsonLd(makeListing()).directApply).toBe(true);
  });

  it('never guesses a salary from the compensation preset', () => {
    // "$15-20/hr" cannot be turned into a currency/value/unit without guessing,
    // and a wrong baseSalary is a manual-action risk.
    expect(jobPostingJsonLd(makeListing()).baseSalary).toBeUndefined();
    expect(jobPostingJsonLd(makeListing({ compensation: 'Unpaid' })).baseSalary).toBeUndefined();
  });

  it('turns an application deadline into an ISO validThrough', () => {
    const json = jobPostingJsonLd(makeListing({ application_deadline: '2026-12-31' }));
    expect(json.validThrough).toBe('2026-12-31T23:59:59');
  });

  it('omits validThrough entirely when there is no deadline', () => {
    expect(jobPostingJsonLd(makeListing()).validThrough).toBeUndefined();
  });

  it('passes the free-text location through as addressLocality', () => {
    const json = jobPostingJsonLd(makeListing());
    expect(json.jobLocation).toEqual({
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Chicago, IL',
        addressCountry: 'US',
      },
    });
  });

  it('adds the applicant-location requirement Google demands for remote roles', () => {
    const json = jobPostingJsonLd(makeListing({ is_remote: true, location: null }));
    expect(json.jobLocationType).toBe('TELECOMMUTE');
    expect(json.applicantLocationRequirements).toEqual({ '@type': 'Country', name: 'USA' });
  });

  it('does not call a hybrid role TELECOMMUTE — it has a real office', () => {
    const json = jobPostingJsonLd(makeListing({ is_remote: true, is_hybrid: true }));
    expect(json.jobLocationType).toBeUndefined();
    expect(json.jobLocation).toBeDefined();
  });

  it('survives an employer with no logo or website', () => {
    const json = jobPostingJsonLd(
      makeListing({ employers: { company_name: 'Bare Co', logo_url: null } }),
    );
    expect(json.hiringOrganization).toEqual({ '@type': 'Organization', name: 'Bare Co' });
  });

  it('serialises to valid JSON — it is injected via dangerouslySetInnerHTML', () => {
    const json = jobPostingJsonLd(makeListing({ title: 'Intern "Quotes" & <script>' }));
    expect(() => JSON.parse(JSON.stringify(json))).not.toThrow();
  });
});

describe('markdownToJobPostingHtml', () => {
  it('turns a hyphen list into a real <ul>', () => {
    expect(markdownToJobPostingHtml(`- One
- Two`)).toBe('<ul><li>One</li><li>Two</li></ul>');
  });

  it('keeps paragraphs separate and joins wrapped lines with <br>', () => {
    expect(markdownToJobPostingHtml(`First line
second line

New para`)).toBe(
      '<p>First line<br>second line</p><p>New para</p>',
    );
  });

  it('promotes a markdown heading to bold text', () => {
    expect(markdownToJobPostingHtml('## What you will do')).toBe(
      '<p><strong>What you will do</strong></p>',
    );
  });

  it('renders bold and italic', () => {
    expect(markdownToJobPostingHtml('a **b** and *c*')).toBe('<p>a <strong>b</strong> and <em>c</em></p>');
  });

  it('escapes employer-authored HTML instead of passing it through', () => {
    const out = markdownToJobPostingHtml('<img src=x onerror=alert(1)>');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img');
  });

  it('drops link URLs but keeps the text', () => {
    expect(markdownToJobPostingHtml('See [the guide](https://evil.example.com)')).toBe(
      '<p>See the guide</p>',
    );
  });

  it('produces nothing from empty input', () => {
    expect(markdownToJobPostingHtml('')).toBe('');
    expect(markdownToJobPostingHtml('\n\n  \n')).toBe('');
  });
});

describe('serializeJsonLd', () => {
  // This block is injected with dangerouslySetInnerHTML. JSON.stringify alone
  // does not escape angle brackets, so listing text could close the script tag.
  it('escapes angle brackets so a listing cannot break out of the script tag', () => {
    const out = serializeJsonLd(jobPostingJsonLd(makeListing({ title: 'Intern</script><script>x' })));
    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<script>');
    // The six literal characters backslash-u-0-0-3-c, not the '<' they encode.
    expect(out).toContain(String.raw`\u003c`);
  });

  it('still parses as the same JSON after escaping', () => {
    const json = jobPostingJsonLd(makeListing({ title: 'A < B & C > D' }));
    expect(JSON.parse(serializeJsonLd(json))).toEqual(JSON.parse(JSON.stringify(json)));
  });
});
