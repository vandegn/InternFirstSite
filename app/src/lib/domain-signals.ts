// Automated signals used to triage employer verification. These are INPUTS to a
// human review, never an auto-approve — see supabase/migrations/20260801_employer_verification.sql.
//
// Relative weight of what's here:
//   domain age            strongest — a front company can't fake an aged domain
//   free-provider email   strong negative — blocked outright at signup
//   email/website match   weak positive; a mismatch is close to meaningless on
//                         its own (subsidiaries, DBAs, franchises, marketing
//                         domains and agencies all mismatch legitimately)

// Consumer mailbox providers and disposable/relay services. An employer signing
// up on one of these is either an individual or deliberately transient, and
// either way there is no domain to verify against.
const FREE_EMAIL_PROVIDERS = new Set([
  // Major consumer providers
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in', 'ymail.com',
  'rocketmail.com', 'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'live.com', 'msn.com',
  'aol.com', 'icloud.com', 'me.com', 'mac.com', 'protonmail.com', 'protonmail.ch', 'proton.me',
  'pm.me', 'gmx.com', 'gmx.net', 'gmx.de', 'mail.com', 'email.com', 'yandex.com', 'yandex.ru',
  'zoho.com', 'tutanota.com', 'tuta.io', 'fastmail.com', 'hushmail.com', 'hey.com',
  // ISP mailboxes
  'comcast.net', 'verizon.net', 'att.net', 'sbcglobal.net', 'bellsouth.net', 'cox.net',
  'charter.net', 'earthlink.net', 'juno.com', 'roadrunner.com', 'rr.com', 'optonline.net',
  'shaw.ca', 'rogers.com', 'sympatico.ca', 'telus.net', 'btinternet.com', 'sky.com',
  'virginmedia.com', 'talktalk.net', 'ntlworld.com', 'blueyonder.co.uk', 'bigpond.com',
  'optusnet.com.au', 'xtra.co.nz',
  // Regional consumer providers
  'qq.com', '163.com', '126.com', 'yeah.net', 'sina.com', 'sohu.com', 'naver.com', 'daum.net',
  'hanmail.net', 'seznam.cz', 'web.de', 't-online.de', 'orange.fr', 'wanadoo.fr', 'free.fr',
  'laposte.net', 'sfr.fr', 'libero.it', 'virgilio.it', 'alice.it', 'tiscali.it', 'terra.com.br',
  'uol.com.br', 'bol.com.br', 'ig.com.br', 'sapo.pt', 'wp.pl', 'o2.pl', 'onet.pl', 'interia.pl',
  'abv.bg', 'mail.ru', 'bk.ru', 'list.ru', 'inbox.ru', 'rambler.ru', 'ukr.net', 'rediffmail.com',
  // Disposable / burner / relay
  'mailinator.com', 'guerrillamail.com', 'sharklasers.com', '10minutemail.com', 'yopmail.com',
  'trashmail.com', 'dispostable.com', 'maildrop.cc', 'getnada.com', 'temp-mail.org', 'tempmail.com',
  'moakt.com', 'mohmal.com', 'emailondeck.com', 'fakeinbox.com', 'spamgourmet.com', 'throwawaymail.com',
  'mytemp.email', 'tempr.email', 'discard.email', 'burnermail.io', 'anonaddy.com', 'anonaddy.me',
  'simplelogin.io', 'simplelogin.com', 'duck.com', 'relay.firefox.com', 'mozmail.com',
]);

// Multi-part public suffixes common enough to matter when reducing a hostname to
// its registrable domain. Not exhaustive — this is a heuristic for a display
// signal, not a security boundary, so an unlisted suffix just means a stricter
// comparison rather than a wrong grant.
const MULTIPART_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'net.uk', 'sch.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'id.au',
  'co.nz', 'net.nz', 'org.nz', 'ac.nz', 'govt.nz',
  'com.br', 'net.br', 'org.br', 'gov.br', 'edu.br',
  'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'go.jp',
  'co.in', 'net.in', 'org.in', 'gov.in', 'ac.in', 'edu.in',
  'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn',
  'co.za', 'org.za', 'net.za', 'gov.za', 'ac.za',
  'com.mx', 'com.ar', 'com.sg', 'com.hk', 'com.tw', 'com.tr', 'com.pl', 'com.es',
  'co.kr', 'or.kr', 'ne.kr', 'go.kr',
]);

/**
 * Reduce arbitrary user input (a full URL, a bare hostname, an email domain)
 * to a lowercase bare hostname. Returns null when nothing usable is present.
 */
export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let value = input.trim().toLowerCase();
  if (!value) return null;

  // Strip scheme, credentials, path, query, and port without requiring a valid URL.
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  value = value.replace(/^[^/@]*@/, '');
  value = value.split(/[/?#]/)[0];
  value = value.split(':')[0];
  value = value.replace(/^www\./, '');
  value = value.replace(/\.+$/, '');

  // A real hostname needs at least one dot and only host-legal characters.
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(value)) return null;
  return value;
}

/** The registrable ("apex") domain, e.g. mail.corp.acme.co.uk -> acme.co.uk. */
export function registrableDomain(domain: string | null): string | null {
  if (!domain) return null;
  const parts = domain.split('.');
  if (parts.length <= 2) return domain;

  const lastTwo = parts.slice(-2).join('.');
  if (MULTIPART_SUFFIXES.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return lastTwo;
}

export function emailDomain(email: string | null | undefined): string | null {
  if (!email || !email.includes('@')) return null;
  return normalizeDomain(email.split('@').pop());
}

export function isFreeEmailProvider(email: string | null | undefined): boolean {
  const domain = emailDomain(email);
  if (!domain) return false;
  // Check both the literal domain and its apex so `mail.gmail.com` style
  // variants and regional subdomains are caught.
  return FREE_EMAIL_PROVIDERS.has(domain) ||
    FREE_EMAIL_PROVIDERS.has(registrableDomain(domain) ?? '');
}

/** True when the email and website share a registrable domain. */
export function domainsMatch(
  emailDom: string | null,
  websiteDom: string | null,
): boolean | null {
  if (!emailDom || !websiteDom) return null;
  const a = registrableDomain(emailDom);
  const b = registrableDomain(websiteDom);
  if (!a || !b) return null;
  return a === b;
}

export type DomainRegistration = {
  registeredAt: Date | null;
  ageDays: number | null;
  error: string | null;
};

/**
 * Look up a domain's registration date over RDAP (the structured successor to
 * WHOIS). rdap.org bootstraps to the authoritative registry server.
 *
 * Failure is normal and non-fatal: plenty of ccTLDs expose no public RDAP
 * endpoint. A null age means "unknown", which the reviewer reads as "check this
 * by hand" — never as a pass.
 */
export async function fetchDomainRegistration(
  domain: string | null,
  timeoutMs = 4000,
): Promise<DomainRegistration> {
  const empty: DomainRegistration = { registeredAt: null, ageDays: null, error: null };
  const apex = registrableDomain(normalizeDomain(domain));
  if (!apex) return { ...empty, error: 'No usable domain' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(apex)}`, {
      signal: controller.signal,
      headers: { accept: 'application/rdap+json' },
    });

    if (res.status === 404) return { ...empty, error: 'Domain not found in RDAP' };
    if (!res.ok) return { ...empty, error: `RDAP lookup failed (${res.status})` };

    const body = await res.json();
    const events: { eventAction?: string; eventDate?: string }[] = body?.events ?? [];
    const registration = events.find((e) => e.eventAction === 'registration');
    if (!registration?.eventDate) return { ...empty, error: 'RDAP returned no registration date' };

    const registeredAt = new Date(registration.eventDate);
    if (Number.isNaN(registeredAt.getTime())) {
      return { ...empty, error: 'RDAP returned an unparseable date' };
    }

    const ageDays = Math.floor((Date.now() - registeredAt.getTime()) / 86_400_000);
    return { registeredAt, ageDays, error: null };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return { ...empty, error: aborted ? 'RDAP lookup timed out' : 'RDAP lookup failed' };
  } finally {
    clearTimeout(timer);
  }
}

export type VerificationSignals = {
  email_domain: string | null;
  website_domain: string | null;
  domain_match: boolean | null;
  free_email_provider: boolean;
  domain_registered_at: string | null;
  domain_age_days: number | null;
  signals_checked_at: string;
  signals_error: string | null;
};

/** Everything the reviewer sees, in the shape the `employers` columns expect. */
export async function computeVerificationSignals(
  email: string | null | undefined,
  website: string | null | undefined,
): Promise<VerificationSignals> {
  const emailDom = emailDomain(email);
  const websiteDom = normalizeDomain(website);

  // Age the website domain when there is one — that's the company's public
  // identity. Fall back to the email domain so a missing website still yields
  // a signal rather than a blank row.
  const { registeredAt, ageDays, error } = await fetchDomainRegistration(websiteDom ?? emailDom);

  return {
    email_domain: emailDom,
    website_domain: websiteDom,
    domain_match: domainsMatch(emailDom, websiteDom),
    free_email_provider: isFreeEmailProvider(email),
    domain_registered_at: registeredAt ? registeredAt.toISOString() : null,
    domain_age_days: ageDays,
    signals_checked_at: new Date().toISOString(),
    signals_error: error,
  };
}

// Triage bands for the review queue. Tuned to be conservative: "clear" means
// "safe to approve quickly", not "approve automatically".
export type TriageLevel = 'clear' | 'review' | 'suspect';

export function triageLevel(s: {
  free_email_provider?: boolean | null;
  domain_age_days?: number | null;
  domain_match?: boolean | null;
}): TriageLevel {
  if (s.free_email_provider) return 'suspect';
  // Under ~6 months is the band where purpose-built front domains cluster.
  if (s.domain_age_days != null && s.domain_age_days < 180) return 'suspect';
  if (s.domain_age_days == null) return 'review';       // unknown age, verify by hand
  if (s.domain_age_days >= 730 && s.domain_match) return 'clear';
  return 'review';
}
