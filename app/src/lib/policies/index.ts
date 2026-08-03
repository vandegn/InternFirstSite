// Legal policy content shown at signup. Sourced from the canonical PDFs in the
// repo root (Student/Employer Terms & Conditions and Privacy Policy) and
// converted to structured blocks so the signup modal can render them as real
// HTML and reliably detect when the user has scrolled through — a PDF embed
// cannot report scroll-to-bottom, which the mandatory-acknowledgement flow needs.
//
// To refresh after the PDFs change, re-run the conversion that produced
// content.json (see the register flow notes) — do not hand-edit block text.
import content from './content.json';

export type PolicyBlock = { type: 'h' | 'p' | 'li'; text: string };

export type PolicyDoc = {
  title: string;
  version: string;
  effectiveDate: string;
  blocks: PolicyBlock[];
};

const RAW_DOCS = content as Record<string, PolicyDoc>;

// The source PDFs ship with bracketed vendor placeholders. We resolve them here
// (rather than in content.json) so the fills survive a PDF re-conversion and are
// reviewable in one place. Map a placeholder to its replacement text, or to ''
// to drop the line entirely when the service isn't used.
//
// NOTE: the canonical PDFs still contain these brackets — update them there too
// for the legal record. Values below reflect the current stack (see package.json).
const PLACEHOLDER_FILLS: Record<string, string> = {
  '[Email or SMTP Provider]': 'Resend, for transactional and notification email delivery',
  '[Calendar or Video Provider]': 'LiveKit, for interview video, audio, and real-time communication',
  '[Hosting or Deployment Provider]': 'Vercel, for application hosting and deployment',
  // Employer domain verification is performed in-house (see lib/domain-signals),
  // so there is no external provider to name — drop the "if added" line.
  '[Website or Domain Verification Provider, if added]': '',
  // No external analytics/error-monitoring or support vendor is in use — drop
  // these service-provider bullets rather than name a placeholder.
  '[Analytics or Error Monitoring Provider]': '',
  '[Customer Support Provider]': '',
  // No public policy-archive page; keep only "retained internally" by removing
  // the trailing clause (matched as a phrase so no dangling "or at" remains).
  ' or at [Policy Archive URL]': '',
};

function resolvePlaceholders(doc: PolicyDoc): PolicyDoc {
  const blocks: PolicyBlock[] = [];
  for (const b of doc.blocks) {
    let text = b.text;
    for (const [needle, fill] of Object.entries(PLACEHOLDER_FILLS)) {
      if (text.includes(needle)) text = text.split(needle).join(fill);
    }
    if (text.trim() === '') continue; // fully-emptied placeholder line — omit it
    blocks.push({ ...b, text });
  }
  return { ...doc, blocks };
}

const DOCS: Record<string, PolicyDoc> = Object.fromEntries(
  Object.entries(RAW_DOCS).map(([k, v]) => [k, resolvePlaceholders(v)]),
);

export type PolicyRole = 'student' | 'employer';

// The two documents a user must acknowledge, in reading order: Terms first,
// then the Privacy Policy it incorporates.
export function getPoliciesForRole(role: PolicyRole): PolicyDoc[] {
  return [DOCS[`${role}_terms`], DOCS[`${role}_privacy`]].filter(Boolean);
}

export type PolicyKind = 'terms' | 'privacy';

export function getPolicyDoc(role: PolicyRole, kind: PolicyKind): PolicyDoc {
  return DOCS[`${role}_${kind}`];
}

// Version pair a user accepts at signup. Stamped into user_metadata by the
// register page and recorded to policy_acceptances by /auth/callback.
export function getPolicyVersions(role: PolicyRole): { terms: string; privacy: string } {
  return { terms: DOCS[`${role}_terms`].version, privacy: DOCS[`${role}_privacy`].version };
}
