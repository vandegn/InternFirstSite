// Pure, framework-free description of a listing's three core sections. This
// lives outside ListingCoreSections.tsx because that file is a 'use client'
// module: a server component importing from it gets client *references*, not
// real functions, so calling normalizeSectionOrder there would throw. The
// public listing page (a server component) and the dashboard editors (client
// components) both need these, so they belong on neutral ground.

// The three sections every listing must have. They render in the employer's
// chosen order on the posting, the live preview, and the student detail page —
// see internship_listings.section_order.
export type CoreSectionKey = 'description' | 'requirements' | 'key_responsibilities';

export const CORE_SECTION_KEYS: CoreSectionKey[] = ['description', 'requirements', 'key_responsibilities'];

// Qualifications first is the default for new listings; employers said it's
// what students skim for. Existing listings keep the order they were authored
// in (the migration backfills them).
export const DEFAULT_SECTION_ORDER: CoreSectionKey[] = ['requirements', 'description', 'key_responsibilities'];

export const CORE_SECTIONS: Record<CoreSectionKey, { label: string; placeholder: string }> = {
  requirements: {
    label: 'Qualifications',
    placeholder: 'List skills, qualifications, or experience needed...\n\nTip: Use - for bullet points',
  },
  description: {
    label: 'Job Overview',
    placeholder: 'Describe the role and what the intern will learn...\n\nTip: Use - for bullet points',
  },
  key_responsibilities: {
    label: 'Key Responsibilities',
    placeholder: 'List the main duties and responsibilities of the role...\n\nTip: Use - for bullet points',
  },
};

// Repairs anything that isn't exactly the three keys — a listing saved before
// section_order existed, or a hand-edited row — so a missing key can never
// make a section vanish from the page.
export function normalizeSectionOrder(order: unknown): CoreSectionKey[] {
  const raw = Array.isArray(order) ? order.filter((k): k is CoreSectionKey => CORE_SECTION_KEYS.includes(k as CoreSectionKey)) : [];
  const seen = new Set<CoreSectionKey>();
  const out: CoreSectionKey[] = [];
  for (const key of raw) {
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  for (const key of DEFAULT_SECTION_ORDER) {
    if (!seen.has(key)) out.push(key);
  }
  return out;
}
