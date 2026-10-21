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

// Employers type listing bodies into a plain textarea, so the text is laid out
// the way it looked there, not as Markdown. Rendered raw, "-Item" (no space) is
// not a bullet and single line breaks collapse, so a whole list reads as one
// paragraph. This turns what they typed into the Markdown they meant: any
// bullet-ish marker (-, •, –, *) becomes "- ", a line break stays a line break,
// and a list is closed before a following line ("Systems Optimization:") so
// that line isn't swallowed into the last bullet. Run every listing body
// through this before handing it to ReactMarkdown.
const BULLET = /^(\s*)(?:[-–—•▪◦●]|\*(?!\*))\s*(\S.*)$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const LIST_ITEM = /^\s*(?:- |\d+[.)]\s)/;

export function normalizeListingMarkdown(body: string): string {
  const lines = body.split(/\r?\n/).map((line) => {
    if (RULE.test(line)) return line;
    const m = line.match(BULLET);
    return m ? `${m[1]}- ${m[2]}` : line;
  });

  const out: string[] = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) inFence = !inFence;
    const next = lines[i + 1];
    if (inFence || !line.trim() || next === undefined || !next.trim()) {
      out.push(line);
      continue;
    }
    if (LIST_ITEM.test(line)) {
      out.push(line);
      // An unindented non-list line ends the list; an indented one continues the item.
      if (!LIST_ITEM.test(next) && !/^\s/.test(next)) out.push('');
    } else {
      out.push(LIST_ITEM.test(next) ? line : `${line.trimEnd()}  `);
    }
  }
  return out.join('\n');
}
